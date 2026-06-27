#!/usr/bin/env bash
# ============================================================================
# Deploy genérico para HostGator via FTP/FTPS (lftp).
# Lê credenciais de um .env. Espelha LOCAL_DIR -> REMOTE_DIR.
#
# Uso:
#   ./ftp-deploy.sh [caminho/para/.env] [--dry-run]
#   (se o .env não for passado, procura ./.env e depois ../.env)
#
# Variáveis esperadas no .env:
#   FTP_HOST, FTP_USER, FTP_PASS, REMOTE_DIR
#   FTP_PORT   (opcional, padrão 21)
#   LOCAL_DIR  (opcional, padrão = pasta do .env)
#   EXCLUDES   (opcional, globs separados por espaço; ex: ".env *.zip")
# ============================================================================
set -euo pipefail

DRY=""
ENV_FILE=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY="--dry-run" ;;
    *) ENV_FILE="$arg" ;;
  esac
done

# localiza o .env
if [[ -z "$ENV_FILE" ]]; then
  if   [[ -f ".env"    ]]; then ENV_FILE=".env"
  elif [[ -f "../.env" ]]; then ENV_FILE="../.env"
  else echo "ERRO: .env não encontrado. Passe o caminho: ./ftp-deploy.sh caminho/.env" >&2; exit 1
  fi
fi

set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a

: "${FTP_HOST:?defina FTP_HOST no .env}"
: "${FTP_USER:?defina FTP_USER no .env}"
: "${FTP_PASS:?defina FTP_PASS no .env}"
: "${REMOTE_DIR:?defina REMOTE_DIR no .env}"
FTP_PORT="${FTP_PORT:-21}"

# LOCAL_DIR padrão = pasta onde está o .env
ENV_DIR="$(cd "$(dirname "$ENV_FILE")" && pwd)"
LOCAL_DIR="${LOCAL_DIR:-$ENV_DIR}"

if ! command -v lftp >/dev/null 2>&1; then
  echo "ERRO: lftp não instalado. Use o fallback make-zip.sh ou instale lftp." >&2
  exit 2
fi

# monta excludes
EXCLUDES="${EXCLUDES:-.env .env.example *.zip}"
EXCL_FLAGS=""
for g in $EXCLUDES; do EXCL_FLAGS="$EXCL_FLAGS --exclude-glob $g"; done

echo "→ Origem : $LOCAL_DIR"
echo "→ Destino: $FTP_HOST:$REMOTE_DIR (porta $FTP_PORT)"
[[ -n "$DRY" ]] && echo "→ MODO SIMULAÇÃO (nada será enviado)"

# shellcheck disable=SC2086
lftp -u "$FTP_USER","$FTP_PASS" -p "$FTP_PORT" "$FTP_HOST" <<EOF
set ftp:ssl-allow true
set ftp:ssl-force false
set ssl:verify-certificate no
set ftp:ssl-protect-data true
set net:max-retries 2
set net:timeout 20
mirror -R --delete --verbose $DRY $EXCL_FLAGS "$LOCAL_DIR" "$REMOTE_DIR"
bye
EOF

echo "✓ Concluído."
