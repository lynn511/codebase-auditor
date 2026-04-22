data "aws_caller_identity" "current" {}

locals {
  name = "${var.project_name}-${terraform.workspace}"
}

# ── S3 bucket for conversation memory ────────────────────────────────────────
resource "aws_s3_bucket" "memory" {
  bucket        = "${local.name}-memory-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = {
    Project   = local.name
    ManagedBy = "opentofu"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "memory" {
  bucket = aws_s3_bucket.memory.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ── CloudWatch log group ──────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name}-api"
  retention_in_days = 30

  tags = {
    Project   = local.name
    ManagedBy = "opentofu"
  }
}

# ── IAM role for Lambda ───────────────────────────────────────────────────────
resource "aws_iam_role" "lambda" {
  name = "${local.name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "${local.name}-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.name}-api",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.name}-api:*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel", "bedrock:Converse"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.memory.arn,
          "${aws_s3_bucket.memory.arn}/*"
        ]
      }
    ]
  })
}

# ── Lambda function ───────────────────────────────────────────────────────────
resource "aws_lambda_function" "api" {
  function_name    = "${local.name}-api"
  filename         = "${path.module}/../backend/lambda-deployment.zip"
  source_code_hash = filebase64sha256("${path.module}/../backend/lambda-deployment.zip")
  handler          = "lambda_handler.handler"
  runtime          = "python3.12"
  role             = aws_iam_role.lambda.arn
  timeout          = var.lambda_timeout
  memory_size      = 512

  environment {
    variables = {
      DEFAULT_AWS_REGION = var.aws_region
      BEDROCK_MODEL_ID   = var.bedrock_model_id
      USE_S3             = "true"
      S3_BUCKET          = aws_s3_bucket.memory.bucket
      CORS_ORIGINS       = var.cors_origins
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda]

  tags = {
    Project   = local.name
    ManagedBy = "opentofu"
  }
}

# ── API Gateway ───────────────────────────────────────────────────────────────
resource "aws_apigatewayv2_api" "api" {
  name          = "${local.name}-api"
  protocol_type = "HTTP"

 cors_configuration {
  allow_origins = split(",", var.cors_origins)
  allow_methods = ["GET", "POST", "OPTIONS"]
  allow_headers = ["Content-Type", "Authorization"]
  max_age       = 300
}
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = var.api_throttle_burst_limit
    throttling_rate_limit  = var.api_throttle_rate_limit
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
