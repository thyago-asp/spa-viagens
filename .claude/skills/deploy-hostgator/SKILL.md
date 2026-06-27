---
name: deploy-hostgator
description: Publica um site ou pasta estática no HostGator (cPanel) via FTP/FTPS usando lftp. Use quando o usuário pedir para publicar, subir, fazer deploy, hospedar ou atualizar um site no HostGator ou num domínio hospedado lá (ex.: solucoesemti.com.br). Lê credenciais de um arquivo .env que NUNCA é versionado. Se FTP não estiver disponível no ambiente, gera um .zip pronto para upload manual pelo cPanel.
---

# Deploy para HostGator

Publica uma pasta estática (HTML/CSS/JS) num domínio hospedado no HostGator.

## Quando usar
- "publica o site no HostGator", "sobe isso pro solucoesemti.com.br",
  "faz o deploy", "atualiza o site no HostGator".

## Como funciona
A skill envia os arquivos por **FTP/FTPS** (com `lftp`), espelhando uma pasta
local para uma pasta remota no servidor. As credenciais ficam num `.env` local,
nunca no git.

## Pré-requisitos
1. `lftp` instalado (`sudo apt install lftp` ou `brew install lftp`).
2. Um arquivo `.env` ao lado do que vai ser publicado, com:
   ```
   FTP_HOST=ftp.SEUDOMINIO.com.br
   FTP_USER=usuario@SEUDOMINIO.com.br
   FTP_PASS=senha
   REMOTE_DIR=public_html/PASTA        # destino no servidor
   FTP_PORT=21
   LOCAL_DIR=.                          # opcional; o que será enviado
   ```
   (As contas de FTP ficam no cPanel → **Contas de FTP**.)

## Passos que o agente deve seguir
1. **Identifique a pasta a publicar** (LOCAL_DIR) e confirme com o usuário se
   houver ambiguidade.
2. **Verifique credenciais**: procure um `.env`. Se não existir, copie de
   `.env.example` e peça ao usuário para preencher — NÃO invente nem peça a
   senha em chat aberto se puder evitar.
3. **CONFIRME O DESTINO antes de enviar.** Deploy é ação externa e
   sobrescreve arquivos. Avise explicitamente se `REMOTE_DIR` for a raiz
   (`public_html`), pois isso substitui o site principal. Só prossiga após o
   ok do usuário.
4. **Pré-visualize** o que será enviado (liste os arquivos / mostre um
   `lftp ... mirror -R --dry-run`).
5. **Execute** o deploy:
   ```bash
   bash .claude/skills/deploy-hostgator/scripts/ftp-deploy.sh
   ```
   O script lê o `.env`, conecta via FTPS e espelha `LOCAL_DIR` → `REMOTE_DIR`.
6. **Reporte** o resultado real (sucesso ou o erro do lftp). Informe a URL final.

## Fallback (sem FTP / sem rede)
Se `lftp` não existir ou a saída FTP estiver bloqueada (ex.: container web do
Claude Code, cuja rede é só HTTPS via proxy):
1. Gere um pacote:
   ```bash
   bash .claude/skills/deploy-hostgator/scripts/make-zip.sh <LOCAL_DIR> <saida.zip>
   ```
2. Entregue o `.zip` ao usuário e instrua: cPanel → Gerenciador de Arquivos →
   `public_html` → criar pasta → **Carregar** o zip → **Extrair**.

## Notas
- Nunca versionar `.env` (garanta que está no `.gitignore`).
- FTPS é tentado com `ssl-allow true` e `verify-certificate no` (o HostGator
  usa certificado compartilhado); ajuste se o servidor exigir o contrário.
- O `mirror --delete` remove no servidor o que não existe mais localmente.
  Remova a flag no script se quiser preservar arquivos extras no destino.
