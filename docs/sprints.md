# Sprints — MangaForge Full-Stack Rebuild

> Frontend existente (React 19 + TanStack Router + Tailwind v4) com UI completa em modo mock.
> Objetivo: reconstruir do zero com frontend + backend reais.

---

## Sprint 0 — Setup & Infraestrutura
**Duração:** 1-2 dias

### Histórias de Usuário
- **US-0.1:** Como desenvolvedor, quero que o projeto tenha um backend Node.js + TypeScript configurado para começar a implementar as APIs.
- **US-0.2:** Como desenvolvedor, quero um Docker Compose com app + Redis + SQLite para rodar tudo com um comando.
- **US-0.3:** Como desenvolvedor, quero um client de API base no frontend (`src/lib/api.ts`) para conectar frontend e backend.
- **US-0.4:** Como desenvolvedor, quero schemas Zod compartilhados entre frontend e backend para garantir consistência de tipos.

### Backend
- [ ] Inicializar projeto Node.js + TypeScript (`/server`)
- [ ] Configurar Fastify + plugins base (CORS, JWT, cookies)
- [ ] Configurar Drizzle ORM + SQLite (schema inicial)
- [ ] Configurar Redis (filas de conversão)
- [ ] Configurar BullMQ (filas: `download`, `convert`, `send`)
- [ ] Docker Compose: app + Redis + SQLite volume
- [ ] ESLint + Prettier no backend

### Frontend
- [ ] Criar `src/lib/api.ts` (fetch wrapper)
- [ ] Criar tipos/Zod schemas compartilhados
- [ ] Configurar `VITE_API_URL`
- [ ] Criar pasta `src/services/`

### Entregáveis
- [ ] `docker-compose.yml` funcional
- [ ] Backend responde `GET /health`
- [ ] Frontend com client de API base

---

## Sprint 1 — Autenticação & Usuários
**Duração:** 2-3 dias

### Histórias de Usuário
- **US-1.1:** Como usuário, quero me registrar com username, email e senha para ter minha conta no MangaForge.
- **US-1.2:** Como usuário, quero fazer login com minhas credenciais para acessar minha área protegida.
- **US-1.3:** Como usuário, quero que minha sessão persista ao fechar e reabrir o browser para não precisar logar toda hora.
- **US-1.4:** Como usuário, quero fazer logout para encerrar minha sessão com segurança.
- **US-1.5:** Como usuário, quero acessar meu perfil para ver e editar meu email Kindle e trocar minha senha.
- **US-1.6:** Como sistema, quero proteger todas as rotas privadas redirecionando usuários não autenticados para `/login`.

