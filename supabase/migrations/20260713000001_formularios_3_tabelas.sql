-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — consolidação 6 → 3 tabelas
--
-- Antes: CS_FORMULARIOS, CS_FORM_PERGUNTAS, CS_FORM_RESPOSTAS,
--        CS_FORM_GESTORES, CS_FORM_VISIBILIDADE, CS_FORM_DASHBOARDS
--
-- Depois:
--   CS_FORMULARIOS    — ganha a coluna perguntas (jsonb, array ordenado;
--                       cada item: {id, tipo, titulo, descricao, obrigatoria,
--                       imagem_url, opcoes, config}; ordem = posição no array)
--   CS_FORM_RESPOSTAS — inalterada (itens = {pergunta_id: valor}; os ids das
--                       perguntas são preservados na migração)
--   CS_FORM_ACESSOS   — funde as 3 tabelas de configuração com a coluna papel:
--                       'gestor'    user_id — quem pode criar formulários
--                                   (lista vazia = qualquer autenticado)
--                       'visualiza' formulario_id + user_id — quem vê o
--                                   formulário restrito na gestão
--                       'dashboard' user_id — widgets do painel em config
--
-- Migra os dados e dropa as tabelas antigas. Idempotente.
-- =========================================================================

-- ── 1) Perguntas viram jsonb no próprio formulário ───────────────────────
ALTER TABLE public."CS_FORMULARIOS"
  ADD COLUMN IF NOT EXISTS perguntas jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $mig$
BEGIN
  IF to_regclass('public."CS_FORM_PERGUNTAS"') IS NOT NULL THEN
    UPDATE public."CS_FORMULARIOS" f
       SET perguntas = COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
                  'id', p.id, 'tipo', p.tipo, 'titulo', p.titulo,
                  'descricao', p.descricao, 'obrigatoria', p.obrigatoria,
                  'imagem_url', p.imagem_url, 'opcoes', p.opcoes,
                  'config', p.config)
                ORDER BY p.ordem)
           FROM public."CS_FORM_PERGUNTAS" p
          WHERE p.formulario_id = f.id), '[]'::jsonb);
  END IF;
END
$mig$;

-- ── 2) Tabela única de configuração/acessos ──────────────────────────────
CREATE TABLE IF NOT EXISTS public."CS_FORM_ACESSOS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  papel         text NOT NULL CHECK (papel IN ('gestor', 'visualiza', 'dashboard')),
  user_id       uuid NOT NULL,
  formulario_id uuid REFERENCES public."CS_FORMULARIOS"(id) ON DELETE CASCADE,
  config        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- widgets (papel dashboard)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  criado_por    uuid DEFAULT auth.uid(),
  -- só 'visualiza' aponta para um formulário; gestor/dashboard são globais
  CONSTRAINT cs_form_acessos_form_por_papel
    CHECK ((formulario_id IS NOT NULL) = (papel = 'visualiza'))
);
CREATE UNIQUE INDEX IF NOT EXISTS cs_form_acessos_unq_form
  ON public."CS_FORM_ACESSOS"(papel, user_id, formulario_id) WHERE formulario_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cs_form_acessos_unq_global
  ON public."CS_FORM_ACESSOS"(papel, user_id) WHERE formulario_id IS NULL;
CREATE INDEX IF NOT EXISTS cs_form_acessos_form_idx ON public."CS_FORM_ACESSOS"(formulario_id);

DROP TRIGGER IF EXISTS trg_cs_form_acessos_updated ON public."CS_FORM_ACESSOS";
CREATE TRIGGER trg_cs_form_acessos_updated BEFORE UPDATE ON public."CS_FORM_ACESSOS"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3) Migra os dados das tabelas antigas ────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('public."CS_FORM_GESTORES"') IS NOT NULL THEN
    INSERT INTO public."CS_FORM_ACESSOS" (papel, user_id, created_at, criado_por)
    SELECT 'gestor', g.user_id, g.created_at, g.criado_por
      FROM public."CS_FORM_GESTORES" g
    ON CONFLICT DO NOTHING;
  END IF;
  IF to_regclass('public."CS_FORM_VISIBILIDADE"') IS NOT NULL THEN
    INSERT INTO public."CS_FORM_ACESSOS" (papel, user_id, formulario_id, created_at)
    SELECT 'visualiza', v.user_id, v.formulario_id, v.created_at
      FROM public."CS_FORM_VISIBILIDADE" v
    ON CONFLICT DO NOTHING;
  END IF;
  IF to_regclass('public."CS_FORM_DASHBOARDS"') IS NOT NULL THEN
    INSERT INTO public."CS_FORM_ACESSOS" (papel, user_id, config, updated_at)
    SELECT 'dashboard', d.user_id, d.config, d.updated_at
      FROM public."CS_FORM_DASHBOARDS" d
    ON CONFLICT DO NOTHING;
  END IF;
