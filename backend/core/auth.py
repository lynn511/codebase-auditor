"""JWT verification using Supabase Auth."""
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Singleton — Lambda reuses the execution context across warm invocations,
# so one client instance is shared across all requests in the same container.
_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SECRET_KEY", "")
    if not url or not key:
        return None
    from supabase import create_client
    _client = create_client(url, key)
    return _client


def get_user_id(token: str) -> Optional[str]:
    """Verify a Supabase JWT and return the user_id, or None if invalid/unconfigured."""
    if not token:
        return None
    client = _get_client()
    if client is None:
        logger.debug("Supabase not configured — skipping JWT verification")
        return None
    try:
        response = client.auth.get_user(token)
        return response.user.id if response.user else None
    except Exception as e:
        logger.warning("JWT verification failed", extra={"error": str(e)})
        return None
