#!/usr/bin/env bash
# Builds the app and deploys it to Cloudflare Workers, prompting for the Octopus API key and
# account number and uploading them as Worker secrets in the same deploy.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f wrangler.jsonc ]]; then
  # The domain is only ever written to wrangler.jsonc, which is gitignored.
  read -rp "Domain to deploy to (e.g. app.example.com): " domain
  if [[ ! "$domain" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "Not a valid domain: $domain" >&2
    exit 1
  fi
  sed "s/<your-domain>/$domain/" wrangler.example.jsonc > wrangler.jsonc
  echo "Created wrangler.jsonc from wrangler.example.jsonc."
fi

echo "Leave a value blank to keep the secret already stored on the Worker."
read -rsp "Octopus API key (input hidden): " api_key
echo
read -rp "Octopus account number (e.g. A-1234ABCD): " account_number

pnpm build

deploy_args=()
if [[ -n "$api_key" || -n "$account_number" ]]; then
  # mktemp creates the file readable by the current user only.
  secrets_file=$(mktemp)
  trap 'rm -f "$secrets_file"' EXIT
  # Secrets are additive, so a blank value is left out rather than overwriting the stored one.
  API_KEY="$api_key" ACCOUNT_NUMBER="$account_number" node -e '
    const secrets = {}
    if (process.env.API_KEY) secrets.OCTOPUS_API_KEY = process.env.API_KEY
    if (process.env.ACCOUNT_NUMBER) secrets.OCTOPUS_ACCOUNT_NUMBER = process.env.ACCOUNT_NUMBER
    process.stdout.write(JSON.stringify(secrets))
  ' > "$secrets_file"
  deploy_args+=(--secrets-file "$secrets_file")
fi

# The ${arr[@]+...} form keeps macOS's bash 3.2 from treating an empty array as unset.
pnpm exec wrangler deploy ${deploy_args[@]+"${deploy_args[@]}"} "$@"
