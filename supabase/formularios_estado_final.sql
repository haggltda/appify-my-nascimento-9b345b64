-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — traz o schema pro ESTADO FINAL de uma vez só.
--
-- Rode ESTE arquivo UMA vez no SQL Editor do banco do APP
-- (projeto fwmzeaztjxrxxzxzxmgc). É idempotente e seguro mesmo com o banco
-- meio-migrado: migra os dados das tabelas antigas, DROPA as antigas (o que
-- destrava o DROP da função velha) e aplica permissões + setores.
--
-- Depois de rodar, o resultado é o mesmo das migrations 20260713000001..003
-- aplicadas em ordem. Contém: consolidação 6→3, drop das tabelas de denúncia
-- e o modelo de permissões/setores (admin faz tudo via has_role).
-- =========================================================================


-- ===================== 20260713000001_formularios_3_tabelas =====================
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
    -- Só preenche quem AINDA não tem perguntas em jsonb — assim re-rodar não
    -- apaga formulários criados/importados direto no jsonb (que não têm
    -- linhas em CS_FORM_PERGUNTAS e virariam '[]').
    UPDATE public."CS_FORMULARIOS" f
       SET perguntas = COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
                  'id', p.id, 'tipo', p.tipo, 'titulo', p.titulo,
                  'descricao', p.descricao, 'obrigatoria', p.obrigatoria,
                  'imagem_url', p.imagem_url, 'opcoes', p.opcoes,
                  'config', p.config)
                ORDER BY p.ordem)
           FROM public."CS_FORM_PERGUNTAS" p
          WHERE p.formulario_id = f.id), '[]'::jsonb)
     WHERE COALESCE(jsonb_array_length(f.perguntas), 0) = 0
       AND EXISTS (SELECT 1 FROM public."CS_FORM_PERGUNTAS" p WHERE p.formulario_id = f.id);
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

-- ===================== 20260713000002_denuncias_drop_responsaveis_synclog =====================
-- =========================================================================
-- DENÚNCIAS — remove tabelas auxiliares inúteis
--
-- Quem acessa o módulo de Denúncias é definido no painel Módulos & Menus
-- (/app/administracao?tab=modulos) + RLS admin em CS_DENUNCIAS. As duas
-- tabelas abaixo não agregam:
--   CS_DENUNCIAS_RESPONSAVEIS — atribuição de "responsável" por denúncia
--                               (feature removida da tela)
--   CS_DENUNCIAS_SYNC_LOG     — log de execuções do sync (o resultado já
--                               volta na resposta da edge function)
--
-- CS_DENUNCIAS permanece. As colunas responsavel_* de CS_DENUNCIAS ficam
-- (sem uso) — dropá-las é opcional e não é feito aqui. Idempotente.
-- =========================================================================

DROP TABLE IF EXISTS public."CS_DENUNCIAS_RESPONSAVEIS";
DROP TABLE IF EXISTS public."CS_DENUNCIAS_SYNC_LOG";

NOTIFY pgrst, 'reload schema';

-- ===================== 20260713000003_formularios_permissoes_setores =====================
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
