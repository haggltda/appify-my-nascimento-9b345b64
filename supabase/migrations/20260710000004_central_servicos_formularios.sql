-- =========================================================================
-- CENTRAL DE SERVIÇOS — Nascimento Formulários (construtor de formulários)
--
-- Sistema estilo survey: o gestor monta formulários com vários tipos de
-- pergunta (texto, múltipla escolha, caixas, lista, escala, data, número),
-- imagens (capa e por pergunta), define vigência (início/fim), limite de
-- respostas e publica numa URL pública (/formularios/<slug>) que qualquer
-- pessoa responde sem login.
--
-- Modelo:
--   CS_FORMULARIOS    — formulário (slug único da URL, status, vigência)
--   CS_FORM_PERGUNTAS — perguntas ordenadas (opcoes/config em jsonb)
--   CS_FORM_RESPOSTAS — 1 linha por envio; itens = {pergunta_id: valor}
--
-- Acesso:
--   Gestão (/app/central-servicos/formularios): tela no painel Módulos &
--   Menus (tela cadastrada = governada pelo painel; seed p/ admins atuais).
--   Público (anon): SELECT só de formulário publicado; INSERT de resposta só
--   com formulário publicado, dentro da janela e abaixo do limite.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."CS_FORMULARIOS" (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  titulo               text NOT NULL,
  descricao            text,
  slug                 text NOT NULL UNIQUE,
  status               text NOT NULL DEFAULT 'rascunho',  -- rascunho | publicado | encerrado
  inicia_em            timestamptz,
  encerra_em           timestamptz,
  max_respostas        integer,
  coleta_identificacao boolean NOT NULL DEFAULT false,    -- pede nome/e-mail do respondente
  imagem_capa_url      text,
  criado_por           uuid DEFAULT auth.uid(),
  criado_por_nome      text
);
CREATE INDEX IF NOT EXISTS cs_forms_status_idx ON public."CS_FORMULARIOS"(status);
CREATE INDEX IF NOT EXISTS cs_forms_slug_idx   ON public."CS_FORMULARIOS"(slug);

CREATE TABLE IF NOT EXISTS public."CS_FORM_PERGUNTAS" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES public."CS_FORMULARIOS"(id) ON DELETE CASCADE,
  ordem         integer NOT NULL DEFAULT 0,
  tipo          text NOT NULL DEFAULT 'texto_curto',
  -- texto_curto | texto_longo | multipla_escolha | caixas_selecao |
  -- lista_suspensa | escala | data | numero
  titulo        text NOT NULL DEFAULT '',
  descricao     text,
  obrigatoria   boolean NOT NULL DEFAULT false,
  imagem_url    text,
  opcoes        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ["Opção A", "Opção B", ...]
  config        jsonb NOT NULL DEFAULT '{}'::jsonb   -- escala: {min,max,rotulo_min,rotulo_max}
);
CREATE INDEX IF NOT EXISTS cs_form_perg_form_idx ON public."CS_FORM_PERGUNTAS"(formulario_id, ordem);

CREATE TABLE IF NOT EXISTS public."CS_FORM_RESPOSTAS" (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id     uuid NOT NULL REFERENCES public."CS_FORMULARIOS"(id) ON DELETE CASCADE,
  enviado_em        timestamptz NOT NULL DEFAULT now(),
  respondente_nome  text,
  respondente_email text,
  itens             jsonb NOT NULL DEFAULT '{}'::jsonb  -- {pergunta_id: valor}
);
CREATE INDEX IF NOT EXISTS cs_form_resp_form_idx ON public."CS_FORM_RESPOSTAS"(formulario_id, enviado_em);

DROP TRIGGER IF EXISTS trg_cs_forms_updated ON public."CS_FORMULARIOS";
CREATE TRIGGER trg_cs_forms_updated BEFORE UPDATE ON public."CS_FORMULARIOS"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public."CS_FORMULARIOS"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CS_FORM_PERGUNTAS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CS_FORM_RESPOSTAS" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."CS_FORMULARIOS", public."CS_FORM_PERGUNTAS", public."CS_FORM_RESPOSTAS" TO authenticated;
GRANT SELECT ON public."CS_FORMULARIOS", public."CS_FORM_PERGUNTAS" TO anon;
GRANT INSERT ON public."CS_FORM_RESPOSTAS" TO anon;

