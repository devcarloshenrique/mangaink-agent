-- Garante a tag canônica 'pt-BR' no provider mangalivre (conteúdo em
-- português por padrão). Idempotente: só anexa quando ausente; bancos novos
-- já recebem a tag via seed (`known-providers.ts`) no `upsertFromSeed`.
UPDATE "providers"
SET "tags" = COALESCE("tags", '{}'::text[]) || ARRAY['pt-BR']
WHERE "slug" = 'mangalivre'
  AND ("tags" IS NULL OR NOT ('pt-BR' = ANY("tags")));
