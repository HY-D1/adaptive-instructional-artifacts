#!/usr/bin/env bash
set -euo pipefail

SIGNATURE_REGEX='-03-24[A-Za-z]-03-24'
FIXED_TOKEN='-03-24'

if ! command -v rg >/dev/null 2>&1; then
  echo "[FAIL] rg is required for integrity scan." >&2
  exit 2
fi

if [ "$#" -gt 0 ]; then
  targets=("$@")
else
  # Default to launch-critical source + build/test config surface.
  targets=(
    apps/web/src/app
    apps/server/src
    package.json
    apps/server/package.json
    apps/web/vite.config.ts
    apps/server/tsconfig.json
    playwright.config.ts
    tsconfig.json
    vercel.json
  )
fi

corrupted_files="$(rg -l --pcre2 --glob '!scripts/check-token-corruption.sh' -- "$SIGNATURE_REGEX" "${targets[@]}" 2>/dev/null || true)"

if [ -n "$corrupted_files" ]; then
  count="$(printf '%s\n' "$corrupted_files" | sed '/^$/d' | wc -l | tr -d ' ')"
  echo "[FAIL] tokenized corruption signature found in ${count} file(s):"
  printf '%s\n' "$corrupted_files"
  exit 1
fi

fixed_token_hits="$(rg -n --fixed-strings -- "$FIXED_TOKEN" "${targets[@]}" 2>/dev/null || true)"
if [ -n "$fixed_token_hits" ]; then
  echo "[FAIL] fixed token '$FIXED_TOKEN' found in launch-critical files:"
  printf '%s\n' "$fixed_token_hits"
  exit 1
fi

echo "[PASS] no tokenized corruption signature or fixed token markers found for: ${targets[*]}"
