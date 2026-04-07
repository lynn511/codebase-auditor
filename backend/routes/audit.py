from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List
import uuid
import json
from datetime import datetime

from services.audit import audit_system_prompt, audit_ingest_prompt


class FilePayload(BaseModel):
    path: str
    content: str


class AuditStartRequest(BaseModel):
    repo: str
    total_files: int
    file_tree: List[str]
    sampled_files: List[FilePayload]


class AuditStartResponse(BaseModel):
    session_id: str
    report: dict


class AuditChatRequest(BaseModel):
    message: str
    session_id: str


class AuditChatResponse(BaseModel):
    response: str
    session_id: str


MAX_CONVERSATION_MESSAGES = 20
MAX_FILE_CHARS = 8000


def _safe_text(value) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    return value.strip()


def _build_ingest_user_message(req: AuditStartRequest) -> str:
    file_tree_str = "\n".join(req.file_tree)

    sampled_parts = []
    for f in req.sampled_files:
        content = _safe_text(f.content)[:MAX_FILE_CHARS]
        sampled_parts.append(f"\n--- FILE: {f.path} ---\n{content}")

    sampled_str = "\n".join(sampled_parts)
    return audit_ingest_prompt(req.repo, file_tree_str, sampled_str, req.total_files)


def _extract_bedrock_text(response: dict) -> str:
    try:
        content = response["output"]["message"]["content"]
        text_parts = []

        for block in content:
            if isinstance(block, dict) and "text" in block:
                text_parts.append(block["text"])

        return "\n".join(text_parts).strip()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Could not parse Bedrock response: {str(e)}"
        )


def _call_bedrock_audit(
    bedrock_client,
    model_id: str,
    conversation,
    user_message: str,
    is_first_turn: bool = False
) -> str:
    from botocore.exceptions import ClientError

    messages = []

    for msg in conversation[-MAX_CONVERSATION_MESSAGES:]:
        role = msg.get("role")
        content = _safe_text(msg.get("content"))

        if role not in {"user", "assistant"}:
            continue
        if not content:
            continue

        messages.append({
            "role": role,
            "content": [{"text": content}]
        })

    user_message = _safe_text(user_message)
    if not user_message:
        raise HTTPException(status_code=400, detail="Empty user message")

    messages.append({
        "role": "user",
        "content": [{"text": user_message}]
    })

    try:
        response = bedrock_client.converse(
            modelId=model_id,
            system=[{"text": audit_system_prompt()}],
            messages=messages,
            inferenceConfig={
                "maxTokens": 4000 if is_first_turn else 2000,
                "temperature": 0.3 if is_first_turn else 0.7,
                "topP": 0.9,
            },
        )
        return _extract_bedrock_text(response)

    except ClientError as e:
        error = e.response.get("Error", {})
        code = error.get("Code", "UnknownError")
        message = error.get("Message", str(e))

        if code == "ValidationException":
            raise HTTPException(
                status_code=400,
                detail=f"Bedrock validation error: {message}"
            )
        elif code == "AccessDeniedException":
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to Bedrock model: {message}"
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Bedrock error ({code}): {message}"
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected Bedrock error: {str(e)}")


def create_audit_router(bedrock_client, model_id: str, load_conv, save_conv, limiter):
    router = APIRouter(prefix="/audit", tags=["audit"])

    @router.post("/start", response_model=AuditStartResponse)
    @limiter.limit("5/minute")
    async def audit_start(request: Request, req: AuditStartRequest):
        session_id = str(uuid.uuid4())
        user_message = _build_ingest_user_message(req)

        raw_response = _call_bedrock_audit(
            bedrock_client=bedrock_client,
            model_id=model_id,
            conversation=[],
            user_message=user_message,
            is_first_turn=True,
        )

        try:
            clean = raw_response.strip()
            if clean.startswith("```json"):
                clean = clean[7:]
            elif clean.startswith("```"):
                clean = clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()

            report = json.loads(clean)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"LLM returned malformed JSON: {str(e)}. Raw: {raw_response[:500]}"
            )

        conversation = [
            {
                "role": "user",
                "content": user_message,
                "timestamp": datetime.now().isoformat()
            },
            {
                "role": "assistant",
                "content": raw_response,
                "timestamp": datetime.now().isoformat()
            },
        ]
        save_conv(session_id, conversation)

        return AuditStartResponse(session_id=session_id, report=report)

    @router.post("/chat", response_model=AuditChatResponse)
    @limiter.limit("30/minute")
    async def audit_chat(request: Request, req: AuditChatRequest):
        conversation = load_conv(req.session_id)
        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Session not found. Run /audit/start first."
            )

        response_text = _call_bedrock_audit(
            bedrock_client=bedrock_client,
            model_id=model_id,
            conversation=conversation,
            user_message=req.message,
            is_first_turn=False,
        )

        conversation.append({
            "role": "user",
            "content": req.message,
            "timestamp": datetime.now().isoformat()
        })
        conversation.append({
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.now().isoformat()
        })
        save_conv(req.session_id, conversation)

        return AuditChatResponse(response=response_text, session_id=req.session_id)

    @router.get("/session/{session_id}")
    async def get_audit_session(session_id: str):
        try:
            conversation = load_conv(session_id)
            return {"session_id": session_id, "messages": conversation}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return router
