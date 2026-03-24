#!/usr/bin/env bash
set -euo pipefail

SIGNATURE_REGEX='-03-24[A-Za-z]-03-24'

if ! command -v rg >/dev/null 2>&1; then
  echo "[FAIL] rg is required for integrity scan." >&2
  exit 2
fi

if [ "$#" -gt 0 ]; then
  targets=("$@")
else
  targets=(apps docs tests scripts package.json)
fi

corrupted_files="$(rg -l --pcre2 --glob '!scripts/check-token-corruption.sh' -- "$SIGNATURE_REGEX" "${targets[@]}" 2>/dev/null || true)"

if [ -n "$corrupted_files" ]; then
  count="$(printf '%s\n' "$corrupted_files" | sed '/^$/d' | wc -l | tr -d ' ')"
  echo "[FAIL] tokenized corruption signature found in ${count} file(s):"
  printf '%s\n' "$corrupted_files"
  exit 1
fi

echo "[PASS] no tokenized corruption signature found for: ${targets[*]}"
