#!/bin/bash
set -e

# ── Workspace guard ───────────────────────────────────────────────────────────
cd "$(dirname "$0")/../opentofu"
WORKSPACE=$(tofu workspace show)

echo "▶ Target workspace: $WORKSPACE"

if [ "$WORKSPACE" = "default" ]; then
  echo "ERROR: You are on the default workspace. Switch to staging or production first."
  echo "  tofu workspace select staging"
  echo "  tofu workspace select production"
  exit 1
fi

if [ "$WORKSPACE" = "production" ]; then
  VAR_FILE="terraform.tfvars.production"
  echo "⚠️  Deploying to PRODUCTION. Press Ctrl+C within 5 seconds to abort."
  sleep 5
else
  VAR_FILE="terraform.tfvars"
fi

# ── Build Lambda package ──────────────────────────────────────────────────────
cd ../backend
echo "▶ Building Lambda package..."
rm -rf lambda-package
mkdir -p lambda-package
pip install -r requirements.txt --target lambda-package --quiet \
  --platform manylinux2014_x86_64 --implementation cp \
  --python-version 3.12 --only-binary=:all:

cp server.py lambda-package/
cp audit_routes.py lambda-package/
cp audit_context.py lambda-package/
cp storage.py lambda-package/
cp lambda_handler.py lambda-package/

cd lambda-package
zip -r ../lambda-deployment.zip . --quiet
cd ..
echo "✓ Lambda package built"

# ── Deploy infrastructure ─────────────────────────────────────────────────────
cd ../opentofu
echo "▶ Deploying infrastructure to workspace: $WORKSPACE"
tofu init -upgrade -input=false
tofu apply -auto-approve -input=false -var-file="$VAR_FILE"

echo ""
echo "Deployment complete! [$WORKSPACE]"
echo "API URL:"
tofu output api_url
