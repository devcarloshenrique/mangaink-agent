# bin-to-kcc-docker — Especificacao

> **Status:** PROPOSED
> **Data:** 2026-07-13
> **Modulo:** `conversion`

---

## Purpose

Migrar a execucao do KCC de um binario Windows nativo para um container Docker dedicado. O backend continua rodando nativamente — apenas a chamada `child_process.spawn` passa a invocar `docker run` com volumes montados para os diretorios de entrada e saida.

A API de conversao, os presets, as flags e todo o contrato publico permanecem identicos. A unica mudanca visivel ao usuario e a remocao do formato KFX do catalogo de opcoes.

---

## Requirements

### Requirement: Imagem Docker do KCC

The system MUST provide a Docker image containing Python 3, KindleComicConverter 10.3.0, and all system dependencies.

#### Scenario: Build da imagem

- **WHEN** o desenvolvedor executa `pnpm kcc:build`
- **THEN** a imagem `mangaink-kcc:10.3.0` e construida com sucesso
- **THEN** `docker run --rm mangaink-kcc:10.3.0 kcc-c2e --help` imprime a ajuda do KCC

#### Scenario: Dependencias de sistema presentes

- **WHEN** a imagem e inspecionada
- **THEN** `p7zip-full` e `unrar` estao instalados (necessarios para CBZ/CBR)
- **THEN** `kindlegen` esta disponivel em `/usr/local/bin/kindlegen` ou ausente com warning (necessario para MOBI)

#### Scenario: Versao pinada do KCC

- **WHEN** `kcc-c2e --version` e executado no container
- **THEN** a versao reportada e 10.3.0 (mesma do binario Windows atual)

#### Scenario: KindleGen indisponivel (fallback)

- **WHEN** o download do KindleGen falha (URL offline)
- **THEN** o build da imagem NAO quebra (usa `|| echo` para fallback)
- **THEN** um warning e emitido: "AVISO: KindleGen nao disponivel. MOBI nao funcionara."

---

### Requirement: Substituicao de spawn(binario) por spawn('docker', ['run', ...])

The system MUST execute KCC via `docker run` with proper volume mounts, user mapping, and path translation.

#### Scenario: Volume mounts corretos

- **WHEN** `KccRunnerService.run()` e chamado com `inputPath=/abs/.../temp/input` e `outputPath=/abs/.../output`
- **THEN** o comando Docker inclui `-v /abs/.../temp/input:/input:ro`
- **THEN** o comando Docker inclui `-v /abs/.../output:/output`
- **THEN** as flags KCC usam paths do container: `-o /output /input`

#### Scenario: Permissoes de arquivo no Linux

- **WHEN** o backend roda em Linux (`process.platform === 'linux'`)
- **THEN** o comando Docker inclui `--user <uid>:<gid>` com UID/GID do processo atual
- **THEN** arquivos gerados em `/output` pertencem ao usuario do host, nao ao root

#### Scenario: Sem `--user` no Windows/macOS

- **WHEN** o backend roda em Windows ou macOS
- **THEN** o comando Docker NAO inclui `--user`
- **THEN** permissoes sao gerenciadas pelo Docker Desktop

#### Scenario: Home e workdir no container

- **WHEN** o container Docker e iniciado
- **THEN** `--workdir /tmp` e definido (evita escrita no `/input`)
- **THEN** `-e HOME=/tmp` e definido (evita erro de home ausente para usuario nao-root)

#### Scenario: Container efemero

- **WHEN** o processo KCC termina (sucesso ou falha)
- **THEN** o container e removido automaticamente (`--rm`)

#### Scenario: Captura de progresso mantida

- **WHEN** o KCC emite progresso via stdout (ex: "Processing page 42/100 (42%)")
- **THEN** o regex `/(\d+)%/` extrai a porcentagem
- **THEN** eventos SSE `conversion.progress` sao emitidos com o progresso

#### Scenario: Captura de erro mantida

- **WHEN** o KCC falha com codigo de saida diferente de 0
- **THEN** stderr (ou stdout) e usado como diagnostico
- **THEN** `KccExecutionError` e lancado com `exitCode` e `diagnostic`

#### Scenario: Leitura do output pos-KCC mantida

- **WHEN** o KCC termina com sucesso
- **THEN** `readdir(absoluteOutputPath)` le o diretorio de saida no host
- **THEN** o arquivo gerado e identificado e seu tamanho calculado via `stat()`
- **THEN** `KccRunResult` e retornado com `outputFile` e `outputSize`

---

### Requirement: Flag mapper agnostico ao Docker

The system MUST keep the KCC flag mapping logic unaware of Docker. Only the runner service wraps the command.

#### Scenario: `mapOptionsToFlags()` inalterada

- **WHEN** opcoes semanticas sao fornecidas (ex: `{ mangaMode: true, cropping: 'margins' }`)
- **THEN** as mesmas flags CLI de antes sao geradas (ex: `['-m', '-c', '1', '-p', 'K11', '-f', 'EPUB']`)
- **THEN** 27 testes existentes passam sem nenhuma alteracao

