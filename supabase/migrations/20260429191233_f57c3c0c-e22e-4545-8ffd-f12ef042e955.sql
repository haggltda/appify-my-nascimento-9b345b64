
ALTER TABLE public.dre_linhas ALTER COLUMN empresa_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dre_linhas_master_codigo_uk
  ON public.dre_linhas (codigo) WHERE empresa_id IS NULL;

DROP POLICY IF EXISTS dre_select ON public.dre_linhas;
DROP POLICY IF EXISTS dre_insert ON public.dre_linhas;
DROP POLICY IF EXISTS dre_update ON public.dre_linhas;
DROP POLICY IF EXISTS dre_delete ON public.dre_linhas;

CREATE POLICY dre_select ON public.dre_linhas FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY dre_insert ON public.dre_linhas FOR INSERT TO authenticated
  WITH CHECK (
    (empresa_id IS NULL AND has_role(auth.uid(),'admin'))
    OR ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
        AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  );
CREATE POLICY dre_update ON public.dre_linhas FOR UPDATE TO authenticated
  USING (
    (empresa_id IS NULL AND has_role(auth.uid(),'admin'))
    OR ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
        AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  );
CREATE POLICY dre_delete ON public.dre_linhas FOR DELETE TO authenticated
  USING (
    (empresa_id IS NULL AND has_role(auth.uid(),'admin'))
    OR ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
        AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  );

INSERT INTO public.dre_linhas (empresa_id, codigo, descricao, natureza, nivel, ordem, ativo) VALUES
  (NULL,'L01','Receita Bruta de Serviços','receita',1,1,true),
  (NULL,'L02','(-) Deduções da Receita','deducao',1,2,true),
  (NULL,'L03','Receita Líquida','resultado',1,3,true),
  (NULL,'L04','(-) Custos com Pessoal Operacional','custo',1,4,true),
  (NULL,'L05','(-) Custos com Materiais e EPIs','custo',1,5,true),
  (NULL,'L06','Lucro Bruto','resultado',1,6,true),
  (NULL,'L07','(-) Despesas Administrativas com Pessoal','despesa',1,7,true),
  (NULL,'L08','(-) Despesas Administrativas Gerais','despesa',1,8,true),
  (NULL,'L09','(-) Despesas Comerciais e Licitações','despesa',1,9,true),
  (NULL,'L10','(-) Despesas Financeiras','financeiro',1,10,true),
  (NULL,'L11','(+) Receitas Financeiras e Outras','financeiro',1,11,true),
  (NULL,'L12','(-) Outras Despesas e Multas','despesa',1,12,true),
  (NULL,'L13','Resultado Antes do IR/CSLL','resultado',1,13,true),
  (NULL,'L14','Resultado Líquido do Período','resultado',1,14,true)
ON CONFLICT DO NOTHING;

