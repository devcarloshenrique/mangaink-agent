# bin-to-kcc-docker — Proposta

> **Status:** PROPOSED
> **Data:** 2026-07-13
> **Modulo:** `conversion`

---

## 1. Problema

O KCC (Kindle Comic Converter) atualmente e executado como um binario Windows (`.exe`) via `child_process.spawn`, localizado em `apps/backend/bin/kcc/windows/kcc_c2e_10.3.0.exe`. Isso impoe as seguintes limitacoes:

1. **Amarracao ao Windows** — o binario `.exe` nao executa em servidores Linux de producao.
2. **Dependencia de bibliotecas do host** — Python, 7z e unrar precisam estar instalados no sistema operacional do host.
3. **Fragilidade de ambiente** — cada maquina de desenvolvimento precisa ter o binario correto copiado para o caminho esperado.
4. **Impossibilidade de escalar** — nao e possivel executar conversoes em containers ou orquestradores (Kubernetes, ECS) sem o binario nativo.

A migracao para Docker resolve todos esses problemas: o KCC e executado como um `docker run` efemero, com todas as dependencias encapsuladas em uma imagem, funcionando identicamente em Windows, Linux e macOS.

## 2. Solucao Proposta

### 2.1. Imagem Docker Dedicada

Criar uma imagem `mangaink-kcc:10.3.0` contendo:

- Python 3.11 (slim-bookworm)
- KindleComicConverter 10.3.0 (pinado via pip — mesma versao do binario atual)
- p7zip-full e unrar (dependencias do KCC para CBZ/CBR)
- KindleGen (binario 32-bit para suporte MOBI/AZW3)
- Bibliotecas i386 (`libc6:i386`, `libstdc++6:i386`, `libgcc-s1:i386`)

O backend **continua rodando nativamente** — nao e containerizado. Apenas a execucao do KCC passa a ser um `docker run`.

### 2.2. Substituicao de `spawn(binario)` por `spawn('docker', ['run', ...])`

O `KccRunnerService` substitui a invocacao do binario por um comando Docker:

```
docker run --rm \
  --workdir /tmp \
  -e HOME=/tmp \
  --user 1000:1000 \              # so em Linux
  -v /host/abs/temp/input:/input:ro \
  -v /host/abs/output:/output \
  mangaink-kcc:10.3.0 \
  kcc-c2e <flags> -o /output /input
```

- **Volumes**: `temp/input` e `output` sao montados como `/input` e `/output` no container
- **Permissoes**: `--user` mapeia UID/GID do host para que arquivos de saida pertencam ao usuario correto (Linux apenas)
- **Home e workdir**: `/tmp` evita que KCC tente escrever em `~/.kcc` como root
- **Input read-only**: `:ro` por seguranca — KCC apenas le imagens

### 2.3. Flag Mapper Agnostic ao Docker

`buildKccCommand()` em `kcc-flag-mapper.ts` continua emitindo o comando KCC puro (`kcc-c2e` + flags + paths do container `/input`, `/output`). O `kcc-runner.service.ts` e quem envolve isso em `docker run`. `mapOptionsToFlags()` permanece **intocada** — zero alteracoes nos testes existentes.

### 2.4. Remocao do Formato KFX

O formato KFX requer Kindle Previewer (ferramenta separada do KindleGen). Nesta migracao, KFX e removido do catalogo (`formats.ts`). EPUB e MOBI cobrem todos os Kindles modernos. KFX podera ser readicionado futuramente com Kindle Previewer na imagem.

---

## 3. Escopo

### Incluido

- [ ] `docker/Dockerfile.kcc` — imagem Python + KCC 10.3.0 + KindleGen + dependencias
- [ ] Script `pnpm kcc:build` no `package.json` raiz
- [ ] `KCC_BIN_PATH` → `KCC_DOCKER_IMAGE` em `env.ts`
- [ ] `kcc-runner.service.ts` — `spawn(binario)` → `spawn('docker', dockerArgs)`
- [ ] `kcc-flag-mapper.ts` — `buildKccCommand()` usa `'kcc-c2e'` e paths do container
- [ ] Remocao de `getKccBinaryPath()` obsoleta
- [ ] Remocao de KFX de `formats.ts`
- [ ] Remocao de `cwd`, `windowsHide` do `spawn` atual
- [ ] Tratamento cross-platform do `--user` (Linux vs Windows)
- [ ] Verificacao de disponibilidade do Docker no startup
- [ ] Atualizacao de documentacao (CLAUDE.md, env vars)

### Fora de Escopo

- [ ] Suporte a KFX (requer Kindle Previewer — migracao futura)
- [ ] Containerizacao do backend (backend continua rodando nativo)
- [ ] Publicacao da imagem em registry (build local por enquanto)
- [ ] Alteracao nos presets, devices ou logica de conversao

---

## 4. Criterios de Aceitacao

1. `pnpm kcc:build` constroi a imagem `mangaink-kcc:10.3.0` com sucesso.
2. `docker run mangaink-kcc:10.3.0 kcc-c2e --help` imprime a ajuda do KCC.
3. `mapOptionsToFlags()` produz as mesmas flags de antes — 27 testes existentes passam sem alteracao.
4. `buildKccCommand()` retorna `{ command: 'kcc-c2e', args: [..., '-o', '/output', '/input'] }`.
5. `KccRunnerService.run()` monta volumes corretamente e executa `docker run` com os argumentos esperados.
6. Arquivos de saida (EPUB/MOBI) pertencem ao usuario do host (nao root).
7. Em Linux, `--user` e aplicado com UID/GID corretos. Em Windows, `--user` e omitido.
8. Se Docker nao estiver instalado, o worker emite erro claro: "Docker nao encontrado".
9. `GET /api/conversions/options` **nao** retorna KFX no array de formatos.
10. Conversao com formato MOBI gera `.mobi` valido (KindleGen funcional no container).
11. Backend processa uma conversao completa (download + KCC via Docker + packaging) sem erros.

---

## 5. Dependencias

- Docker Engine instalado no host (nova dependencia de infraestrutura)
- Modulo `conversion` existente (worker, repositorios, SSE)
- Modulo `scraping` existente (sourceId, metadados, URLs de imagens)
- Redis + BullMQ (ja configurados)
- `kcc-flag-mapper.ts` — mapeamento de flags existente (intocado)
