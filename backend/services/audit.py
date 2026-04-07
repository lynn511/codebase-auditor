"""System and user prompts and Bedrock invocation logic for the repo audit flow."""

from datetime import datetime
from typing import List


class BedrockError(RuntimeError):
    """Raised when the Bedrock API returns an error."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


class ServiceError(RuntimeError):
    """Raised for general service-layer errors."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


MAX_CONVERSATION_MESSAGES = 20
MAX_FILE_CHARS = 8000


# ── Prompts ───────────────────────────────────────────────────────────────────

def audit_system_prompt() -> str:
    return """You are an expert AI/MLOps engineer performing repository audits.

## Report Generation
When generating the initial audit, return ONLY a valid JSON object with no markdown fences or preamble.

## Follow-up Chat
After generating the audit report, you will answer follow-up questions about the findings.
Follow these rules strictly:

- Maximum 2 sentences.
- Maximum 40 words.
- No bullet points, headers, markdown, or lists.
- Do not explain background or summarize the project.
- Answer only the exact question asked.
- Reference concrete files when relevant (e.g., "in server.py").
- If the repo evidence is insufficient, say: "Not enough evidence from sampled files."
- Stop immediately after the answer.
"""


def audit_ingest_prompt(
    repo: str, file_tree_str: str, sampled_str: str, total_files: int
) -> str:
    return f"""
You are an expert AI/MLOps engineer performing a deep audit of a GitHub repository.
Your job is to produce a structured, honest, and actionable health report.
Do NOT invent findings — only report what the evidence supports.
If a component is absent or unclear, say so explicitly rather than guessing.

## Repository
{repo}

## File Tree ({total_files} total files)
{file_tree_str}

## Sampled File Contents
{sampled_str}

## Current Date
{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Your Task
Analyze the repository and return ONLY a valid JSON object with NO markdown fences, NO preamble.


Use this exact schema:

{{
  "repo": "{repo}",
  "score": "B+",
  "score_rationale": "One sentence explaining why this score was assigned.",
  "summary": "2-3 sentence executive summary: what the project is, its maturity level, and biggest strength/weakness.",
  "stats": {{
    "total_files": {total_files},
    "critical": 0,
    "warnings": 0,
    "info": 0,
    "recommendations": 0
  }},
  "architecture": [
    {{
      "component": "Training Pipeline",
      "status": "found | partial | missing",
      "description": "What was found or clearly inferred, or 'Not found' if absent.",
      "key_files": ["relative/path.py"]
    }}
  ],
  "issues": [
    {{
      "severity": "critical | warning | info",
      "category": "reproducibility | config | testing | security | structure | deps",
      "title": "Short issue title",
      "detail": "Clear explanation of the problem and its consequence.",
      "location": "filename or pattern (e.g. config/*.yaml)"
    }}
  ],
  "recommendations": [
    {{
      "priority": 1,
      "title": "Action title",
      "detail": "Specific, actionable step with concrete example where possible.",
      "impact": "high | medium | low",
      "effort": "low | medium | high"
    }}
  ]
}}

## Architecture Components to Evaluate
Always include ALL of these, using status=missing if not found:
Training Pipeline, Inference/Serving, Model Definition, Configuration Management,
Data Pipeline, Test Suite, Deployment/CI-CD, Dependency Management

## Issues to Scan For
- Hard-coded file paths, API keys, or credentials
- Unpinned or missing dependency versions
- No random seed / non-reproducible training
- Unclear or missing entry points
- Absent or minimal test coverage
- Config scattered across multiple files or hard-coded in logic
- No CI/CD pipeline
- Large binary/model files committed to git
- Missing or inadequate logging
- No Dockerfile or reproducible environment definition
- Dead code or unused imports
- Missing README or setup instructions

## Scoring Guide
A  = Production-ready, well-tested, reproducible, clean MLOps
B  = Solid foundations, minor gaps in testing or config
C  = Functional but significant MLOps debt
D  = Fragile, hard to reproduce, major gaps
F  = Broken, insecure, or completely unstructured

Set stats.critical / warnings / info / recommendations to match the actual counts in your issues and recommendations arrays. Assign sequential priority numbers (1, 2, 3...) to recommendations.
Respond with ONLY the JSON object.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_text(value) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    return value.strip()


def _build_ingest_user_message(
    repo: str, file_tree: List[str], sampled_files, total_files: int
) -> str:
    file_tree_str = "\n".join(file_tree)

    sampled_parts = []
    for f in sampled_files:
        content = _safe_text(f.content)[:MAX_FILE_CHARS]
        sampled_parts.append(f"\n--- FILE: {f.path} ---\n{content}")

    sampled_str = "\n".join(sampled_parts)
    return audit_ingest_prompt(repo, file_tree_str, sampled_str, total_files)


def _extract_bedrock_text(response: dict) -> str:
    try:
        content = response["output"]["message"]["content"]
        text_parts = []

        for block in content:
            if isinstance(block, dict) and "text" in block:
                text_parts.append(block["text"])

        return "\n".join(text_parts).strip()
    except Exception as e:
        raise ServiceError(f"Could not parse Bedrock response: {str(e)}")


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
        raise ServiceError("Empty user message", status_code=400)

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
            raise BedrockError(f"Bedrock validation error: {message}", status_code=400)
        elif code == "AccessDeniedException":
            raise BedrockError(f"Access denied to Bedrock model: {message}", status_code=403)
        else:
            raise BedrockError(f"Bedrock error ({code}): {message}")

    except BedrockError:
        raise
    except Exception as e:
        raise BedrockError(f"Unexpected Bedrock error: {str(e)}")
