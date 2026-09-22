-- Remove a tag 'internacional' (redundante) e adiciona os códigos IETF / BCP 47
-- dos idiomas do catálogo MangaDex (`availableTranslatedLanguages`) às tags do
-- provider mangadex. Idempotente: filtra elementos já presentes antes de anexar.
UPDATE "providers"
SET "tags" = (
  SELECT array_agg(t.tag ORDER BY t.ord)
  FROM unnest("providers"."tags") WITH ORDINALITY AS t(tag, ord)
  WHERE lower(trim(t.tag)) <> 'internacional'
)
WHERE "slug" = 'mangadex';

UPDATE "providers"
SET "tags" = (
  SELECT array_agg(x ORDER BY x)
  FROM (
    SELECT DISTINCT unnest("providers"."tags" || ARRAY['pt-BR', 'pt', 'en', 'es', 'es-la', 'ja', 'ko', 'zh', 'zh-hk', 'api', 'scans', 'mangá'])
  ) AS u(x)
)
WHERE "slug" = 'mangadex';
