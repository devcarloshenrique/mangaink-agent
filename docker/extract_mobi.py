#!/usr/bin/env python3
"""
Extrai as paginas (imagens) de um arquivo MOBI gerado pelo KCC/KindleGen,
preservando a ordem de leitura (spine) do MOBI original.

Uso:
    extract_mobi.py <input.mobi> <output_dir>

Fluxo:
    1. mobi.extract('/input.mobi') → tempdir com EPUB (ou HTML/PDF).
    2. Se EPUB: parseia o OPF e segue o <spine> em ordem.
       - Para cada item XHTML do spine, resolve referencias <img>/<image>
         no manifest e copia cada imagem unica para /output/images/NNNNN.<ext>.
       - Se o proprio item do spine for uma imagem (raro em MOBI gerado pelo
         KCC, mas possivel), copia diretamente.
    3. Escreve /output/index.json com a lista ordenada de paginas:
       { "pages": [{"index":0,"filename":"00000.jpg","contentType":"image/jpeg"}, ...],
         "sourceMobi": "<basename>", "extractedAt": "<iso8601>" }
    4. Escreve /output/READY ao concluir (sinal atomico para o Node worker).

A escrita de cada pagina e incremental — o Node worker pode detectar a
primeira pagina disponivel observando /output/images/00000.* e liberar
o frontend sem aguardar a extracao completa.

Trata mobi7-only e mobi8 (KF8) sem distincao — a lib `mobi` resolves ambos.
"""
import json
import os
import re
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

import mobi


# Namespace do OPF pode vir com ou sem barra final: o KCC 10.3.0 escreve
# `xmlns="http://www.idpf.org/2007/opf"` (sem barra); outras ferramentas usam
# `http://www.idpf.org/2007/opf/`. O ElementTree casa o namespace por string
# exata, então registramos ambas e tentamos as duas.
OPF_NS = {
    'opf': 'http://www.idpf.org/2007/opf',
    'opus': 'http://www.idpf.org/2007/opf',
    'opf_legacy': 'http://www.idpf.org/2007/opf/',
}


def _find_opf_child(root, tag):
    """Busca `tag` no OPF aceitando o namespace com e sem barra final."""
    el = root.find(f'opf:{tag}', OPF_NS)
    if el is None:
        el = root.find(f'opf_legacy:{tag}', OPF_NS)
    return el


def _zip_path(p: str) -> str:
    """Caminho dentro de um zip usa sempre '/' — no Windows os.path.join()
    gera '\\', o que quebra z.read()/namelist()."""
    return p.replace('\\', '/')


def _zip_text(data: bytes) -> str:
    return data.decode('utf-8', errors='replace')


def _find_opf_path(epub_zip: zipfile.ZipFile) -> tuple[str, str]:
    """Retorna (opf_path, opf_dir) a partir de META-INF/container.xml."""
    container = _zip_text(epub_zip.read('META-INF/container.xml'))
    root = ET.fromstring(container)
    ns = {'c': 'urn:oasis:names:tc:opendocument:xmlns:container'}
    rootfile = root.find('c:rootfiles/c:rootfile', ns)
    if rootfile is None or 'full-path' not in rootfile.attrib:
        raise RuntimeError('container.xml sem rootfile/full-path')
    opf_path = rootfile.attrib['full-path']
    opf_dir = os.path.dirname(opf_path)
    return opf_path, opf_dir


