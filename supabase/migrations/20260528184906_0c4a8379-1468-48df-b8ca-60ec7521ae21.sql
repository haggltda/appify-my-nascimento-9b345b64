DO $pf1$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.app_menu WHERE codigo = 'folha' AND ativo = true) THEN RAISE EXCEPTION 'app_menu.folha ausente ou inativo. Migration abortada.'; END IF; END $pf1$;

DO $pf2$ BEGIN
  IF EXISTS (SELECT 1 FROM public.folha_evento fe JOIN public.folha_periodo fp ON fp.id = fe.folha_periodo_id WHERE fe.empresa_id IS DISTINCT FROM fp.empresa_id) THEN RAISE EXCEPTION 'folha_evento com empresa_id divergente de folha_periodo.'; END IF;
  IF EXISTS (SELECT 1 FROM public.folha_evento fe JOIN public.colaborador c ON c.id = fe.colaborador_id WHERE fe.colaborador_id IS NOT NULL AND fe.empresa_id IS DISTINCT FROM c.empresa_id) THEN RAISE EXCEPTION 'folha_evento com colaborador de empresa divergente.'; END IF;
  IF EXISTS (SELECT 1 FROM public.folha_evento fe JOIN public.centros_custo cc ON cc.id = fe.centro_custo_id WHERE fe.centro_custo_id IS NOT NULL AND fe.empresa_id IS DISTINCT FROM cc.empresa_id) THEN RAISE EXCEPTION 'folha_evento com centro_custo de empresa divergente.'; END IF;
END $pf2$;

CREATE OR REPLACE FUNCTION public.folha_periodo_lock_empresa() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn1$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'folha_periodo.empresa_id eh imutavel (id=%, de=% para=%)', OLD.id, OLD.empresa_id, NEW.empresa_id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn1$;

DROP TRIGGER IF EXISTS trg_folha_periodo_lock_empresa ON public.folha_periodo;
CREATE TRIGGER trg_folha_periodo_lock_empresa BEFORE UPDATE ON public.folha_periodo FOR EACH ROW EXECUTE FUNCTION public.folha_periodo_lock_empresa();

CREATE OR REPLACE FUNCTION public.folha_evento_validar_coerencia() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn2$
DECLARE v_emp_periodo uuid; v_emp_colab uuid; v_emp_cc uuid;
BEGIN
  SELECT empresa_id INTO v_emp_periodo FROM public.folha_periodo WHERE id = NEW.folha_periodo_id;
  IF v_emp_periodo IS NULL THEN RAISE EXCEPTION 'folha_periodo % inexistente', NEW.folha_periodo_id USING ERRCODE = 'foreign_key_violation'; END IF;
  IF NEW.empresa_id IS DISTINCT FROM v_emp_periodo THEN RAISE EXCEPTION 'folha_evento.empresa_id (%) difere de folha_periodo.empresa_id (%)', NEW.empresa_id, v_emp_periodo USING ERRCODE = 'check_violation'; END IF;
  IF NEW.colaborador_id IS NOT NULL THEN
    SELECT empresa_id INTO v_emp_colab FROM public.colaborador WHERE id = NEW.colaborador_id;
    IF v_emp_colab IS NULL THEN RAISE EXCEPTION 'colaborador % inexistente', NEW.colaborador_id USING ERRCODE = 'foreign_key_violation'; END IF;
    IF v_emp_colab IS DISTINCT FROM NEW.empresa_id THEN RAISE EXCEPTION 'colaborador % (empresa %) difere da empresa do evento (%)', NEW.colaborador_id, v_emp_colab, NEW.empresa_id USING ERRCODE = 'check_violation'; END IF;
  END IF;
  IF NEW.centro_custo_id IS NOT NULL THEN
    SELECT empresa_id INTO v_emp_cc FROM public.centros_custo WHERE id = NEW.centro_custo_id;
    IF v_emp_cc IS NULL THEN RAISE EXCEPTION 'centro_custo % inexistente', NEW.centro_custo_id USING ERRCODE = 'foreign_key_violation'; END IF;
    IF v_emp_cc IS DISTINCT FROM NEW.empresa_id THEN RAISE EXCEPTION 'centro_custo % (empresa %) difere da empresa do evento (%)', NEW.centro_custo_id, v_emp_cc, NEW.empresa_id USING ERRCODE = 'check_violation'; END IF;
  END IF;
  RETURN NEW;
