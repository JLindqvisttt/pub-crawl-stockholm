#!/usr/bin/env bash
set -euo pipefail

REGION="eu-north-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
FUNCTION_NAME="kroghoppen-venue-search"
ROLE_NAME="kroghoppen-lambda-role"
API_NAME="kroghoppen-api"
LAMBDA_DIR="$(cd "$(dirname "$0")/lambda/pub-search" && pwd)"

echo "=================================================="
echo "  Kroghoppen - Lambda + API Gateway Deploy"
echo "  Account: $ACCOUNT_ID  Region: $REGION"
echo "=================================================="

# ---- 1. IAM Role ----
echo ""
echo "1. IAM Role..."
EXISTING_ROLE=$(AWS_PAGER="" aws iam get-role --role-name "$ROLE_NAME" --query "Role.Arn" --output text 2>/dev/null || true)
if [[ -n "$EXISTING_ROLE" && "$EXISTING_ROLE" != "None" ]]; then
    ROLE_ARN="$EXISTING_ROLE"
    echo "   ✓ Role already exists: $ROLE_ARN"
else
    ROLE_ARN=$(AWS_PAGER="" aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
        --query "Role.Arn" --output text)
    echo "   Created role: $ROLE_ARN"

    AWS_PAGER="" aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

    AWS_PAGER="" aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name "geo-places-access" \
        --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["geo-places:SearchNearby","geo-places:SearchText"],"Resource":"*"}]}'

    echo "   Waiting 12s for role to propagate..."
    sleep 12
fi

# ---- 2. Package Lambda ----
echo ""
echo "2. Packaging Lambda..."
cd "$LAMBDA_DIR"
npm install --omit=dev --silent
ZIP_FILE="/tmp/kroghoppen-pub-search.zip"
rm -f "$ZIP_FILE"
zip -r "$ZIP_FILE" . -x '*.sh' -x '.git*' -x '*.md' > /dev/null
echo "   ✓ Zipped: $ZIP_FILE ($(du -h "$ZIP_FILE" | cut -f1))"
cd -

# ---- 3. Lambda Function ----
echo ""
echo "3. Lambda Function..."
LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"
EXISTING_FN=$(AWS_PAGER="" aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" --query "Configuration.FunctionArn" --output text 2>/dev/null || true)

if [[ -n "$EXISTING_FN" && "$EXISTING_FN" != "None" ]]; then
    echo "   Updating existing Lambda..."
    AWS_PAGER="" aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION" \
        --zip-file "fileb://$ZIP_FILE" \
        --output text > /dev/null
    echo "   ✓ Lambda updated"
else
    echo "   Creating Lambda..."
    AWS_PAGER="" aws lambda create-function \
        --function-name "$FUNCTION_NAME" \
        --runtime nodejs20.x \
        --role "$ROLE_ARN" \
        --handler index.handler \
        --zip-file "fileb://$ZIP_FILE" \
        --region "$REGION" \
        --timeout 30 \
        --memory-size 256 \
        --output text > /dev/null
    echo "   ✓ Lambda created"
fi

echo "   Waiting for Lambda to become active..."
AWS_PAGER="" aws lambda wait function-active --function-name "$FUNCTION_NAME" --region "$REGION"
echo "   ✓ Lambda active"

# ---- 4. HTTP API Gateway ----
echo ""
echo "4. HTTP API Gateway..."
EXISTING_API_ID=$(AWS_PAGER="" aws apigatewayv2 get-apis --region "$REGION" \
    --query "Items[?Name=='$API_NAME'].ApiId" --output text 2>/dev/null || true)

if [[ -n "$EXISTING_API_ID" && "$EXISTING_API_ID" != "None" ]]; then
    API_ID="$EXISTING_API_ID"
    echo "   ✓ API already exists: $API_ID"
else
    API_ID=$(AWS_PAGER="" aws apigatewayv2 create-api \
        --name "$API_NAME" \
        --protocol-type HTTP \
        --cors-configuration 'AllowOrigins=["*"],AllowMethods=["GET","OPTIONS"],AllowHeaders=["Content-Type"]' \
        --region "$REGION" \
        --query "ApiId" --output text)
    echo "   ✓ API created: $API_ID"
fi

# ---- 5. Lambda Integration ----
echo ""
echo "5. Lambda Integration..."
EXISTING_INT=$(AWS_PAGER="" aws apigatewayv2 get-integrations --api-id "$API_ID" --region "$REGION" \
    --query "Items[?contains(IntegrationUri, '$FUNCTION_NAME')].IntegrationId" --output text 2>/dev/null || true)

if [[ -n "$EXISTING_INT" && "$EXISTING_INT" != "None" ]]; then
    INTEGRATION_ID="$EXISTING_INT"
    echo "   ✓ Integration already exists: $INTEGRATION_ID"
else
    INTEGRATION_ID=$(AWS_PAGER="" aws apigatewayv2 create-integration \
        --api-id "$API_ID" \
        --integration-type AWS_PROXY \
        --integration-uri "$LAMBDA_ARN" \
        --payload-format-version "2.0" \
        --region "$REGION" \
        --query "IntegrationId" --output text)
    echo "   ✓ Integration created: $INTEGRATION_ID"
fi

# ---- 6. Route ----
echo ""
echo "6. Route GET /pubs..."
EXISTING_ROUTE=$(AWS_PAGER="" aws apigatewayv2 get-routes --api-id "$API_ID" --region "$REGION" \
    --query "Items[?RouteKey=='GET /pubs'].RouteId" --output text 2>/dev/null || true)

if [[ -n "$EXISTING_ROUTE" && "$EXISTING_ROUTE" != "None" ]]; then
    echo "   ✓ Route already exists"
else
    AWS_PAGER="" aws apigatewayv2 create-route \
        --api-id "$API_ID" \
        --route-key "GET /pubs" \
        --target "integrations/$INTEGRATION_ID" \
        --region "$REGION" > /dev/null
    echo "   ✓ Route created"
fi

# ---- 7. Stage ----
echo ""
echo "7. Default stage with auto-deploy..."
AWS_PAGER="" aws apigatewayv2 create-stage \
    --api-id "$API_ID" \
    --stage-name '$default' \
    --auto-deploy \
    --region "$REGION" > /dev/null 2>&1 || echo "   ✓ Stage already exists"

# ---- 8. Lambda Permission ----
echo ""
echo "8. Lambda execution permission..."
AWS_PAGER="" aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "apigateway-invoke-pubs" \
    --action "lambda:InvokeFunction" \
    --principal "apigateway.amazonaws.com" \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/pubs" \
    --region "$REGION" > /dev/null 2>&1 || echo "   ✓ Permission already exists"

# ---- Done ----
ENDPOINT="https://${API_ID}.execute-api.${REGION}.amazonaws.com/pubs"
echo ""
echo "=================================================="
echo "  ✅ Deploy complete!"
echo "  Endpoint: $ENDPOINT"
echo ""
echo "  Test it:"
echo "  curl '$ENDPOINT?lat=59.3293&lng=18.0686'"
echo "=================================================="
echo ""
echo "  Update config.js:"
echo "  awsVenueEndpoint: '$ENDPOINT'"
