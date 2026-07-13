# bin-to-kcc-docker — Design de Arquitetura

> **Status:** PROPOSED
> **Data:** 2026-07-13
> **Ultima revisao:** 2026-07-13 — Revisao apos analise do codigo atual: 10 inconsistencias corrigidas.

---

## 1. Motivacao

O binario Windows do KCC (`kcc_c2e_10.3.0.exe`) e o unico componente que impede a execucao do backend em Linux. O KCC e um pacote Python (`KindleComicConverter`) que pode ser instalado via pip e executado em qualquer plataforma. A abordagem mais limpa e encapsula-lo em uma imagem Docker dedicada, mantendo o backend rodando nativamente — apenas a chamada `spawn(binario)` e substituida por `spawn('docker', ['run', ...])`.

## 2. Decisao: Imagem Dedicada vs. Dockerizar Tudo

| Abordagem | Pros | Contras |
|---|---|---|
| **Imagem dedicada (escolhida)** | Backend continua nativo; mudanca minima no codigo; KCC isolado | Docker daemon como nova dependencia |
| Dockerizar backend + KCC juntos | Tudo em container | Requer reestruturar todo o ambiente (PostgreSQL, Redis, volumes) |
| Microservico KCC com API HTTP | Desacoplamento total | Complexidade extra (API, autenticacao, coordenacao) |

**Decisao:** Imagem dedicada. O backend chama `docker run` como se fosse `spawn` — a interface do `KccRunnerService.run()` nao muda. A unica diferenca e o comando executado.

## 3. Fluxo da Chamada Docker

```
KccRunnerService.run(jobId, options, deviceId, format, inputPath, outputPath, title)
  |
  +-- resolve(inputPath)  -> /home/user/.../temp/input
  +-- resolve(outputPath) -> /home/user/.../output
  |
  +-- buildKccCommand(options, deviceId, format, '/input', '/output')
  |     Retorna: { command: 'kcc-c2e', args: ['-m', '-u', '-p', 'KPW5', ...] }
  |
  +-- Constroi dockerArgs:
  |     ['run', '--rm', '--workdir', '/tmp', '-e', 'HOME=/tmp',
  |      ...(Linux ? ['--user', `${uid}:${gid}`] : []),
  |      '-v', `${absInput}:/input:ro`,
  |      '-v', `${absOutput}:/output`,
  |      env.KCC_DOCKER_IMAGE,
  |      ...kccArgs]
  |
  +-- spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
       |
       +-- stdout -> regex /(\d+)%/ -> SSE conversion.progress
       +-- stderr -> acumula para diagnostico de erro
       +-- close -> le diretorio output (host path) -> resolve KccRunResult
```

### 3.1. Traducao de Paths

| Contexto | Path de Input | Path de Output |
|---|---|---|
| **Host** (worker) | `/abs/storage/.../temp/input` | `/abs/storage/.../output` |
| **Docker mount** | `-v /abs/.../temp/input:/input:ro` | `-v /abs/.../output:/output` |
| **Container** (kcc-c2e) | `/input` | `/output` |

O `kcc-runner.service.ts` ja resolve paths para absolutos (linhas 48-49). As flags `-o` e o argumento posicional usam os paths **do container** (`/input`, `/output`), enquanto os mounts `-v` usam os paths absolutos **do host**.

### 3.2. Leitura do Output Pos-KCC

Apos o `docker run` terminar, o `kcc-runner.service.ts` le o diretorio `absoluteOutputPath` (host) com `readdir()` para descobrir o arquivo gerado (linhas 97-98 do codigo atual). Isso **continua funcionando** porque o diretorio de saida do container e um bind mount do diretorio do host — o arquivo gerado dentro do container aparece no host instantaneamente.

## 4. Mapeamento de Flags — Separacao de Responsabilidades

### 4.1. `mapOptionsToFlags()` — INTOCADA

Esta funcao converte opcoes semanticas em flags CLI do KCC. Nao sabe nada sobre Docker, nem sobre paths. Seus 27 testes existentes permanecem identicos.

### 4.2. `buildKccCommand()` — Ajuste Minimo