END
$mig$;

-- ── 4) Função de permissão lê a tabela nova ──────────────────────────────
CREATE OR REPLACE FUNCTION public.cs_form_pode_criar()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" WHERE papel = 'gestor')
      OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                  WHERE a.papel = 'gestor' AND a.user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_pode_criar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_pode_criar() FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_pode_criar() TO authenticated;

-- ── 5) RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public."CS_FORM_ACESSOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CS_FORM_ACESSOS" TO authenticated;

-- SELECT não pode consultar CS_FORMULARIOS: a policy de lá consulta esta
-- tabela, e referenciar de volta em SELECT reentraria → recursão infinita.
-- Dashboard é privado do dono; gestor/visualiza são legíveis por qualquer
-- autenticado (como as tabelas antigas).
DROP POLICY IF EXISTS cs_form_acessos_select ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_select ON public."CS_FORM_ACESSOS"
  FOR SELECT TO authenticated
  USING (papel <> 'dashboard' OR user_id = auth.uid());

-- Escrita por papel: gestor exige estar na lista (ou lista vazia); visualiza
-- exige poder gerenciar o formulário; dashboard é só do próprio usuário.
DROP POLICY IF EXISTS cs_form_acessos_insert ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_insert ON public."CS_FORM_ACESSOS"
  FOR INSERT TO authenticated WITH CHECK (
    (papel = 'gestor' AND public.cs_form_pode_criar())
    OR (papel = 'visualiza' AND EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
          WHERE f.id = formulario_id
            AND (f.criado_por = auth.uid() OR public.cs_form_pode_criar())))
    OR (papel = 'dashboard' AND user_id = auth.uid()));
DROP POLICY IF EXISTS cs_form_acessos_update ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_update ON public."CS_FORM_ACESSOS"
  FOR UPDATE TO authenticated
  USING (papel = 'dashboard' AND user_id = auth.uid())
  WITH CHECK (papel = 'dashboard' AND user_id = auth.uid());
DROP POLICY IF EXISTS cs_form_acessos_delete ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_delete ON public."CS_FORM_ACESSOS"
  FOR DELETE TO authenticated USING (
    (papel = 'gestor' AND public.cs_form_pode_criar())
    OR (papel = 'visualiza' AND EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
          WHERE f.id = formulario_id
            AND (f.criado_por = auth.uid() OR public.cs_form_pode_criar())))
    OR (papel = 'dashboard' AND user_id = auth.uid()));

-- CS_FORMULARIOS: o SELECT agora consulta CS_FORM_ACESSOS.
-- (Recriar ANTES de dropar as tabelas antigas — a policy atual depende delas.)
DROP POLICY IF EXISTS cs_forms_select ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_select ON public."CS_FORMULARIOS"
  FOR SELECT TO authenticated USING (
    visibilidade = 'todos'
    OR criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                WHERE a.papel = 'visualiza'
                  AND a.formulario_id = "CS_FORMULARIOS".id
                  AND a.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                WHERE a.papel = 'gestor' AND a.user_id = auth.uid()));

-- ── 6) Dropa as tabelas antigas (policies caem junto) ────────────────────
DROP TABLE IF EXISTS public."CS_FORM_PERGUNTAS";
DROP TABLE IF EXISTS public."CS_FORM_GESTORES";
DROP TABLE IF EXISTS public."CS_FORM_VISIBILIDADE";
DROP TABLE IF EXISTS public."CS_FORM_DASHBOARDS";

NOTIFY pgrst, 'reload schema';