DO $$ BEGIN CREATE TYPE public.conta_tipo AS ENUM ('sintetica','analitica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.conta_natureza AS ENUM ('D','C');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.conta_exige_contrato AS ENUM ('sim','nao','opcional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.conta_grupo_dre AS ENUM ('balanco','balanco_gerencial','dre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.banco_tipo AS ENUM ('corrente','poupanca','aplicacao','vinculada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.plano_contas_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_reduzida INTEGER NOT NULL UNIQUE,
  classificacao TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  tipo public.conta_tipo NOT NULL,
  natureza public.conta_natureza NOT NULL,
  exige_contrato public.conta_exige_contrato NOT NULL DEFAULT 'nao',
  centro_custo_padrao TEXT,
  entra_fluxo BOOLEAN NOT NULL DEFAULT false,
  entra_orcamento BOOLEAN NOT NULL DEFAULT false,
  parent_id UUID REFERENCES public.plano_contas_master(id) ON DELETE SET NULL,
  dre_linha_id UUID REFERENCES public.dre_linhas(id) ON DELETE SET NULL,
  grupo_dre public.conta_grupo_dre NOT NULL DEFAULT 'balanco',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plano_contas_master_classificacao ON public.plano_contas_master(classificacao);
CREATE INDEX idx_plano_contas_master_parent ON public.plano_contas_master(parent_id);
CREATE INDEX idx_plano_contas_master_dre ON public.plano_contas_master(dre_linha_id);

CREATE TRIGGER trg_plano_contas_master_updated_at
  BEFORE UPDATE ON public.plano_contas_master
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.plano_contas_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcm_select ON public.plano_contas_master FOR SELECT TO authenticated USING (true);
CREATE POLICY pcm_admin_ins ON public.plano_contas_master FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY pcm_admin_upd ON public.plano_contas_master FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY pcm_admin_del ON public.plano_contas_master FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

INSERT INTO public.plano_contas_master
  (conta_reduzida, classificacao, descricao, tipo, natureza, exige_contrato, centro_custo_padrao, entra_fluxo, entra_orcamento, grupo_dre)
VALUES
(1,'01','ATIVO','sintetica','D','nao',NULL,false,false,'balanco'),
(2,'01.1','ATIVO CIRCULANTE','sintetica','D','nao',NULL,false,false,'balanco'),
(3,'01.1.1','DISPONIBILIDADES','sintetica','D','nao',NULL,true,false,'balanco'),
(4,'01.1.1.01','CAIXA','sintetica','D','nao',NULL,true,false,'balanco'),
(5,'01.1.1.01.001','Caixa','analitica','D','nao',NULL,true,false,'balanco'),
(6,'01.1.1.02','BANCOS CONTA MOVIMENTO','sintetica','D','nao',NULL,true,false,'balanco'),
(7,'01.1.1.03','APLICAÇÕES DE LIQUIDEZ IMEDIATA','sintetica','D','nao',NULL,true,false,'balanco'),
(8,'01.1.1.04','CONTA VINCULADA / RETIDA','sintetica','D','sim','sim',true,false,'balanco'),
(9,'01.1.2','CLIENTES E VALORES A RECEBER','sintetica','D','sim','sim',true,false,'balanco'),
(10,'01.1.2.01','Clientes a Receber','analitica','D','sim','sim',true,false,'balanco'),
(11,'01.1.2.02','Empenhos / Receitas Contratuais a Realizar','analitica','D','sim','sim',false,false,'balanco_gerencial'),
(12,'01.1.2.03','Intercompany a Receber','analitica','D','nao','ADM.019',true,false,'balanco'),
(13,'01.1.3','TRIBUTOS A RECUPERAR / COMPENSAR','sintetica','D','opcional','sim',false,false,'balanco'),
(14,'01.1.3.01','PIS a recuperar','analitica','D','opcional','sim',false,false,'balanco'),
(15,'01.1.3.02','COFINS a recuperar','analitica','D','opcional','sim',false,false,'balanco'),
(16,'01.1.3.03','INSS retido a compensar','analitica','D','sim','sim',false,false,'balanco'),
(17,'01.1.3.04','ISS retido a compensar','analitica','D','sim','sim',false,false,'balanco'),
(18,'01.1.4','ESTOQUES E MATERIAIS','sintetica','D','sim','sim',false,false,'balanco'),
(19,'01.1.4.01','Estoques de limpeza','analitica','D','sim','sim',false,false,'balanco'),
(20,'01.1.4.02','Estoques de EPIs e uniformes (grupo sintético)','analitica','D','sim','sim',false,false,'balanco'),
(21,'01.1.4.03','Estoques de peças/equipamentos de consumo','analitica','D','sim','sim',false,false,'balanco'),
(22,'01.2','ATIVO NÃO CIRCULANTE','sintetica','D','nao',NULL,false,false,'balanco'),
(23,'01.2.1','REALIZÁVEL A LONGO PRAZO','sintetica','D','nao',NULL,false,false,'balanco'),
(24,'01.2.2','IMOBILIZADO','sintetica','D','opcional','sim',false,false,'balanco'),
(25,'01.2.3','INTANGÍVEL','sintetica','D','opcional','sim',false,false,'balanco'),
(101,'02','PASSIVO E PATRIMÔNIO LÍQUIDO','sintetica','C','nao',NULL,false,false,'balanco'),
(102,'02.1','PASSIVO CIRCULANTE','sintetica','C','nao',NULL,true,false,'balanco'),
(103,'02.1.1','FORNECEDORES','sintetica','C','sim','sim',true,false,'balanco'),
(104,'02.1.1.01','Fornecedores nacionais','analitica','C','sim','sim',true,false,'balanco'),
(105,'02.1.2','OBRIGAÇÕES TRABALHISTAS','sintetica','C','sim','sim',true,false,'balanco'),
(106,'02.1.2.01','Salários a pagar','analitica','C','sim','sim',true,false,'balanco'),
(107,'02.1.2.02','Férias a pagar','analitica','C','sim','sim',true,false,'balanco'),
(108,'02.1.2.03','13º salário a pagar','analitica','C','sim','sim',true,false,'balanco'),
(109,'02.1.2.04','FGTS a recolher','analitica','C','sim','sim',true,false,'balanco'),
(110,'02.1.2.05','INSS / CPP / RAT / terceiros a recolher','analitica','C','sim','sim',true,false,'balanco'),
(111,'02.1.3','OBRIGAÇÕES TRIBUTÁRIAS','sintetica','C','opcional','sim',true,false,'balanco'),
(112,'02.1.3.01','ISS a recolher','analitica','C','sim','sim',true,false,'balanco'),
(113,'02.1.3.02','PIS a recolher','analitica','C','sim','sim',true,false,'balanco'),
(114,'02.1.3.03','COFINS a recolher','analitica','C','sim','sim',true,false,'balanco'),
(115,'02.1.3.04','IRRF/CSRF retidos','analitica','C','opcional','sim',true,false,'balanco'),
(116,'02.1.4','CONTAS A PAGAR INTERCOMPANY','analitica','C','nao','ADM.019',true,false,'balanco'),
(117,'02.1.5','EMPRÉSTIMOS E FINANCIAMENTOS','sintetica','C','nao','opcional',true,false,'balanco'),
(118,'02.2','PASSIVO NÃO CIRCULANTE','sintetica','C','nao',NULL,false,false,'balanco'),
(119,'02.3','PATRIMÔNIO LÍQUIDO / PATRIMÔNIO SOCIAL','sintetica','C','nao',NULL,false,false,'balanco'),
(201,'03','RECEITAS','sintetica','C','sim','sim',false,true,'dre'),
(202,'03.1.1','Receita bruta de serviços','sintetica','C','sim','sim',false,true,'dre'),
(203,'03.1.1.03.003','Serviços prestados a prazo','analitica','C','sim','sim',false,true,'dre'),
(204,'03.1.2','Deduções da receita','sintetica','D','sim','sim',false,true,'dre'),
(205,'03.1.2.02.002','PIS sobre vendas e serviços','analitica','D','sim','sim',false,true,'dre'),
(206,'03.1.2.02.003','COFINS sobre vendas e serviços','analitica','D','sim','sim',false,true,'dre'),
(207,'03.1.2.02.007','ISSQN sobre serviços','analitica','D','sim','sim',false,true,'dre'),
(208,'03.1.2.02.008','Simples sobre vendas e serviços (se aplicável)','analitica','D','sim','sim',false,true,'dre'),
(301,'04','CUSTOS E DESPESAS','sintetica','D','sim','sim',false,true,'dre'),
(302,'04.1.3.02.013','Salários operacionais','analitica','D','sim','sim',false,true,'dre'),
(303,'04.1.3.02.010','INSS / CPP operacional','analitica','D','sim','sim',false,true,'dre'),
(304,'04.1.3.02.005','FGTS operacional','analitica','D','sim','sim',false,true,'dre'),
(305,'04.1.3.02.001','13º salário operacional','analitica','D','sim','sim',false,true,'dre'),
(306,'04.1.3.02.006','Férias e abono de férias operacional','analitica','D','sim','sim',false,true,'dre'),
(307,'04.1.3.02.003','Aviso prévio / rescisões','analitica','D','sim','sim',false,true,'dre'),
(308,'04.1.3.02.015','Vale alimentação','analitica','D','sim','sim',true,true,'dre'),
(309,'04.1.3.02.016','Vale transporte','analitica','D','sim','sim',true,true,'dre'),
(310,'04.1.3.02.019','Saúde ocupacional','analitica','D','sim','sim',true,true,'dre'),
(311,'04.1.3.02.021','Uniformes','analitica','D','sim','sim',true,true,'dre'),
(3120,'04.1.3.02.022','EPIs','analitica','D','sim','sim',true,true,'dre'),
(312,'04.1.3.03.003','Bens não imobilizáveis de pequeno valor','analitica','D','sim','sim',true,true,'dre'),
(313,'04.1.3.03.043','Manutenção bens e equipamentos dos contratos','analitica','D','sim','sim',true,true,'dre'),
(314,'04.2.1.01.001','Salários administrativos','analitica','D','nao','ADM por setor',true,true,'dre'),
(315,'04.2.1.03.001','Aluguel','analitica','D','nao','ADM.001/ADM.012',true,true,'dre'),
(316,'04.2.1.03.002','Água e esgoto','analitica','D','nao','ADM.001',true,true,'dre'),
(317,'04.2.1.03.003','Energia elétrica','analitica','D','nao','ADM.001',true,true,'dre'),
(318,'04.2.1.03.004','Internet','analitica','D','nao','ADM.010',true,true,'dre'),
(319,'04.2.1.03.045','Processamento de dados / sistemas','analitica','D','nao','ADM.010',true,true,'dre'),
(320,'04.2.1.03.073','Honorários contábeis','analitica','D','nao','ADM.004',true,true,'dre'),
(321,'04.2.1.03.020','Serviços terceiros PJ administrativos','analitica','D','opcional','ADM conforme setor',true,true,'dre'),
(322,'04.2.1.03.034','Seguros','analitica','D','opcional','ADM conforme setor',true,true,'dre'),
(323,'04.2.1.03.038','Combustíveis administrativos','analitica','D','opcional','ADM conforme setor',true,true,'dre'),
(324,'04.2.2.03.031','Serviços terceiros comerciais/licitações','analitica','D','opcional','ADM.008',true,true,'dre'),
(325,'04.2.2.03.036','Impostos e taxas comerciais','analitica','D','opcional','ADM.008',true,true,'dre'),
(326,'04.2.3.02.001','Juros pagos','analitica','D','nao','ADM.018',true,true,'dre'),
(327,'04.2.3.02.020','Despesas bancárias','analitica','D','nao','ADM.018',true,true,'dre'),
(328,'04.2.3.03.02.001','Rendimentos de aplicação financeira','analitica','C','nao','ADM.018',true,true,'dre'),
(329,'04.2.3.03.03.001','Juros recebidos','analitica','C','nao','ADM.018',true,true,'dre'),
(330,'04.2.4.01.003','IPTU','analitica','D','nao','ADM conforme setor',true,true,'dre'),
(331,'04.2.4.01.004','IPVA','analitica','D','nao','ADM conforme setor',true,true,'dre'),
(332,'04.2.4.02.003','Multas contratuais','analitica','D','sim','sim',true,true,'dre');

UPDATE public.plano_contas_master c
   SET parent_id = p.id
  FROM public.plano_contas_master p
 WHERE p.classificacao = regexp_replace(c.classificacao, '\.[^.]+$', '')
   AND p.classificacao <> c.classificacao;

UPDATE public.plano_contas_master c
   SET dre_linha_id = (SELECT id FROM public.dre_linhas WHERE empresa_id IS NULL AND codigo = m.dre)
  FROM (VALUES
    ('03.1.1','L01'),('03.1.1.03.003','L01'),
    ('03.1.2','L02'),('03.1.2.02.002','L02'),('03.1.2.02.003','L02'),('03.1.2.02.007','L02'),('03.1.2.02.008','L02'),
    ('04.1.3.02.013','L04'),('04.1.3.02.010','L04'),('04.1.3.02.005','L04'),('04.1.3.02.001','L04'),
    ('04.1.3.02.006','L04'),('04.1.3.02.003','L04'),('04.1.3.02.015','L04'),('04.1.3.02.016','L04'),
    ('04.1.3.02.019','L04'),
    ('04.1.3.02.021','L05'),('04.1.3.02.022','L05'),('04.1.3.03.003','L05'),('04.1.3.03.043','L05'),
    ('04.2.1.01.001','L07'),
    ('04.2.1.03.001','L08'),('04.2.1.03.002','L08'),('04.2.1.03.003','L08'),('04.2.1.03.004','L08'),
    ('04.2.1.03.045','L08'),('04.2.1.03.073','L08'),('04.2.1.03.020','L08'),('04.2.1.03.034','L08'),('04.2.1.03.038','L08'),
    ('04.2.2.03.031','L09'),('04.2.2.03.036','L09'),
    ('04.2.3.02.001','L10'),('04.2.3.02.020','L10'),
    ('04.2.3.03.02.001','L11'),('04.2.3.03.03.001','L11'),('04.2.4.01.003','L11'),('04.2.4.01.004','L11'),
    ('04.2.4.02.003','L12')
  ) AS m(classif, dre)
 WHERE c.classificacao = m.classif;

CREATE TABLE public.conta_contabil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  master_id UUID REFERENCES public.plano_contas_master(id) ON DELETE SET NULL,
  conta_reduzida INTEGER NOT NULL,
  classificacao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tipo public.conta_tipo NOT NULL,
  natureza public.conta_natureza NOT NULL,
  exige_contrato public.conta_exige_contrato NOT NULL DEFAULT 'nao',
  centro_custo_padrao TEXT,
  entra_fluxo BOOLEAN NOT NULL DEFAULT false,
  entra_orcamento BOOLEAN NOT NULL DEFAULT false,
  parent_id UUID REFERENCES public.conta_contabil(id) ON DELETE SET NULL,
  dre_linha_id UUID REFERENCES public.dre_linhas(id) ON DELETE SET NULL,
  grupo_dre public.conta_grupo_dre NOT NULL DEFAULT 'balanco',
  saldo_inicial NUMERIC(18,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, classificacao),
  UNIQUE (empresa_id, conta_reduzida)
);
CREATE INDEX idx_conta_contabil_empresa ON public.conta_contabil(empresa_id);
CREATE INDEX idx_conta_contabil_parent ON public.conta_contabil(parent_id);
CREATE INDEX idx_conta_contabil_dre ON public.conta_contabil(dre_linha_id);
CREATE INDEX idx_conta_contabil_master ON public.conta_contabil(master_id);

CREATE TRIGGER trg_conta_contabil_updated_at
  BEFORE UPDATE ON public.conta_contabil
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.conta_contabil ENABLE ROW LEVEL SECURITY;
CREATE POLICY cc_cont_select ON public.conta_contabil FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY cc_cont_insert ON public.conta_contabil FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
    AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()))
  );
