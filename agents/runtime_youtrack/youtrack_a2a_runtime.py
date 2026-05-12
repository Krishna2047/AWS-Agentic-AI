#!/usr/bin/env python3
"""YouTrack Operations A2A Runtime — uses Direct REST API (no Gateway MCP).

Bypasses the complex Gateway MCP wrapper in favor of direct REST API calls,
matching the proven Flask sample pattern. This eliminates authentication issues.
"""
import logging
import os
import json
import asyncio
from typing import Any

# Load environment variables from env_config.txt bundled during deployment
if os.path.exists('env_config.txt'):
    with open('env_config.txt', 'r', encoding='utf-8', errors='ignore') as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#'):
                try:
                    _k, _v = _line.split('=', 1)
                    os.environ.setdefault(_k, _v)
                except ValueError:
                    pass

import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from strands import Agent
from strands.models import BedrockModel
from strands.multiagent.a2a import A2AServer
from youtrack_direct_client import get_youtrack_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL = os.getenv('MODEL_ID', os.getenv('MODEL', 'global.anthropic.claude-sonnet-4-20250514-v1:0'))
MAX_TOKENS = int(os.getenv('MAX_TOKENS', '4096'))
_runtime_url = os.environ.get("AGENTCORE_RUNTIME_URL", "http://127.0.0.1:9000/")

YOUTRACK_PROMPT = """You are a YouTrack operations specialist for an MSP operations platform.

Your capabilities:
- Create incident issues in the configured YouTrack project
- Look up existing issues by ID, query, or project
- Update issue summaries and descriptions
- Add issue comments with remediation details
- Apply workflow commands to move issues to a resolved state
- Optionally list projects if the configured project id needs verification

Important guidelines:
- You MUST call a YouTrack tool before answering any create, update, list, or search request
- Use the configured project id from the prompt context unless the user explicitly asks for another project
- If project.id is already provided, use it directly in createIssue without extra lookup
- Prefer concise issue summaries and detailed markdown/plain-text descriptions
- When closing an issue, add a comment first and then use applyCommand with a resolved-state query like Fixed, Done, or Resolved
- Format issue URLs as {base_url}/issue/ISSUE-ID when the issue idReadable is available
- Be explicit about which YouTrack action was taken and its result
- Never output pseudo-code, XML, function-call markup, or raw tool syntax in the final answer
- If the API returns 401 or Unauthorized, say the configured YouTrack permanent token is invalid, expired, or missing the required permissions
- Never tell the user to configure AWS accounts or use the Accounts section for YouTrack operations; YouTrack actions depend on YouTrack API access, not AWS account selection
"""


class YouTrackToolAdapter:
    """Wraps direct YouTrack client to work with Strands Agent tool interface."""

    def __init__(self, client):
        self.client = client

    def create_issue(self, summary: str, description: str = "") -> dict:
        """Create a YouTrack issue directly using REST API."""
        logger.info(f"[Tool] Creating YouTrack issue: {summary}")
        result = self.client.create_issue(summary=summary, description=description)
        logger.info(f"[Tool] Result: {json.dumps(result, default=str)}")
        return result

    def test_connection(self) -> dict:
        """Test YouTrack API connectivity."""
        logger.info("[Tool] Testing YouTrack connection")
        success = self.client.test_connection()
        return {"success": success, "message": "Connection test completed"}


def _create_direct_tools():
    """Create tool-like objects for Strands Agent from YouTrack direct client."""
    try:
        client = get_youtrack_client()
        adapter = YouTrackToolAdapter(client)

        class DirectTool:
            def __init__(self, name, func, description, input_schema):
                self.name = name
                self.func = func
                self.description = description
                self.tool_spec = {
                    'name': name,
                    'description': description,
                    'inputSchema': {'json': {'type': 'object', 'properties': input_schema}}
                }

            def stream(self, tool_use, invocation_state=None, **kwargs):
                tool_input = tool_use.get("input", {})
                logger.info(f"[DirectTool] Executing {self.name} with input: {json.dumps(tool_input, default=str)}")
                try:
                    result = self.func(**tool_input)
                    logger.info(f"[DirectTool] {self.name} succeeded: {json.dumps(result, default=str)}")
                    yield {
                        "type": "text",
                        "text": json.dumps(result, indent=2, default=str)
                    }
                except Exception as e:
                    logger.error(f"[DirectTool] {self.name} failed: {e}")
                    yield {
                        "type": "text",
                        "text": json.dumps({"error": str(e)}, indent=2)
                    }

        tools = [
            DirectTool(
                "create_issue",
                adapter.create_issue,
                "Create a new YouTrack issue in the configured project",
                {
                    "summary": {"type": "string", "description": "Issue title/summary"},
                    "description": {"type": "string", "description": "Detailed description (optional)"}
                }
            ),
            DirectTool(
                "test_connection",
                adapter.test_connection,
                "Test YouTrack API connectivity",
                {}
            ),
        ]
        logger.info(f"[DirectTools] Created {len(tools)} YouTrack tools")
        return tools
    except Exception as e:
        logger.error(f"[DirectTools] Failed to create tools: {e}")
        raise


_agent = None
_a2a_server = None


def _get_agent():
    """Lazily initialize Agent with direct YouTrack tools."""
    global _agent
    if _agent is None:
        logger.info("Initializing YouTrack Agent with direct REST API tools...")
        try:
            tools = _create_direct_tools()
            _agent = Agent(
                name="YouTrack Operations Manager",
                description="Manages YouTrack issues for AWS incidents and operations",
                model=BedrockModel(model_id=MODEL, max_tokens=MAX_TOKENS),
                tools=tools,
                system_prompt=YOUTRACK_PROMPT,
                callback_handler=None,
            )
            logger.info("YouTrack Agent initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize agent: {e}")
            raise
    return _agent


def _get_a2a_server():
    """Lazily initialize the A2A server with direct-client agent."""
    global _agent, _a2a_server
    if _a2a_server is None:
        logger.info("Initializing A2A server...")
        agent = _get_agent()
        _a2a_server = A2AServer(agent=agent, http_url=_runtime_url, serve_at_root=True)
        logger.info("YouTrack A2A server initialized")
    return _a2a_server


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def ping():
    return {"status": "healthy", "agent": "youtrack"}


class _LazyA2AApp:
    """ASGI wrapper that lazily initializes the A2A server on first request."""

    async def __call__(self, scope, receive, send):
        if scope["type"] == "lifespan":
            await receive()
            await send({"type": "lifespan.startup.complete"})
            await receive()
            await send({"type": "lifespan.shutdown.complete"})
            return
        try:
            await _get_a2a_server().to_fastapi_app()(scope, receive, send)
        except Exception:
            logger.exception("YouTrack A2A request failed")
            raise


def create_app() -> FastAPI:
    app = FastAPI(title="YouTrack Operations A2A Runtime", lifespan=lifespan)
    app.add_api_route("/ping", ping, methods=["GET"])
    app.mount("/", _LazyA2AApp())
    logger.info("YouTrack A2A Runtime ready (direct REST API)")
    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9000)  # nosec B104
