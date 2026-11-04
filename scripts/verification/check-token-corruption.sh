#!/usr/bin/env bash
set -euo pipefail

SIGNATURE_REGEX='-03-24[A-Za-z]-03-24'
FIXED_TOKEN='-03-24'

if command -v rg >/dev/null 2>&1; then
  SCAN_TOOL='rg'
elif command -v grep >/dev/null 2>&1; then
  SCAN_TOOL='grep'
else
  echo "[FAIL] integrity scan requires either rg or grep." >&2
  exit 2
fi

SELF_PATH='scripts/verification/check-token-corruption.sh'

if [ "$#" -gt 0 ]; then
  targets=("$@")
  signature_targets=("$@")
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
  # The interleaved signature never occurs naturally, so it is also checked in
  # tooling dirs. The bare fixed token is not: it appears in real dates there.
  signature_targets=("${targets[@]}" scripts tests .github)
fi

if [ "$SCAN_TOOL" = 'rg' ]; then
  corrupted_files="$(rg -l --pcre2 --glob "!${SELF_PATH}" -- "$SIGNATURE_REGEX" "${signature_targets[@]}" 2>/dev/null || true)"
else
  corrupted_files="$(
    {
      grep -R -E -l -- "$SIGNATURE_REGEX" "${signature_targets[@]}" 2>/dev/null \
        | awk -v self="$SELF_PATH" '$0 != self'
    } || true
  )"
fi

if [ -n "$corrupted_files" ]; then
  count="$(printf '%s\n' "$corrupted_files" | sed '/^$/d' | wc -l | tr -d ' ')"
  echo "[FAIL] tokenized corruption signature found in ${count} file(s):"
  printf '%s\n' "$corrupted_files"
  exit 1
fi

if [ "$SCAN_TOOL" = 'rg' ]; then
  fixed_token_hits="$(rg -n --fixed-strings -- "$FIXED_TOKEN" "${targets[@]}" 2>/dev/null || true)"
else
  fixed_token_hits="$(
    {
      grep -R -n -F -- "$FIXED_TOKEN" "${targets[@]}" 2>/dev/null \
        | awk -v self="$SELF_PATH" 'index($0, self ":") != 1'
    } || true
  )"
fi
if [ -n "$fixed_token_hits" ]; then
  echo "[FAIL] fixed token '$FIXED_TOKEN' found in launch-critical files:"
  printf '%s\n' "$fixed_token_hits"
  exit 1
fi

echo "[PASS] no tokenized corruption signature in: ${signature_targets[*]}; no fixed token in: ${targets[*]} (scanner: ${SCAN_TOOL})"
