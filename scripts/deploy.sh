#!/bin/bash
set -e

# ── Environment selection ─────────────────────────────────────────────────────
echo "Where do you want to deploy?"
echo "  1) staging"
echo "  2) production"
read -p "Enter 1 or 2: " CHOICE

case $CHOICE in
  1)
    TARGET="staging"
    VAR_FILE="terraform.tfvars.staging"
    ;;
  2)
    TARGET="production"
    VAR_FILE="terraform.tfvars.production"
    read -p "You are deploying to PRODUCTION. Type 'production' to confirm: " CONFIRM
    if [ "$CONFIRM" != "production" ]; then
      echo "Aborted."
      exit 1
    fi
    ;;
  *)
    echo "Invalid choice. Aborted."
    exit 1
    ;;
esac

# ── Switch to correct workspace ───────────────────────────────────────────────
cd "$(dirname "$0")/../opentofu"
tofu workspace select "$TARGET"
echo "▶ Deploying to workspace: $TARGET"

# ── Build Lambda package ──────────────────────────────────────────────────────
cd ../backend
echo "▶ Building Lambda package..."
rm -rf lambda-package
mkdir -p lambda-package
pip install -r requirements.txt --target lambda-package --quiet \
  --platform manylinux2014_x86_64 --implementation cp \
  --python-version 3.12 --only-binary=:all:

cp server.py lambda-package/
cp lambda_handler.py lambda-package/

cd lambda-package
zip -r ../lambda-deployment.zip . --quiet
cd ..
echo "✓ Lambda package built"

# ── Deploy infrastructure ─────────────────────────────────────────────────────
cd ../opentofu
echo "▶ Deploying infrastructure..."
tofu init -upgrade -input=false
tofu apply -auto-approve -input=false -var-file="$VAR_FILE"

echo ""
echo "✅ Deployment complete! [$TARGET]"
echo "API URL:"
tofu output api_url
