# Fluxo de alto nivel:
Abaixo tem o fluxo da aba de conversão do meu frontend, sendo necessário preencher econfigurar todas as etapas abaixo até criar um job de conversão tendo 5 steps. 

### 1. Step Origem: Buscar metadados da obra pela URL.
- Essa etapa é focada em verificar se o manga existe e a quantidade de capítulos disponíveis. 

**Entrada do usuario:**
- `url`: link da obra.
**Endpoint recomendado:**
```http
POST /conversions/source/inspect
Content-Type: application/json
Authorization: Bearer <token>
```

**Request**:
```json
{
  "url": "https://mangalivre.to/manga/hunter-x-hunter",
}
```

**Response**:
```json
{
  "id": "1",
  "url": "https://mangalivre.to/manga/hunter-x-hunter/",
  "title": "HUNTER x HUNTER",
  "author": "Togashi Yoshihiro",
  "chapters": [
    {
      "id": "ch-1",
      "number": "1",
      "title": "nome do capitulo se não Capitulo 1",
      "pages": somente se tiver a informação,
      "volume": somente se tiver a informação
    },
    {
      "id": "cd-2",
      "number": "2",
      "title": "nome do capitulo se não Capitulo 2",
      "pages": somente se tiver a informação,
      "volume": somente se tiver a informação
    }
	...    
  ],
  "covers": [
    {
      "id": "",
      "label": "Capa 1",
      "imageUrl": "https://cdn.exemplo.com/covers/cv-1.jpg"
    }
  ]
}

```

### 2. Step Capítulos: Selecionar capítulos e definir volumes.

**Entrada do usuario:**
- `selectedChapters`: conjunto de IDs dos capitulos escolhidos.
- `grouping`: `"single"` ou `"separate"`.
- `volumeMode`: `"fixed"` ou `"custom"`.
- `volumeFixedSize`: quantidade fixa de capitulos por volume.
- `volumeCustomSizes`: lista de quantidades por volume quando `volumeMode = "custom"`.

**Tipos atuais:**

```typescript
type VolumeConfiguration =
  | { mode: "fixed"; size: number }
  | { mode: "custom"; sizes: number[] }
  | { mode: "none" }; // Útil caso o usuário queira tudo em um único arquivão sem divisão interna

type ChapterStepPayload = {
  chapters: string[];
  grouping: "single" | "separate"; // single = 1 arquivo EPUB final; separate = 1 arquivo EPUB por volume
  volume: VolumeConfiguration;
};
```

```json
{
  "chapters": ["ch-1", "ch-2", "ch-3"],
  "grouping": "single",
  "volume": {
    "mode": "fixed",
    "size": 8,
  }
}
```

**Para volumes customizados:**

```json
{
  "chapters": ["ch-1", "ch-2", "ch-3"],
  "grouping": "single",
  "volume": {
    "mode": "custom",
    "sizes": [6, 7, 5]
  }
}
```

### 3. Step Capas: Definir capas.

**Tipos atuais:**

```typescript
type CoverRef =
  | { kind: "original" }
  | { kind: "gallery"; coverId: string }
  | { kind: "upload"; uploadId: string; name: string };
```

```typescript
type CoverConfiguration =
  | {
      mode: "single";
      cover: CoverRef; // Direto ao ponto, sem assignments
    }
  | {
      mode: "per-volume";
      assignments: Array<{ volumeId: string; cover: CoverRef }>;
    }
  | {
      mode: "per-chapter";
      assignments: Array<{ chapterId: string; cover: CoverRef }>;
    };
```

**Exemplos de JSON**

Exemplo A: Capa Única (`single`)
```json
{
  "coverConfig": {
    "mode": "single",
    "cover": { 
      "kind": "upload", 
      "uploadId": "upl_123", 
      "name": "capa-customizada.jpg" 
    }
  }
}
```

Exemplo B: Capa por Volume (`per-volume`)
```json
{
  "coverConfig": {
    "mode": "per-volume",
    "assignments": [
      {
        "volumeId": "vol-1",
        "cover": { "kind": "gallery", "coverId": "cv-1" }
      },
      {
        "volumeId": "vol-2",
        "cover": { "kind": "original" }
      }
    ]
  }
}
```

Exemplo C: Capa por Capítulo (`per-chapter`) exclusivamente com Uploads

- O usuário sobe a imagem, ela fica numa pasta temporária ou bucket, e você retorna a referência para ser usada no Job.

```http
POST /api/conversions/covers/upload
Content-Type: multipart/form-data
```

```json
{
  "uploadId": "upl_123",
  "fileName": "minha-capa.jpg",
  "url": "/storage/temp/covers/upl_123.jpg",
  "expiresAt": "2026-07-06T10:48:00Z" 
}
```

- No cenário abaixo, o front-end já chamou o endpoint `POST /api/conversions/covers/upload` duas vezes (uma para cada imagem) e recebeu os respectivos `uploadId`. Agora, ele envia esse mapeamento no Job de conversão final:

