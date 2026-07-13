# bin-to-kcc-docker — Tasks de Implementacao

> **Status:** PROPOSED
> **Data:** 2026-07-13

---

## 1. Imagem Docker do KCC

- [ ] 1.1 Criar `docker/Dockerfile.kcc` com:
  - Base `python:3.11-slim-bookworm`
  - Instalar `p7zip-full`, `unrar`, `wget` (dependencias de sistema)
  - Adicionar arquitetura i386 e instalar `libc6:i386`, `libstdc++6:i386`, `libgcc-s1:i386`
  - Download do KindleGen (`kindlegen_linux_2.6_i386_v2_9.tar.gz`) com fallback `|| echo`
  - `pip3 install --no-cache-dir KindleComicConverter==10.3.0`
  - `WORKDIR /tmp` e `ENTRYPOINT ["kcc-c2e"]`

- [ ] 1.2 Adicionar script `"kcc:build"` ao `package.json` raiz:
  ```json
  "kcc:build": "docker build -f docker/Dockerfile.kcc -t mangaink-kcc:10.3.0 ."
  ```

- [ ] 1.3 Verificar que `pnpm kcc:build` constroi a imagem com sucesso

- [ ] 1.4 Verificar que `docker run --rm mangaink-kcc:10.3.0 kcc-c2e --help` funciona

- [ ] 1.5 Verificar que `kindlegen` esta no PATH do container:
  `docker run --rm mangaink-kcc:10.3.0 kindlegen`

---

## 2. Variaveis de Ambiente

- [ ] 2.1 Em `apps/backend/src/shared/config/env.ts`:
  - Remover `KCC_BIN_PATH`
  - Adicionar `KCC_DOCKER_IMAGE: z.string().default('mangaink-kcc:10.3.0')`

- [ ] 2.2 Atualizar `.env.test` (se existir) removendo `KCC_BIN_PATH`

- [ ] 2.3 Atualizar documentacao de env vars (CLAUDE.md)

---

## 3. Flag Mapper (`kcc-flag-mapper.ts`)

- [ ] 3.1 Em `buildKccCommand()`:
  - Remover parametro `kccBinPath` da assinatura
  - Hardcodar `command: 'kcc-c2e'`
  - Documentar que `inputPath` e `outputPath` sao paths do container (`/input`, `/output`)

- [ ] 3.2 Remover funcao `getKccBinaryPath()` (linhas 227-229 — obsoleta)

- [ ] 3.3 Confirmar que `mapOptionsToFlags()` **nao** e alterada

- [ ] 3.4 Rodar `pnpm test` para confirmar que 27 testes do `kcc-flag-mapper.test.ts` passam sem alteracao

---

## 4. KCC Runner Service (`kcc-runner.service.ts`)

- [ ] 4.1 Substituir `resolve(env.KCC_BIN_PATH)` por referencia ao `env.KCC_DOCKER_IMAGE`

- [ ] 4.2 Remover `const kccDir = resolve(kccBinPath, '..')` (linha 47 — obsoleto)

- [ ] 4.3 Criar funcao auxiliar `buildDockerArgs(absInput: string, absOutput: string, kccArgs: string[]): string[]`:
  ```
  [
    'run', '--rm',
    '--workdir', '/tmp',
    '-e', 'HOME=/tmp',
    ...(process.platform === 'linux' ? ['--user', `${uid}:${gid}`] : []),
    '-v', `${absInput}:/input:ro`,
    '-v', `${absOutput}:/output`,
    env.KCC_DOCKER_IMAGE,
    ...kccArgs,
  ]
  ```

- [ ] 4.4 Criar funcao auxiliar `getUserArgs(): string[]` com tratamento cross-platform:
  - Linux: `['--user', `${uid}:${gid}`]` usando `process.getuid()/process.getgid()`
  - Windows/macOS: `[]` (Docker Desktop gerencia permissoes)

- [ ] 4.5 Alterar chamada `buildKccCommand()` para passar paths do container:
  ```typescript
  const { args: kccArgs } = buildKccCommand(options, deviceId, format, '/input', '/output')
  ```

- [ ] 4.6 Alterar `spawn(command, args, { cwd, env, stdio, windowsHide })` para:
  ```typescript
  spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
  ```
  - Remover `cwd` (nao necessario com Docker)
  - Remover `env: { ...process.env }` (nao necessario — env vars nao passam ao container)
  - Remover `windowsHide: true` (irrelevante para Docker)

- [ ] 4.7 Manter logica de stdout/stderr/close identica:
  - Regex `/(\d+)%/` para progresso
  - Acumulo de stderr para diagnostico
  - `readdir(absoluteOutputPath)` para descobrir output
  - `KccExecutionError` em caso de falha

- [ ] 4.8 Adicionar verificacao opcional de disponibilidade do Docker:
  - Tentar `execSync('docker --version')` no primeiro `run()`
  - Se falhar, logar erro claro

---

## 5. Formatos (`formats.ts`)

- [ ] 5.1 Remover entrada `{ id: 'KFX', name: 'KFX' }` do array `formats`

---

## 6. Testes

- [ ] 6.1 Rodar `pnpm test` e verificar que todos os 287 testes existentes passam

- [ ] 6.2 Atualizar teste E2E `conversion.e2e.test.ts`:
  - Verificar que `GET /api/conversions/options` NAO retorna KFX em `formats`

- [ ] 6.3 (Opcional) Adicionar teste unitario para `buildKccCommand()`:
  - Verificar que retorna `command: 'kcc-c2e'`
  - Verificar que `args` incluem `-o /output /input` (paths do container)

- [ ] 6.4 (Opcional) Adicionar teste unitario para `getUserArgs()`:
  - Linux: retorna `['--user', '<uid>:<gid>']`
  - Windows: retorna `[]`

---

## 7. Integracao e Validacao Manual

- [ ] 7.1 Construir imagem: `pnpm kcc:build`

- [ ] 7.2 Iniciar infraestrutura: `pnpm docker:up`

- [ ] 7.3 Iniciar backend: `pnpm dev:backend`

- [ ] 7.4 Executar uma conversao completa via API:
  - `POST /source/inspect` → inspecionar uma URL de manga
  - Aguardar scraping concluir
  - `POST /api/conversions` → criar conversao com formato EPUB
  - Acompanhar via SSE `/api/conversions/:id/events`
  - Verificar que progresso e reportado
  - Verificar que EPUB final existe em `storage/conversions/{convId}/jobs/{jobId}/output/`

- [ ] 7.5 Repetir com formato MOBI e verificar saida `.mobi`

- [ ] 7.6 Verificar permissoes: `ls -l storage/conversions/.../output/*.epub` → owner = usuario do host

- [ ] 7.7 Verificar que containers sao removidos (`docker ps -a` nao acumula containers parados)

---

## 8. Documentacao

- [ ] 8.1 Atualizar `CLAUDE.md` com:
  - Nova dependencia: Docker Engine
  - Nova env var: `KCC_DOCKER_IMAGE` (substitui `KCC_BIN_PATH`)
  - Novo script: `pnpm kcc:build`
  - Remocao do formato KFX

- [ ] 8.2 Atualizar `README.md` (se existir) com instrucoes de build da imagem KCC

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
