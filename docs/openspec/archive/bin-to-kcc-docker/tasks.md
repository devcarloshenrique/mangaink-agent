# bin-to-kcc-docker — Tasks de Implementacao

> **Status:** IN_PROGRESS
> **Data:** 2026-07-13

---

## 1. Imagem Docker do KCC

- [x] 1.1 Criar `docker/Dockerfile.kcc` com:
  - Base `python:3.11-slim-bookworm`
  - Instalar `p7zip-full`, `unrar`, `wget`, `git`, `ca-certificates` (dependencias de sistema)
  - Habilitar `contrib non-free non-free-firmware` em sources (Debian bookworm moveu `unrar` para non-free)
  - Adicionar arquitetura i386 e instalar `libc6:i386`, `libstdc++6:i386`, `libgcc-s1:i386`
  - Download do KindleGen (`kindlegen_linux_2.6_i386_v2_9.tar.gz`) com fallback `|| echo`
  - `pip3 install --no-cache-dir 'git+https://github.com/ciromattia/kcc.git@v10.3.0'`
    (KCC NAO esta no PyPI — instalado via git source da tag v10.3.0)
  - `WORKDIR /tmp`, `ENV HOME=/tmp` e `ENTRYPOINT ["kcc-c2e"]`

- [x] 1.2 Adicionar script `"kcc:build"` ao `package.json` raiz:
  ```json
  "kcc:build": "docker build -f docker/Dockerfile.kcc -t mangaink-kcc:10.3.0 ."
  ```

- [x] 1.3 Verificar que `pnpm kcc:build` constroi a imagem com sucesso
  (Build concluido em ~285s; imagem `mangaink-kcc:10.3.0` criada localmente)

- [x] 1.4 Verificar que `docker run --rm mangaink-kcc:10.3.0 --help` funciona
  (Saida: `comic2ebook v10.3.0 - Written by Ciro Mattia Gonano and Pawel Jastrzebski.`)

- [x] 1.5 Verificar que `kindlegen` esta no PATH do container:
  `docker run --rm --entrypoint sh mangaink-kcc:10.3.0 -c 'which kindlegen'`
  (Resultado: `/usr/local/bin/kindlegen` — `Amazon kindlegen(Linux) V2.9 build 1028-0897292`)

  **IMPLEMENTACAO DO MOBI:**
  Amazon descontinuou o KindleGen em 2022 e a URL S3 oficial retorna 403 Forbidden.
  Solucao aplicada (binario Linux versionado no repo):
    1. Download via Internet Archive Wayback Machine
       (snapshot de 2015-08-03 do `kindlegen_linux_2.6_i386_v2_9.tar.gz`)
    2. Extracao + validacao: ELF 32-bit i386, **estaticamente linkado** (sem deps libc6:i386)
    3. Commit em `docker/kindlegen/kindlegen` (~28MB)
    4. `COPY docker/kindlegen/kindlegen /usr/local/bin/kindlegen` no Dockerfile
    5. Removido o bloco `dpkg --add-architecture i386 && apt-get install libc6:i386 ...`
       (nao e mais necessario — kindlegen e estatico)
  Validacao end-to-end:
    - `kcc-c2e -p KPW5 -f MOBI -m -o /out /in/manga` → `manga.mobi` (45KB) OK
    - `kcc-c2e -p K11  -f MOBI+EPUB -m -o /out /in/manga` → `manga.mobi` (42KB) + `manga.epub` (20KB) OK

---

## 2. Variaveis de Ambiente

- [x] 2.1 Em `apps/backend/src/shared/config/env.ts`:
  - Removido `KCC_BIN_PATH`
  - Adicionado `KCC_DOCKER_IMAGE: z.string().default('mangaink-kcc:10.3.0')`

- [x] 2.2 `.env.test` e `.env` nao continham `KCC_BIN_PATH` — nada a remover.

- [x] 2.3 Atualizar documentacao de env vars (CLAUDE.md) — feito.

---

## 3. Flag Mapper (`kcc-flag-mapper.ts`)

- [x] 3.1 Em `buildKccCommand()`:
  - Removido parametro `kccBinPath` da assinatura
  - Hardcodado `command: 'kcc-c2e'` (tipo literal)
  - Documentado que `inputPath` e `outputPath` sao paths do container (`/input`, `/output`)

- [x] 3.2 Removida funcao `getKccBinaryPath()` (era nas linhas 227-229)

- [x] 3.3 Confirmado que `mapOptionsToFlags()` **nao** foi alterada

- [x] 3.4 `pnpm test` confirma que 27 testes do `kcc-flag-mapper.test.ts` passam sem alteracao

---

## 4. KCC Runner Service (`kcc-runner.service.ts`)

- [x] 4.1 Substituido `resolve(env.KCC_BIN_PATH)` por `env.KCC_DOCKER_IMAGE` (via `buildDockerArgs`)

- [x] 4.2 Removido `const kccDir = resolve(kccBinPath, '..')`

- [x] 4.3 Criada funcao auxiliar `buildDockerArgs(absInput, absOutput, kccArgs)`:
  ```
  [
    'run', '--rm',
    '--workdir', '/tmp',
    '-e', 'HOME=/tmp',
    ...buildUserArgs(),
    '-v', `${absInput}:/input:ro`,
    '-v', `${absOutput}:/output`,
    env.KCC_DOCKER_IMAGE,
    ...kccArgs,
  ]
  ```

