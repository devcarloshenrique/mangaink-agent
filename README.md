# MangaInk Agent 📚

> Aplicação web self-hosted para converter mangás de fontes online em formatos compatíveis com Kindle (EPUB, MOBI, CBZ) e enviá-los diretamente ao seu dispositivo Kindle.

Interface em **Português Brasileiro** com design temático de quadrinhos pop-art.

---

## 🏗️ Estrutura do Projeto

```
mangaink-agent/                (monorepo)
├── apps/
│   ├── frontend/              (React + Vite + TanStack)
│   └── backend/               (Fastify + Prisma + PostgreSQL)
├── docs/                      (modelagem, sprints, openspec)
├── package.json               (scripts orquestradores)
└── pnpm-workspace.yaml
```

---

## 🔧 Pré-requisitos

| Ferramenta | Versão mínima | Obrigatório |
|------------|---------------|-------------|
| [Node.js](https://nodejs.org/) | 20+ | Sim |
| [pnpm](https://pnpm.io/) | 9+ | Sim |
| [Docker](https://www.docker.com/) | 24+ | Sim (PostgreSQL + Redis + KCC) |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ | Sim |

> Instalar pnpm: `npm install -g pnpm`
> 
> **O KCC (Kindle Comic Converter) é executado em um container Docker dedicado.** 
> Antes da primeira conversão, construa a imagem: `pnpm kcc:build`

---

## 🚀 Como Iniciar o Projeto

### 1. Clonar e instalar dependências

```bash
git clone https://github.com/seu-usuario/mangaink-agent.git
cd mangaink-agent
pnpm install
```

### 2. Configurar variáveis de ambiente

#### Backend (`apps/backend/.env`)

Copie o arquivo de exemplo:
```bash
cp apps/backend/.env.example apps/backend/.env
```

Edite `apps/backend/.env` com suas configurações:
```env
DATABASE_URL="postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db"
JWT_SECRET="sua-chave-secreta-aqui-min-32-chars"
PORT=3333
KCC_DOCKER_IMAGE=mangaink-kcc:10.3.0
```

#### Frontend (`apps/frontend/.env`)

```bash
# apps/frontend/.env
VITE_API_URL=http://localhost:3333
```

### 3. Subir o banco de dados

```bash
pnpm docker:up
```

### 4. Construir imagem Docker do KCC

```bash
pnpm kcc:build
```

> O KCC (Kindle Comic Converter) converte as imagens em EPUB/MOBI. 
> A imagem Docker `mangaink-kcc:10.3.0` contém Python, KCC 10.3.0 e KindleGen.
> Esta etapa só precisa ser executada uma vez (ou quando a imagem for atualizada).

### 5. Rodar as migrations do Prisma

```bash
pnpm db:migrate
pnpm db:generate
```

### 6. Iniciar o projeto

#### Ambos simultaneamente (recomendado):
```bash
pnpm dev:full
```

#### Separadamente:
```bash
# Terminal 1 — Frontend (http://localhost:5173)
pnpm dev

# Terminal 2 — Backend (http://localhost:3333)
pnpm dev:backend
```

---

## 📋 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Inicia o frontend em `localhost:5173` |
| `pnpm dev:backend` | Inicia o backend em `localhost:3333` |
| `pnpm dev:full` | Inicia frontend e backend simultaneamente |
| `pnpm build` | Build de produção do frontend |
| `pnpm build:backend` | Build de produção do backend (tsc) |
| `pnpm lint` | ESLint em todos os pacotes |
| `pnpm format` | Prettier em todos os pacotes |
| `pnpm test` | Executa os testes do backend |
| `pnpm kcc:build` | Constrói a imagem Docker do KCC |
| `pnpm docker:up` | Inicia PostgreSQL + Redis via Docker |
| `pnpm docker:down` | Para e remove containers PostgreSQL + Redis |
| `pnpm db:migrate` | Executa as migrations do Prisma |
| `pnpm db:push` | Push do schema sem migration |
| `pnpm db:studio` | Abre o Prisma Studio (GUI do banco) |
| `pnpm storybook` | Inicia o Storybook em `localhost:6006` |

---

## 🧪 Como Testar

### Testes do Backend (Vitest)

```bash
# Rodar todos os testes (uma vez)
pnpm test

# Rodar testes em modo watch
pnpm --filter @mangaink/backend test:watch
```

> Os testes do backend usam um banco de dados de teste separado. Certifique-se de ter o arquivo `apps/backend/.env.test` configurado:
> ```env
> DATABASE_URL="postgresql://mangaink:mangaink@localhost:5432/mangaink_test"
> ```

### Testar a API manualmente

Com o backend rodando, acesse a documentação interativa Swagger:

```
http://localhost:3333/api-docs
```

#### Fluxo de autenticação via cURL:

```bash
# 1. Registrar novo usuário
curl -X POST http://localhost:3333/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Teste", "email": "teste@email.com", "password": "senha123"}'

# 2. Fazer login e obter JWT
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "teste@email.com", "password": "senha123"}'

# 3. Acessar rota protegida com o token
curl http://localhost:3333/users/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### Testar o Frontend

Com ambos rodando (`pnpm dev:full`):

1. Acesse `http://localhost:5173`
2. Registre um novo usuário ou faça login
3. Navegue pelas funcionalidades: Wizard, Biblioteca, Agendamentos, Configurações

---

## 🐳 Docker

### Infraestrutura (PostgreSQL + Redis)

```bash
# Iniciar
pnpm docker:up

# Parar
pnpm docker:down
```

### Imagem do KCC (Kindle Comic Converter)

```bash
# Construir imagem (executar uma vez)
pnpm kcc:build

# Testar a imagem
docker run --rm mangaink-kcc:10.3.0 --help
```

> O backend executa o KCC via `docker run` com bind mounts para os diretórios de input/output.
> A imagem contém Python 3.11, KCC 10.3.0, p7zip, unrar e KindleGen (MOBI/AZW3).
> Formato KFX não está disponível (requer Kindle Previewer, fora de escopo).

---

## 📖 Documentação

- [Modelagem do banco de dados](./docs/modelagem.md)
- [Sprints e roadmap](./docs/sprints.md)
- [OpenAPI Spec](./docs/openspec/)
- [Swagger UI](http://localhost:3333/api-docs) (requer backend rodando)

---

## 🛠️ Tech Stack

**Frontend**
- React 19 + TypeScript + Vite 7
- TanStack Router (file-based routing)
- TanStack Query
- Tailwind CSS v4 + Radix UI (shadcn/ui)
- react-hook-form + Zod

**Backend**
- Fastify 5 + TypeScript
- Prisma 7 (ORM) + PostgreSQL
- JWT (autenticação)
- Zod (validação)
- Swagger/OpenAPI

---

## 📄 Licença

MIT
