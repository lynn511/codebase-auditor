variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-3"
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "codebase-auditor"
}

variable "bedrock_model_id" {
  description = "Bedrock model ID"
  type        = string
  default     = "amazon.nova-lite-v1:0"
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 120
}

variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = string
  default     = "https://codebase-auditor.vercel.app"
}
variable "api_throttle_burst_limit" {
  description = "API Gateway burst throttle limit"
  type        = number
  default     = 10
}

variable "api_throttle_rate_limit" {
  description = "API Gateway steady-state request rate limit"
  type        = number
  default     = 5
}

variable "supabase_url" {
  description = "Supabase project URL (staging only)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "supabase_publishable_key" {
  description = "Supabase publishable key (replaces anon key, safe for frontend)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "supabase_secret_key" {
  description = "Supabase secret key (replaces service role key, backend only)"
  type        = string
  sensitive   = true
  default     = ""
}