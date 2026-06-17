-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.contrato_status AS ENUM ('implantacao','ativo','suspenso','encerrado');
CREATE TYPE public.posto_jornada AS ENUM ('12x36','8h','6h','4h','escala_5x2','escala_6x1','outra');
CREATE TYPE public.dissidio_criterio AS ENUM ('indice','percentual_fixo','cct','acordo_coletivo','judicial');
CREATE TYPE public.dissidio_base_calculo AS ENUM ('salario_base','total_remuneracao','posto');
CREATE TYPE public.comprovacao_tipo AS ENUM ('empenho','ordem_servico','aditivo','apostilamento','nota_fiscal','contrato_assinado','publicacao_doe','outro');
CREATE TYPE public.licitacao_status AS ENUM ('rascunho','oportunidade','em_andamento','vencida','perdida','cancelada');

-- =========================================================
-- LICITACAO (estrutura mínima — será expandida no Bloco Licitações)
-- =========================================================
CREATE TABLE public.licitacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  numero TEXT NOT NULL,
  objeto TEXT NOT NULL,
  orgao TEXT NOT NULL,
  modalidade TEXT,
  valor_estimado NUMERIC(18,2) NOT NULL DEFAULT 0,
  status public.licitacao_status NOT NULL DEFAULT 'rascunho',
  abertura DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero)
);
CREATE INDEX idx_licitacao_empresa ON public.licitacao(empresa_id);
CREATE INDEX idx_licitacao_status ON public.licitacao(status);

ALTER TABLE public.licitacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY lic_select ON public.licitacao FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY lic_insert ON public.licitacao FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid())));
CREATE POLICY lic_update ON public.licitacao FOR UPDATE TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid())));
CREATE POLICY lic_delete ON public.licitacao FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_licitacao_updated BEFORE UPDATE ON public.licitacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- BASE DISSIDIO CATEGORIA (master + por empresa)
-- =========================================================
CREATE TABLE public.base_dissidio_categoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE, -- NULL = master
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  cbo TEXT,
  sindicato TEXT,
  uf TEXT,
  data_base_mes SMALLINT CHECK (data_base_mes BETWEEN 1 AND 12),
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uk_base_dissidio_master ON public.base_dissidio_categoria(codigo) WHERE empresa_id IS NULL;
CREATE UNIQUE INDEX uk_base_dissidio_empresa ON public.base_dissidio_categoria(empresa_id, codigo) WHERE empresa_id IS NOT NULL;

ALTER TABLE public.base_dissidio_categoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY bdc_select ON public.base_dissidio_categoria FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY bdc_insert ON public.base_dissidio_categoria FOR INSERT TO authenticated
  WITH CHECK (
    (empresa_id IS NULL AND public.has_role(auth.uid(),'admin'))
    OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
        AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid())))
  );
CREATE POLICY bdc_update ON public.base_dissidio_categoria FOR UPDATE TO authenticated
  USING (
    (empresa_id IS NULL AND public.has_role(auth.uid(),'admin'))
    OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
        AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid())))
  );
CREATE POLICY bdc_delete ON public.base_dissidio_categoria FOR DELETE TO authenticated
  USING (
    (empresa_id IS NULL AND public.has_role(auth.uid(),'admin'))
    OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
        AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid())))
  );

CREATE TRIGGER trg_bdc_updated BEFORE UPDATE ON public.base_dissidio_categoria
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Pré-seed de categorias típicas (master)
INSERT INTO public.base_dissidio_categoria (codigo, nome, cbo, sindicato, data_base_mes) VALUES
  ('LIMP-URB',   'Limpeza Urbana',                '5142-25', 'SIEMACO',                            1),
  ('LIMP-PRED',  'Limpeza Predial / Conservação', '5143-20', 'SIEMACO / SINDILIMP',                1),
  ('VIG-ARM',    'Vigilância Patrimonial Armada', '5173-10', 'SINDESP / FENAVIST',                 2),
  ('VIG-DES',    'Vigilância Desarmada',          '5173-30', 'SINDESP',                            2),
  ('PORT-CTRL',  'Portaria e Controle de Acesso', '5174-10', 'SINDESP / SINDEAC',                  3),
  ('CONS-CIVIL', 'Conservação e Manutenção Civil','7170-20', 'SINTRACON',                          5),
  ('JARD',       'Jardinagem e Paisagismo',       '6220-10', 'SIEMACO',                            5),
  ('MOTO-CAT-D', 'Motorista Categoria D/E',       '7825-10', 'SINDICATO MOTORISTAS',               3),
  ('REC-ADM',    'Recepção e Administrativo',     '4221-05', 'SEAAC / SINDICATO COMERCIÁRIOS',     9),
  ('COZ-ALIM',   'Cozinha e Alimentação',         '5132-05', 'SINTHORESP',                         8);

-- =========================================================
-- CONTRATO
-- =========================================================
CREATE TABLE public.contrato (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  centro_custo_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  licitacao_id UUID REFERENCES public.licitacao(id) ON DELETE SET NULL,
  numero TEXT NOT NULL,
  origem_licitacao_texto TEXT,
  objeto TEXT NOT NULL,
  orgao TEXT NOT NULL,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE NOT NULL,
  valor_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  faturamento_mensal NUMERIC(18,2) NOT NULL DEFAULT 0,
  status public.contrato_status NOT NULL DEFAULT 'implantacao',
  gestor TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero),
  CHECK (vigencia_fim >= vigencia_inicio)
);
CREATE INDEX idx_contrato_empresa ON public.contrato(empresa_id);
CREATE INDEX idx_contrato_status ON public.contrato(status);
CREATE INDEX idx_contrato_licitacao ON public.contrato(licitacao_id);
CREATE INDEX idx_contrato_cc ON public.contrato(centro_custo_id);

