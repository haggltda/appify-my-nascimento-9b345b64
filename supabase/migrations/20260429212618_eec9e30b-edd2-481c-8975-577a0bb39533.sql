-- ============== ENUMS ==============
DO $$ BEGIN CREATE TYPE public.fornecedor_tipo AS ENUM ('pj','pf'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.prod_serv_tipo AS ENUM ('produto','servico'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.req_compra_status AS ENUM ('rascunho','enviada','aprovada','rejeitada','pedido_emitido','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.pedido_compra_status AS ENUM ('rascunho','aprovado','enviado','recebido_parcial','recebido','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.titulo_status AS ENUM ('aberto','parcial','pago','cancelado','vencido'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.mov_banco_tipo AS ENUM ('debito','credito'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.lanc_status AS ENUM ('rascunho','efetivado','estornado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.partida_dc AS ENUM ('D','C'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.colab_status AS ENUM ('ativo','afastado','demitido','ferias'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============== SUPRIMENTOS ==============
CREATE TABLE IF NOT EXISTS public.fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  tipo fornecedor_tipo NOT NULL DEFAULT 'pj',
  cnpj_cpf text NOT NULL,
  razao_social text NOT NULL,
  nome_fantasia text,
  contato text,
  email text,
  telefone text,
  endereco text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, cnpj_cpf)
);
ALTER TABLE public.fornecedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY forn_select ON public.fornecedor FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY forn_write ON public.fornecedor FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER trg_forn_upd BEFORE UPDATE ON public.fornecedor FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.produto_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  codigo text NOT NULL,
  descricao text NOT NULL,
  tipo prod_serv_tipo NOT NULL DEFAULT 'produto',
  unidade text NOT NULL DEFAULT 'UN',
  preco_referencia numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
ALTER TABLE public.produto_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY ps_select ON public.produto_servico FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY ps_write ON public.produto_servico FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER trg_ps_upd BEFORE UPDATE ON public.produto_servico FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.requisicao_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  numero text NOT NULL,
  solicitante uuid,
  centro_custo_id uuid,
  contrato_id uuid,
  justificativa text,
  status req_compra_status NOT NULL DEFAULT 'rascunho',
  valor_estimado numeric NOT NULL DEFAULT 0,
  data_solicitacao date NOT NULL DEFAULT current_date,
  data_necessidade date,
  aprovado_por uuid,
  aprovado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero)
);
ALTER TABLE public.requisicao_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY rc_select ON public.requisicao_compra FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY rc_insert ON public.requisicao_compra FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY rc_update ON public.requisicao_compra FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY rc_delete ON public.requisicao_compra FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'));
CREATE TRIGGER trg_rc_upd BEFORE UPDATE ON public.requisicao_compra FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pedido_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  numero text NOT NULL,
  fornecedor_id uuid NOT NULL,
  requisicao_id uuid,
  centro_custo_id uuid,
  status pedido_compra_status NOT NULL DEFAULT 'rascunho',
  data_emissao date NOT NULL DEFAULT current_date,
  data_entrega_prevista date,
  condicao_pagamento text,
  valor_total numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero)
);
ALTER TABLE public.pedido_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY pc_select ON public.pedido_compra FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY pc_write ON public.pedido_compra FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER trg_pc_upd BEFORE UPDATE ON public.pedido_compra FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pedido_compra_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedido_compra(id) ON DELETE CASCADE,
  produto_servico_id uuid,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  preco_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_compra_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY pci_select ON public.pedido_compra_item FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedido_compra p WHERE p.id = pedido_id
    AND (p.empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'))));
CREATE POLICY pci_write ON public.pedido_compra_item FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedido_compra p WHERE p.id = pedido_id
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
    AND (has_role(auth.uid(),'admin') OR p.empresa_id = get_user_empresa(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedido_compra p WHERE p.id = pedido_id
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
    AND (has_role(auth.uid(),'admin') OR p.empresa_id = get_user_empresa(auth.uid()))));

-- ============== FINANCEIRO ==============
CREATE TABLE IF NOT EXISTS public.titulo_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  fornecedor_id uuid,
  pedido_id uuid,
  numero_documento text NOT NULL,
  competencia date NOT NULL,
  data_emissao date NOT NULL DEFAULT current_date,
  data_vencimento date NOT NULL,
  data_pagamento date,
  valor numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  status titulo_status NOT NULL DEFAULT 'aberto',
  conta_contabil_id uuid,
  centro_custo_id uuid,
  conta_bancaria_id uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.titulo_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY tp_select ON public.titulo_pagar FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY tp_write ON public.titulo_pagar FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER trg_tp_upd BEFORE UPDATE ON public.titulo_pagar FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.titulo_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  contrato_id uuid,
  cliente_nome text NOT NULL,
  numero_documento text NOT NULL,
  competencia date NOT NULL,
  data_emissao date NOT NULL DEFAULT current_date,
  data_vencimento date NOT NULL,
  data_recebimento date,
  valor numeric NOT NULL DEFAULT 0,
  valor_recebido numeric NOT NULL DEFAULT 0,
  status titulo_status NOT NULL DEFAULT 'aberto',
  conta_contabil_id uuid,
  centro_custo_id uuid,
  conta_bancaria_id uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.titulo_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY tr_select ON public.titulo_receber FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY tr_write ON public.titulo_receber FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER trg_tr_upd BEFORE UPDATE ON public.titulo_receber FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.movimento_bancario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  conta_bancaria_id uuid NOT NULL,
  data_movimento date NOT NULL,
  tipo mov_banco_tipo NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  descricao text,
  documento text,
  contraparte text,
  conciliado boolean NOT NULL DEFAULT false,
  titulo_pagar_id uuid,
  titulo_receber_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.movimento_bancario ENABLE ROW LEVEL SECURITY;
CREATE POLICY mb_select ON public.movimento_bancario FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY mb_write ON public.movimento_bancario FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER trg_mb_upd BEFORE UPDATE ON public.movimento_bancario FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== CONTÁBIL ==============
CREATE TABLE IF NOT EXISTS public.lancamento_contabil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  numero text NOT NULL,
  data_lancamento date NOT NULL DEFAULT current_date,
  historico text NOT NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  origem text,
  status lanc_status NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero)
);
ALTER TABLE public.lancamento_contabil ENABLE ROW LEVEL SECURITY;
CREATE POLICY lc_select ON public.lancamento_contabil FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY lc_write ON public.lancamento_contabil FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER trg_lc_upd BEFORE UPDATE ON public.lancamento_contabil FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.lancamento_partida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id uuid NOT NULL REFERENCES public.lancamento_contabil(id) ON DELETE CASCADE,
  conta_contabil_id uuid NOT NULL,
  centro_custo_id uuid,
  dc partida_dc NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  historico text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lancamento_partida ENABLE ROW LEVEL SECURITY;
