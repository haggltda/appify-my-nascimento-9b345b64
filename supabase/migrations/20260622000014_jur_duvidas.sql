-- =========================================================================
-- JURÍDICO — Central de Dúvidas Jurídicas (base de conhecimento Q&A)
--
-- Qualquer colaborador autenticado pergunta e PESQUISA/LÊ a biblioteca.
-- SOMENTE quem é do setor Jurídico e está Trabalhando pode RESPONDER/editar/
-- excluir (controle via função is_juridico_ativo(), checada nas policies).
--
-- JUR_DUVIDAS — pergunta + resposta (vira item da biblioteca quando respondida).
-- Idempotente. RLS por papel.
-- =========================================================================

-- Função-papel: o usuário atual é do Jurídico e está Trabalhando?
-- SECURITY DEFINER p/ poder consultar EMPREGADOS independente da RLS dela.
CREATE OR REPLACE FUNCTION public.is_juridico_ativo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."EMPREGADOS" e
    WHERE e.auth_user_id = auth.uid()
      AND e."Setor_ERP" = 'JURIDICO'
      AND e."Situação"  = 'Trabalhando'
  );
$$;
-- anon não pode chamar (REVOKE FROM PUBLIC não basta; revogar de anon também).
REVOKE EXECUTE ON FUNCTION public.is_juridico_ativo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_juridico_ativo() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_juridico_ativo() TO authenticated;

CREATE TABLE IF NOT EXISTS public."JUR_DUVIDAS" (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  autor_id       uuid DEFAULT auth.uid(),
  autor_nome     text,
  titulo         text NOT NULL,
  pergunta       text NOT NULL,
  categoria      text,
  status         text NOT NULL DEFAULT 'Aberta',   -- Aberta / Respondida
  resposta       text,
  respondido_por text,
  respondido_em  timestamptz,
  publicada      boolean NOT NULL DEFAULT true      -- aparece na biblioteca de pesquisa
);

CREATE INDEX IF NOT EXISTS jur_duvidas_status_idx ON public."JUR_DUVIDAS"(status);
CREATE INDEX IF NOT EXISTS jur_duvidas_autor_idx  ON public."JUR_DUVIDAS"(autor_id);
CREATE INDEX IF NOT EXISTS jur_duvidas_criado_idx ON public."JUR_DUVIDAS"(created_at DESC);

ALTER TABLE public."JUR_DUVIDAS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."JUR_DUVIDAS" TO authenticated;

-- Leitura: todos os autenticados (pesquisar/ler a biblioteca).
DROP POLICY IF EXISTS jur_duvidas_select ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_select ON public."JUR_DUVIDAS"
  FOR SELECT TO authenticated USING (true);

-- Perguntar: qualquer autenticado cria a PRÓPRIA dúvida.
DROP POLICY IF EXISTS jur_duvidas_insert ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_insert ON public."JUR_DUVIDAS"
  FOR INSERT TO authenticated WITH CHECK (autor_id = auth.uid());

-- Responder/editar: somente Jurídico Trabalhando.
DROP POLICY IF EXISTS jur_duvidas_update ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_update ON public."JUR_DUVIDAS"
  FOR UPDATE TO authenticated USING (public.is_juridico_ativo()) WITH CHECK (public.is_juridico_ativo());

-- Excluir: somente Jurídico Trabalhando.
DROP POLICY IF EXISTS jur_duvidas_delete ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_delete ON public."JUR_DUVIDAS"
  FOR DELETE TO authenticated USING (public.is_juridico_ativo());

NOTIFY pgrst, 'reload schema';
