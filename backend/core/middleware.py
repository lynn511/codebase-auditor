import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.monotonic()

        logger.info("request started", extra={
            "request_id": request_id,
            "endpoint": request.url.path,
            "method": request.method,
        })

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.monotonic() - start) * 1000)
            logger.exception("request failed", extra={
                "request_id": request_id,
                "endpoint": request.url.path,
                "method": request.method,
                "duration_ms": duration_ms,
            })
            raise

        duration_ms = round((time.monotonic() - start) * 1000)
        logger.info("request completed", extra={
            "request_id": request_id,
            "endpoint": request.url.path,
            "method": request.method,
            "status": response.status_code,
            "duration_ms": duration_ms,
        })

        return response