CREATE POLICY lp_select ON public.lancamento_partida FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lancamento_contabil l WHERE l.id = lancamento_id
    AND (l.empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'))));
CREATE POLICY lp_write ON public.lancamento_partida FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lancamento_contabil l WHERE l.id = lancamento_id
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
    AND (has_role(auth.uid(),'admin') OR l.empresa_id = get_user_empresa(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lancamento_contabil l WHERE l.id = lancamento_id
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
    AND (has_role(auth.uid(),'admin') OR l.empresa_id = get_user_empresa(auth.uid()))));

-- ============== RH ==============
CREATE TABLE IF NOT EXISTS public.colaborador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  cpf text NOT NULL,
  nome text NOT NULL,
  cargo text,
  matricula text,
  data_admissao date NOT NULL DEFAULT current_date,
  data_demissao date,
  salario_base numeric NOT NULL DEFAULT 0,
  status colab_status NOT NULL DEFAULT 'ativo',
  email text,
  telefone text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, cpf)
);
ALTER TABLE public.colaborador ENABLE ROW LEVEL SECURITY;
CREATE POLICY col_select ON public.colaborador FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY col_write ON public.colaborador FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER trg_col_upd BEFORE UPDATE ON public.colaborador FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.alocacao_colaborador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  colaborador_id uuid NOT NULL REFERENCES public.colaborador(id) ON DELETE CASCADE,
  contrato_posto_id uuid,
  contrato_id uuid,
  data_inicio date NOT NULL DEFAULT current_date,
  data_fim date,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alocacao_colaborador ENABLE ROW LEVEL SECURITY;
CREATE POLICY ac_select ON public.alocacao_colaborador FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY ac_write ON public.alocacao_colaborador FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER trg_ac_upd BEFORE UPDATE ON public.alocacao_colaborador FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== BI VIEW ==============
CREATE OR REPLACE VIEW public.vw_bi_resumo_empresa
WITH (security_invoker = true) AS
SELECT
  e.id AS empresa_id,
  e.razao_social,
  (SELECT COUNT(*) FROM public.contrato c WHERE c.empresa_id = e.id AND c.status = 'ativo') AS contratos_ativos,
  (SELECT COALESCE(SUM(faturamento_mensal),0) FROM public.contrato c WHERE c.empresa_id = e.id AND c.status = 'ativo') AS faturamento_mensal_total,
  (SELECT COALESCE(SUM(valor - valor_recebido),0) FROM public.titulo_receber t WHERE t.empresa_id = e.id AND t.status IN ('aberto','parcial','vencido')) AS contas_receber_aberto,
  (SELECT COALESCE(SUM(valor - valor_pago),0) FROM public.titulo_pagar t WHERE t.empresa_id = e.id AND t.status IN ('aberto','parcial','vencido')) AS contas_pagar_aberto,
  (SELECT COUNT(*) FROM public.colaborador co WHERE co.empresa_id = e.id AND co.status = 'ativo') AS colaboradores_ativos,
  (SELECT COUNT(*) FROM public.pedido_compra p WHERE p.empresa_id = e.id AND p.status NOT IN ('recebido','cancelado')) AS pedidos_compra_abertos
FROM public.empresas e;

-- ============== INDEXES ==============
CREATE INDEX IF NOT EXISTS idx_forn_emp ON public.fornecedor(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ps_emp ON public.produto_servico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_rc_emp ON public.requisicao_compra(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_pc_emp ON public.pedido_compra(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_tp_emp ON public.titulo_pagar(empresa_id, status, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_tr_emp ON public.titulo_receber(empresa_id, status, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_mb_emp ON public.movimento_bancario(empresa_id, conta_bancaria_id, data_movimento);
CREATE INDEX IF NOT EXISTS idx_lc_emp ON public.lancamento_contabil(empresa_id, data_lancamento);
CREATE INDEX IF NOT EXISTS idx_col_emp ON public.colaborador(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_ac_emp ON public.alocacao_colaborador(empresa_id, ativo);