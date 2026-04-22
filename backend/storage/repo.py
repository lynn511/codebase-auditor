"""storage/repo.py — conversation persistence layer."""

from __future__ import annotations

import json
import os
import time
from typing import List, Dict, Protocol, runtime_checkable

from botocore.exceptions import ClientError


@runtime_checkable
class ConversationRepo(Protocol):
    def load(self, session_id: str) -> List[Dict]: ...
    def save(self, session_id: str, messages: List[Dict]) -> None: ...


SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "24"))


class LocalRepo:
    def __init__(self, memory_dir: str) -> None:
        self._dir = memory_dir

    def _path(self, session_id: str) -> str:
        return os.path.join(self._dir, f"{session_id}.json")

    def load(self, session_id: str) -> List[Dict]:
        p = self._path(session_id)
        if not os.path.exists(p):
            return []
        age_hours = (time.time() - os.path.getmtime(p)) / 3600
        if age_hours > SESSION_TTL_HOURS:
            os.remove(p)
            return []
        with open(p, "r") as f:
            return json.load(f)

    def save(self, session_id: str, messages: List[Dict]) -> None:
        os.makedirs(self._dir, exist_ok=True)
        with open(self._path(session_id), "w") as f:
            json.dump(messages, f, indent=2)


class S3Repo:
    def __init__(self, s3_client, bucket: str) -> None:
        self._client = s3_client
        self._bucket = bucket

    @staticmethod
    def _key(session_id: str) -> str:
        return f"{session_id}.json"

    def load(self, session_id: str) -> List[Dict]:
        try:
            response = self._client.get_object(
                Bucket=self._bucket, Key=self._key(session_id)
            )
            return json.loads(response["Body"].read().decode("utf-8"))
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return []
            raise

    def save(self, session_id: str, messages: List[Dict]) -> None:
        self._client.put_object(
            Bucket=self._bucket,
            Key=self._key(session_id),
            Body=json.dumps(messages, indent=2),
            ContentType="application/json",
        )


def make_repo(
    use_s3: bool,
    s3_bucket: str = "",
    memory_dir: str = "../memory",
) -> ConversationRepo:
    if use_s3:
        import boto3
        return S3Repo(boto3.client("s3"), s3_bucket)
    return LocalRepo(memory_dir)
