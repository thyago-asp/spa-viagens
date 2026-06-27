# Publicar o SPA Finanças no HostGator (solucoesemti.com.br)

O SPA Finanças é estático (HTML/CSS/JS), então qualquer hospedagem serve.
Abaixo, três caminhos — do mais automático ao mais manual. Escolha um.

> **Importante:** este repositório está conectado ao **Netlify** (arquivo
> `_redirects`). O HostGator é um destino *adicional*; nada aqui guarda
> credenciais de FTP. Nunca comite o arquivo `.env`.

---

## Opção A — Script FTP (recomendado, repetível)

1. Instale o `lftp` na sua máquina:
   - Ubuntu/Debian: `sudo apt install lftp`
   - macOS: `brew install lftp`
2. Crie suas credenciais (a partir do cPanel → **Contas de FTP**):
   ```bash
   cd spa-financas
   cp .env.example .env
   # edite .env com FTP_HOST, FTP_USER, FTP_PASS e REMOTE_DIR
   ```
3. Rode:
   ```bash
   ./deploy-spa-financas.sh
   ```
   O script espelha a pasta `spa-financas/` para `REMOTE_DIR` (padrão
   `public_html/spa-financas` → **solucoesemti.com.br/spa-financas**). Não envia
   `.env`, `deploy-spa-financas.sh` nem este `DEPLOY.md`.

Para republicar depois de qualquer mudança, basta rodar o script de novo.

---

## Opção B — Upload manual via cPanel (sem instalar nada)

1. Gere/baixe o pacote `spa-financas.zip` (só os arquivos do app).
2. No cPanel → **Gerenciador de Arquivos** → entre em `public_html`.
3. Crie a pasta `spa-financas` e entre nela.
4. **Carregar** o `spa-financas.zip` → depois **Extrair**.
5. Acesse **solucoesemti.com.br/spa-financas**.

Estrutura esperada no servidor:
```
public_html/spa-financas/
├── index.html
├── css/styles.css
├── js/ (engine, state, charts, ui, app)
└── data/exemplo.json
```

---

## Opção C — Git Version Control do cPanel (deploy automático)

1. cPanel → **Git™ Version Control** → **Create**.
2. Clone URL: o HTTPS deste repositório no GitHub.
3. Caminho de implantação: `public_html/spa-financas` (ou um subdomínio).
4. Em **Pull or Deploy**, use **Update from Remote** + **Deploy HEAD Commit**
   a cada nova versão. (Opcionalmente um `.cpanel.yml` para copiar só
   `spa-financas/`.)

> Como o app vive na subpasta `spa-financas/` de um repositório maior, a Opção A
> ou B costuma ser mais simples que a C (que puxa o repositório inteiro).

---

## Endereço

- **Subpasta** (`public_html/spa-financas`): `solucoesemti.com.br/spa-financas`
  — não mexe no site atual. Recomendado.
- **Subdomínio**: crie `financas.solucoesemti.com.br` no cPanel apontando para
  uma pasta dedicada e ajuste `REMOTE_DIR`.
- **Raiz** (`public_html`): sobrescreve o site principal — evite, a menos que
  seja intencional.

## Observação técnica

Os gráficos usam **Chart.js via CDN**, então a página precisa de internet para
renderizá-los. Todo o resto (cálculo, localStorage, export/import) funciona
offline. Se quiser 100% offline, baixe o `chart.umd.min.js` para
`spa-financas/js/vendor/` e troque o `<script>` do CDN no `index.html`.
