#!/usr/bin/env python3
"""YouTrack Operations A2A Runtime — uses Gateway MCP for YouTrack API access.

The file path remains under runtime_youtrack/ to minimize deployment churn, but the
runtime itself is now fully configured for YouTrack-based issue management.
"""
import logging
import os

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
from gateway_client import ResilientMCPClientManager
from context_tools import create_context_agent, create_a2a_server

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

YOUTRACK_PROMPT = """You are a YouTrack operations specialist for an MSP operations platform.

Your capabilities:
- Create incident issues in the configured YouTrack project
- Look up existing issues by ID, query, or project
- Update issue summaries and descriptions
- Add issue comments with remediation details
- Apply workflow commands to move issues to a resolved state
- List projects to resolve the configured project short name to a project id

Important guidelines:
- Use the configured project short name from the prompt context unless the user explicitly asks for another project
- To create an issue, first resolve the project via listProjects, then use its database id in createIssue
- Prefer concise issue summaries and detailed markdown/plain-text descriptions
- When closing an issue, add a comment first and then use applyCommand with a resolved-state query like Fixed, Done, or Resolved
- Format issue URLs as {base_url}/issue/ISSUE-ID when the issue idReadable is available
- Be explicit about which YouTrack action was taken and its result
"""

_client_mgr = None
_a2a_server = None
_runtime_url = os.environ.get("AGENTCORE_RUNTIME_URL", "http://127.0.0.1:9000/")


def _get_a2a_server():
    """Lazily initialize the A2A server with Gateway MCP connection on first use."""
    global _client_mgr, _a2a_server
    if _a2a_server is None:
        logger.info("Lazy init: connecting to Gateway MCP...")
        _client_mgr = ResilientMCPClientManager()
        mcp_client = _client_mgr.get_client()
        agent = create_context_agent(
            name="YouTrack Operations Manager",
            description="Manages YouTrack issues for AWS incidents and operations",
            system_prompt=YOUTRACK_PROMPT,
            mcp_client=mcp_client,
        )
        _a2a_server = create_a2a_server(agent, _runtime_url)
        logger.info("YouTrack Operations A2A server initialized")
    return _a2a_server


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    if _client_mgr:
        _client_mgr.close()


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
            logger.exception("YouTrack A2A request failed during lazy init or request handling")
            raise


def create_app() -> FastAPI:
    app = FastAPI(title="YouTrack Operations A2A Runtime", lifespan=lifespan)
    app.add_api_route("/ping", ping, methods=["GET"])
    app.mount("/", _LazyA2AApp())
    logger.info("YouTrack A2A Runtime ready (Gateway connection deferred to first request)")
    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9000)  # nosec B104
