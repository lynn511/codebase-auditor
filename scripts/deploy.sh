#!/bin/bash
set -e

echo "▶ Building Lambda package..."
cd backend

# Install dependencies into lambda-package/
rm -rf lambda-package
mkdir -p lambda-package
pip install -r requirements.txt --target lambda-package --quiet --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 --only-binary=:all:
# Copy source files
cp server.py lambda-package/
cp audit_routes.py lambda-package/
cp audit_context.py lambda-package/
cp lambda_handler.py lambda-package/
cp storage.py lambda-package/

# Zip it up
cd lambda-package
zip -r ../lambda-deployment.zip . --quiet
cd ..
echo "✓ Lambda package built"

# Deploy with OpenTofu
cd ../opentofu
echo "▶ Deploying infrastructure..."
tofu init -upgrade -input=false
tofu apply -auto-approve -input=false

echo ""
echo "✅ Deployment complete!"
echo "API URL:"
tofu output api_url