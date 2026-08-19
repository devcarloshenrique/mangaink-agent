# Política de Retenção e Limpeza de Storage de Conversões

## Contexto (VULN-8)

Os outputs de conversão (EPUB/MOBI/CBZ/PDF), logs e previews temporários vivem
em `<STORAGE_PATH>/conversions/{conversionId}/`. Antes desta correção, o
`DELETE /api/conversions/:conversionId` removia **apenas a linha do banco**, e o
diretório no filesystem permanecia indefinidamente — retenção implícita de dados
sensíveis do usuário e crescimento ilimitado do storage.

## Comportamento implementado

### 1. DELETE de conversão remove o storage

`DeleteConversionUseCase` (`apps/backend/src/modules/conversion/use-cases/delete-conversion.use-case.ts`)
agora executa, nesta ordem:

1. **Banco primeiro** — `conversions.delete(conversionId)` remove a linha (fonte
   de verdade). Nunca apagamos o storage de uma conversão que ainda existe no banco.
2. **Storage depois** — `ConversionStorageService.removeConversion(conversionId)`
   (`apps/backend/src/modules/conversion/services/conversion-storage.service.ts`)
   remove recursivamente `storage/conversions/{conversionId}` (outputs + logs +
   previews temporários MOBI, que vivem dentro de `jobs/<jobId>/output/temp/`).

**Fallback:** se a remoção do storage falhar (ex.: arquivo em uso, permissão),
o serviço registra o erro no console, retorna `false`, e o use-case **não**
quebra a resposta — a conversão já foi removida do banco e o diretório órfão é
recolhido pelo sweeper periódico (item 2).

### 2. Sweeper periódico de storage órfão

`ConversionStorageSweeper` (`apps/backend/src/modules/conversion/services/conversion-storage-sweeper.service.ts`)
varre `CONVERSIONS_STORAGE_PATH` e remove recursivamente diretórios que **não**
possuem registro na tabela `conversions`. Iniciado no boot do backend
(`src/shared/server.ts`), com varredura inicial 1 min após o boot e depois no
intervalo configurável.

- **Fonte de verdade:** a tabela `conversions` (via Prisma).
- **Grace period:** diretórios com mtime mais recente que
  `STORAGE_SWEEPER_MIN_ORPHAN_AGE_MS` são ignorados, evitando a corrida entre a
  criação do diretório e a transação de insert no banco.
- **Segurança:** nunca remove o storage de uma conversão existente no banco;
  em caso de falha de banco a varredura registra o erro e não apaga nada.

## Variáveis de ambiente

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `STORAGE_SWEEPER_INTERVAL_MS` | Intervalo entre varreduras do sweeper de storage órfão | `21600000` (6h) |
| `STORAGE_SWEEPER_MIN_ORPHAN_AGE_MS` | Idade mínima de um diretório sem registro no banco para ser removido (grace period) | `86400000` (24h) |
| `CONVERSIONS_STORAGE_PATH` | Raiz dos diretórios de conversão (já existente) | `./storage/conversions` |
| `MOBI_PREVIEW_TTL_SEC` | TTL do cache de preview MOBI (previews dentro do diretório da conversão são removidos com ele) | `86400` (24h) |

## Árvore de referência

```
<STORAGE_PATH>/
└── conversions/{conversionId}/      ← removido pelo DELETE e pelo sweeper
    ├── config.json
    ├── status.json
    ├── logs/conversion.log
    └── jobs/{jobId}/
        ├── temp/…                   (imagens intermediárias do KCC)
        └── output/
            ├── {título}.{ext}       (EPUB/MOBI/CBZ/PDF)
            └── temp/{file-base}/    (cache de preview MOBI — TTL 24h)
```

## Verificação

- **Delete:** criar conversão → `DELETE /api/conversions/:id` → o diretório
  `storage/conversions/{id}` deixa de existir.
- **Sweeper:** criar um diretório `storage/conversions/{id_órfão}` sem registro
  no banco e com mtime antigo → na próxima varredura ele é removido; um diretório
  com registro no banco é mantido.
