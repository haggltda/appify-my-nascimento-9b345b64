-- =====================================================
-- MIGRATION #4 — REALIZADO FINANCEIRO (CORRIGIDA)
-- =====================================================

CREATE TYPE public.lote_origem AS ENUM ('manual','erp','extrato_bancario','planilha','api');
CREATE TYPE public.lote_status AS ENUM ('pendente','processado','erro','cancelado');

-- =====================================================
-- REALIZADO LOTES
-- =====================================================
CREATE TABLE public.realizado_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  referencia_mes int NOT NULL CHECK (referencia_mes BETWEEN 1 AND 12),
  referencia_ano int NOT NULL CHECK (referencia_ano BETWEEN 2020 AND 2100),
  origem lote_origem NOT NULL DEFAULT 'manual',
  arquivo_nome text,
  arquivo_path text,
  status lote_status NOT NULL DEFAULT 'pendente',
  total_lancamentos int NOT NULL DEFAULT 0,
  total_valor numeric(18,2) NOT NULL DEFAULT 0,
  observacoes text,
  erro_msg text,
  importado_por uuid,
  importado_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rlot_empresa_ref ON public.realizado_lotes(empresa_id, referencia_ano, referencia_mes);
ALTER TABLE public.realizado_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY rlot_select ON public.realizado_lotes FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY rlot_write ON public.realizado_lotes FOR ALL TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin')
     OR public.has_role(auth.uid(),'controladoria')
     OR public.has_role(auth.uid(),'diretor_adm'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  )
  WITH CHECK (
    (public.has_role(auth.uid(),'admin')
     OR public.has_role(auth.uid(),'controladoria')
     OR public.has_role(auth.uid(),'diretor_adm'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE TRIGGER trg_rlot_upd BEFORE UPDATE ON public.realizado_lotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rlot_audit AFTER INSERT OR UPDATE OR DELETE ON public.realizado_lotes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =====================================================
-- REALIZADO LANCAMENTOS
-- =====================================================
CREATE TABLE public.realizado_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  lote_id uuid REFERENCES public.realizado_lotes(id) ON DELETE SET NULL,
  data_lancamento date NOT NULL,
  data_competencia date NOT NULL,
  valor numeric(18,2) NOT NULL,
  dre_linha_id uuid REFERENCES public.dre_linhas(id) ON DELETE RESTRICT,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE RESTRICT,
  descricao text NOT NULL,
  documento text,
  contraparte text,
  classificadores jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash_dedup text,
  origem_externa_id text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rlanc_empresa_data ON public.realizado_lancamentos(empresa_id, data_competencia);
CREATE INDEX idx_rlanc_lote ON public.realizado_lancamentos(lote_id);
CREATE INDEX idx_rlanc_dre ON public.realizado_lancamentos(dre_linha_id);
CREATE INDEX idx_rlanc_cc ON public.realizado_lancamentos(centro_custo_id);
CREATE UNIQUE INDEX uq_rlanc_dedup ON public.realizado_lancamentos(empresa_id, hash_dedup) WHERE hash_dedup IS NOT NULL;

ALTER TABLE public.realizado_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY rlanc_select ON public.realizado_lancamentos FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY rlanc_insert ON public.realizado_lancamentos FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin')
     OR public.has_role(auth.uid(),'controladoria')
     OR public.has_role(auth.uid(),'diretor_adm'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE POLICY rlanc_update ON public.realizado_lancamentos FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE POLICY rlanc_delete ON public.realizado_lancamentos FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE TRIGGER trg_rlanc_upd BEFORE UPDATE ON public.realizado_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rlanc_audit AFTER INSERT OR UPDATE OR DELETE ON public.realizado_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =====================================================
-- CONCILIACAO REGRAS
-- =====================================================
CREATE TABLE public.conciliacao_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  prioridade int NOT NULL DEFAULT 100,
  pattern_descricao text,
  pattern_contraparte text,
  pattern_documento text,
  valor_min numeric(18,2),
  valor_max numeric(18,2),
  dre_linha_id uuid REFERENCES public.dre_linhas(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_creg_empresa ON public.conciliacao_regras(empresa_id, prioridade);
ALTER TABLE public.conciliacao_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY creg_select ON public.conciliacao_regras FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY creg_write ON public.conciliacao_regras FOR ALL TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  )
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE TRIGGER trg_creg_upd BEFORE UPDATE ON public.conciliacao_regras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_creg_audit AFTER INSERT OR UPDATE OR DELETE ON public.conciliacao_regras
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();