def _parse_opf(epub_zip: zipfile.ZipFile, opf_path: str, opf_dir: str):
    """Retorna (manifest_by_id, spine_idrefs)."""
    opf_xml = _zip_text(epub_zip.read(opf_path))
    root = ET.fromstring(opf_xml)
    manifest_el = _find_opf_child(root, 'manifest')
    spine_el = _find_opf_child(root, 'spine')
    if manifest_el is None or spine_el is None:
        raise RuntimeError('OPF sem manifest ou spine')

    manifest = {}
    for item in manifest_el.findall('opf:item', OPF_NS) + manifest_el.findall('opf_legacy:item', OPF_NS):
        iid = item.attrib.get('id')
        href = item.attrib.get('href')
        media_type = item.attrib.get('media-type', '')
        if iid and href:
            manifest[iid] = {
                'href': href,
                'media_type': media_type,
                'path': _zip_path(os.path.normpath(os.path.join(opf_dir, href))) if opf_dir else _zip_path(href),
            }

    spine = [
        el.attrib['idref']
        for el in spine_el.findall('opf:itemref', OPF_NS) + spine_el.findall('opf_legacy:itemref', OPF_NS)
        if 'idref' in el.attrib
    ]
    return manifest, spine


_IMG_TAG_RE = re.compile(
    r'<(?:img|image)[^>]+(?:src|xlink:href)\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def _resolve_href(base_item_path: str, ref: str) -> str:
    if ref.startswith('#'):
        return ''
    # Remove fragment
    ref = ref.split('#')[0]
    base_dir = os.path.dirname(base_item_path)
    if base_dir:
        return _zip_path(os.path.normpath(os.path.join(base_dir, ref)))
    return _zip_path(ref)


def _mime_to_ext(mime: str) -> str:
    return {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/bmp': 'bmp',
        'image/avif': 'avif',
    }.get(mime.lower(), 'bin')


def _ext_from_filename(name: str) -> str:
    ext = os.path.splitext(name)[1].lower().lstrip('.')
    return ext or 'bin'


def extract_epub_images(epub_path: str, out_images_dir: str) -> list[dict]:
    """Extrai imagens na ordem do spine, escrevendo em out_images_dir/NNNNN.<ext>."""
    pages: list[dict] = []
    seen_paths: set[str] = set()
    page_index = 0

    with zipfile.ZipFile(epub_path, 'r') as z:
        opf_path, opf_dir = _find_opf_path(z)
        manifest, spine = _parse_opf(z, opf_path, opf_dir)

        for idref in spine:
            item = manifest.get(idref)
            if item is None:
                continue
            media_type = item['media_type']
            item_path = item['path']

            if media_type.startswith('image/'):
                # Spine aponta diretamente para uma imagem
                if item_path in seen_paths or item_path not in z.namelist():
                    continue
                seen_paths.add(item_path)
                data = z.read(item_path)
                ext = _mime_to_ext(media_type) or _ext_from_filename(item_path)
                filename = f'{page_index:05d}.{ext}'
                with open(os.path.join(out_images_dir, filename), 'wb') as f:
                    f.write(data)
                pages.append({
                    'index': page_index,
                    'filename': filename,
                    'contentType': f'image/{ext}' if ext in ('png', 'gif', 'webp', 'bmp', 'avif') else 'image/jpeg',
                })
                page_index += 1
                continue

            if media_type in ('application/xhtml+xml', 'text/html', 'text/html; charset=utf-8'):
                if item_path not in z.namelist():
                    continue
                try:
                    xhtml = _zip_text(z.read(item_path))
                except KeyError:
                    continue
                for m in _IMG_TAG_RE.finditer(xhtml):
                    href = m.group(1)
                    target = _resolve_href(item_path, href)
                    if not target or target in seen_paths:
                        continue
                    # Acha o item do manifest correspondente ao path resolvido
                    target_item = next(
                        (it for it in manifest.values() if it['path'] == target),
                        None,
                    )
                    # Tenta Path-matching relativo (com case-insensitive util)
                    target_item = next(
                        (
                            it for it in manifest.values()
                            if os.path.normpath(it['path']).lower() == target.lower()
                        ),
                        None,
                    )
                    if target_item is None or target_item['path'] not in z.namelist():
                        continue
                    seen_paths.add(target_item['path'])
                    data = z.read(target_item['path'])
                    ext = _mime_to_ext(target_item['media_type']) or _ext_from_filename(target_item['path'])
                    filename = f'{page_index:05d}.{ext}'
                    with open(os.path.join(out_images_dir, filename), 'wb') as f:
                        f.write(data)
                    pages.append({
                        'index': page_index,
                        'filename': filename,
                        'contentType': f'image/{ext}' if ext in ('png', 'gif', 'webp', 'bmp', 'avif') else 'image/jpeg',
                    })
                    page_index += 1
    return pages


def plan_epub_pages(epub_path: str) -> list[dict]:
    """Mesma ordem do spine de extract_epub_images, mas so le os metadados.
    Permite escrever index.json ANTES de copiar as imagens, permitindo que o
    Node worker anuncie totalPages cedo.
    """
    pages: list[dict] = []
    seen_paths: set[str] = set()
    page_index = 0

    with zipfile.ZipFile(epub_path, 'r') as z:
        opf_path, opf_dir = _find_opf_path(z)
        manifest, spine = _parse_opf(z, opf_path, opf_dir)

        for idref in spine:
            item = manifest.get(idref)
            if item is None:
                continue
            media_type = item['media_type']
            item_path = item['path']

            if media_type.startswith('image/'):
                if item_path in seen_paths or item_path not in z.namelist():
                    continue
                seen_paths.add(item_path)
                ext = _mime_to_ext(media_type) or _ext_from_filename(item_path)
                pages.append({
                    'index': page_index,
                    'filename': f'{page_index:05d}.{ext}',
                    'contentType': f'image/{ext}' if ext in ('png', 'gif', 'webp', 'bmp', 'avif') else 'image/jpeg',
                    '_source_path': item_path,
                })
                page_index += 1
                continue

            if media_type in ('application/xhtml+xml', 'text/html', 'text/html; charset=utf-8'):
                if item_path not in z.namelist():
                    continue
                try:
                    xhtml = _zip_text(z.read(item_path))
                except KeyError:
                    continue
                for m in _IMG_TAG_RE.finditer(xhtml):
                    href = m.group(1)
                    target = _resolve_href(item_path, href)
                    if not target or target in seen_paths:
                        continue
                    target_item = next(
                        (it for it in manifest.values() if it['path'] == target),
                        None,
                    )
                    if target_item is None:
                        target_item = next(
                            (
                                it for it in manifest.values()
                                if os.path.normpath(it['path']).lower() == target.lower()
                            ),
                            None,
                        )
                    if target_item is None or target_item['path'] not in z.namelist():
                        continue
                    seen_paths.add(target_item['path'])
                    ext = _mime_to_ext(target_item['media_type']) or _ext_from_filename(target_item['path'])
                    pages.append({
                        'index': page_index,
                        'filename': f'{page_index:05d}.{ext}',
                        'contentType': f'image/{ext}' if ext in ('png', 'gif', 'webp', 'bmp', 'avif') else 'image/jpeg',
                        '_source_path': target_item['path'],
                    })
                    page_index += 1
    return pages


def extract_pdf_images(pdf_path: str, out_images_dir: str) -> list[dict]:
    """Para MOBI Print Replica (PDF) — lista imagens no diretorio de extract."""
    pages: list[dict] = []
    base_dir = os.path.dirname(pdf_path)
    try:
        entries = sorted(os.listdir(base_dir))
    except OSError:
        return pages
    image_exts = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.avif')
    idx = 0
    for entry in entries:
        if entry.lower().endswith(image_exts):
            src = os.path.join(base_dir, entry)
            ext = _ext_from_filename(entry)
            filename = f'{idx:05d}.{ext}'
            shutil.copyfile(src, os.path.join(out_images_dir, filename))
            pages.append({
                'index': idx,
                'filename': filename,
                'contentType': f'image/{ext}' if ext in ('png', 'gif', 'webp', 'bmp', 'avif') else 'image/jpeg',
            })
            idx += 1
    return pages


def main() -> int:
    if len(sys.argv) < 3:
        print('Uso: extract_mobi.py <input.mobi> <output_dir>', file=sys.stderr)
        return 2

    input_path = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.isfile(input_path):
        print(f'Arquivo MOBI nao encontrado: {input_path}', file=sys.stderr)
        return 1

    os.makedirs(output_dir, exist_ok=True)
    images_dir = os.path.join(output_dir, 'images')
    os.makedirs(images_dir, exist_ok=True)

    print(f'[extract_mobi] Iniciando extracao: {input_path} -> {output_dir}', flush=True)

    tempdir, filepath = mobi.extract(input_path)
    print(f'[extract_mobi] mobi.extract -> {filepath}', flush=True)

    try:
        ext = os.path.splitext(filepath)[1].lower()

        if ext == '.epub':
            # Plan primeiro (le apenas metadados): escreve index.json ANTES
            # de copiar imagens, permitindo que o Node worker anuncie totalPages.
            plan = plan_epub_pages(filepath)
            _write_index(output_dir, input_path, plan)
            print(f'[extract_mobi] index.json escrito: {len(plan)} pagina(s) previstas', flush=True)

            # Agora copia cada imagem seqüencialmente
            pages: list[dict] = []
            with zipfile.ZipFile(filepath, 'r') as z:
                for entry in plan:
                    src = entry['_source_path']
                    data = z.read(src)
                    dest = os.path.join(images_dir, entry['filename'])
                    with open(dest, 'wb') as f:
                        f.write(data)
                    # Remove campo interno antes de registrar
                    public = {k: v for k, v in entry.items() if not k.startswith('_')}
                    pages.append(public)
            _rewrite_index(output_dir, input_path, pages)
        elif ext == '.pdf':
            pages = extract_pdf_images(filepath, images_dir)
            _rewrite_index(output_dir, input_path, pages)
        else:
            # HTML: varre diretorio de extracao por imagens
            pages = []
            extract_dir = os.path.dirname(filepath)
            idx = 0
            for root_dir, _, files in os.walk(extract_dir):
                for f in sorted(files):
                    if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.avif')):
                        shutil.copyfile(
                            os.path.join(root_dir, f),
                            os.path.join(images_dir, f'{idx:05d}.{_ext_from_filename(f)}'),
                        )
                        img_ext = _ext_from_filename(f)
                        pages.append({
                            'index': idx,
                            'filename': f'{idx:05d}.{img_ext}',
                            'contentType': f'image/{img_ext}' if img_ext in ('png', 'gif', 'webp', 'bmp', 'avif') else 'image/jpeg',
                        })
                        idx += 1
            _rewrite_index(output_dir, input_path, pages)

        if not pages:
            print('[extract_mobi] AVISO: nenhuma imagem encontrada no MOBI', file=sys.stderr)

        # Sinal atomico de conclusao
        ready_path = os.path.join(output_dir, 'READY')
        with open(ready_path, 'w', encoding='utf-8') as f:
            f.write(datetime.now(timezone.utc).isoformat())

        print(f'[extract_mobi] Concluido: {len(pages)} pagina(s) extraida(s)', flush=True)
        return 0
    finally:
        try:
            shutil.rmtree(tempdir)
        except OSError:
            pass


def _write_index(output_dir: str, input_path: str, pages: list[dict]) -> None:
    """Escreve index.json (versao plan, antes das imagens serem copiadas)."""
    public_pages = [
        {k: v for k, v in p.items() if not k.startswith('_')}
        for p in pages
    ]
    index_path = os.path.join(output_dir, 'index.json')
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump({
            'sourceMobi': os.path.basename(input_path),
            'extractedAt': datetime.now(timezone.utc).isoformat(),
            'pages': public_pages,
        }, f, ensure_ascii=False, indent=2)


def _rewrite_index(output_dir: str, input_path: str, pages: list[dict]) -> None:
    """Reescreve index.json apos copia (mesma estrutura; valida consistencia)."""
    _write_index(output_dir, input_path, pages)


if __name__ == '__main__':
    raise SystemExit(main())