CREATE POLICY cc_cont_update ON public.conta_contabil FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
    AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()))
  );
CREATE POLICY cc_cont_delete ON public.conta_contabil FOR DELETE TO authenticated
  USING (
    (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
    AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.aplicar_plano_mestre(_empresa_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF NOT (has_role(auth.uid(),'admin')
          OR (has_role(auth.uid(),'controladoria') AND _empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão para aplicar plano mestre nesta empresa';
  END IF;

  INSERT INTO public.conta_contabil
    (empresa_id, master_id, conta_reduzida, classificacao, descricao, tipo, natureza,
     exige_contrato, centro_custo_padrao, entra_fluxo, entra_orcamento, dre_linha_id, grupo_dre, ativo)
  SELECT _empresa_id, m.id, m.conta_reduzida, m.classificacao, m.descricao, m.tipo, m.natureza,
         m.exige_contrato, m.centro_custo_padrao, m.entra_fluxo, m.entra_orcamento, m.dre_linha_id, m.grupo_dre, m.ativo
    FROM public.plano_contas_master m
   WHERE NOT EXISTS (
     SELECT 1 FROM public.conta_contabil c
      WHERE c.empresa_id = _empresa_id AND c.classificacao = m.classificacao
   );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.conta_contabil c
     SET parent_id = p.id
    FROM public.conta_contabil p
   WHERE c.empresa_id = _empresa_id
     AND p.empresa_id = _empresa_id
     AND p.classificacao = regexp_replace(c.classificacao, '\.[^.]+$', '')
     AND p.classificacao <> c.classificacao
     AND (c.parent_id IS NULL OR c.parent_id <> p.id);

  RETURN v_count;
END;
$$;

CREATE TABLE public.conta_bancaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  conta_contabil_id UUID REFERENCES public.conta_contabil(id) ON DELETE SET NULL,
  banco_codigo TEXT NOT NULL,
  banco_nome TEXT NOT NULL,
  agencia TEXT NOT NULL,
  conta TEXT NOT NULL,
  digito TEXT,
  tipo public.banco_tipo NOT NULL DEFAULT 'corrente',
  titular TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, banco_codigo, agencia, conta)
);
CREATE INDEX idx_conta_bancaria_empresa ON public.conta_bancaria(empresa_id);
CREATE INDEX idx_conta_bancaria_contabil ON public.conta_bancaria(conta_contabil_id);

CREATE TRIGGER trg_conta_bancaria_updated_at
  BEFORE UPDATE ON public.conta_bancaria
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.conta_bancaria ENABLE ROW LEVEL SECURITY;
CREATE POLICY cb_select ON public.conta_bancaria FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY cb_insert ON public.conta_bancaria FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
    AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()))
  );
CREATE POLICY cb_update ON public.conta_bancaria FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
    AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()))
  );
CREATE POLICY cb_delete ON public.conta_bancaria FOR DELETE TO authenticated
  USING (
    (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
    AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()))
  );