### Backend
- [ ] Model `users` (id, username, email, password_hash, kindle_email, created_at)
- [ ] `POST /auth/register` (bcrypt)
- [ ] `POST /auth/login` (JWT + refresh token httpOnly cookie)
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me` (protegido)
- [ ] Middleware JWT
- [ ] `PATCH /users/me` (kindle_email, senha)
- [ ] Migrations Drizzle

### Frontend
- [ ] Substituir `useAuth.tsx` por API real
- [ ] Login funcional (Zod validation)
- [ ] Página `/register`
- [ ] Persistência de sessão (refresh token)
- [ ] Redirect se não autenticado
- [ ] Remover mock auth

### Entregáveis
- [ ] Login/registro end-to-end
- [ ] Sessão persiste após refresh

---

## Sprint 2 — Fontes & Scraping Engine
**Duração:** 3-4 dias

### Histórias de Usuário
- **US-2.1:** Como usuário, quero ver a lista de fontes homologadas (MangaDex, MangaLivre, etc.) para saber de onde posso baixar.
- **US-2.2:** Como usuário, quero buscar uma obra pelo nome na fonte selecionada para encontrar o mangá que quero converter.
- **US-2.3:** Como usuário, quero ver os detalhes de uma obra (título, autor, capítulos disponíveis) antes de iniciar a conversão.
- **US-2.4:** Como sistema, quero buscar dados do MangaDex via API oficial para obter metadados e lista de capítulos.
- **US-2.5:** Como sistema, quero fazer scraping do MangaLivre para obter dados de obras quando não há API disponível.
- **US-2.6:** Como sistema, quero cachear respostas das fontes por 15 minutos para não sobrecarregar os servidores.
- **US-2.7:** Como usuário, quero ver uma mensagem clara quando uma fonte estiver offline ou indisponível.

### Backend
- [ ] Model `sources` (id, name, slug, base_url, status)
- [ ] Sistema de plugins `SourceScraper`
- [ ] `MangaDexScraper` (API oficial)
- [ ] `MangaLivreScraper` (Cheerio/Playwright)
- [ ] `GET /sources` (lista)
- [ ] `GET /sources/:slug/search?q=` (busca)
- [ ] `GET /sources/:slug/series/:seriesSlug` (detalhes + capítulos)
- [ ] Cache Redis (TTL 15min)
- [ ] Rate limiting por fonte

### Frontend
- [ ] Página `/fontes` com API real
- [ ] Busca de obras com debounce
- [ ] Skeleton loading
- [ ] Tratamento de erros

### Entregáveis
- [ ] 2+ fontes funcionando
- [ ] Busca retornando dados reais

---

## Sprint 3 — Wizard de Conversão
**Duração:** 3-4 dias

### Histórias de Usuário
- **US-3.1:** Como usuário, quero colar a URL de uma obra no Step 1 e ver os dados reais (título, autor, capítulos) carregados da fonte.
- **US-3.2:** Como usuário, quero selecionar os capítulos que quero converter no Step 2, com dados reais da API.
- **US-3.3:** Como usuário, quero configurar o agrupamento por volume (fixo ou personalizado) para organizar os arquivos de saída.
- **US-3.4:** Como usuário, quero escolher capas (da galeria, original ou upload) no Step 3 para personalizar o arquivo final.
- **US-3.5:** Como usuário, quero selecionar meu dispositivo Kindle, formato de saída (EPUB/MOBI/CBZ/KFX) e preset de imagem no Step 4.
- **US-3.6:** Como usuário, quero gerar um preview de página no Step 4 para ver como ficará a conversão antes de confirmar.
- **US-3.7:** Como usuário, quero escolher entre download direto ou envio pro Kindle no Step 5 e ver um resumo completo antes de confirmar.
- **US-3.8:** Como sistema, quero criar um job de conversão no backend ao confirmar o wizard para processar a conversão em background.

### Backend
- [ ] `POST /wizard/fetch-series` (URL → série + capítulos)
- [ ] `POST /wizard/preview` (gera preview)
- [ ] `POST /conversion/jobs` (inicia job)
- [ ] `GET /conversion/jobs/:id` (status)
- [ ] `GET /conversion/jobs` (lista)
- [ ] `DELETE /conversion/jobs/:id` (cancela)
- [ ] Validação Zod

### Frontend
- [ ] Step 1: busca real de série
- [ ] Step 2: dados reais da API
- [ ] Step 3: upload real de imagem
- [ ] Step 4: preview real
- [ ] Step 5: submissão real do job
- [ ] Remover `mockFetchSeries()`

### Entregáveis
- [ ] Wizard funcional end-to-end
- [ ] Job criado no backend

---

## Sprint 4 — Engine de Conversão (Worker)
**Duração:** 5-7 dias

### Histórias de Usuário
- **US-4.1:** Como sistema, quero baixar as imagens dos capítulos selecionados em background para não bloquear o usuário.
- **US-4.2:** Como sistema, quero processar as imagens aplicando o preset escolhido (manga, webtoon, highQuality, etc.) para otimizar a leitura no Kindle.
- **US-4.3:** Como sistema, quero gerar arquivos EPUB a partir das imagens processadas para o formato mais compatível.
- **US-4.4:** Como sistema, quero gerar arquivos CBZ (zip de imagens) para quem prefere ler em apps de quadrinhos.
- **US-4.5:** Como sistema, quero gerar arquivos MOBI/KFX via Calibre para compatibilidade com Kindles antigos.
- **US-4.6:** Como usuário, quero ver o progresso em tempo real de cada etapa (baixando → convertendo → gerando) para acompanhar a conversão.
- **US-4.7:** Como sistema, quero tentar novamente automaticamente (retry) quando uma etapa falhar para aumentar a taxa de sucesso.
- **US-4.8:** Como usuário, quero ser notificado quando a conversão terminar para saber que o arquivo está pronto.
- **US-4.9:** Como sistema, quero salvar os arquivos convertidos em `/data/library/<obra>/` para organização e persistência.

### Backend
- [ ] Worker `download` — baixa imagens, salva em `/data/downloads/:jobId/`
- [ ] Worker `convert` — Sharp (presets), EPUB (epub-gen), CBZ (zip), MOBI/KFX (Calibre)
- [ ] Worker `generate` — monta arquivo final em `/data/library/:seriesSlug/`
- [ ] Models `conversion_jobs`, `conversion_stages`
- [ ] Progresso em tempo real (WebSocket/SSE)
- [ ] Retry com backoff

### Infra
- [ ] Sharp para processamento de imagens
- [ ] Calibre CLI para MOBI/KFX
- [ ] Volume Docker `/data/`

### Entregáveis
- [ ] Conversão real (imagens → EPUB/CBZ)
- [ ] Progresso em tempo real
- [ ] Presets funcionando

---

## Sprint 5 — Biblioteca & Gerenciamento
**Duração:** 3-4 dias

### Histórias de Usuário
- **US-5.1:** Como usuário, quero ver todas as minhas séries convertidas na biblioteca para acessar meus mangás.
- **US-5.2:** Como usuário, quero ver os detalhes de uma série (arquivos, capítulos, status) para gerenciar o conteúdo.
- **US-5.3:** Como usuário, quero favoritar uma série para encontrá-la mais facilmente.
- **US-5.4:** Como usuário, quero renomear uma série para organizar com meu próprio critério.
- **US-5.5:** Como usuário, quero excluir uma série que não quero mais para liberar espaço.
- **US-5.6:** Como usuário, quero reconverter um volume ou capítulo específico quando a conversão anterior falhou.
- **US-5.7:** Como usuário, quero baixar o arquivo convertido (EPUB/CBZ/MOBI) para meu computador.
- **US-5.8:** Como usuário, quero ler as páginas do mangá diretamente no navegador após a conversão.
- **US-5.9:** Como usuário, quero filtrar a biblioteca por status (todas, em andamento, concluídas) para encontrar o que procuro.
- **US-5.10:** Como usuário, quero alternar entre visualização em grade e em lista para ver a biblioteca do meu jeito.

### Backend
- [ ] Models: `manga_series`, `manga_files`, `chapters`
- [ ] `GET /library` (lista)
- [ ] `GET /library/:slug` (detalhes)
- [ ] `PATCH /library/:slug` (renomear)
- [ ] `DELETE /library/:slug` (excluir)
- [ ] `PATCH /library/:slug/favorite`
- [ ] `POST /library/:slug/reconvert`
- [ ] `GET /library/:slug/download/:fileId`
- [ ] `DELETE /library/:slug/files/:fileId`
- [ ] Paginação e filtros

### Frontend
- [ ] `/biblioteca` com dados reais
- [ ] `/biblioteca/:slug` com detalhes
- [ ] CRUD: renomear, excluir, favoritar
- [ ] Download real
- [ ] Leitor de páginas real
- [ ] Remover `INITIAL_SERIES` e todos os mocks

### Entregáveis
- [ ] Biblioteca totalmente funcional
- [ ] Download de arquivos convertidos

---

## Sprint 6 — Envio para Kindle
**Duração:** 2-3 dias

### Histórias de Usuário
- **US-6.1:** Como usuário, quero enviar um arquivo convertido diretamente para o email do meu Kindle (`@kindle.com`) para ler no dispositivo.
- **US-6.2:** Como sistema, quero enviar o arquivo como anexo via SMTP para o email Kindle do usuário.
- **US-6.3:** Como sistema, quero dividir arquivos maiores que 25MB em partes para respeitar o limite do Kindle.
- **US-6.4:** Como usuário, quero ver o histórico de envios para saber o que já foi enviado.
- **US-6.5:** Como sistema, quero validar o email Kindle antes do envio para evitar erros.
- **US-6.6:** Como usuário, quero receber feedback (sucesso/erro) após o envio para saber se funcionou.

### Backend
- [ ] Worker `send` — SMTP → email @kindle.com
- [ ] Limite 25MB (divide em partes)
- [ ] `POST /library/:slug/send/:fileId`
- [ ] Model `send_history`
- [ ] Validação de email Kindle

### Frontend
- [ ] "Enviar pro Kindle" funcional
- [ ] Histórico de envios
- [ ] Feedback de envio

### Entregáveis
- [ ] Envio real para Kindle via email

---

## Sprint 7 — Agendamentos & Subscriptions
**Duração:** 3-4 dias

### Histórias de Usuário
- **US-7.1:** Como usuário, quero criar uma assinatura para uma obra para receber novos capítulos automaticamente.
- **US-7.2:** Como usuário, quero escolher a frequência de checagem (diária, semanal, ao detectar novo capítulo) para cada assinatura.
- **US-7.3:** Como sistema, quero checar automaticamente por novos capítulos nas fontes configuradas no horário definido.
- **US-7.4:** Como sistema, quero iniciar uma conversão automaticamente quando um novo capítulo for detectado.
- **US-7.5:** Como usuário, quero disparar uma checagem manual de uma assinatura para verificar agora se há capítulos novos.
- **US-7.6:** Como usuário, quero ver o histórico de checagens para acompanhar a atividade das minhas assinaturas.
- **US-7.7:** Como usuário, quero excluir uma assinatura que não quero mais para parar de receber atualizações.

### Backend
- [ ] Model `subscriptions` (user_id, series_title, source_url, frequency, last_check)
- [ ] CRUD `/subscriptions`
- [ ] `POST /subscriptions/:id/check`
- [ ] Cron job (node-cron) para checagem automática
- [ ] Cria job de conversão ao detectar capítulo novo
- [ ] Model `subscription_history`

### Frontend
- [ ] `/agendamentos` com dados reais
- [ ] Nova assinatura
- [ ] Lista com ações
- [ ] Histórico de checagens

### Entregáveis
- [ ] Assinaturas funcionando
- [ ] Checagem automática via cron

---

## Sprint 8 — Configurações & Perfil
**Duração:** 1-2 dias

### Histórias de Usuário
- **US-8.1:** Como usuário, quero configurar meu email Kindle nas configurações para usar em todos os envios.
- **US-8.2:** Como usuário, quero trocar minha senha para manter minha conta segura.
- **US-8.3:** Como usuário, quero ver estatísticas de uso (espaço usado, número de conversões) para monitorar minha instância.
- **US-8.4:** Como admin, quero ver o diretório da biblioteca e do banco de dados para gerenciar o armazenamento.

### Backend
- [ ] `PATCH /users/me` (perfil)
- [ ] `PATCH /users/me/kindle-email`
- [ ] `PATCH /users/me/password`
- [ ] `GET /users/me/usage` (estatísticas)
- [ ] `GET /settings` / `PATCH /settings`

### Frontend
- [ ] `/configuracoes` funcional
- [ ] Email Kindle, troca de senha
- [ ] Dashboard de uso

### Entregáveis
- [ ] Configurações persistidas

---

## Sprint 9 — Dashboard & Métricas
**Duração:** 2-3 dias

### Histórias de Usuário
- **US-9.1:** Como usuário, quero ver um resumo na página inicial (total de séries, arquivos, espaço usado) para ter uma visão geral.
- **US-9.2:** Como usuário, quero ver minhas conversões recentes na home para acessar rapidamente o que acabei de converter.
- **US-9.3:** Como usuário, quero ver um gráfico de atividade dos últimos 30 dias para acompanhar meu uso do MangaForge.
- **US-9.4:** Como usuário, quero ver cards de atalho (Converter, Biblioteca, Agendamentos, Fontes) na home para navegar rapidamente.

### Backend
- [ ] `GET /dashboard/stats`
- [ ] `GET /dashboard/recent`
- [ ] `GET /dashboard/activity`

### Frontend
- [ ] `/` com dados reais
- [ ] Cards de estatísticas
- [ ] Conversões recentes
- [ ] Gráfico de atividade (Recharts)

### Entregáveis
- [ ] Dashboard com métricas reais

---

## Sprint 10 — Testes, Polimento & Deploy
**Duração:** 3-4 dias

### Histórias de Usuário
- **US-10.1:** Como desenvolvedor, quero testes unitários no backend (services, workers) para garantir que a lógica está correta.
- **US-10.2:** Como desenvolvedor, quero testes de integração nos endpoints da API para garantir que as rotas funcionam end-to-end.
- **US-10.3:** Como desenvolvedor, quero testes E2E (Playwright) no fluxo completo de conversão para simular o uso real.
- **US-10.4:** Como usuário, quero que a aplicação funcione bem em dispositivos mobile para usar no celular.
- **US-10.5:** Como usuário, quero que mensagens de erro sejam claras e em português para entender o que aconteceu.
- **US-10.6:** Como usuário, quero loading states (skeletons) em todas as telas para saber que algo está carregando.
- **US-10.7:** Como usuário com deficiência visual, quero que a aplicação tenha labels ARIA e navegação por teclado para ser acessível.
- **US-10.8:** Como usuário, quero usar o modo dark para ler à noite sem cansar os olhos.
- **US-10.9:** Como admin, quero um comando de backup para salvar meus dados (SQLite + arquivos).
- **US-10.10:** Como admin, quero documentação clara no README para instalar e configurar o MangaForge.

### Testes
- [ ] Unit tests backend (vitest)
- [ ] Integration tests (endpoints)
- [ ] E2E (Playwright) — fluxo completo
- [ ] Component tests (Storybook)

### Polimento
- [ ] Error boundaries
- [ ] Loading states (skeleton)
- [ ] Toasts padronizados
- [ ] Validação Zod + react-hook-form
- [ ] Acessibilidade (ARIA, keyboard)
- [ ] Responsividade (mobile-first)
- [ ] Dark mode em todas as páginas

### Deploy
- [ ] Dockerfile multi-stage
- [ ] Docker Compose produção
- [ ] Script de backup
- [ ] README documentado

### Entregáveis
- [ ] Testes passando
- [ ] Documentação completa
- [ ] Deploy via Docker funcional

---

## Resumo

| Sprint | Módulo | Histórias | Dias |
|--------|--------|-----------|------|
| 0 | Setup & Infraestrutura | 4 | 1-2 |
| 1 | Autenticação & Usuários | 6 | 2-3 |
| 2 | Fontes & Scraping Engine | 7 | 3-4 |
| 3 | Wizard de Conversão | 8 | 3-4 |
| 4 | Engine de Conversão (Worker) | 9 | 5-7 |
| 5 | Biblioteca & Gerenciamento | 10 | 3-4 |
| 6 | Envio para Kindle | 6 | 2-3 |
| 7 | Agendamentos & Subscriptions | 7 | 3-4 |
| 8 | Configurações & Perfil | 4 | 1-2 |
| 9 | Dashboard & Métricas | 4 | 2-3 |
| 10 | Testes, Polimento & Deploy | 10 | 3-4 |
| **Total** | | **75** | **28-40 dias** |

## Notas

1. **Frontend existente é referência visual** — componentes em `src/components/` estão prontos, só substituir a camada de dados.
2. **Sprint 4 é o mais complexo** — processamento de imagens, geração de EPUB/CBZ/MOBI, filas.
3. **Sprints podem ser paralelizadas** — frontend e backend simultaneamente após Sprint 0.
4. **Playwright já está nas deps** — usado para scraping e testes E2E.
5. **Calibre CLI** necessário para MOBI/KFX.
6. **Redis opcional inicialmente** — filas em memória para dev, Redis em produção.