```typescript
// ANTES (atual):
export function buildKccCommand(
  options: KccOptions,
  deviceId: string,
  format: string,
  inputPath: string,      // path do host: /abs/.../temp/input
  outputPath: string,     // path do host: /abs/.../output
  kccBinPath: string,     // bin/kcc/windows/kcc_c2e_10.3.0.exe
): { command: string; args: string[] }

// DEPOIS (proposto):
export function buildKccCommand(
  options: KccOptions,
  deviceId: string,
  format: string,
  inputPath: string,      // path do container: /input
  outputPath: string,     // path do container: /output
): { command: string; args: string[] }
```

Mudancas:
- Remove parametro `kccBinPath`
- `command` hardcoded como `'kcc-c2e'` (CLI dentro do container)
- Paths sao do container (`/input`, `/output`), nao do host
- `mapOptionsToFlags()` continua sendo chamada do mesmo jeito

### 4.3. `getKccBinaryPath()` — REMOVIDA

Funcao trivial (linha 227-229) que apenas retorna o parametro recebido. Sem proposito com Docker.

## 5. Tratamento Cross-Platform do `--user`

```typescript
// No kcc-runner.service.ts
function buildUserArgs(): string[] {
  if (process.platform === 'linux') {
    try {
      const uid = process.getuid?.()
      const gid = process.getgid?.()
      if (uid !== undefined && gid !== undefined) {
        return ['--user', `${uid}:${gid}`]
      }
    } catch {
      // Fallback: roda como root (arriscado mas funcional)
    }
  }
  // Windows/macOS: Docker Desktop gerencia permissoes automaticamente
  return []
}
```

- **Linux**: `--user 1000:1000` garante que arquivos de saida pertencam ao usuario do host
- **Windows**: Docker Desktop usa SMB/CIFS para volumes — permissoes sao gerenciadas pelo Docker
- **macOS**: Docker Desktop usa osxfs — permissoes sao gerenciadas pelo Docker

## 6. Dockerfile — Imagem `mangaink-kcc:10.3.0`

```dockerfile
FROM python:3.11-slim-bookworm

# Dependencias de sistema: 7z, unrar para CBZ/CBR
RUN apt-get update && apt-get install -y --no-install-recommends \
    p7zip-full \
    unrar \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Suporte 32-bit para KindleGen (MOBI/AZW3)
RUN dpkg --add-architecture i386 \
    && apt-get update && apt-get install -y --no-install-recommends \
    libc6:i386 \
    libstdc++6:i386 \
    libgcc-s1:i386 \
    && rm -rf /var/lib/apt/lists/*

# KindleGen (necessario para MOBI)
# URL oficial da Amazon. Se falhar, mirror ou bundle local necessario.
RUN wget -q --timeout=30 \
    http://kindlegen.s3.amazonaws.com/kindlegen_linux_2.6_i386_v2_9.tar.gz \
    -O /tmp/kindlegen.tar.gz \
    && tar -xzf /tmp/kindlegen.tar.gz -C /usr/local/bin/ kindlegen \
    && rm /tmp/kindlegen.tar.gz \
    && chmod +x /usr/local/bin/kindlegen \
    || echo "AVISO: KindleGen nao disponivel. MOBI nao funcionara."

# KCC 10.3.0 (mesma versao do binario atual)
RUN pip3 install --no-cache-dir KindleComicConverter==10.3.0

WORKDIR /tmp
ENTRYPOINT ["kcc-c2e"]
```

### 6.1. Risco: KindleGen URL

A URL `http://kindlegen.s3.amazonaws.com/...` e HTTP e pode estar indisponivel (Amazon descontinuou o KindleGen em 2022). O Dockerfile usa `|| echo` para nao quebrar o build se o download falhar — a imagem sera construida sem KindleGen e o formato MOBI nao funcionara.

**Mitigacao:** Se a URL falhar, criar diretorio `docker/kindlegen/` com uma copia local do binario e alterar o Dockerfile para copia-lo via `COPY`.

## 7. Estrutura de Arquivos

