## ADDED Requirements

### Requirement: Script de preparação do runtime

O monorepo SHALL ter `apps/desktop/scripts/prepare-runtime.mjs` que baixa, valida (SHA256 contra `runtime-manifest.json`) e extrai todos os artefatos do runtime em `apps/desktop/resources/runtime/`, na estrutura esperada pelas capabilities `embedded-postgres` e `embedded-python-kcc`. A falha em qualquer artefato DEVE abortar com mensagem clara e o manifesto DEVE registrar URL, versão e hash de cada artefato.

#### Scenario: Prepare idempotente

- **WHEN** `pnpm desktop:prepare:runtime` roda duas vezes seguidas
- **THEN** a segunda execução conclui sem erros e o runtime fica íntegro

#### Scenario: Manifesto incompleto

- **WHEN** um artefato referenciado pelo prepare não possui hash no manifesto
- **THEN** o script aborta antes de baixar qualquer coisa

### Requirement: Empacotamento do runtime no instalador

`electron-builder.yml` SHALL incluir `resources/runtime/` via `extraResources` (→ `resources/runtime` no app instalado). Os targets `nsis` e `portable` DEVM ser gerados com o runtime incluso, sem junction quebradas no node_modules (reuso do `after-pack.mjs`).

#### Scenario: Runtime no app empacotado

- **WHEN** `pnpm desktop:dist` gera os instaladores
- **THEN** `resources/runtime/` (postgres, python, kcc, kindlegen.exe, extract_mobi.py) está presente no conteúdo do app instalado

#### Scenario: Instalação offline

- **WHEN** o instalador NSIS é executado em máquina sem internet
- **THEN** o app instala e roda sem baixar nada

### Requirement: Integração com o fluxo de distribuição

`pnpm desktop:dist` SHALL exigir (ou acionar) a preparação do runtime antes do empacotamento, e o `prepare-backend.mjs`/`after-pack.mjs` DEVE continuar funcionando com a presença do diretório `resources/runtime/`.

#### Scenario: Dist sem runtime preparado

- **WHEN** `pnpm desktop:dist` roda sem `resources/runtime/`
- **THEN** o fluxo falha com instrução para rodar `pnpm desktop:prepare:runtime` (ou o prepara automaticamente)

#### Scenario: Smoke E2E em modo embedded

- **WHEN** o smoke E2E (`MI_SMOKE_FULL=1` + `MI_EMBEDDED_MODE=1`) roda contra o app empacotado
- **THEN** boot, login, inspeção e conversão funcionam sem Docker no host

### Requirement: Licenciamento documentado

O `runtime-manifest.json` (ou README anexo) SHALL listar a licença de cada artefato vendored (PostgreSQL permissiva, Python PSF, KCC GPLv3 com fonte incluída, kindlegen EULA Amazon) para conformidade de redistribuição.

#### Scenario: Manifesto com licenças

- **WHEN** o manifesto do runtime é inspecionado
- **THEN** cada artefato possui licença declarada e o source do KCC está presente no runtime