ALTER TABLE public.contrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY ctr_select ON public.contrato FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY ctr_insert ON public.contrato FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid())));
CREATE POLICY ctr_update ON public.contrato FOR UPDATE TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid())));
CREATE POLICY ctr_delete ON public.contrato FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_contrato_updated BEFORE UPDATE ON public.contrato
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- CONTRATO_POSTO
-- =========================================================
CREATE TABLE public.contrato_posto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contrato(id) ON DELETE CASCADE,
  base_dissidio_id UUID REFERENCES public.base_dissidio_categoria(id) ON DELETE SET NULL,
  cargo TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  local TEXT,
  jornada public.posto_jornada NOT NULL DEFAULT 'outra',
  salario_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  va NUMERIC(14,2) NOT NULL DEFAULT 0,
  vt NUMERIC(14,2) NOT NULL DEFAULT 0,
  uniformes NUMERIC(14,2) NOT NULL DEFAULT 0,
  epis NUMERIC(14,2) NOT NULL DEFAULT 0,
  insalubridade_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (insalubridade_pct BETWEEN 0 AND 100),
  periculosidade_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (periculosidade_pct BETWEEN 0 AND 100),
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posto_contrato ON public.contrato_posto(contrato_id);
CREATE INDEX idx_posto_dissidio ON public.contrato_posto(base_dissidio_id);

ALTER TABLE public.contrato_posto ENABLE ROW LEVEL SECURITY;

CREATE POLICY cposto_select ON public.contrato_posto FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contrato c WHERE c.id = contrato_posto.contrato_id
    AND (c.empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY cposto_write ON public.contrato_posto FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
    AND EXISTS (SELECT 1 FROM public.contrato c WHERE c.id = contrato_posto.contrato_id
      AND (public.has_role(auth.uid(),'admin') OR c.empresa_id = public.get_user_empresa(auth.uid()))))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
    AND EXISTS (SELECT 1 FROM public.contrato c WHERE c.id = contrato_posto.contrato_id
      AND (public.has_role(auth.uid(),'admin') OR c.empresa_id = public.get_user_empresa(auth.uid()))));

CREATE TRIGGER trg_posto_updated BEFORE UPDATE ON public.contrato_posto
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- CONTRATO_DISSIDIO
-- =========================================================
CREATE TABLE public.contrato_dissidio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contrato(id) ON DELETE CASCADE,
  contrato_posto_id UUID REFERENCES public.contrato_posto(id) ON DELETE SET NULL,
  base_dissidio_id UUID REFERENCES public.base_dissidio_categoria(id) ON DELETE SET NULL,
  competencia DATE NOT NULL, -- mês de aplicação (use dia 1)
  criterio public.dissidio_criterio NOT NULL,
  base_calculo public.dissidio_base_calculo NOT NULL DEFAULT 'salario_base',
  percentual NUMERIC(7,4) NOT NULL DEFAULT 0,
  valor_fixo NUMERIC(14,2) NOT NULL DEFAULT 0,
  indice_referencia TEXT,
  documento_referencia TEXT,
  observacoes TEXT,
  aplicado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dis_contrato ON public.contrato_dissidio(contrato_id);
CREATE INDEX idx_dis_posto ON public.contrato_dissidio(contrato_posto_id);
CREATE INDEX idx_dis_competencia ON public.contrato_dissidio(competencia);

ALTER TABLE public.contrato_dissidio ENABLE ROW LEVEL SECURITY;

CREATE POLICY cdis_select ON public.contrato_dissidio FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contrato c WHERE c.id = contrato_dissidio.contrato_id
    AND (c.empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY cdis_write ON public.contrato_dissidio FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
    AND EXISTS (SELECT 1 FROM public.contrato c WHERE c.id = contrato_dissidio.contrato_id
      AND (public.has_role(auth.uid(),'admin') OR c.empresa_id = public.get_user_empresa(auth.uid()))))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
    AND EXISTS (SELECT 1 FROM public.contrato c WHERE c.id = contrato_dissidio.contrato_id
      AND (public.has_role(auth.uid(),'admin') OR c.empresa_id = public.get_user_empresa(auth.uid()))));

CREATE TRIGGER trg_dis_updated BEFORE UPDATE ON public.contrato_dissidio
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- CONTRATO_COMPROVACAO
-- =========================================================
CREATE TABLE public.contrato_comprovacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contrato(id) ON DELETE CASCADE,
  tipo public.comprovacao_tipo NOT NULL,
  numero TEXT NOT NULL,
  data_documento DATE NOT NULL,
  valor NUMERIC(18,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  anexo_id UUID REFERENCES public.anexos(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comp_contrato ON public.contrato_comprovacao(contrato_id);
CREATE INDEX idx_comp_tipo ON public.contrato_comprovacao(tipo);

ALTER TABLE public.contrato_comprovacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY ccomp_select ON public.contrato_comprovacao FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contrato c WHERE c.id = contrato_comprovacao.contrato_id
    AND (c.empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY ccomp_write ON public.contrato_comprovacao FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
    AND EXISTS (SELECT 1 FROM public.contrato c WHERE c.id = contrato_comprovacao.contrato_id
      AND (public.has_role(auth.uid(),'admin') OR c.empresa_id = public.get_user_empresa(auth.uid()))))
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
    AND EXISTS (SELECT 1 FROM public.contrato c WHERE c.id = contrato_comprovacao.contrato_id
      AND (public.has_role(auth.uid(),'admin') OR c.empresa_id = public.get_user_empresa(auth.uid()))));

CREATE TRIGGER trg_comp_updated BEFORE UPDATE ON public.contrato_comprovacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();