-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — permissões granulares + setores (Admin/Operac.)
--
-- Substitui o modelo antigo (gestor / visibilidade por formulário) por
-- CAPACIDADES por usuário, geridas no painel dentro de Nascimento
-- Formulários (setinha ▾). Admin (user_roles.role='admin') faz tudo.
--
-- Capacidades (CS_FORM_ACESSOS.papel), todas globais (formulario_id NULL):
--   editar_criar      criar/editar formulários e perguntas
--   responder         abrir e enviar respostas (logado)
--   encerrar_excluir  publicar/encerrar/reabrir/excluir + apagar respostas
--   ver_tudo          ver todas as respostas (ex.: Helena)
--   ver_admin         ver respostas de setores ADMINISTRATIVOS (ex.: Fernanda)
--   ver_op            ver respostas de setores OPERACIONAIS (ex.: Senilton)
--   ver_proprias      ver só as respostas que a própria pessoa enviou (líder)
--   dashboard         (já existia) layout do painel por usuário, em config
--
-- Grupo do setor: CS_FORM_SETOR_GRUPO mapeia cada Setor_ERP (de EMPREGADOS)
-- → 'administrativo' | 'operacional'. A resposta guarda o setor (coluna
-- setor, vinda da pergunta indicada em CS_FORMULARIOS.pergunta_setor_id).
--
-- Idempotente.
-- =========================================================================

-- ── 1) Resposta: dono (p/ "só as minhas") + setor (p/ Admin/Operac.) ─────
ALTER TABLE public."CS_FORM_RESPOSTAS"
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS setor      text;
ALTER TABLE public."CS_FORM_RESPOSTAS" ALTER COLUMN criado_por SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS cs_form_resp_criado_idx ON public."CS_FORM_RESPOSTAS"(criado_por);
CREATE INDEX IF NOT EXISTS cs_form_resp_setor_idx  ON public."CS_FORM_RESPOSTAS"(setor);

-- ── 2) Qual pergunta define o setor (id dentro do jsonb perguntas) ───────
ALTER TABLE public."CS_FORMULARIOS"
  ADD COLUMN IF NOT EXISTS pergunta_setor_id text;

-- ── 3) Mapa setor → grupo ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."CS_FORM_SETOR_GRUPO" (
  setor          text PRIMARY KEY,
  grupo          text NOT NULL CHECK (grupo IN ('administrativo', 'operacional')),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid DEFAULT auth.uid()
);

-- ── 4) Capacidades em CS_FORM_ACESSOS.papel ──────────────────────────────
-- migra 'gestor' → 'editar_criar'; remove 'visualiza' (por-formulário, superado)
UPDATE public."CS_FORM_ACESSOS" SET papel = 'editar_criar' WHERE papel = 'gestor';
DELETE FROM public."CS_FORM_ACESSOS" WHERE papel = 'visualiza';

ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS "CS_FORM_ACESSOS_papel_check";
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_papel_check;
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_form_por_papel;
ALTER TABLE public."CS_FORM_ACESSOS"
  ADD CONSTRAINT cs_form_acessos_papel_check CHECK (papel IN (
    'editar_criar', 'responder', 'encerrar_excluir',
    'ver_tudo', 'ver_admin', 'ver_op', 'ver_proprias', 'dashboard'));
-- todas as capacidades são globais agora (não apontam formulário)
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_sem_form;
ALTER TABLE public."CS_FORM_ACESSOS"
  ADD CONSTRAINT cs_form_acessos_sem_form CHECK (formulario_id IS NULL);

-- ── 5) has-capability (admin faz tudo) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.cs_form_cap(_cap text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                  WHERE a.papel = _cap AND a.user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_cap(text) TO authenticated;

-- ── 6) RLS: CS_FORMULARIOS ───────────────────────────────────────────────
-- Vê o formulário na gestão: admin, criador, quem tem QUALQUER capacidade,
-- ou qualquer logado se o formulário está publicado (é público de qualquer
-- forma — permite responder pela URL mesmo logado sem capacidade).
DROP POLICY IF EXISTS cs_forms_select ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_select ON public."CS_FORMULARIOS"
  FOR SELECT TO authenticated USING (
    status = 'publicado'
    OR public.has_role(auth.uid(), 'admin')
    OR criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a WHERE a.user_id = auth.uid()));
DROP POLICY IF EXISTS cs_forms_insert ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_insert ON public."CS_FORMULARIOS"
  FOR INSERT TO authenticated WITH CHECK (public.cs_form_cap('editar_criar'));
DROP POLICY IF EXISTS cs_forms_update ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_update ON public."CS_FORMULARIOS"
  FOR UPDATE TO authenticated
  USING (public.cs_form_cap('editar_criar') OR public.cs_form_cap('encerrar_excluir'))
  WITH CHECK (public.cs_form_cap('editar_criar') OR public.cs_form_cap('encerrar_excluir'));
