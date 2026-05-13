
-- =========================================================================
-- 1) PERFIL METADATA (mantém roles, adiciona descrição/ícone/cor)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.perfil_metadata (
  role public.app_role PRIMARY KEY,
  descricao text,
  icone text,
  cor text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.perfil_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfil_metadata_select ON public.perfil_metadata
  FOR SELECT TO authenticated USING (true);
CREATE POLICY perfil_metadata_admin_ins ON public.perfil_metadata
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY perfil_metadata_admin_upd ON public.perfil_metadata
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY perfil_metadata_admin_del ON public.perfil_metadata
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_perfil_metadata_updated
  BEFORE UPDATE ON public.perfil_metadata
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.perfil_metadata (role, descricao, icone, cor) VALUES
  ('admin','Administrador global do ERP','ShieldCheck','#1e3a8a'),
  ('controladoria','Revisão de margem, tributos e alçadas','Calculator','#0d7a5f'),
  ('comercial','Equipe comercial / licitações','Briefcase','#c9a84c'),
  ('operacional','Equipe de operações','Activity','#2e6b8a'),
  ('juridico','Análise jurídica','BookOpen','#6b3a2a'),
  ('sst','Saúde e segurança do trabalho','ShieldCheck','#e85d3a'),
  ('diretor_adm','Diretoria Administrativa','UserCog','#4f46e5'),
  ('diretor_op','Diretoria Operacional','UserCog','#4338ca'),
  ('visitante','Acesso somente leitura','Eye','#94a3b8'),
  ('comprador','Compras e cotações','ShoppingCart','#a0522d'),
  ('almoxarife','Estoque e almoxarifado','Package','#8b6f5e'),
  ('gestor_cc','Gestor de Centro de Custo','Building2','#3b6fa0'),
  ('fiscal_recebedor','Recebimento fiscal','ClipboardCheck','#0c2340'),
  ('financeiro','Financeiro','Wallet','#0d7a5f'),
  ('fiscal','Fiscal e impostos','Receipt','#5c2018'),
  ('presidencia','Presidência','Crown','#0d0d0d')
ON CONFLICT (role) DO NOTHING;

-- =========================================================================
-- 2) MÓDULOS & MENUS DO ERP
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.app_modulo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  icone text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_modulo ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_modulo_select ON public.app_modulo FOR SELECT TO authenticated USING (true);
CREATE POLICY app_modulo_admin_ins ON public.app_modulo FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY app_modulo_admin_upd ON public.app_modulo FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY app_modulo_admin_del ON public.app_modulo FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_app_modulo_updated BEFORE UPDATE ON public.app_modulo FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.app_menu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.app_modulo(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  rota text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modulo_id, codigo)
);
ALTER TABLE public.app_menu ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_menu_select ON public.app_menu FOR SELECT TO authenticated USING (true);
CREATE POLICY app_menu_admin_ins ON public.app_menu FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY app_menu_admin_upd ON public.app_menu FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY app_menu_admin_del ON public.app_menu FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_app_menu_updated BEFORE UPDATE ON public.app_menu FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed inicial dos módulos/menus principais
INSERT INTO public.app_modulo (codigo,nome,ordem,icone) VALUES
  ('licitacoes','Licitações',10,'Briefcase'),
  ('controladoria','Controladoria & Orçamento',20,'Calculator'),
  ('financeiro','Financeiro',30,'Wallet'),
  ('contabil','Contábil',40,'BookOpen'),
  ('suprimentos','Suprimentos',50,'ShoppingCart'),
  ('contratos','Contratos',60,'FileSignature'),
  ('rh','RH',70,'Users2'),
  ('fiscal','Fiscal',80,'Receipt'),
  ('bi','BI',90,'BarChart3'),
  ('admin','Administração',100,'Settings')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, x.codigo, x.nome, x.rota, x.ordem FROM (VALUES
  ('licitacoes','pipeline','Pipeline','/app/pipeline',10),
  ('licitacoes','editais','Cadastro de Editais','/app/editais',20),
  ('licitacoes','documentos','Documentos','/app/documentos',30),
  ('licitacoes','triagem','Triagem & IA','/app/triagem',40),
  ('licitacoes','composicao','Composição & BDI','/app/composicao',50),
  ('licitacoes','aprovacoes','Aprovações','/app/aprovacoes',60),
  ('licitacoes','pregao','Pregão','/app/pregao',70),
  ('licitacoes','resultado','Resultado','/app/resultado',80),
  ('controladoria','empresas','Empresas','/app/co/empresas',10),
  ('controladoria','cc','Centros de Custo','/app/co/centros-custo',20),
  ('controladoria','dre','Linhas DRE','/app/co/dre',30),
  ('controladoria','obz','Planejador OBZ','/app/co/obz',40),
  ('financeiro','contas-pagar','Contas a Pagar','/app/financeiro/contas-pagar',10),
  ('financeiro','contas-receber','Contas a Receber','/app/financeiro/contas-receber',20),
  ('financeiro','fluxo','Fluxo de Caixa','/app/financeiro/fluxo-caixa',30),
  ('financeiro','programacao','Programação de Pagamentos','/app/financeiro/programacao-pagamentos',40),
  ('financeiro','validacao','Validação Pós-Pagamento','/app/financeiro/validacao-pos-pagamento',50),
  ('contratos','ativos','Contratos Ativos','/app/contratos/ativos',10),
  ('contratos','empenhos','Empenhos','/app/contratos/empenhos',20),
  ('contratos','medicoes','Medições','/app/contratos/medicoes',30),
  ('admin','administracao','Configurações do ERP','/app/administracao',10)
) AS x(modulo_codigo,codigo,nome,rota,ordem)
JOIN public.app_modulo m ON m.codigo = x.modulo_codigo
ON CONFLICT (modulo_id, codigo) DO NOTHING;

