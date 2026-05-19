# Modelagem do Banco de Dados — MangaForge

PostgreSQL — versão alinhada com o domínio do projeto.

---

## 1. `users` — Usuários

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    kindle_email    VARCHAR(255),
    avatar_url      TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```

| Campo | Motivo |
|---|---|
| `kindle_email` | E-mail do dispositivo Kindle para envio direto |
| `is_active` | Soft delete / desativação sem perder dados |

---

## 2. `sources` — Fontes de mangá

```sql
CREATE TABLE sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    base_url        TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

| Campo | Motivo |
|---|---|
| `config` JSONB | Cada fonte tem parâmetros diferentes (API key, rate limit, seletores CSS) |

---

## 3. `series` — Mangás/Séries

```sql
CREATE TABLE series (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id       UUID REFERENCES sources(id) ON DELETE SET NULL,
    title           VARCHAR(500) NOT NULL,
    slug            VARCHAR(500) NOT NULL,
    author          VARCHAR(255),
    description     TEXT,
    cover_url       TEXT,
    source_url      TEXT NOT NULL,
    status          VARCHAR(20) DEFAULT 'ongoing'
                        CHECK (status IN ('ongoing','completed','hiatus','cancelled')),
    is_favorite     BOOLEAN DEFAULT false,
    last_checked_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(user_id, slug)
);

CREATE INDEX idx_series_user_id ON series(user_id);
CREATE INDEX idx_series_favorite ON series(user_id, is_favorite);
```

| Campo | Motivo |
|---|---|
| `slug` | URL amigável na biblioteca (`/biblioteca/meu-manga`) |
| `source_url` | Link original na fonte para scraping/atualização |
| `last_checked_at` | Controle de quando foi verificado por novos capítulos |
| `is_favorite` | Filtro rápido na UI da biblioteca |

---

## 4. `chapters` — Capítulos

```sql
CREATE TABLE chapters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id       UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    chapter_number  NUMERIC(10,2) NOT NULL,
    title           VARCHAR(500),
    source_url      TEXT NOT NULL,
    page_count      INTEGER,
    is_read         BOOLEAN DEFAULT false,
    published_at    DATE,
    created_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(series_id, chapter_number)
);

CREATE INDEX idx_chapters_series_id ON chapters(series_id);
CREATE INDEX idx_chapters_number ON chapters(series_id, chapter_number);
```

| Campo | Motivo |
|---|---|
| `chapter_number NUMERIC(10,2)` | Suporta capítulos como "10.5", "100.1" (extras) |
| `is_read` | Controle de leitura do usuário |
| `page_count` | Exibição na UI e estimativa de tamanho do arquivo |

---

## 5. `conversion_jobs` — Trabalhos de conversão

```sql
CREATE TYPE job_status AS ENUM (
    'pending','downloading','converting','packaging','sending','completed','failed','cancelled'
);

CREATE TYPE output_format AS ENUM ('epub','mobi','cbz','kfx');

CREATE TABLE conversion_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    series_id       UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    status          job_status DEFAULT 'pending',
    output_format   output_format NOT NULL,
    kindle_preset   VARCHAR(50) DEFAULT 'kindle_paperwhite',
    chapter_ids     UUID[] NOT NULL,
    file_path       TEXT,
    file_size_bytes BIGINT,
    error_message   TEXT,
    progress        SMALLINT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jobs_user_id ON conversion_jobs(user_id);
CREATE INDEX idx_jobs_status ON conversion_jobs(status);
CREATE INDEX idx_jobs_user_status ON conversion_jobs(user_id, status);
```

| Campo | Motivo |
|---|---|
| `chapter_ids UUID[]` | Seleção de capítulos; job é imutável após criado |
| `kindle_preset` | Perfil do dispositivo (Paperwhite, Oasis, etc.) |
| `progress` | Barra de progresso na UI (0–100) |
| `file_path` | Caminho do arquivo convertido no storage local |
| `file_size_bytes` | Validação de limite do e-mail Kindle (50 MB) |

---

## 6. `subscriptions` — Assinaturas/Agendamentos

```sql
CREATE TYPE schedule_frequency AS ENUM ('daily','weekly','manual');

CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    series_id       UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    frequency       schedule_frequency DEFAULT 'daily',
    output_format   output_format NOT NULL DEFAULT 'epub',
    kindle_preset   VARCHAR(50) DEFAULT 'kindle_paperwhite',
    is_active       BOOLEAN DEFAULT true,
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(user_id, series_id)
);

CREATE INDEX idx_subs_user_id ON subscriptions(user_id);
CREATE INDEX idx_subs_active_next ON subscriptions(is_active, next_run_at);
```

| Campo | Motivo |
|---|---|
| `frequency` | Frequência de verificação de novos capítulos |
| `next_run_at` | Usado pelo scheduler/cron para buscar próximos jobs |
| `UNIQUE(user_id, series_id)` | Uma assinatura por série por usuário |

---

## 7. `delivery_logs` — Histórico de envios

```sql
CREATE TABLE delivery_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID NOT NULL REFERENCES conversion_jobs(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kindle_email    VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('sent','failed','rejected')),
    error_message   TEXT,
    sent_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_delivery_job ON delivery_logs(job_id);
CREATE INDEX idx_delivery_user ON delivery_logs(user_id);
```

---

## 8. `user_settings` — Configurações por usuário

```sql
CREATE TABLE user_settings (
    user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_format          output_format DEFAULT 'epub',
    default_kindle_preset   VARCHAR(50) DEFAULT 'kindle_paperwhite',
    kindle_email            VARCHAR(255),
    smtp_host               VARCHAR(255),
    smtp_port               INTEGER DEFAULT 587,
    smtp_user               VARCHAR(255),
    smtp_password_encrypted TEXT,
    storage_path            TEXT DEFAULT '/data/converted',
    max_concurrent_jobs     SMALLINT DEFAULT 3,
    updated_at              TIMESTAMPTZ DEFAULT now()
);
```

| Campo | Motivo |
|---|---|
| `smtp_*` | Configuração de envio de e-mail para o Kindle |
| `smtp_password_encrypted` | Senha nunca em texto plano |
| `storage_path` | Onde os arquivos convertidos ficam armazenados |
| `max_concurrent_jobs` | Limite de conversões simultâneas por usuário |

---

## Diagrama de relacionamentos

```
users ──┬── series ──┬── chapters
        │            │
        ├── conversion_jobs ── delivery_logs
        │
        ├── subscriptions
        │
        └── user_settings (1:1)

sources ── series
```

---

## Decisões de design

| Decisão | Motivo |
|---|---|
| **UUID como PK** | Facilita sistemas distribuídos, evita enumeração |
| **`NUMERIC` para chapter_number** | Suporta capítulos como "10.5", "100.1" |
| **`JSONB` em sources.config** | Cada fonte tem parâmetros diferentes |
| **`ENUM` para status/formatos** | Integridade no banco, sem tabelas lookup |
| **`chapter_ids UUID[]` em jobs** | Job é imutável após criado; evita tabela intermediária |
| **Separar `user_settings`** | Configurações raramente mudam; evita SELECT de colunas pesadas em `users` |
| **`updated_at` em todas as tabelas** | Essencial para cache, sync e debugging |
| **`ON DELETE CASCADE` em dados do usuário** | Limpeza automática ao remover conta |
| **`ON DELETE SET NULL` em source_id** | Série não é perdida se a fonte for removida |
