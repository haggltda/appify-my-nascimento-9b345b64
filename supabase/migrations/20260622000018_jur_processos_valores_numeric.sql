-- =========================================================================
-- JURÍDICO — Processos: normaliza colunas de valor p/ numeric
--
-- Algumas colunas de valor de JUR_PROCESSOS (herdadas do app Flask) ficaram
-- como bigint/integer, mas guardam valores com centavos (ex.: 1350.00) e o
-- app (Processos.tsx) grava/soma como float. Bigint rejeita decimal, o que
-- quebra tanto a carga do histórico quanto futuras gravações pela tela.
-- Converte as colunas de valor que ainda são inteiras para numeric.
--
-- Idempotente: só altera colunas que hoje são bigint/integer.
-- =========================================================================

DO $$
DECLARE c text;
BEGIN
  IF to_regclass('public."JUR_PROCESSOS"') IS NOT NULL THEN
    FOREACH c IN ARRAY ARRAY[
      'valor_pericia_empresa','valor_pedidos','valor_acordo','valor_sentenca','valor_final',
      'valor_deposito_recursal','valor_seguro_garantia','valor_custas_processuais',
      'valor_pericia_contabil','valor_outros_custos','demais_encargos','valor_causa'
    ] LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='JUR_PROCESSOS'
          AND column_name=c AND data_type IN ('bigint','integer')
      ) THEN
        EXECUTE format('ALTER TABLE public."JUR_PROCESSOS" ALTER COLUMN %I TYPE numeric USING %I::numeric', c, c);
      END IF;
    END LOOP;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
