project_name             = "code-auditor"
bedrock_model_id         = "eu.amazon.nova-lite-v1:0"
lambda_timeout           = 60

api_throttle_burst_limit = 10
api_throttle_rate_limit  = 5

cors_origins = "https://codebase-auditor.vercel.app,https://codebase-auditor-git-fix-stabilize-codebase-lynnelm.vercel.app,http://localhost:3000"