-- =========================================================================
-- COMENTÁRIOS — remove de vez as tabelas legadas duplicadas
--
-- JUR_COMENTARIOS e SISTEMA_JURIDICO_COMENTARIOS foram substituídas pelo
-- feed único polimórfico SISTEMA_COMENTARIOS (modulo + entidade_id) na
-- migration 20260622000016, mas continuaram existindo no banco porque os
-- CREATEs legados eram reexecutados depois da consolidação. O frontend só
-- usa SISTEMA_COMENTARIOS (Patrimônios, Processos, Férias).
--
-- Idempotente: migra o que ainda houver nas legadas e dropa as duas.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."SISTEMA_COMENTARIOS" (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  modulo      text NOT NULL,
  entidade_id text NOT NULL,
  autor_nome  text,
  autor_cpf   text,
  texto       text NOT NULL
);
CREATE INDEX IF NOT EXISTS sistema_coment_ent_idx ON public."SISTEMA_COMENTARIOS"(modulo, entidade_id);

DO $$
BEGIN
  IF to_regclass('public."JUR_COMENTARIOS"') IS NOT NULL THEN
    -- NOT EXISTS evita duplicar comentários já migrados pela 016.
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, texto, created_at)
    SELECT 'patrimonio', c.patrimonio_id::text, c.autor, c.texto, c.created_at
      FROM public."JUR_COMENTARIOS" c
     WHERE c.patrimonio_id IS NOT NULL
       AND NOT EXISTS (
             SELECT 1 FROM public."SISTEMA_COMENTARIOS" s
              WHERE s.modulo = 'patrimonio'
                AND s.entidade_id = c.patrimonio_id::text
                AND s.texto = c.texto
                AND s.created_at = c.created_at
           );
    DROP TABLE public."JUR_COMENTARIOS";
  END IF;

  IF to_regclass('public."SISTEMA_JURIDICO_COMENTARIOS"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, texto, created_at)
    SELECT 'processo', c.numero_processo, c.autor, c.comentario, c.criado_em
      FROM public."SISTEMA_JURIDICO_COMENTARIOS" c
     WHERE c.numero_processo IS NOT NULL
       AND NOT EXISTS (
             SELECT 1 FROM public."SISTEMA_COMENTARIOS" s
              WHERE s.modulo = 'processo'
                AND s.entidade_id = c.numero_processo
                AND s.texto = c.comentario
                AND s.created_at = c.criado_em
           );
    DROP TABLE public."SISTEMA_JURIDICO_COMENTARIOS";
  END IF;
END $$;

ALTER TABLE public."SISTEMA_COMENTARIOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_COMENTARIOS" TO authenticated;
DROP POLICY IF EXISTS "SISTEMA_COMENTARIOS_all_auth" ON public."SISTEMA_COMENTARIOS";
CREATE POLICY "SISTEMA_COMENTARIOS_all_auth" ON public."SISTEMA_COMENTARIOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
