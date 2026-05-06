"""Persist audit results to Supabase."""
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Singleton — reused across Lambda warm invocations.
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


def save_audit(user_id: str, repo: str, report: dict) -> Optional[str]:
    """Save an audit to Supabase. Returns the new audit ID or None if unconfigured/failed.

    Degrades gracefully — a missing Supabase config never breaks the audit response.
    """
    client = _get_client()
    if client is None:
        logger.debug("Supabase not configured — skipping audit persistence")
        return None

    raw_score = report.get("score", "")
    health_score = raw_score[0].upper() if raw_score else None
    if health_score not in {"A", "B", "C", "D", "F"}:
        health_score = None

    try:
        response = (
            client.table("audits")
            .insert({
                "user_id": user_id,
                "repo_url": repo,
                "report": report,
                "health_score": health_score,
            })
            .execute()
        )
        audit_id = response.data[0]["id"] if response.data else None
        logger.info("audit persisted", extra={"audit_id": audit_id, "user_id": user_id, "repo": repo})
        return audit_id
    except Exception as e:
        logger.error("failed to persist audit", extra={"error": str(e), "user_id": user_id, "repo": repo})
        return None
