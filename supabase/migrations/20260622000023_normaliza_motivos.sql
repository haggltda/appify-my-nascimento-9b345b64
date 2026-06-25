-- =========================================================================
-- JURÍDICO — Normaliza motivos repetidos (one-off, idempotente)
--
-- Junta motivos que são "o mesmo" mas diferem só por CAIXA ou ESPAÇOS
-- (ex.: "Vale alimentação" e "Vale Alimentação" -> uma grafia só).
-- NÃO apaga linhas (cada linha é um motivo de um processo); apenas reescreve
-- o texto para a grafia CANÔNICA = a mais usada dentro de cada grupo.
--
-- Rode quantas vezes quiser: depois de normalizado, vira no-op.
-- =========================================================================

WITH norm AS (
  SELECT id,
         regexp_replace(btrim(motivos), '\s+', ' ', 'g')        AS m,   -- texto limpo
         lower(regexp_replace(btrim(motivos), '\s+', ' ', 'g'))  AS k    -- chave do grupo
  FROM public."JUR_PROCESSOS"
  WHERE motivos IS NOT NULL AND btrim(motivos) <> ''
),
freq AS (
  SELECT k, m, count(*) AS n,
         row_number() OVER (PARTITION BY k ORDER BY count(*) DESC, m) AS rn
  FROM norm
  GROUP BY k, m
),
canon AS (  -- grafia canônica por grupo (a mais frequente; desempate alfabético)
  SELECT k, m AS canonico FROM freq WHERE rn = 1
)
UPDATE public."JUR_PROCESSOS" p
SET motivos = c.canonico
FROM canon c
WHERE lower(regexp_replace(btrim(p.motivos), '\s+', ' ', 'g')) = c.k
  AND p.motivos IS DISTINCT FROM c.canonico;

NOTIFY pgrst, 'reload schema';
