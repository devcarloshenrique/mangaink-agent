-- Converte tags de idioma legadas (ex.: 'português') para códigos IETF / BCP 47
-- canônicos (ex.: 'pt-BR'), preservando a ordem do array. Idempotente: os
-- canônicos mapeiam para si mesmos, então re-execução é no-op.
-- Tags fora do mapa (ex.: 'mangá', 'fr') passam intactas.
UPDATE "providers"
SET "tags" = (
  SELECT array_agg(
    CASE lower(trim(t.tag))
      WHEN 'português' THEN 'pt-BR'
      WHEN 'portugues' THEN 'pt-BR'
      WHEN 'pt-br' THEN 'pt-BR'
      WHEN 'ptbr' THEN 'pt-BR'
      WHEN 'br' THEN 'pt-BR'
      WHEN 'inglês' THEN 'en'
      WHEN 'ingles' THEN 'en'
      WHEN 'english' THEN 'en'
      WHEN 'en' THEN 'en'
      WHEN 'espanhol' THEN 'es'
      WHEN 'espanol' THEN 'es'
      WHEN 'spanish' THEN 'es'
      WHEN 'es' THEN 'es'
      WHEN 'japonês' THEN 'ja'
      WHEN 'japones' THEN 'ja'
      WHEN 'japanese' THEN 'ja'
      WHEN 'ja' THEN 'ja'
      WHEN 'coreano' THEN 'ko'
      WHEN 'korean' THEN 'ko'
      WHEN 'ko' THEN 'ko'
      WHEN 'chinês' THEN 'zh'
      WHEN 'chines' THEN 'zh'
      WHEN 'chinese' THEN 'zh'
      WHEN 'zh' THEN 'zh'
      ELSE t.tag
    END
    ORDER BY t.ord
  )
  FROM unnest("providers"."tags") WITH ORDINALITY AS t(tag, ord)
)
WHERE EXISTS (
  SELECT 1
  FROM unnest("providers"."tags") AS u(tag)
  WHERE lower(trim(u.tag)) IN (
    'português', 'portugues', 'pt-br', 'ptbr', 'br',
    'inglês', 'ingles', 'english', 'en',
    'espanhol', 'espanol', 'spanish', 'es',
    'japonês', 'japones', 'japanese', 'ja',
    'coreano', 'korean', 'ko',
    'chinês', 'chines', 'chinese', 'zh'
  )
);
