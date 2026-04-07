from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import boto3
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from audit_routes import create_audit_router
from storage.repo import make_repo

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
CORS_ORIGINS     = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
USE_S3           = os.getenv("USE_S3", "false").lower() == "true"
S3_BUCKET        = os.getenv("S3_BUCKET", "")
MEMORY_DIR       = os.getenv("MEMORY_DIR", "../memory")

# ── App ───────────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Clients ───────────────────────────────────────────────────────────────────
bedrock_client = boto3.client(
    service_name="bedrock-runtime",
    region_name=os.getenv("DEFAULT_AWS_REGION", "eu-west-2")
)
repo = make_repo(use_s3=USE_S3, s3_bucket=S3_BUCKET, memory_dir=MEMORY_DIR)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(
    create_audit_router(bedrock_client, BEDROCK_MODEL_ID, repo.load, repo.save, limiter)
)


@app.get("/")
async def root():
    return {
        "message": "AI Codebase Auditor API",
        "storage": "S3" if USE_S3 else "local",
        "ai_model": BEDROCK_MODEL_ID
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "use_s3": USE_S3, "bedrock_model": BEDROCK_MODEL_ID}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