END;
$fn2$;

DROP TRIGGER IF EXISTS trg_folha_evento_validar_coerencia ON public.folha_evento;
CREATE TRIGGER trg_folha_evento_validar_coerencia BEFORE INSERT OR UPDATE ON public.folha_evento FOR EACH ROW EXECUTE FUNCTION public.folha_evento_validar_coerencia();

DROP POLICY IF EXISTS folha_periodo_rw ON public.folha_periodo;
DROP POLICY IF EXISTS fp_select ON public.folha_periodo;
DROP POLICY IF EXISTS fp_insert ON public.folha_periodo;
DROP POLICY IF EXISTS fp_update ON public.folha_periodo;
DROP POLICY IF EXISTS fp_delete ON public.folha_periodo;

CREATE POLICY fp_select ON public.folha_periodo FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.user_pode_atuar_empresa(auth.uid(), empresa_id) AND public.can_access(auth.uid(), 'folha', 'visualizar'::app_acao, empresa_id, 'rh')));
CREATE POLICY fp_insert ON public.folha_periodo FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR (public.user_pode_atuar_empresa(auth.uid(), empresa_id) AND public.can_access(auth.uid(), 'folha', 'incluir'::app_acao, empresa_id, 'rh')));
CREATE POLICY fp_update ON public.folha_periodo FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.user_pode_atuar_empresa(auth.uid(), empresa_id) AND public.can_access(auth.uid(), 'folha', 'alterar'::app_acao, empresa_id, 'rh'))) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR (public.user_pode_atuar_empresa(auth.uid(), empresa_id) AND public.can_access(auth.uid(), 'folha', 'alterar'::app_acao, empresa_id, 'rh')));
CREATE POLICY fp_delete ON public.folha_periodo FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.user_pode_atuar_empresa(auth.uid(), empresa_id) AND public.can_access(auth.uid(), 'folha', 'excluir'::app_acao, empresa_id, 'rh')));

DROP POLICY IF EXISTS folha_evento_rw ON public.folha_evento;
DROP POLICY IF EXISTS fe_select ON public.folha_evento;
DROP POLICY IF EXISTS fe_insert ON public.folha_evento;
DROP POLICY IF EXISTS fe_update ON public.folha_evento;
DROP POLICY IF EXISTS fe_delete ON public.folha_evento;

CREATE POLICY fe_select ON public.folha_evento FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.user_pode_atuar_empresa(auth.uid(), empresa_id) AND public.can_access(auth.uid(), 'folha', 'visualizar'::app_acao, empresa_id, 'rh')));
CREATE POLICY fe_insert ON public.folha_evento FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR (public.user_pode_atuar_empresa(auth.uid(), empresa_id) AND public.can_access(auth.uid(), 'folha', 'incluir'::app_acao, empresa_id, 'rh')));
CREATE POLICY fe_update ON public.folha_evento FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.user_pode_atuar_empresa(auth.uid(), empresa_id) AND public.can_access(auth.uid(), 'folha', 'alterar'::app_acao, empresa_id, 'rh'))) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR (public.user_pode_atuar_empresa(auth.uid(), empresa_id) AND public.can_access(auth.uid(), 'folha', 'alterar'::app_acao, empresa_id, 'rh')));
CREATE POLICY fe_delete ON public.folha_evento FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.user_pode_atuar_empresa(auth.uid(), empresa_id) AND public.can_access(auth.uid(), 'folha', 'excluir'::app_acao, empresa_id, 'rh')));