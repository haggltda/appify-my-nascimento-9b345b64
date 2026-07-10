-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — permissões por formulário + dashboard
--
-- Configurações DENTRO do sistema (tela ⚙ Configurações):
--   CS_FORM_GESTORES      — quem pode CRIAR formulários (e administrar a
--                           configuração). Lista VAZIA = qualquer autenticado
--                           pode criar (estado inicial, nada trava).
--   CS_FORMULARIOS.visibilidade — 'todos' (padrão) ou 'restrita'
--   CS_FORM_VISIBILIDADE  — quem VÊ o formulário na gestão quando restrito
--                           (o criador e os gestores sempre veem)
--   CS_FORM_DASHBOARDS    — dashboard customizável (widgets em jsonb, por
--                           usuário)
--
-- A autoridade é a RLS: as policies amplas ("qualquer autenticado faz tudo")
-- são substituídas por regras por linha. A URL pública (anon) não muda:
-- formulário publicado continua respondível por qualquer pessoa com o link.
-- =========================================================================

ALTER TABLE public."CS_FORMULARIOS"
  ADD COLUMN IF NOT EXISTS visibilidade text NOT NULL DEFAULT 'todos'; -- todos | restrita

CREATE TABLE IF NOT EXISTS public."CS_FORM_GESTORES" (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public."CS_FORM_VISIBILIDADE" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  formulario_id uuid NOT NULL REFERENCES public."CS_FORMULARIOS"(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formulario_id, user_id)
);
CREATE INDEX IF NOT EXISTS cs_form_vis_form_idx ON public."CS_FORM_VISIBILIDADE"(formulario_id);

CREATE TABLE IF NOT EXISTS public."CS_FORM_DASHBOARDS" (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  config     jsonb NOT NULL DEFAULT '[]'::jsonb  -- lista de widgets
);

-- Pode criar formulários? (lista de gestores vazia = todos podem)
CREATE OR REPLACE FUNCTION public.cs_form_pode_criar()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public."CS_FORM_GESTORES")
      OR EXISTS (SELECT 1 FROM public."CS_FORM_GESTORES" g WHERE g.user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_pode_criar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_pode_criar() FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_pode_criar() TO authenticated;

-- ── RLS: CS_FORMULARIOS (substitui a policy ampla) ───────────────────────
DROP POLICY IF EXISTS cs_forms_auth ON public."CS_FORMULARIOS";
DROP POLICY IF EXISTS cs_forms_select ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_select ON public."CS_FORMULARIOS"
  FOR SELECT TO authenticated USING (
    visibilidade = 'todos'
    OR criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public."CS_FORM_VISIBILIDADE" v
                WHERE v.formulario_id = "CS_FORMULARIOS".id AND v.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public."CS_FORM_GESTORES" g WHERE g.user_id = auth.uid())
  );
DROP POLICY IF EXISTS cs_forms_insert ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_insert ON public."CS_FORMULARIOS"
  FOR INSERT TO authenticated WITH CHECK (public.cs_form_pode_criar());
-- Editar/excluir: o criador do formulário ou gestor (lista vazia = aberto).
DROP POLICY IF EXISTS cs_forms_update ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_update ON public."CS_FORMULARIOS"
  FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.cs_form_pode_criar())
  WITH CHECK (criado_por = auth.uid() OR public.cs_form_pode_criar());
DROP POLICY IF EXISTS cs_forms_delete ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_delete ON public."CS_FORMULARIOS"
  FOR DELETE TO authenticated
  USING (criado_por = auth.uid() OR public.cs_form_pode_criar());

-- ── RLS: perguntas e respostas delegam ao formulário ─────────────────────
-- SELECT herda a visibilidade do pai (o EXISTS passa pela RLS do pai);
-- escrita exige poder gerenciar o pai.
DROP POLICY IF EXISTS cs_form_perg_auth ON public."CS_FORM_PERGUNTAS";
DROP POLICY IF EXISTS cs_form_perg_select ON public."CS_FORM_PERGUNTAS";
CREATE POLICY cs_form_perg_select ON public."CS_FORM_PERGUNTAS"
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f WHERE f.id = formulario_id));
DROP POLICY IF EXISTS cs_form_perg_write ON public."CS_FORM_PERGUNTAS";
CREATE POLICY cs_form_perg_write ON public."CS_FORM_PERGUNTAS"
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
                  WHERE f.id = formulario_id
                    AND (f.criado_por = auth.uid() OR public.cs_form_pode_criar())))
  WITH CHECK (EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
                       WHERE f.id = formulario_id
                         AND (f.criado_por = auth.uid() OR public.cs_form_pode_criar())));

