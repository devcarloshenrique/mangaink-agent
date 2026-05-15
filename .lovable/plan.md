# MangaForge → App self-hosted (CasaOS)

Pivot do site de venda para um app pessoal que roda em container Docker (CasaOS), com biblioteca em volume local, auth local, preview de página convertida e agendamento de envio para o Kindle.

## Aviso importante (mudança de stack)

Hoje o projeto usa **Lovable Cloud (Supabase)** + deploy Cloudflare Workers. Para rodar 100% dentro de um container CasaOS sem depender de serviço gerenciado, vamos:

- Remover Supabase (auth, profiles, créditos) e substituir por **SQLite local + sessão em cookie criptografado**.
- Trocar o runtime de Cloudflare Workers para **Node.js** (preciso para acessar filesystem `/data`, rodar `node-cron`, ler/escrever SQLite).
- Adicionar `Dockerfile` + `docker-compose.yml` prontos pra CasaOS.

Consequência: o **preview do Lovable** (que roda em Worker) deixa de mostrar a app rodando como antes — a partir daqui o ambiente “real” é o container. Você ainda consegue desenvolver, mas a validação fim-a-fim acontece via `docker compose up`. Sistema de créditos é removido (não faz sentido em self-hosted single-user).

---

## O que fica

- Visual pop-art / quadrinhos atual (Header, ComicPanel, SpeechBubble, StepIndicator, fontes Bangers/Inter).
- Wizard de 5 passos: Origem → Capítulos → Capas → Configurações → Envio.
- Presets de Kindle (`src/lib/kindle-presets.ts`).

## O que muda / é novo

### 1. Auth local (substitui Supabase Auth)
- Tela `/login` continua sendo a primeira. Usuário/senha único definidos por env (`APP_USER`, `APP_PASSWORD`) ou criados no primeiro boot.
- Sessão via cookie criptografado (`useSession` do TanStack Start, segredo em `SESSION_SECRET`).
- `RequireAuth` passa a checar a sessão server-side.

### 2. Preview de página convertida (passo Conversão)
- Dentro do passo de Configurações, o usuário escolhe **uma página** do capítulo (capa ou página N) numa tira de thumbnails.
- Botão **“Gerar preview”** chama uma server function que aplica os filtros do device escolhido (resize ao tamanho exato do Kindle, grayscale, contraste/gama do preset, margens) usando **sharp**.
- Resultado aparece num painel side-by-side: original ↔ como vai ficar no Kindle.
- Conversão final continua mockada (gera um arquivo placeholder), o preview server-side é o que dá noção real do resultado.

### 3. Envio por email Kindle (limite 25MB)
- Nova página **Configurações** (`/configuracoes`) com campo “Email do Kindle” (`@kindle.com`) salvo em SQLite.
- No passo Envio: badge mostrando tamanho estimado do arquivo, barra de progresso até 25MB, aviso quando passa do limite + sugestão de **dividir em partes** (split por capítulo).
- Mock de envio que loga o que seria mandado e gera o `.epub` no diretório de saída.

### 4. Biblioteca local (`/biblioteca`)
- Cada conversão é salva em `/data/library/{slug-da-obra}/{volume-ou-cap}.epub`.
- Metadados (obra, capa, capítulos convertidos, data, tamanho, status de envio) em SQLite.
- UI lista obras como cards (capa + nome) → clicar abre detalhes com lista de arquivos, botões “Reenviar”, “Baixar”, “Apagar”.

### 5. Sites homologados
- Página **`/fontes`** lista as fontes suportadas: **MangaDex** e **MangaLivre**, com status (✅ ativo / 🚧 em breve), ícone, descrição curta e exemplo de URL aceita.
- Link da página visível no header e na tela de Origem do wizard (“Ver fontes suportadas”).

### 6. Agendamento de envio automático
- Página **`/agendamentos`**: usuário marca obras como “assinadas” e escolhe frequência (diária / semanal / ao detectar novo capítulo).
- Worker `node-cron` no servidor:
  - Para cada assinatura, verifica se há capítulo novo na fonte.
  - Se houver, baixa → converte (mock) → salva na biblioteca → envia pro email Kindle configurado (respeitando o limite de 25MB, dividindo se preciso).
- Histórico de execuções visível na página.

---

## Estrutura de rotas (final)

```text
/login                     → tela de entrada (pública)
/                          → dashboard pós-login (atalhos: wizard, biblioteca, agendamentos)
/wizard                    → wizard 5 passos (com preview no passo 4)
/biblioteca                → grade de obras
/biblioteca/$slug          → detalhes + arquivos
/agendamentos              → assinaturas + histórico
/fontes                    → sites homologados
/configuracoes             → email Kindle, senha, paths
```

A `/conta` atual e a landing de venda da `/` somem.

---

## Detalhes técnicos

**Stack alvo**
- Runtime: Node 20 (deploy alvo = container, não Worker). Remover `wrangler.jsonc`, ajustar `vite.config.ts` para target node.
- DB: `better-sqlite3` em `/data/db/manga.db`.
- Auth: `useSession` do `@tanstack/react-start/server`, `SESSION_SECRET` via env.
- Imagens/preview: `sharp`.
- Cron: `node-cron` iniciado no boot do server.
- Filesystem: tudo persistido em `/data` (volume montado).

**Server functions novas (em `src/lib/*.functions.ts`)**
- `auth.functions.ts`: `login`, `logout`, `me`.
- `library.functions.ts`: `listSeries`, `getSeries`, `deleteFile`.
- `preview.functions.ts`: `generatePreview({ pageUrl, deviceId, presetId })` → retorna PNG base64.
- `convert.functions.ts`: `convertChapter(...)` (mock, escreve arquivo).
- `kindle.functions.ts`: `sendToKindle({ filePath })` (mock SMTP, loga).
- `sources.functions.ts`: `listSources`, `searchSource`, `fetchChapters`.
- `schedules.functions.ts`: `listSubscriptions`, `subscribe`, `unsubscribe`, `runHistory`.

**Schema SQLite (resumo)**
- `users(id, username, password_hash, kindle_email, created_at)`
- `series(id, slug, title, source, source_url, cover_path)`
- `files(id, series_id, kind, label, path, bytes, sent_at)`
- `subscriptions(id, series_id, frequency, last_check, last_chapter)`
- `cron_runs(id, ran_at, ok, message)`

**Docker**
- `Dockerfile` multi-stage: build → `node` runtime, expõe `3000`, `VOLUME /data`.
- `docker-compose.yml` com volume `./data:/data` e env `APP_USER`, `APP_PASSWORD`, `SESSION_SECRET`, `KINDLE_SMTP_*`.

**Fontes (escopo desta entrega)**
- Adapter `MangaDexAdapter` real (API pública, sem chave).
- Adapter `MangaLivreAdapter` com scraping básico (selectors podem precisar ajuste futuro).
- Interface comum `MangaSource` para adicionar mais depois.

---

## Ordem de execução

1. Trocar runtime para Node, remover Supabase do código + dependências, criar SQLite + sessão.
2. Refazer `/login` e `RequireAuth` server-side; nova `/` (dashboard).
3. Página `/configuracoes` (email Kindle, troca de senha).
4. Página `/fontes` + adapters MangaDex/MangaLivre.
5. Wizard: integrar adapters reais nos passos 1–3; adicionar preview server-side com `sharp` no passo 4; barra de 25MB no passo 5.
6. Conversão mock + escrita em `/data/library/...` + página `/biblioteca`.
7. Agendamentos + cron + envio mock.
8. `Dockerfile` + `docker-compose.yml` + README de instalação no CasaOS.

