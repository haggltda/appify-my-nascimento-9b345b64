-- =====================================================
-- MIGRATION #3 — OBZ VERSIONADO
-- =====================================================

CREATE TYPE public.obz_status AS ENUM ('rascunho','em_aprovacao','aprovada','arquivada');
CREATE TYPE public.periodo_status AS ENUM ('aberto','fechado');

-- =====================================================
-- OBZ VERSOES
-- =====================================================
CREATE TABLE public.obz_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ano int NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
  versao int NOT NULL CHECK (versao >= 1),
  revisao int NOT NULL DEFAULT 0 CHECK (revisao >= 0),
  nome text NOT NULL,
  descricao text,
  status obz_status NOT NULL DEFAULT 'rascunho',
  criado_por uuid,
  aprovado_por uuid,
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, ano, versao, revisao)
);
CREATE INDEX idx_obzv_empresa_ano ON public.obz_versoes(empresa_id, ano);
-- Apenas 1 aprovada por empresa+ano
CREATE UNIQUE INDEX uq_obzv_aprovada_unica
  ON public.obz_versoes(empresa_id, ano)
  WHERE status = 'aprovada';

ALTER TABLE public.obz_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY obzv_select ON public.obz_versoes FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY obzv_insert ON public.obz_versoes FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
    AND status IN ('rascunho','em_aprovacao')
  );

CREATE POLICY obzv_update ON public.obz_versoes FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE POLICY obzv_delete ON public.obz_versoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND status IN ('rascunho','arquivada'));

-- Trigger: somente admin pode mudar para 'aprovada' ou 'arquivada'
CREATE OR REPLACE FUNCTION public.obz_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('aprovada','arquivada')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Apenas admin pode aprovar ou arquivar versões OBZ';
  END IF;
  IF NEW.status = 'aprovada' AND OLD.status IS DISTINCT FROM 'aprovada' THEN
    NEW.aprovado_por := auth.uid();
    NEW.aprovado_em := now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_obzv_status BEFORE UPDATE ON public.obz_versoes
  FOR EACH ROW EXECUTE FUNCTION public.obz_status_guard();
CREATE TRIGGER trg_obzv_upd BEFORE UPDATE ON public.obz_versoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_obzv_audit AFTER INSERT OR UPDATE OR DELETE ON public.obz_versoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =====================================================
-- OBZ PERIODOS
-- =====================================================
CREATE TABLE public.obz_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id uuid NOT NULL REFERENCES public.obz_versoes(id) ON DELETE CASCADE,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  status periodo_status NOT NULL DEFAULT 'aberto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (versao_id, mes)
);
CREATE INDEX idx_obzp_versao ON public.obz_periodos(versao_id);
ALTER TABLE public.obz_periodos ENABLE ROW LEVEL SECURITY;

CREATE POLICY obzp_select ON public.obz_periodos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obz_versoes v WHERE v.id = versao_id
      AND (v.empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'))
  ));

CREATE POLICY obzp_write ON public.obz_periodos FOR ALL TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND EXISTS (
      SELECT 1 FROM public.obz_versoes v WHERE v.id = versao_id
        AND (public.has_role(auth.uid(),'admin') OR v.empresa_id = public.get_user_empresa(auth.uid()))
    )
  )
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND EXISTS (
      SELECT 1 FROM public.obz_versoes v WHERE v.id = versao_id
        AND (public.has_role(auth.uid(),'admin') OR v.empresa_id = public.get_user_empresa(auth.uid()))
    )
  );

CREATE TRIGGER trg_obzp_upd BEFORE UPDATE ON public.obz_periodos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_obzp_audit AFTER INSERT OR UPDATE OR DELETE ON public.obz_periodos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Trigger: ao criar versão, gerar 12 períodos
CREATE OR REPLACE FUNCTION public.obz_seed_periodos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.obz_periodos (versao_id, mes)
  SELECT NEW.id, generate_series(1,12);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_obzv_seed AFTER INSERT ON public.obz_versoes
  FOR EACH ROW EXECUTE FUNCTION public.obz_seed_periodos();

-- =====================================================
-- OBZ VALORES
-- =====================================================
CREATE TABLE public.obz_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id uuid NOT NULL REFERENCES public.obz_versoes(id) ON DELETE CASCADE,
  periodo_id uuid NOT NULL REFERENCES public.obz_periodos(id) ON DELETE CASCADE,
  dre_linha_id uuid NOT NULL REFERENCES public.dre_linhas(id) ON DELETE RESTRICT,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE RESTRICT,
  valor numeric(18,2) NOT NULL DEFAULT 0,
  memoria_calculo text,
  classificadores jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periodo_id, dre_linha_id, centro_custo_id)
);
CREATE INDEX idx_obzval_versao ON public.obz_valores(versao_id);
CREATE INDEX idx_obzval_periodo ON public.obz_valores(periodo_id);
CREATE INDEX idx_obzval_dre ON public.obz_valores(dre_linha_id);
CREATE INDEX idx_obzval_cc ON public.obz_valores(centro_custo_id);

ALTER TABLE public.obz_valores ENABLE ROW LEVEL SECURITY;

CREATE POLICY obzval_select ON public.obz_valores FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obz_versoes v WHERE v.id = versao_id
      AND (v.empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'))
  ));

CREATE POLICY obzval_write ON public.obz_valores FOR ALL TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND EXISTS (
      SELECT 1 FROM public.obz_versoes v WHERE v.id = versao_id
        AND v.status IN ('rascunho','em_aprovacao')
        AND (public.has_role(auth.uid(),'admin') OR v.empresa_id = public.get_user_empresa(auth.uid()))
    )
  )
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND EXISTS (
      SELECT 1 FROM public.obz_versoes v WHERE v.id = versao_id
        AND v.status IN ('rascunho','em_aprovacao')
        AND (public.has_role(auth.uid(),'admin') OR v.empresa_id = public.get_user_empresa(auth.uid()))
    )
  );

CREATE TRIGGER trg_obzval_upd BEFORE UPDATE ON public.obz_valores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_obzval_audit AFTER INSERT OR UPDATE OR DELETE ON public.obz_valores
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();