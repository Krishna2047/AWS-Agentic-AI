#!/usr/bin/env python3
"""
Direct YouTrack API Client (bypassing Gateway MCP).

This client uses the EXACT SAME PATTERN as the working Flask example:
- Bearer token authentication
- Direct POST to /api/issues endpoint
- Project structure: {"id": PROJECT_ID}
- Status code checks for 200 or 201

This fixes issues where the Gateway MCP wrapper adds complexity.
"""
import os
import requests
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class DirectYouTrackClient:
    """Direct YouTrack API client using the proven Flask pattern."""

    def __init__(self):
        self.base_url = os.getenv("YOUTRACK_URL", "").strip()
        self.token = os.getenv("YOUTRACK_TOKEN", "").strip()
        self.project_id = os.getenv("YOUTRACK_PROJECT_ID", "").strip()

        logger.info(f"[YouTrack Client Init]")
        logger.info(f"  URL: {self.base_url}")
        logger.info(f"  Token: {self.token[:20]}..." if self.token else "  Token: NOT SET")
        logger.info(f"  Project ID: {self.project_id}")

        if not all([self.base_url, self.token, self.project_id]):
            raise ValueError(
                "Missing YouTrack config: "
                f"URL={bool(self.base_url)}, "
                f"TOKEN={bool(self.token)}, "
                f"PROJECT_ID={bool(self.project_id)}"
            )

    def create_issue(
        self,
        summary: str,
        description: str = "",
        tags: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Create issue using EXACT same pattern as Flask example.

        Args:
            summary: Issue title/summary
            description: Detailed description
            tags: Optional list of tag strings (NOTE: YouTrack requires tag IDs, not names)

        Returns:
            {
                "success": bool,
                "issue_id": str (or "Unknown" if not returned),
                "data": full response,
                "error": str (if failed)
            }
        """
        try:
            # EXACT URL from Flask example
            url = f"{self.base_url}/api/issues?fields=idReadable,summary"

            # EXACT headers from Flask example - critical: Bearer {token}
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }

            # EXACT payload structure from Flask example
            payload = {
                "project": {
                    "id": self.project_id
                },
                "summary": summary,
                "description": description
            }

            # Note: Tags require YouTrack tag IDs, not names.
            # For now, we skip tags since the API requires tag IDs.
            # To use tags, first query the tags endpoint to get tag IDs.

            logger.info(f"[YouTrack API] Creating issue: {summary[:60]}")
            logger.debug(f"[YouTrack API] URL: {url}")
            logger.debug(f"[YouTrack API] Headers: Authorization=Bearer ***, Content-Type=application/json")
            logger.debug(f"[YouTrack API] Payload: {json.dumps(payload, indent=2)}")

            # POST request (same as Flask)
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=30
            )

            logger.info(f"[YouTrack API] Response Status: {response.status_code}")
            logger.debug(f"[YouTrack API] Response Body: {response.text[:500]}")

            # Check for success (200 or 201) - same as Flask
            if response.status_code in [200, 201]:
                data = response.json()
                issue_id = data.get("idReadable", data.get("id", "Unknown"))

                logger.info(f"[YouTrack API] ✅ SUCCESS - Issue created: {issue_id}")

                return {
                    "success": True,
                    "issue_id": issue_id,
                    "data": data
                }
            else:
                # Error response
                error_msg = response.text or f"HTTP {response.status_code}"

                logger.error(f"[YouTrack API] ❌ FAILED - {response.status_code}: {error_msg[:200]}")

                # Check for 401 Unauthorized (common issue)
                if response.status_code == 401:
                    error_msg = (
                        "❌ YouTrack Unauthorized (401): "
                        "Token is invalid, expired, or doesn't have required permissions. "
                        "Verify: (1) Token exists, (2) Token scope is ONLY 'YouTrack' (not Administration), "
                        "(3) Token is not expired"
                    )
                    logger.error(f"[YouTrack API] {error_msg}")

                return {
                    "success": False,
                    "error": error_msg,
                    "status_code": response.status_code
                }

        except requests.exceptions.Timeout as e:
            logger.error(f"[YouTrack API] ❌ Timeout: {e}")
            return {"success": False, "error": f"Request timeout: {str(e)}"}

        except requests.exceptions.ConnectionError as e:
            logger.error(f"[YouTrack API] ❌ Connection error: {e}")
            return {"success": False, "error": f"Connection failed: {str(e)}"}

        except requests.exceptions.RequestException as e:
            logger.error(f"[YouTrack API] ❌ Request error: {e}")
            return {"success": False, "error": f"Request error: {str(e)}"}

        except json.JSONDecodeError as e:
            logger.error(f"[YouTrack API] ❌ JSON decode error: {e}")
            return {"success": False, "error": f"Invalid JSON response: {str(e)}"}

        except Exception as e:
            logger.error(f"[YouTrack API] ❌ Unexpected error: {e}")
            return {"success": False, "error": f"Unexpected error: {str(e)}"}

    def test_connection(self) -> bool:
        """Test if YouTrack connection works."""
        try:
            logger.info("[YouTrack Client] Testing connection...")

            # Try to create a test issue
            result = self.create_issue(
                summary="[TEST] Connection Test",
                description="This is a test issue to verify YouTrack API connectivity"
            )

            if result["success"]:
                logger.info(f"[YouTrack Client] ✅ Connection OK - Test issue: {result['issue_id']}")
                return True
            else:
                logger.error(f"[YouTrack Client] ❌ Connection FAILED - {result['error']}")
                return False

        except Exception as e:
            logger.error(f"[YouTrack Client] ❌ Connection test error: {e}")
            return False


# Module-level singleton
_client = None


def get_youtrack_client() -> DirectYouTrackClient:
    """Get or create singleton client."""
    global _client
    if _client is None:
        _client = DirectYouTrackClient()
    return _client


if __name__ == "__main__":
    # Test the client
    logging.basicConfig(level=logging.DEBUG)

    client = get_youtrack_client()
    success = client.test_connection()

    if success:
        print("\n✅ Direct YouTrack client works!")
    else:
        print("\n❌ Direct YouTrack client failed")
        exit(1)
