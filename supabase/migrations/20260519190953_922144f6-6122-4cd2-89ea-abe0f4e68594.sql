
-- ===========================================================================
-- ONDA 1: Sincronizar app_menu com as rotas reais do App.tsx
-- ===========================================================================
WITH novos(modulo_codigo, codigo, nome, rota, ordem) AS (
  VALUES
    -- Licitações (restantes)
    ('licitacoes','custos-bdi','Custos & BDI','/app/custos-bdi',60),
    ('licitacoes','parecer-tecnico','Parecer Técnico','/app/parecer-tecnico',70),
    ('licitacoes','parecer-sst','Parecer SST','/app/parecer-sst',71),
    ('licitacoes','parecer-juridico','Parecer Jurídico','/app/parecer-juridico',72),
    ('licitacoes','parecer-controladoria','Parecer Controladoria','/app/parecer-controladoria',73),
    ('licitacoes','parecer-dir-operacional','Parecer Diretor Operacional','/app/parecer-dir-operacional',74),
    ('licitacoes','parecer-dir-administrativo','Parecer Diretor Administrativo','/app/parecer-dir-administrativo',75),
    ('licitacoes','parecer-gerencial','Parecer Gerencial','/app/parecer-gerencial',76),
    ('licitacoes','aprovacoes-inbox','Aprovações — Inbox','/app/aprovacoes/inbox',91),
    ('licitacoes','prontas-contrato','Prontas para Contrato','/app/prontas-contrato',95),
    ('licitacoes','historico','Histórico','/app/historico',99),
    ('licitacoes','painel-executivo','Painel Executivo','/app/painel-executivo',5),
    ('licitacoes','presidencia','Presidência','/app/presidencia',6),
    ('licitacoes','controladoria-licit','Controladoria (Licitações)','/app/controladoria',80),
    -- Contratos (restantes)
    ('contratos','implantacao','Implantação','/app/contratos/implantacao',10),
    ('contratos','postos','Postos','/app/contratos/postos',40),
    ('contratos','faturamento','Faturamento','/app/contratos/faturamento',50),
    ('contratos','reajustes','Reajustes','/app/contratos/reajustes',60),
    ('contratos','encerramentos','Encerramentos','/app/contratos/encerramentos',70),
    -- Controladoria (restantes)
    ('controladoria','estrutura-organizacional','Estrutura Organizacional','/app/co/estrutura-organizacional',40),
    ('controladoria','classificadores','Classificadores','/app/co/classificadores',50),
    ('controladoria','obz-versoes','OBZ — Versões','/app/co/obz-versoes',61),
    ('controladoria','dre-gerencial','DRE Gerencial','/app/co/dre-gerencial',70),
    ('controladoria','orcamento','Orçamento','/app/orcamento',80),
    -- Suprimentos (todos)
    ('suprimentos','fornecedores','Fornecedores','/app/suprimentos/fornecedores',10),
    ('suprimentos','produtos-servicos','Produtos & Serviços','/app/suprimentos/produtos-servicos',20),
    ('suprimentos','produtos','Produtos','/app/suprimentos/produtos',21),
    ('suprimentos','categorias','Categorias','/app/suprimentos/categorias',22),
    ('suprimentos','almoxarifados','Almoxarifados','/app/suprimentos/almoxarifados',30),
    ('suprimentos','estoque','Estoque','/app/suprimentos/estoque',31),
    ('suprimentos','movimentos','Movimentos de Estoque','/app/suprimentos/movimentos',32),
    ('suprimentos','nf-entrada','NF de Entrada','/app/suprimentos/nf-entrada',40),
    ('suprimentos','requisicoes','Requisições','/app/suprimentos/requisicoes',50),
    ('suprimentos','pedidos','Pedidos de Compra','/app/suprimentos/pedidos',60),
    ('suprimentos','aprovacoes','Aprovações de Compras','/app/suprimentos/aprovacoes',70),
    ('suprimentos','recebimentos','Recebimentos','/app/suprimentos/recebimentos',80),
    ('suprimentos','cotacoes','Cotações','/app/suprimentos/cotacoes',90),
    -- Financeiro (restantes)
    ('financeiro','fluxo-caixa-diario','Fluxo de Caixa Diário','/app/financeiro/fluxo-caixa-diario',31),
    ('financeiro','capital-giro','Capital de Giro','/app/financeiro/capital-giro',40),
    ('financeiro','conciliacao-fluxo','Conciliação Fluxo de Caixa','/app/financeiro/conciliacao-fluxo-caixa',45),
    ('financeiro','contas-bancarias','Contas Bancárias','/app/financeiro/contas-bancarias',50),
    ('financeiro','movimentos-bancarios','Movimentos Bancários','/app/financeiro/movimentos',55),
    ('financeiro','integracao-bancaria','Integração Bancária','/app/financeiro/integracao-bancaria',60),
    -- Contábil
    ('contabil','lancamentos','Lançamentos','/app/contabil/lancamentos',10),
    ('contabil','plano-contas','Plano de Contas','/app/contabil/plano-contas',20),
    ('contabil','avancada','Contabilidade Avançada','/app/contabil/avancada',30),
    ('contabil','aprovacao-contas','Aprovação de Contas','/app/contabil/aprovacao-contas',40),
    ('contabil','balancete','Balancete','/app/contabil/balancete',50),
    ('contabil','razao','Razão','/app/contabil/razao',60),
    ('contabil','dre-gerencial-real','DRE Gerencial (Real)','/app/contabil/dre-gerencial-real',70),
    ('contabil','conciliacao-eventos','Conciliação de Eventos','/app/contabil/conciliacao-eventos',80),
    -- Fiscal
    ('fiscal','principal','Fiscal','/app/fiscal',10),
    -- BI
    ('bi','principal','BI','/app/bi',10),
    -- RH
    ('rh','colaboradores','Colaboradores','/app/rh/colaboradores',10),
    ('rh','alocacoes','Alocações','/app/rh/alocacoes',20),
    ('rh','folha','Folha','/app/rh/folha',30),
    -- Admin
    ('admin','integracao','Integração','/app/integracao',20),
    ('admin','integracao-aliases','Integração — Aliases','/app/integracao/aliases',21),
    ('admin','ajuda','Ajuda','/app/ajuda',30),
    ('admin','migracao-zero','Migração Zero','/app/admin/migracao-zero',90)
)
INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem, ativo)
SELECT m.id, n.codigo, n.nome, n.rota, n.ordem, true
FROM novos n
JOIN public.app_modulo m ON m.codigo = n.modulo_codigo
ON CONFLICT (modulo_id, codigo) DO NOTHING;