- [x] 4.4 Criada funcao auxiliar `buildUserArgs()` com tratamento cross-platform:
  - Linux: `['--user', `${uid}:${gid}`]` via `process.getuid/getgid`
  - Windows/macOS: `[]`

- [x] 4.5 Alterada chamada `buildKccCommand()` para passar paths do container:
  ```typescript
  buildKccCommand(options, deviceId, format, '/input', '/output')
  ```

- [x] 4.6 Alterado `spawn` para `spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] })`
  - Removidos `cwd`, `env: { ...process.env }`, `windowsHide`

- [x] 4.7 Logica de stdout/stderr/close mantida identica (regex `/(\d+)%/`, acumulo stderr, `readdir`, `KccExecutionError`)

- [x] 4.8 Adicionada `checkDockerAvailable()` que roda `docker --version` no primeiro `run()`.
  Falhou claramente: `"❌ Docker não encontrado. Instale o Docker e rode: pnpm kcc:build"` (singular via flag `dockerChecked`).

---

## 5. Formatos (`formats.ts`)

- [x] 5.1 Removida entrada `{ id: 'KFX', name: 'KFX' }` do array `formats`

---

## 6. Testes

- [x] 6.1 `pnpm test`: 328 testes — 327 passaram + 1 flaky em `cancel-conversion.use-case.test.ts`
  (assertao temporal `updatedAt !== createdAt` — passa isoladamente; independente da migracao)
  Total anterior era 287; novos 41 = 38 do `kcc-command.test.ts` (nao, 3) + ajustes previos do repo.
  Reconferido apos mudancas: nenhum teste de `kcc-flag-mapper` (27) quebrou.

- [x] 6.2 Teste E2E `conversion.e2e.test.ts` atualizado com assertion de KFX:
  `it('formats NÃO deve conter KFX (requer Kindle Previewer — fora de escopo)')`

- [x] 6.3 Adicionado teste unitario `kcc-command.test.ts` (3 testes) para `buildKccCommand()`:
  - command === 'kcc-c2e'
  - args incluem `-o /output` e ultima posicao `/input`
  - assinatura sem `kccBinPath`

- [x] 6.4 Teste unitario para `buildUserArgs()`, `buildDockerArgs()` e `checkDockerAvailable()` criado em `kcc-runner.service.test.ts`:
  - `buildUserArgs`: 4 testes (win32, macOS, Linux com getuid/getgid, Linux com fallback)
  - `buildDockerArgs`: 3 testes (estrutura docker run, bind mounts, imagem KCC + args)
  - `checkDockerAvailable`: 1 teste (verifica que nao emite erro quando Docker disponivel)

---

## 7. Integracao e Validacao Manual

- [x] 7.1 Construir imagem: `pnpm kcc:build` — concluido com sucesso (285s)

- [ ] 7.2 Iniciar infraestrutura: `pnpm docker:up` — pendente (validacao do usuario)

> Scripts `docker:up` e `docker:down` adicionados ao `package.json` raiz apontando para `apps/backend/docker-compose.yml`.

- [ ] 7.3 Iniciar backend: `pnpm dev:backend` — pendente

- [ ] 7.4 Executar uma conversao completa via API — pendente (depende 7.2/7.3)

- [x] 7.5 **Repetir com formato MOBI:** IMPLEMENTADO E VALIDADO.
   KindleGen V2.9 (Linux i386 estatico, obtido via Wayback Machine) commitado em
   `docker/kindlegen/kindlegen` e copiado para `/usr/local/bin/kindlegen` no Dockerfile.
   Validado: `kcc-c2e -f MOBI` gera `.mobi` valido; `kcc-c2e -f MOBI+EPUB` gera ambos.

- [ ] 7.6 Verificar permissoes: `ls -l storage/conversions/.../output/*.epub` — pendente (ambiente Linux)

- [ ] 7.7 Verificar remocao dos containers (`docker ps -a`) — pendente (apos conversao real)

---

## 8. Documentacao

- [x] 8.1 `CLAUDE.md` atualizado com:
  - Aviso de dependencia de Docker no topo do arquivo
  - Nova env var `KCC_DOCKER_IMAGE` (substitui `KCC_BIN_PATH`)
  - Novo script `pnpm kcc:build` na secao de comandos
  - Remocao de KFX da descricao do projeto
  - Atualizada a descricao de `kcc-runner.service.ts` (docker run + bind mounts + --user em Linux)

- [ ] 8.2 README.md — pendente (nao tinha referencias a KCC_BIN_PATH; leave para revisao futura)

---

## Ordem de Implementacao

```
1 (Dockerfile + build script)
  -> 2 (env vars)
    -> 3 (flag mapper)
      -> 4 (kcc-runner)
        -> 5 (remove KFX)
          -> 6 (testes)
            -> 7 (validacao manual)
              -> 8 (documentacao)
```

## Dependencias Entre Tarefas

- Tarefas 3 e 4 podem ser feitas em paralelo (arquivos diferentes)
- Tarefa 5 e independente de 3-4
- Tarefa 6 requer 2, 3, 4 e 5 concluidas
- Tarefa 7 requer 1, 2, 3, 4, 5 concluidas
- Tarefa 8 pode ser feita em paralelo com 7
