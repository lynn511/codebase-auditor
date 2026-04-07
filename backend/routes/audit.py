from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List
import uuid
import json
from datetime import datetime

from services.audit import _build_ingest_user_message, _call_bedrock_audit, BedrockError, ServiceError


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


def create_audit_router(bedrock_client, model_id: str, load_conv, save_conv, limiter):
    router = APIRouter(prefix="/audit", tags=["audit"])

    @router.post("/start", response_model=AuditStartResponse)
    @limiter.limit("5/minute")
    async def audit_start(request: Request, req: AuditStartRequest):
        session_id = str(uuid.uuid4())
        user_message = _build_ingest_user_message(
            req.repo, req.file_tree, req.sampled_files, req.total_files
        )

        try:
            raw_response = _call_bedrock_audit(
                bedrock_client=bedrock_client,
                model_id=model_id,
                conversation=[],
                user_message=user_message,
                is_first_turn=True,
            )
        except (BedrockError, ServiceError) as e:
            raise HTTPException(status_code=e.status_code, detail=str(e))

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

        try:
            response_text = _call_bedrock_audit(
                bedrock_client=bedrock_client,
                model_id=model_id,
                conversation=conversation,
                user_message=req.message,
                is_first_turn=False,
            )
        except (BedrockError, ServiceError) as e:
            raise HTTPException(status_code=e.status_code, detail=str(e))

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
