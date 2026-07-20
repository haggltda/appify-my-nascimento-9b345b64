-- =========================================================================
-- EMPREGADOS — Padronizar CPF no formato pontuado (XXX.XXX.XXX-XX)
--
-- Alguns CPFs estão gravados só com dígitos (ex.: 05566199003) e outros já
-- pontuados (ex.: 055.661.990-03). São o MESMO valor — muda só a formatação.
-- Este script normaliza TODOS para o formato com pontuação.
--
-- Regras:
--   * Extrai só os dígitos e completa com zeros à esquerda até 11 (cobre os
--     CPFs que perderam o zero inicial por terem sido salvos como número).
--   * Só toca em linhas com 8..11 dígitos (evita mexer em campo vazio/lixo).
--   * Idempotente: quem já está no formato certo não é alterado.
--
-- Ao final, RAISE NOTICE mostra quantos foram normalizados e quantos ficaram
-- de fora por não terem dígitos suficientes (revisar manualmente, se houver).
-- =========================================================================

DO $$
DECLARE
  v_norm int;
  v_fora int;
BEGIN
  WITH atualizadas AS (
    UPDATE public."EMPREGADOS" e
       SET "CPF" = regexp_replace(
             lpad(regexp_replace(e."CPF", '\D', '', 'g'), 11, '0'),
             '(\d{3})(\d{3})(\d{3})(\d{2})', '\1.\2.\3-\4'
           )
     WHERE e."CPF" IS NOT NULL
       AND length(regexp_replace(e."CPF", '\D', '', 'g')) BETWEEN 8 AND 11
       AND e."CPF" IS DISTINCT FROM regexp_replace(
             lpad(regexp_replace(e."CPF", '\D', '', 'g'), 11, '0'),
             '(\d{3})(\d{3})(\d{3})(\d{2})', '\1.\2.\3-\4'
           )
    RETURNING 1
  )
  SELECT count(*) INTO v_norm FROM atualizadas;

  SELECT count(*) INTO v_fora
  FROM public."EMPREGADOS" e
  WHERE coalesce(btrim(e."CPF"), '') <> ''
    AND length(regexp_replace(e."CPF", '\D', '', 'g')) NOT BETWEEN 8 AND 11;

  RAISE NOTICE 'CPFs normalizados: %; fora do padrao (revisar manualmente): %', v_norm, v_fora;
END $$;

NOTIFY pgrst, 'reload schema';
