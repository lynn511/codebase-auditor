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