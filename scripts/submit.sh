#!/bin/bash
set -e

# Read service account JSON file from 1Password attachment
SERVICE_ACCOUNT=$(op read "op://Private/Chrome Web Store API/arenpatel-default-04559b47c1fb.json")

# Extract fields from JSON
CLIENT_EMAIL=$(echo "$SERVICE_ACCOUNT" | jq -r '.client_email')
PRIVATE_KEY=$(echo "$SERVICE_ACCOUNT" | jq -r '.private_key')

# Find the latest ZIP file
ZIP_FILE=$(ls -t .output/version-chrome-ext-v*.zip | head -1)

# Get config values from .env.submit
source .env.submit

# Run submit with env vars (keeps secrets hidden)
export CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL="$CLIENT_EMAIL"
export CHROME_SERVICE_ACCOUNT_PRIVATE_KEY="$PRIVATE_KEY"

op run -- bun run submit -- \
  --chrome-api-version v2 \
  --chrome-extension-id "$CHROME_EXTENSION_ID" \
  --chrome-publisher-id "$CHROME_PUBLISHER_ID" \
  --chrome-zip "$ZIP_FILE"