DROP POLICY IF EXISTS cs_form_resp_auth ON public."CS_FORM_RESPOSTAS";
DROP POLICY IF EXISTS cs_form_resp_select ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_select ON public."CS_FORM_RESPOSTAS"
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f WHERE f.id = formulario_id));
DROP POLICY IF EXISTS cs_form_resp_ins_auth ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_ins_auth ON public."CS_FORM_RESPOSTAS"
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f WHERE f.id = formulario_id));
DROP POLICY IF EXISTS cs_form_resp_delete ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_delete ON public."CS_FORM_RESPOSTAS"
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
             WHERE f.id = formulario_id
               AND (f.criado_por = auth.uid() OR public.cs_form_pode_criar())));

-- ── RLS: tabelas de configuração ─────────────────────────────────────────
ALTER TABLE public."CS_FORM_GESTORES"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CS_FORM_VISIBILIDADE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CS_FORM_DASHBOARDS"   ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CS_FORM_GESTORES", public."CS_FORM_VISIBILIDADE", public."CS_FORM_DASHBOARDS" TO authenticated;

DROP POLICY IF EXISTS cs_form_gest_select ON public."CS_FORM_GESTORES";
CREATE POLICY cs_form_gest_select ON public."CS_FORM_GESTORES"
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cs_form_gest_write ON public."CS_FORM_GESTORES";
CREATE POLICY cs_form_gest_write ON public."CS_FORM_GESTORES"
  FOR ALL TO authenticated
  USING (public.cs_form_pode_criar()) WITH CHECK (public.cs_form_pode_criar());

DROP POLICY IF EXISTS cs_form_vis_select ON public."CS_FORM_VISIBILIDADE";
CREATE POLICY cs_form_vis_select ON public."CS_FORM_VISIBILIDADE"
  FOR SELECT TO authenticated USING (true);
-- Escrita só em INSERT/DELETE (NÃO 'FOR ALL'): uma policy FOR ALL também vale
-- para SELECT, e como a policy de CS_FORMULARIOS consulta CS_FORM_VISIBILIDADE,
-- isso reentraria em CS_FORMULARIOS → recursão infinita. O SELECT desta tabela
-- é coberto por cs_form_vis_select (true).
DROP POLICY IF EXISTS cs_form_vis_write   ON public."CS_FORM_VISIBILIDADE";
DROP POLICY IF EXISTS cs_form_vis_insert  ON public."CS_FORM_VISIBILIDADE";
CREATE POLICY cs_form_vis_insert ON public."CS_FORM_VISIBILIDADE"
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
                       WHERE f.id = formulario_id
                         AND (f.criado_por = auth.uid() OR public.cs_form_pode_criar())));
DROP POLICY IF EXISTS cs_form_vis_delete  ON public."CS_FORM_VISIBILIDADE";
CREATE POLICY cs_form_vis_delete ON public."CS_FORM_VISIBILIDADE"
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
                  WHERE f.id = formulario_id
                    AND (f.criado_por = auth.uid() OR public.cs_form_pode_criar())));

DROP POLICY IF EXISTS cs_form_dash_own ON public."CS_FORM_DASHBOARDS";
CREATE POLICY cs_form_dash_own ON public."CS_FORM_DASHBOARDS"
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Limpa o seed antigo de admins da tela (a liberação da TELA é pelo painel;
-- quem cria/vê formulário é pela configuração acima).
DELETE FROM public.screen_permission_user
 WHERE menu_codigo = 'central_servicos_formularios'
   AND motivo LIKE 'Nascimento Formulários%';

NOTIFY pgrst, 'reload schema';