-- ===========================================================================
-- ONDA 2: Multi-empresa por pessoa
-- ===========================================================================

-- 2.1 Tabela user_empresa (autorizações por pessoa)
CREATE TABLE IF NOT EXISTS public.user_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_user_empresa_user ON public.user_empresa(user_id);
CREATE INDEX IF NOT EXISTS idx_user_empresa_empresa ON public.user_empresa(empresa_id);

ALTER TABLE public.user_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_empresa_select_self_or_admin" ON public.user_empresa;
CREATE POLICY "user_empresa_select_self_or_admin"
ON public.user_empresa FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "user_empresa_admin_all" ON public.user_empresa;
CREATE POLICY "user_empresa_admin_all"
ON public.user_empresa FOR ALL
USING (public.has_role(auth.uid(),'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- 2.2 Coluna empresa_atual_id em profiles (escolha persistente do seletor)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS empresa_atual_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;

-- 2.3 Helper: pode ver dados desta empresa?
CREATE OR REPLACE FUNCTION public.user_can_see_empresa(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_empresa ue
      WHERE ue.user_id = auth.uid() AND ue.empresa_id = _empresa_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.empresa_id = _empresa_id
    );
$$;

-- 2.4 get_user_empresa passa a preferir empresa_atual_id (mantém fallback)
CREATE OR REPLACE FUNCTION public.get_user_empresa(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT empresa_atual_id FROM public.profiles WHERE id = _user_id),
    (SELECT empresa_id FROM public.profiles WHERE id = _user_id)
  );
$$;

-- 2.5 Backfill: importa profiles.empresa_id como autorização inicial (is_default=true)
INSERT INTO public.user_empresa (user_id, empresa_id, is_default)
SELECT p.id, p.empresa_id, true
FROM public.profiles p
WHERE p.empresa_id IS NOT NULL
ON CONFLICT (user_id, empresa_id) DO NOTHING;
