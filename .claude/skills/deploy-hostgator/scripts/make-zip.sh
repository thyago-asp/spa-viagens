#!/usr/bin/env bash
# ============================================================================
# Fallback: empacota uma pasta em .zip para upload manual pelo cPanel.
#
# Uso:
#   ./make-zip.sh <pasta_local> [saida.zip]
#
# Ignora .env, .env.example, *.zip e os scripts/SKILL desta skill.
# ============================================================================
set -euo pipefail

SRC="${1:?uso: make-zip.sh <pasta_local> [saida.zip]}"
OUT="${2:-site.zip}"

[[ -d "$SRC" ]] || { echo "ERRO: pasta '$SRC' não existe." >&2; exit 1; }
command -v zip >/dev/null 2>&1 || { echo "ERRO: 'zip' não instalado." >&2; exit 2; }

# resolve a saída para caminho absoluto (antes do cd)
case "$OUT" in /*) OUT_ABS="$OUT" ;; *) OUT_ABS="$PWD/$OUT" ;; esac

rm -f "$OUT_ABS"
( cd "$SRC" && zip -rq "$OUT_ABS" . \
    -x '.env' '.env.example' '*.zip' 'deploy-*.sh' 'DEPLOY.md' )

echo "✓ Pacote gerado: $OUT_ABS"
unzip -l "$OUT_ABS"