```
mangaink-agent/
├── docker/
│   └── Dockerfile.kcc              ← NOVO: Imagem KCC
│
├── apps/backend/src/
│   ├── shared/config/env.ts        ← ALTERADO: KCC_BIN_PATH -> KCC_DOCKER_IMAGE
│   └── modules/conversion/
│       ├── config/
│       │   ├── kcc-flag-mapper.ts   ← ALTERADO: buildKccCommand() sem kccBinPath; remove getKccBinaryPath()
│       │   └── formats.ts          ← ALTERADO: remove KFX
│       ├── services/
│       │   └── kcc-runner.service.ts ← ALTERADO: spawn(binario) -> spawn('docker', dockerArgs)
│       └── tests/unit/
│           └── kcc-flag-mapper.test.ts ← SEM ALTERACAO (testa apenas mapOptionsToFlags)
│
└── package.json                    ← ALTERADO: adiciona script "kcc:build"
```

## 8. Decisoes de Seguranca

### 8.1. Input Read-Only

O mount de input usa `:ro` (read-only). KCC apenas le imagens do diretorio de entrada. O `ComicInfo.xml` e `cover.jpg` ja foram escritos pelo worker ANTES da chamada Docker. `--workdir /tmp` garante que o KCC nao tente criar arquivos temporarios no `/input`.

### 8.2. Sem Rede (Opcional Futuro)

KCC nao precisa de acesso a rede durante a conversao (KindleGen e pre-instalado). Pode-se adicionar `--network none` para isolamento maximo, mas nao nesta migracao inicial para evitar surpresas.

### 8.3. Remocao Automatica

`--rm` remove o container automaticamente apos a execucao, evitando acumulo de containers parados.

## 9. Dependencia do Docker Daemon

O backend agora requer Docker instalado e rodando. No startup do worker, uma verificacao simples:

```typescript
// No conversion-job.worker.ts ou em kcc-runner.service.ts
function checkDockerAvailable(): void {
  try {
    const { execSync } = require('node:child_process')
    execSync('docker --version', { stdio: 'ignore' })
  } catch {
    console.error(
      'Docker nao encontrado. Instale Docker e rode: pnpm kcc:build'
    )
  }
}
```

### 9.1. Docker Socket em Producao

Em ambientes de producao, o backend precisa de acesso ao socket do Docker (`/var/run/docker.sock`). O usuario que executa o backend deve estar no grupo `docker` ou ter permissao de leitura/escrita no socket.

## 10. Variaveis de Ambiente

| Variavel | Antes | Depois | Descricao |
|---|---|---|---|
| `KCC_BIN_PATH` | `bin/kcc/windows/kcc_c2e_10.3.0.exe` | **Removida** | Substituida por `KCC_DOCKER_IMAGE` |
| `KCC_DOCKER_IMAGE` | — | `mangaink-kcc:10.3.0` | **Nova**: nome/tag da imagem Docker do KCC |
| `CONVERSIONS_STORAGE_PATH` | `./storage/conversions` | inalterado | Diretorio raiz para saida de conversoes |
| `STORAGE_PATH` | `./storage` | inalterado | Diretorio raiz do cache de scraping |

## 11. Impacto em Testes

### 11.1. Testes Unitarios

- `kcc-flag-mapper.test.ts` (27 testes): **Zero alteracoes** — testa `mapOptionsToFlags()` que nao muda.
- `kcc-runner.service.test.ts`: **Nao existe**. Se fosse criado, mockaria `spawn('docker', ...)`.

### 11.2. Testes E2E

- `conversion.e2e.test.ts`: Mock do `KccRunnerService` permanece via dependencia injetada.
- Teste `GET /api/conversions/options`: Precisa verificar que KFX **nao** esta mais em `formats`.

## 12. Consideracoes de Performance

- **Inicializacao do container**: ~1-2 segundos (Python slim + KCC). Desprezivel para jobs que duram minutos.
- **Overhead de I/O**: Bind mounts tem performance nativa (sem camada de overlay). Hard links no host nao sao afetados.
- **Concorrencia**: Worker mantem `concurrency: 1` — um container KCC por vez. Sem risco de sobrecarregar o Docker.