-- Gestão: qualquer autenticado (o acesso à TELA é governado pelo painel).
DROP POLICY IF EXISTS cs_forms_auth ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_auth ON public."CS_FORMULARIOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS cs_form_perg_auth ON public."CS_FORM_PERGUNTAS";
CREATE POLICY cs_form_perg_auth ON public."CS_FORM_PERGUNTAS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS cs_form_resp_auth ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_auth ON public."CS_FORM_RESPOSTAS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Público (anon): lê só formulário PUBLICADO (a página trata janela/encerrado).
DROP POLICY IF EXISTS cs_forms_public_read ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_public_read ON public."CS_FORMULARIOS"
  FOR SELECT TO anon USING (status = 'publicado');
DROP POLICY IF EXISTS cs_form_perg_public_read ON public."CS_FORM_PERGUNTAS";
CREATE POLICY cs_form_perg_public_read ON public."CS_FORM_PERGUNTAS"
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM public."CS_FORMULARIOS" f
     WHERE f.id = formulario_id AND f.status = 'publicado'));

-- Resposta anônima: só com formulário publicado, dentro da janela e
-- abaixo do limite de respostas (quando definido).
DROP POLICY IF EXISTS cs_form_resp_public_insert ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_public_insert ON public."CS_FORM_RESPOSTAS"
  FOR INSERT TO anon WITH CHECK (EXISTS (
    SELECT 1 FROM public."CS_FORMULARIOS" f
     WHERE f.id = formulario_id
       AND f.status = 'publicado'
       AND (f.inicia_em  IS NULL OR now() >= f.inicia_em)
       AND (f.encerra_em IS NULL OR now() <= f.encerra_em)
       AND (f.max_respostas IS NULL OR
            (SELECT count(*) FROM public."CS_FORM_RESPOSTAS" r
              WHERE r.formulario_id = f.id) < f.max_respostas)));

-- ── Storage: imagens dos formulários (capa e perguntas) ──────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('cs-formularios', 'cs-formularios', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS cs_forms_storage_read ON storage.objects;
CREATE POLICY cs_forms_storage_read ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'cs-formularios');
DROP POLICY IF EXISTS cs_forms_storage_insert ON storage.objects;
CREATE POLICY cs_forms_storage_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cs-formularios');
DROP POLICY IF EXISTS cs_forms_storage_update ON storage.objects;
CREATE POLICY cs_forms_storage_update ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'cs-formularios');
DROP POLICY IF EXISTS cs_forms_storage_delete ON storage.objects;
CREATE POLICY cs_forms_storage_delete ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'cs-formularios');

-- ── Tela no painel Módulos & Menus (guardada por rota) + seed p/ admins ──
INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, 'central_servicos_formularios', 'Nascimento Formulários', '/app/central-servicos/formularios', 30
  FROM public.app_modulo m
 WHERE m.codigo = 'central_servicos'
   AND NOT EXISTS (SELECT 1 FROM public.app_menu am WHERE am.rota = '/app/central-servicos/formularios');

INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id, motivo)
SELECT ur.user_id, 'central_servicos_formularios', 'visualizar'::public.app_acao, true, NULL,
       'Nascimento Formulários: gestão liberada aos admins atuais'
  FROM public.user_roles ur
 WHERE ur.role = 'admin'::public.app_role
   AND NOT EXISTS (
         SELECT 1 FROM public.screen_permission_user s
          WHERE s.user_id = ur.user_id
            AND s.menu_codigo = 'central_servicos_formularios'
            AND s.acao = 'visualizar'::public.app_acao
            AND s.empresa_id IS NULL);

NOTIFY pgrst, 'reload schema';
