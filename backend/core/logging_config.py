import json
import logging
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    _SKIP = {
        "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
        "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
        "created", "msecs", "relativeCreated", "thread", "threadName",
        "processName", "process", "message", "taskName",
    }

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "service": "codebase-auditor",
        }

        # Include extra fields
        for k, v in record.__dict__.items():
            if k not in self._SKIP:
                entry[k] = v

        # Exceptions
        if record.exc_info:
            entry["exc_info"] = self.formatException(record.exc_info)

        if record.stack_info:
            entry["stack_info"] = self.formatStack(record.stack_info)

        return json.dumps(entry, default=str)


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    numeric_level = getattr(logging, level.upper(), logging.INFO)

    logging.basicConfig(
        level=numeric_level,
        handlers=[handler],
        force=True,
    )
