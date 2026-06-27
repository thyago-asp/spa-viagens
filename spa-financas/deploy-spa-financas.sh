#!/usr/bin/env bash
# ============================================================================
# Deploy do SPA Finanças para o HostGator via FTP (FTPS) com lftp.
#
# Uso:
#   1) cp .env.example .env   e preencha suas credenciais
#   2) ./deploy-spa-financas.sh
#
# Requisitos: lftp instalado
#   - Ubuntu/Debian:  sudo apt install lftp
#   - macOS (brew):   brew install lftp
#
# Sobe APENAS os arquivos do app (index.html, css/, js/, data/).
# Espelha a pasta: arquivos removidos localmente também somem no servidor
# (--delete). Comente a flag se não quiser esse comportamento.
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# carrega .env
if [[ -f .env ]]; then
  set -a; # shellcheck disable=SC1091
  source .env; set +a
else
  echo "ERRO: arquivo .env não encontrado. Rode: cp .env.example .env e preencha." >&2
  exit 1
fi

: "${FTP_HOST:?defina FTP_HOST no .env}"
: "${FTP_USER:?defina FTP_USER no .env}"
: "${FTP_PASS:?defina FTP_PASS no .env}"
: "${REMOTE_DIR:?defina REMOTE_DIR no .env}"
FTP_PORT="${FTP_PORT:-21}"

if ! command -v lftp >/dev/null 2>&1; then
  echo "ERRO: lftp não está instalado. Veja o cabeçalho deste script." >&2
  exit 1
fi

echo "→ Publicando SPA Finanças em $FTP_HOST:$REMOTE_DIR ..."

# mirror reverso (-R = local -> remoto). Sobe só o necessário.
lftp -u "$FTP_USER","$FTP_PASS" -p "$FTP_PORT" "$FTP_HOST" <<EOF
set ftp:ssl-allow true
set ftp:ssl-force false
set ssl:verify-certificate no
set ftp:ssl-protect-data true
mirror -R --delete --verbose \
  --exclude-glob .env \
  --exclude-glob .env.example \
  --exclude-glob deploy-spa-financas.sh \
  --exclude-glob DEPLOY.md \
  --exclude-glob '*.zip' \
  ./ "$REMOTE_DIR"
bye
EOF

echo "✓ Deploy concluído."