DROP POLICY IF EXISTS cs_forms_delete ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_delete ON public."CS_FORMULARIOS"
  FOR DELETE TO authenticated USING (public.cs_form_cap('encerrar_excluir'));
-- (mantém cs_forms_public_read p/ anon — formulário publicado)

-- ── 7) RLS: CS_FORM_RESPOSTAS ────────────────────────────────────────────
-- Visualização por escopo. ver_proprias = criado_por = auth.uid().
DROP POLICY IF EXISTS cs_form_resp_select ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_select ON public."CS_FORM_RESPOSTAS"
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.cs_form_cap('ver_tudo')
    OR (public.cs_form_cap('ver_proprias') AND criado_por = auth.uid())
    OR (public.cs_form_cap('ver_admin') AND setor IN
         (SELECT g.setor FROM public."CS_FORM_SETOR_GRUPO" g WHERE g.grupo = 'administrativo'))
    OR (public.cs_form_cap('ver_op') AND setor IN
         (SELECT g.setor FROM public."CS_FORM_SETOR_GRUPO" g WHERE g.grupo = 'operacional')));
-- Enviar resposta logado: tem 'responder' OU o formulário está publicado,
-- na janela e abaixo do limite (mesma regra da URL pública anônima, que
-- continua pela policy cs_form_resp_public_insert). Em ambos os casos o
-- criado_por é carimbado (default auth.uid()) → alimenta "só as minhas".
DROP POLICY IF EXISTS cs_form_resp_ins_auth ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_ins_auth ON public."CS_FORM_RESPOSTAS"
  FOR INSERT TO authenticated WITH CHECK (
    public.cs_form_cap('responder')
    OR public.cs_form_cap('editar_criar')  -- importar/semear respostas
    OR EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
                WHERE f.id = formulario_id
                  AND f.status = 'publicado'
                  AND (f.inicia_em  IS NULL OR now() >= f.inicia_em)
                  AND (f.encerra_em IS NULL OR now() <= f.encerra_em)
                  AND (f.max_respostas IS NULL OR
                       (SELECT count(*) FROM public."CS_FORM_RESPOSTAS" r
                         WHERE r.formulario_id = f.id) < f.max_respostas)));
DROP POLICY IF EXISTS cs_form_resp_delete ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_delete ON public."CS_FORM_RESPOSTAS"
  FOR DELETE TO authenticated USING (public.cs_form_cap('encerrar_excluir'));

-- ── 8) RLS: CS_FORM_SETOR_GRUPO ──────────────────────────────────────────
ALTER TABLE public."CS_FORM_SETOR_GRUPO" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CS_FORM_SETOR_GRUPO" TO authenticated;
DROP POLICY IF EXISTS cs_form_setor_select ON public."CS_FORM_SETOR_GRUPO";
CREATE POLICY cs_form_setor_select ON public."CS_FORM_SETOR_GRUPO"
  FOR SELECT TO authenticated USING (true);  -- lido pelo painel e pela policy de respostas
DROP POLICY IF EXISTS cs_form_setor_write ON public."CS_FORM_SETOR_GRUPO";
CREATE POLICY cs_form_setor_write ON public."CS_FORM_SETOR_GRUPO"
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── 9) RLS: CS_FORM_ACESSOS (capacidades = admin; dashboard = dono) ──────
DROP POLICY IF EXISTS cs_form_acessos_select ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_select ON public."CS_FORM_ACESSOS"
  FOR SELECT TO authenticated USING (
    papel <> 'dashboard' OR user_id = auth.uid());
DROP POLICY IF EXISTS cs_form_acessos_insert ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_insert ON public."CS_FORM_ACESSOS"
  FOR INSERT TO authenticated WITH CHECK (
    (papel = 'dashboard' AND user_id = auth.uid())
    OR (papel <> 'dashboard' AND public.has_role(auth.uid(), 'admin')));
DROP POLICY IF EXISTS cs_form_acessos_update ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_update ON public."CS_FORM_ACESSOS"
  FOR UPDATE TO authenticated
  USING ((papel = 'dashboard' AND user_id = auth.uid())
         OR (papel <> 'dashboard' AND public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((papel = 'dashboard' AND user_id = auth.uid())
         OR (papel <> 'dashboard' AND public.has_role(auth.uid(), 'admin')));
DROP POLICY IF EXISTS cs_form_acessos_delete ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_delete ON public."CS_FORM_ACESSOS"
  FOR DELETE TO authenticated USING (
    (papel = 'dashboard' AND user_id = auth.uid())
    OR (papel <> 'dashboard' AND public.has_role(auth.uid(), 'admin')));

-- Função antiga sem uso — dropar só DEPOIS de recriar todas as policies que
-- a referenciavam (senão o DROP falha por dependência).
DROP FUNCTION IF EXISTS public.cs_form_pode_criar();

NOTIFY pgrst, 'reload schema';
