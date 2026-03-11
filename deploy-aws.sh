#!/usr/bin/env bash
set -euo pipefail

# ====================================================
# Pub Crawl App - AWS Deploy Script
# Creates S3 bucket + CloudFront distribution
# ====================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR"
REGION="eu-north-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
BUCKET_NAME="jl-pub-crawl-${ACCOUNT_ID}"

echo "🍺 Pub Crawl App - AWS Deploy"
echo "================================"
echo "   Bucket: $BUCKET_NAME"
echo "   Region: $REGION"
echo ""

# ---- S3 Bucket ----
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo "✓ S3-bucket finns redan"
else
    echo "📦 Skapar S3-bucket..."
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION"

    # Disable block public access
    aws s3api put-public-access-block \
        --bucket "$BUCKET_NAME" \
        --public-access-block-configuration \
            "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

    # Bucket policy for public read
    aws s3api put-bucket-policy \
        --bucket "$BUCKET_NAME" \
        --policy "{
            \"Version\": \"2012-10-17\",
            \"Statement\": [{
                \"Effect\": \"Allow\",
                \"Principal\": \"*\",
                \"Action\": \"s3:GetObject\",
                \"Resource\": \"arn:aws:s3:::${BUCKET_NAME}/*\"
            }]
        }"

    # Enable static website hosting
    aws s3api put-bucket-website \
        --bucket "$BUCKET_NAME" \
        --website-configuration '{
            "IndexDocument": {"Suffix": "index.html"},
            "ErrorDocument": {"Key": "index.html"}
        }'

    echo "✓ S3-bucket skapad med statisk webbhosting"
fi

# ---- Upload files ----
echo ""
echo "📤 Laddar upp filer till S3..."
aws s3 sync "$APP_DIR" "s3://$BUCKET_NAME" \
    --delete \
    --exclude "*.sh" \
    --exclude "*.backup" \
    --exclude "*.md" \
    --exclude ".env*" \
    --exclude ".gitignore"

echo "✓ Filer uppladdade"

# ---- CloudFront ----
S3_WEBSITE_ENDPOINT="${BUCKET_NAME}.s3-website.${REGION}.amazonaws.com"

EXISTING_DIST=$(AWS_PAGER="" aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, '${BUCKET_NAME}')].{Id:Id,DomainName:DomainName,Status:Status}" \
    --output json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['Id'] + ' ' + d[0]['DomainName']) if d else print('')" 2>/dev/null || echo "")

if [[ -n "$EXISTING_DIST" ]]; then
    DIST_ID=$(echo "$EXISTING_DIST" | awk '{print $1}')
    DIST_DOMAIN=$(echo "$EXISTING_DIST" | awk '{print $2}')
    echo ""
    echo "✓ CloudFront-distribution finns redan: $DIST_DOMAIN"

    echo "🔄 Invaliderar cache..."
    AWS_PAGER="" aws cloudfront create-invalidation \
        --distribution-id "$DIST_ID" \
        --paths "/*" > /dev/null
else
    echo ""
    echo "🌐 Skapar CloudFront-distribution (tar ~10 min)..."

    DIST_OUTPUT=$(AWS_PAGER="" aws cloudfront create-distribution \
        --origin-domain-name "$S3_WEBSITE_ENDPOINT" \
        --default-root-object "index.html" \
        --query 'Distribution.{Id:Id,DomainName:DomainName,Status:Status}' \
        --output json)

    DIST_ID=$(echo "$DIST_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Id'])")
    DIST_DOMAIN=$(echo "$DIST_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['DomainName'])")

    echo "✓ Distribution skapad: $DIST_DOMAIN"
    echo "⏳ Väntar på att CloudFront ska bli aktiv..."
    AWS_PAGER="" aws cloudfront wait distribution-deployed --id "$DIST_ID"
    echo "✓ CloudFront aktiv!"
fi

echo ""
echo "=============================="
echo "✅ Deploy klar!"
echo ""
echo "🌐 S3 direkt (HTTP):  http://${S3_WEBSITE_ENDPOINT}"
echo "🌐 CloudFront (HTTPS): https://${DIST_DOMAIN}"
echo "=============================="
