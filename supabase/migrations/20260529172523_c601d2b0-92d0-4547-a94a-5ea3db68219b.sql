-- M2A — Triggers de updated_at, anti-swap, anti-escalada e auditoria BDI
-- Reusa: public.update_updated_at_column(), public.audit_trigger(), public.audit_log
-- NÃO altera M1B/M1B-fix-grants

-- 3.1 updated_at nas 4 tabelas editáveis
CREATE TRIGGER update_bdi_versao_updated_at      BEFORE UPDATE ON public.bdi_versao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bdi_posto_updated_at       BEFORE UPDATE ON public.bdi_posto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bdi_verba_folha_updated_at BEFORE UPDATE ON public.bdi_verba_folha
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bdi_item_updated_at        BEFORE UPDATE ON public.bdi_item
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3.2 BEFORE INSERT em bdi_versao
CREATE OR REPLACE FUNCTION public.bdi_versao_defaults_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'bdi_versao: created_by não pode ser nulo (sem auth.uid)'
      USING ERRCODE = 'not_null_violation';
  END IF;
  IF NEW.status IS DISTINCT FROM 'rascunho'::public.bdi_status THEN
    RAISE EXCEPTION 'bdi_versao: novo registro deve nascer em rascunho (recebido %)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'bdi_versao: approved_by/approved_at não podem ser setados na criação'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER bdi_versao_defaults BEFORE INSERT ON public.bdi_versao
  FOR EACH ROW EXECUTE FUNCTION public.bdi_versao_defaults_trigger();

-- 3.3 BEFORE UPDATE em bdi_versao
CREATE OR REPLACE FUNCTION public.bdi_versao_guard_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'bdi_versao: empresa_id é imutável' USING ERRCODE='check_violation';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'bdi_versao: created_by é imutável' USING ERRCODE='check_violation';
  END IF;
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'bdi_versao: approved_by só pode ser alterado por RPC de aprovação (M3)'
      USING ERRCODE='check_violation';
  END IF;
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'bdi_versao: approved_at só pode ser alterado por RPC de aprovação (M3)'
      USING ERRCODE='check_violation';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'rascunho'   AND NEW.status IN ('em_revisao','cancelado')) OR
      (OLD.status = 'em_revisao' AND NEW.status IN ('rascunho','cancelado'))
    ) THEN
      RAISE EXCEPTION 'bdi_versao: transição % -> % não permitida em M2A (somente RPC M3)',
        OLD.status, NEW.status USING ERRCODE='check_violation';
    END IF;
  END IF;

  IF OLD.status NOT IN ('rascunho','em_revisao') THEN
    IF (NEW.licitacao_id    IS DISTINCT FROM OLD.licitacao_id)
    OR (NEW.contrato_id     IS DISTINCT FROM OLD.contrato_id)
    OR (NEW.centro_custo_id IS DISTINCT FROM OLD.centro_custo_id)
    OR (NEW.base_versao_id  IS DISTINCT FROM OLD.base_versao_id) THEN
      RAISE EXCEPTION 'bdi_versao: vínculos imutáveis no status %', OLD.status
        USING ERRCODE='check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER bdi_versao_guard BEFORE UPDATE ON public.bdi_versao
  FOR EACH ROW EXECUTE FUNCTION public.bdi_versao_guard_trigger();

-- 3.4 Anti-swap em bdi_posto / bdi_verba_folha / bdi_item
CREATE OR REPLACE FUNCTION public.bdi_filhos_guard_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status public.bdi_status;
  v_empresa uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.empresa_id    IS DISTINCT FROM OLD.empresa_id    THEN
      RAISE EXCEPTION '%: empresa_id é imutável', TG_TABLE_NAME USING ERRCODE='check_violation';
    END IF;
    IF NEW.bdi_versao_id IS DISTINCT FROM OLD.bdi_versao_id THEN
      RAISE EXCEPTION '%: bdi_versao_id é imutável', TG_TABLE_NAME USING ERRCODE='check_violation';
    END IF;
  END IF;

  SELECT v.status, v.empresa_id INTO v_status, v_empresa
  FROM public.bdi_versao v WHERE v.id = NEW.bdi_versao_id;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION '%: bdi_versao_id inexistente', TG_TABLE_NAME USING ERRCODE='foreign_key_violation';
  END IF;
  IF NEW.empresa_id IS DISTINCT FROM v_empresa THEN
    RAISE EXCEPTION '%: empresa_id divergente da versão pai', TG_TABLE_NAME USING ERRCODE='check_violation';
  END IF;
  IF v_status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION '%: versão em status % não permite escrita', TG_TABLE_NAME, v_status
      USING ERRCODE='check_violation';
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER bdi_posto_guard       BEFORE INSERT OR UPDATE ON public.bdi_posto
  FOR EACH ROW EXECUTE FUNCTION public.bdi_filhos_guard_trigger();
CREATE TRIGGER bdi_verba_folha_guard BEFORE INSERT OR UPDATE ON public.bdi_verba_folha
  FOR EACH ROW EXECUTE FUNCTION public.bdi_filhos_guard_trigger();
CREATE TRIGGER bdi_item_guard        BEFORE INSERT OR UPDATE ON public.bdi_item
  FOR EACH ROW EXECUTE FUNCTION public.bdi_filhos_guard_trigger();

-- 3.5 Imutabilidade UPDATE/DELETE em bdi_aprovacao / bdi_snapshot
CREATE OR REPLACE FUNCTION public.bdi_imutavel_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '%: registros são imutáveis (UPDATE/DELETE proibidos)', TG_TABLE_NAME
    USING ERRCODE='check_violation';
END;
$$;
CREATE TRIGGER bdi_aprovacao_imutavel BEFORE UPDATE OR DELETE ON public.bdi_aprovacao
  FOR EACH ROW EXECUTE FUNCTION public.bdi_imutavel_trigger();
CREATE TRIGGER bdi_snapshot_imutavel  BEFORE UPDATE OR DELETE ON public.bdi_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.bdi_imutavel_trigger();

-- 3.6 Auditoria — reusa audit_trigger() + audit_log
CREATE TRIGGER bdi_versao_audit       AFTER INSERT OR UPDATE OR DELETE ON public.bdi_versao
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER bdi_posto_audit        AFTER INSERT OR UPDATE OR DELETE ON public.bdi_posto
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER bdi_verba_folha_audit  AFTER INSERT OR UPDATE OR DELETE ON public.bdi_verba_folha
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER bdi_item_audit         AFTER INSERT OR UPDATE OR DELETE ON public.bdi_item
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER bdi_aprovacao_audit    AFTER INSERT ON public.bdi_aprovacao
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER bdi_snapshot_audit     AFTER INSERT ON public.bdi_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();