```json
{
  "coverConfig": {
    "mode": "per-chapter",
    "assignments": [
      {
        "chapterId": "cap-1",
        "cover": { 
          "kind": "upload", 
          "uploadId": "upl_777", 
          "name": "capa-cap1-refeita.png" 
        }
      },
      {
        "chapterId": "cap-2",
        "cover": { 
          "kind": "upload", 
          "uploadId": "upl_888", 
          "name": "capa-cap2-editada.jpg" 
        }
      },
      {
        "chapterId": "cap-3",
        "cover": { 
          "kind": "original" 
        }
      }
    ]
  }
}
```

### Step 4 Configurações: Escolher dispositivo, formato, preset e metadados finais.

**Entrada do usuario:**
- `device`: perfil Kindle/dispositivo.
- `format`: formato de saida.
- `preset`: processamento de imagem.
- `meta.title`: preenchido automaticamente devido as etapas anteriores.
- `meta.author`: preenchido automaticamente devido as etapas anteriores.

**Formatos aceitos hoje:**
```txt
EPUB
MOBI
CBZ
```

**Dispositivos aceitos hoje:**

```txt
'K11': ("Kindle 11", (1072, 1448), Palette16, 1.0),
'KPW5': ("Kindle Paperwhite 5/Signature Edition", (1236, 1648), Palette16, 1.0),
'KO': ("Kindle Oasis 2/3", (1264, 1680), Palette16, 1.0),
'KS': ("Kindle Scribe 1/2", (1860, 2480), Palette16, 1.0),
'K810': ("Kindle 8/10", (600, 800), Palette16, 1.0),
'KCS': ("Kindle Colorsoft", (1272, 1696), Palette16, 1.0),
'KV': ("Kindle Voyage", (1072, 1448), Palette16, 1.0),
```

**Presets aceitos**

```txt
default
manga
webtoon
highQuality
noProcessing
comic
```

## Mapeamento para flags do KCC

| Preset | Flags KCC | Descrição |
|--------|-----------|-----------|
| `default` | *(nenhuma flag adicional)* | Conversão padrão usando apenas o perfil do dispositivo (`-p`). |
| `manga` | `-m` `-g Auto` | Ativa leitura da direita para esquerda (RTL), divisão de páginas e ajuste automático de gama. |
| `webtoon` | `-w` | Processa imagens longas de webtoons, dividindo-as em páginas compatíveis com o Kindle. |
| `highQuality` | `-q` | Utiliza algoritmos de redimensionamento de maior qualidade. |
| `noProcessing` | `-n` | Desabilita todo o processamento de imagens. Deve ser tratado como exclusivo, ignorando os demais presets. |
| `comic` | *(nenhuma flag adicional)* | Conversão padrão para quadrinhos ocidentais (leitura esquerda → direita). |

> **Observação:** Os presets podem ser combinados (ex.: `manga` + `highQuality` → `-m -g Auto -q`), exceto `noProcessing`, que deve sobrescrever qualquer outro preset.


### Step 4.1 Configurações: Opcionalmente gerar preview de uma pagina.
Por enquanto não vamos trabalhar no preview, pode manter os componentes no frontend, porém não vamos trabalhar esse modulo agora no backend. 

### Step 5 Envio: Criar job de conversão.
No step 5 tem várias opções referente a baixar arquivo e enviar para o kindle. Porém para esse exemplo, eu quero somente selecionar a opção baixar, clicar em converter e esse processo salvar 

### Acompanhar progresso por etapas.

### Ao concluir, registrar arquivos na biblioteca e liberar download/envio.

### Criacao do job de conversao

```http
POST /conversions
Content-Type: application/json
Authorization: Bearer <token>
```

Request:

```json
Organizar aqui o json completo apartir das informações obtidas na etapa anterior
```

Request:

```json
Organizar aqui o json completo apartir das informações obtidas na etapa anterior
```
### Diretórios 

```
apps/backend/storage/
```

Com esta estrutura:

```
apps/backend/storage/
├─ covers/
│  ├─ uploaded/
│  └─ extracted/
├─ sources/
│  └─ {sourceId}/
│     ├─ covers/
│     └─ chapters/
│        └─ {chapterId}/
│           ├─ 001.jpg
│           ├─ 002.jpg
│           └─ ...
├─ conversions/
│  └─ {jobId}/
│     ├─ input/
│     ├─ work/
│     └─ output/
│        ├─ manga-vol-01.epub
│        └─ manga-vol-02.epub
└─ tools/
   └─ kcc/
      └─ ...
```

Minha recomendação prática:

```
apps/backend/storage/covers
```

Para capas enviadas ou extraídas.

```
apps/backend/storage/sources/{sourceId}/chapters/{chapterId}
```

Para imagens baixadas dos capítulos, organizadas por capítulo.

```
apps/backend/storage/conversions/{jobId}/output
```

Para EPUB/CBZ/MOBI final convertido.

```
apps/backend/storage/tools/kcc
```