-- =========================================================================
-- 3) ALÇADAS DE APROVAÇÃO (por empresa)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.alcada_aprovacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  responsavel_user_id uuid,
  responsavel_nome text,
  valor_min numeric(18,2) NOT NULL DEFAULT 0,
  valor_max numeric(18,2),
  excecao text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alcada_emp ON public.alcada_aprovacao(empresa_id);
ALTER TABLE public.alcada_aprovacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY alcada_select ON public.alcada_aprovacao
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY alcada_admin_ins ON public.alcada_aprovacao
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY alcada_admin_upd ON public.alcada_aprovacao
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY alcada_admin_del ON public.alcada_aprovacao
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_alcada_updated BEFORE UPDATE ON public.alcada_aprovacao FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 4) PARÂMETROS GERAIS (chave/valor por empresa)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.parametro_geral (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave text NOT NULL,
  valor text,
  descricao text,
  tipo text NOT NULL DEFAULT 'texto',
  categoria text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, chave)
);
CREATE INDEX IF NOT EXISTS idx_parametro_geral_emp ON public.parametro_geral(empresa_id);
ALTER TABLE public.parametro_geral ENABLE ROW LEVEL SECURITY;
CREATE POLICY parametro_geral_select ON public.parametro_geral
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY parametro_geral_admin_ins ON public.parametro_geral
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY parametro_geral_admin_upd ON public.parametro_geral
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY parametro_geral_admin_del ON public.parametro_geral
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_parametro_geral_updated BEFORE UPDATE ON public.parametro_geral FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 5) OCORRÊNCIAS OPERACIONAIS (por empresa)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ocorrencia_operacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'info',
  titulo text NOT NULL,
  descricao text,
  usuario_id uuid,
  usuario_nome text,
  ocorreu_em timestamptz NOT NULL DEFAULT now(),
  resolvida boolean NOT NULL DEFAULT false,
  resolvida_em timestamptz,
  resolvida_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ocorrencia_emp ON public.ocorrencia_operacional(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencia_data ON public.ocorrencia_operacional(ocorreu_em DESC);
ALTER TABLE public.ocorrencia_operacional ENABLE ROW LEVEL SECURITY;
CREATE POLICY ocorrencia_select ON public.ocorrencia_operacional
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'controladoria')
      OR empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY ocorrencia_admin_ins ON public.ocorrencia_operacional
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY ocorrencia_admin_upd ON public.ocorrencia_operacional
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY ocorrencia_admin_del ON public.ocorrencia_operacional
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- 6) IDENTIDADE VISUAL (por empresa, 1:1)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.identidade_visual (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome_empresarial text,
  subtitulo text,
  logo_path text,
  cor_primaria text,
  cor_secundaria text,
  cor_destaque text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.identidade_visual ENABLE ROW LEVEL SECURITY;
CREATE POLICY identidade_visual_select ON public.identidade_visual
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()));
CREATE POLICY identidade_visual_admin_ins ON public.identidade_visual
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY identidade_visual_admin_upd ON public.identidade_visual
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_identidade_visual_updated BEFORE UPDATE ON public.identidade_visual FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 7) STORAGE BUCKET PRIVADO
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('identidade-visual','identidade-visual', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "identidade_visual_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'identidade-visual' AND (
    public.has_role(auth.uid(),'admin') OR auth.uid() IS NOT NULL
  ));
CREATE POLICY "identidade_visual_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'identidade-visual' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "identidade_visual_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'identidade-visual' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "identidade_visual_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'identidade-visual' AND public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- 8) FUNÇÕES SECURITY DEFINER PARA SESSÕES E LOGS DE AUTH
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_list_active_sessions()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  refreshed_at timestamptz,
  user_agent text,
  ip text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT
    s.id,
    s.user_id,
    u.email::text,
    p.display_name,
    s.created_at,
    s.refreshed_at,
    s.user_agent,
    host(s.ip)::text
  FROM auth.sessions s
  LEFT JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE public.has_role(auth.uid(),'admin')
    AND (s.not_after IS NULL OR s.not_after > now())
  ORDER BY COALESCE(s.refreshed_at, s.created_at) DESC
  LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.admin_list_active_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_active_sessions() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_auth_logs(_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  ip_address text,
  payload jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT a.id, a.created_at, a.ip_address, a.payload
  FROM auth.audit_log_entries a
  WHERE public.has_role(auth.uid(),'admin')
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$$;
REVOKE ALL ON FUNCTION public.admin_list_auth_logs(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_auth_logs(int) TO authenticated;
