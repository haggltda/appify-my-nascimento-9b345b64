-- =====================================================
-- MIGRATION #6 — STORAGE + IA + CONECTORES
-- =====================================================

-- =====================================================
-- 1) STORAGE BUCKET (anexos, privado, 25 MB)
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('anexos', 'anexos', false, 26214400)  -- 25 MB
ON CONFLICT (id) DO UPDATE SET file_size_limit = 26214400, public = false;

-- Helper para extrair empresa_id do path (formato: {empresa_id}/...)
CREATE OR REPLACE FUNCTION public.storage_path_empresa(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(split_part(_name, '/', 1), '')::uuid;
$$;
REVOKE EXECUTE ON FUNCTION public.storage_path_empresa(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.storage_path_empresa(text) TO authenticated;

-- Políticas storage.objects para o bucket 'anexos'
CREATE POLICY anexos_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'anexos'
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.storage_path_empresa(name) = public.get_user_empresa(auth.uid())
    )
  );

CREATE POLICY anexos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'anexos'
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.storage_path_empresa(name) = public.get_user_empresa(auth.uid())
    )
  );

CREATE POLICY anexos_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'anexos'
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.storage_path_empresa(name) = public.get_user_empresa(auth.uid())
    )
  );

CREATE POLICY anexos_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'anexos'
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'controladoria')
      OR public.storage_path_empresa(name) = public.get_user_empresa(auth.uid())
    )
  );

-- =====================================================
-- 2) ANEXOS (metadados)
-- =====================================================
CREATE TABLE public.anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modulo text NOT NULL,           -- ex.: 'licitacao', 'realizado', 'obz', 'controladoria'
  registro_id uuid,               -- referência genérica ao registro do módulo
  nome text NOT NULL,
  tamanho_bytes bigint NOT NULL,
  mime_type text,
  storage_path text NOT NULL,     -- {empresa_id}/{modulo}/{uuid}-{filename}
  enviado_por uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tamanho_bytes <= 26214400)
);
CREATE INDEX idx_anex_empresa ON public.anexos(empresa_id);
CREATE INDEX idx_anex_modulo ON public.anexos(modulo, registro_id);
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY anex_select ON public.anexos FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY anex_insert ON public.anexos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY anex_update ON public.anexos FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY anex_delete ON public.anexos FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'controladoria')
    OR (empresa_id = public.get_user_empresa(auth.uid()) AND enviado_por = auth.uid())
  );

CREATE TRIGGER trg_anex_upd BEFORE UPDATE ON public.anexos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_anex_audit AFTER INSERT OR UPDATE OR DELETE ON public.anexos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =====================================================
-- 3) IA PROVEDORES (slot plugável)
-- =====================================================
CREATE TYPE public.ia_status AS ENUM ('pendente','processando','concluida','erro','cancelada');

CREATE TABLE public.ia_provedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,    -- 'lovable_gemini','openai','anthropic','custom'
  nome text NOT NULL,
  modelo_default text NOT NULL,
  base_url text,                  -- gateway URL ou endpoint custom
  secret_name text,               -- nome do secret no Supabase (ex.: 'OPENAI_API_KEY')
  ativo boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 100,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Apenas 1 default
CREATE UNIQUE INDEX uq_ia_default ON public.ia_provedores(is_default) WHERE is_default = true;

ALTER TABLE public.ia_provedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY iap_select ON public.ia_provedores FOR SELECT TO authenticated USING (true);
CREATE POLICY iap_admin_all ON public.ia_provedores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_iap_upd BEFORE UPDATE ON public.ia_provedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_iap_audit AFTER INSERT OR UPDATE OR DELETE ON public.ia_provedores
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Seed: Gemini via Lovable AI Gateway (default)
INSERT INTO public.ia_provedores (codigo, nome, modelo_default, base_url, secret_name, is_default, ordem, config)
VALUES
  ('lovable_gemini','Lovable AI Gateway (Gemini)','google/gemini-2.5-flash',
   'https://ai.gateway.lovable.dev/v1/chat/completions','LOVABLE_API_KEY', true, 1,
   '{"descricao":"Provider padrão via Lovable AI Gateway"}'::jsonb),
  ('openai','OpenAI','gpt-4o-mini',
   'https://api.openai.com/v1/chat/completions','OPENAI_API_KEY', false, 10,
   '{"descricao":"Slot para conectar OpenAI diretamente"}'::jsonb),
  ('anthropic','Anthropic Claude','claude-3-5-sonnet-latest',
   'https://api.anthropic.com/v1/messages','ANTHROPIC_API_KEY', false, 20,
   '{"descricao":"Slot para conectar Anthropic"}'::jsonb);

-- =====================================================
-- 4) IA TRIAGENS
-- =====================================================
CREATE TABLE public.ia_triagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  provedor_id uuid NOT NULL REFERENCES public.ia_provedores(id) ON DELETE RESTRICT,
  modelo text NOT NULL,
  modulo text NOT NULL,           -- 'licitacao','dre','obz','controladoria','geral'
  registro_id uuid,
  prompt text NOT NULL,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  resposta text,
  resposta_estruturada jsonb,
  tokens_input int,
  tokens_output int,
  custo_usd numeric(10,6),
  duracao_ms int,
  status ia_status NOT NULL DEFAULT 'pendente',
  erro_msg text,
  solicitado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_iat_empresa ON public.ia_triagens(empresa_id, created_at DESC);
CREATE INDEX idx_iat_modulo ON public.ia_triagens(modulo, registro_id);

ALTER TABLE public.ia_triagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY iat_select ON public.ia_triagens FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY iat_insert ON public.ia_triagens FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY iat_update ON public.ia_triagens FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR (empresa_id = public.get_user_empresa(auth.uid()) AND solicitado_por = auth.uid())
  );

CREATE TRIGGER trg_iat_upd BEFORE UPDATE ON public.ia_triagens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_iat_audit AFTER INSERT OR UPDATE OR DELETE ON public.ia_triagens
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =====================================================
-- 5) IA FEEDBACK
-- =====================================================
CREATE TABLE public.ia_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triagem_id uuid NOT NULL REFERENCES public.ia_triagens(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  util boolean NOT NULL,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (triagem_id, user_id)
);
ALTER TABLE public.ia_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY iaf_select ON public.ia_feedback FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.ia_triagens t
      WHERE t.id = triagem_id
        AND t.empresa_id = public.get_user_empresa(auth.uid())
    )
  );
CREATE POLICY iaf_insert ON public.ia_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY iaf_update ON public.ia_feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY iaf_delete ON public.ia_feedback FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));