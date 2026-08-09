#!/usr/bin/env python3
"""
Patch para KCC 10.3.0 — previne capa duplicada em MOBI.

Adaptação do docker/patches/patch_mobi_cover.py para o runtime embutido:
a mesma lógica é aplicada sobre o source do KCC extraído (não sobre o
pacote instalado via pip). O caminho do source é passado como argv[1].

Uso:
    python patch_mobi_cover_runtime.py <dir-do-source-kcc>

PROBLEMA:
  O sanitizeTree() renomeia a primeira imagem (ex: cover.jpg → kcc-0001.jpg)
  e cria um objeto Cover a partir dela. O Cover carrega a imagem na memória
  (Image.open + process em __init__). Mas o arquivo renomeado permanece
  no diretório de input e é incluido como pagina de conteudo por
  imgDirectoryProcessing + buildEPUB.

  Resultado: o MOBI contem a capa duas vezes consecutivas:
    1. cover.jpg (Cover-processada, often stretched) — registro de metadados
    2. kcc-0001.jpg (imgDirectoryProcessing, regular processing) — pagina de conteudo

  No EPUB isso não é visivel porque leitores EPUB omitem a capa de metadados
  do fluxo de leitura. No MOBI, KindleGen inclui o registro de metadados como
  uma pagina separada, e o usuario ve a capa esticada seguida da capa original.

SOLUÇÃO:
  Após criar o objeto Cover (que le a imagem para a memória), remover o
  arquivo cover_path do diretório. Assim a capa aparece apenas como
  metadados (cover.jpg no OPF), não como pagina de conteudo.

  Aplicado apenas para format == 'MOBI' para não alterar o comportamento
  do EPUB (onde a capa como primeira pagina é o comportamento esperado).
"""
import pathlib
import sys

if len(sys.argv) < 2:
    print('patch-mobi-cover: uso: python patch_mobi_cover_runtime.py <dir-do-source-kcc>')
    raise SystemExit(2)

FILE = pathlib.Path(sys.argv[1]) / 'kindlecomicconverter' / 'comic2ebook.py'

OLD = '        cover = image.Cover(cover_path, options)\n'
NEW = (
    '        cover = image.Cover(cover_path, options)\n'
    '        # MangaInk patch: remove cover_path do diretório após criar\n'
    '        # o objeto Cover (que já carregou a imagem na memória).\n'
    '        # Previne capa duplicada em MOBI — sem isso, o arquivo\n'
    '        # renomeado (kcc-0001.jpg) permanece como pagina de conteudo.\n'
    '        if options.format == "MOBI" and cover_path:\n'
    '            try:\n'
    '                os.remove(cover_path)\n'
    '            except OSError:\n'
    '                pass\n'
)

content = FILE.read_text(encoding='utf-8')

# O padrão OLD continua presente após a primeira aplicação (a linha alvo é
# prefixo do bloco injetado) — por isso o check de 'MangaInk patch' vem
# primeiro para tornar a aplicação idempotente em reruns do prepare.
if 'MangaInk patch' in content:
    # Already patched or KCC version changed
    print('patch-mobi-cover: já aplicado, pulando')
elif OLD not in content:
    print('patch-mobi-cover: ERRO — padrão não encontrado em comic2ebook.py')
    raise SystemExit(1)
else:
    content = content.replace(OLD, NEW, 1)
    FILE.write_text(content, encoding='utf-8')
    print('patch-mobi-cover: aplicado com sucesso')
