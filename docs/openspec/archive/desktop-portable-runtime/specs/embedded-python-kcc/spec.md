## ADDED Requirements

### Requirement: Runtime Python embutido vendored

O desktop SHALL incluir um runtime Python 3.11 (python-build-standalone) em `apps/desktop/resources/runtime/python/`, com versão fixa no `runtime-manifest.json` (URL + SHA256). O `desktop:prepare:runtime` DEVE materializar as dependências (wheels Pillow, requests, psutil, six, `mobi==0.4.1`), o source do KCC v10.3.0 (tag GitHub) com `patch_mobi_cover.py` aplicado, `docker/extract_mobi.py` e `kindlegen.exe` (build 1028, Windows).

#### Scenario: Runtime preparado

- **WHEN** `pnpm desktop:prepare:runtime` conclui com sucesso
- **THEN** `resources/runtime/python/python.exe`, os site-packages, o source do KCC com o patch aplicado e `kindlegen.exe` existem

#### Scenario: KCC executável via Python embutido

- **WHEN** o CLI do KCC é invocado com o `python.exe` embutido
- **THEN** o `kcc-c2e --help` responde com a versão 10.3.0 sem dependências externas

#### Scenario: extract_mobi executável

- **WHEN** `extract_mobi.py` é invocado com o `python.exe` embutido
- **THEN** a lib `mobi==0.4.1` é importável e a extração preserva a ordem do spine

### Requirement: Resolução de paths e ambiente do runtime

O backend em modo embedded SHALL resolver os executáveis via env `MI_EMBEDDED_RUNTIME_PATH` (default: `{resources}/runtime` quando gerenciado pelo desktop). O child do KCC e do extract_mobi MUST ter o diretório do `kindlegen.exe` no `PATH` para que o KCC gere saída MOBI/AZW3.

#### Scenario: KCC gera MOBI com kindlegen no PATH

- **WHEN** um job converte para MOBI em modo embedded
- **THEN** o child do KCC enxerga `kindlegen.exe` no PATH e o arquivo `.mobi` é produzido

#### Scenario: Runtime path ausente

- **WHEN** `MI_EMBEDDED_MODE=1` e o runtime não existe no caminho resolvido
- **THEN** o runner falha com erro claro apontando o runtime ausente

### Requirement: Saída e progresso equivalentes ao Docker

A execução embedded do KCC SHALL emitir o mesmo progresso (`(\d+)%` no stdout) e os mesmos eventos (`conversion.started/progress/finished`) que a impl docker, e a do extract_mobi SHALL manter o poll de `images/` a cada 250ms com `onTick`.

#### Scenario: Progresso do KCC embutido

- **WHEN** o KCC embedded emite linhas de progresso no stdout
- **THEN** o runner traduz para eventos `conversion.progress` como na impl docker

#### Scenario: Poll de páginas do MOBI embutido

- **WHEN** o extract_mobi embedded grava imagens em `outputDir/images`
- **THEN** o runner chama `onTick` com a contagem atualizada conforme novas páginas aparecem