#### Scenario: `buildKccCommand()` usa paths e comando do container

- **WHEN** `buildKccCommand(options, 'KPW5', 'EPUB', '/input', '/output')` e chamado
- **THEN** retorna `{ command: 'kcc-c2e', args: ['-p', 'KPW5', '-f', 'EPUB', '-o', '/output', '/input'] }`
- **THEN** nao recebe parametro `kccBinPath` (removido da assinatura)
- **THEN** `command` e sempre `'kcc-c2e'`

#### Scenario: `getKccBinaryPath()` removida

- **WHEN** o codigo e inspecionado
- **THEN** a funcao `getKccBinaryPath()` nao existe mais em `kcc-flag-mapper.ts`

---

### Requirement: Variavel de ambiente `KCC_DOCKER_IMAGE`

The system MUST use a Docker image reference instead of a binary path for KCC execution.

#### Scenario: Configuracao padrao

- **WHEN** `KCC_DOCKER_IMAGE` nao esta definida no ambiente
- **THEN** o valor default `mangaink-kcc:10.3.0` e usado

#### Scenario: Configuracao customizada

- **WHEN** `KCC_DOCKER_IMAGE=registry.exemplo.com/kcc:latest` esta definida
- **THEN** o `docker run` usa a imagem customizada

#### Scenario: Variavel antiga removida

- **WHEN** o codigo e inspecionado
- **THEN** `KCC_BIN_PATH` nao existe mais em `env.ts`

---

### Requirement: Remocao do formato KFX

The system MUST remove KFX from the output format catalog, as it requires Kindle Previewer (not bundled in the Docker image).

#### Scenario: KFX ausente do catalogo

- **WHEN** o frontend chama `GET /api/conversions/options`
- **THEN** o array `formats` NAO contem `{ id: 'KFX', name: 'KFX' }`

#### Scenario: EPUB continua como default

- **WHEN** o frontend chama `GET /api/conversions/options`
- **THEN** `EPUB` continua sendo o formato com `default: true`

#### Scenario: Demais formatos mantidos

- **WHEN** o frontend chama `GET /api/conversions/options`
- **THEN** `EPUB`, `MOBI`, `CBZ`, `PDF`, `MOBI+EPUB` estao presentes

---

### Requirement: Verificacao de disponibilidade do Docker

The system SHOULD warn early if Docker is not available, preventing cryptic spawn errors.

#### Scenario: Docker disponivel

- **WHEN** o worker inicia ou a primeira conversao e solicitada
- **THEN** `docker --version` e executado com sucesso
- **THEN** nenhum warning e emitido

#### Scenario: Docker indisponivel

- **WHEN** `docker --version` falha (comando nao encontrado)
- **THEN** um erro claro e logado: "Docker nao encontrado. Instale Docker e rode: pnpm kcc:build"
- **THEN** o worker continua operando (o erro so ocorrera na primeira conversao)

---

### Requirement: Script de build `pnpm kcc:build`

The system MUST provide a convenient way to build the KCC Docker image via the monorepo's package manager.

#### Scenario: Build via pnpm

- **WHEN** o desenvolvedor executa `pnpm kcc:build` na raiz do monorepo
- **THEN** `docker build -f docker/Dockerfile.kcc -t mangaink-kcc:10.3.0 .` e executado
- **THEN** a imagem e construida com sucesso

---

### Requirement: Compatibilidade com pipeline de conversao existente

The system MUST NOT break any existing conversion behavior, SSE events, or storage layout.

#### Scenario: Worker pipeline inalterado

- **WHEN** o worker executa um job de conversao completo
- **THEN** as fases sao: download -> hard links -> ComicInfo.xml -> capa -> KCC (agora via Docker) -> packaging
- **THEN** `syncStatus()` e chamado apos cada atualizacao
- **THEN** eventos SSE sao emitidos nos mesmos canais Redis

#### Scenario: Storage layout inalterado

- **WHEN** uma conversao e concluida
- **THEN** a estrutura `conversions/{convId}/jobs/{jobId}/` permanece identica
- **THEN** `temp/` e limpo apos o job
- **THEN** `output/` contem o EPUB/MOBI final

#### Scenario: Renomeacao de output mantida

- **WHEN** o KCC gera o arquivo (ex: `One Piece 001 - Romance Dawn.epub`)
- **THEN** o worker renomeia para o titulo sanitizado (ex: `One Piece - Romance Dawn.epub`)

---

## NOT YET IMPLEMENTED (Future Enhancements)

- **KFX support:** Adicionar Kindle Previewer a imagem Docker para suporte KFX
- **Publicacao em registry:** Publicar `mangaink-kcc:10.3.0` em um container registry
- **Multi-arch build:** Suporte a ARM64 para execucao em Apple Silicon / AWS Graviton
- **Network isolation:** Adicionar `--network none` para isolamento maximo do container KCC
- **Health check do container:** Verificar se a imagem KCC existe antes de iniciar conversao
