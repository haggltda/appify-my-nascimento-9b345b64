
BEGIN;

-- 1) Colunas em public.licitacao
ALTER TABLE public.licitacao
  ADD COLUMN responsavel_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN assumido_em         timestamptz,
  ADD COLUMN assumido_por        uuid REFERENCES auth.users(id);

CREATE INDEX idx_licitacao_responsavel
  ON public.licitacao (responsavel_user_id)
  WHERE responsavel_user_id IS NOT NULL;

-- 2) Tabela histórico
CREATE TABLE public.licitacao_responsavel_historico (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL,
  licitacao_id   uuid NOT NULL REFERENCES public.licitacao(id) ON DELETE CASCADE,
  de_user_id     uuid REFERENCES auth.users(id),
  para_user_id   uuid NOT NULL REFERENCES auth.users(id),
  ator_id        uuid NOT NULL REFERENCES auth.users(id),
  acao           text NOT NULL CHECK (acao IN ('assumir','transferir')),
  justificativa  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lic_resp_hist_licitacao
  ON public.licitacao_responsavel_historico (licitacao_id, created_at DESC);
CREATE INDEX idx_lic_resp_hist_empresa
  ON public.licitacao_responsavel_historico (empresa_id);

-- 3) Grants do histórico
REVOKE ALL ON public.licitacao_responsavel_historico FROM PUBLIC;
REVOKE ALL ON public.licitacao_responsavel_historico FROM anon;
REVOKE ALL ON public.licitacao_responsavel_historico FROM authenticated;
GRANT SELECT ON public.licitacao_responsavel_historico TO authenticated;
GRANT ALL    ON public.licitacao_responsavel_historico TO service_role;

-- 4) RLS + policy SELECT
ALTER TABLE public.licitacao_responsavel_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY lic_resp_hist_select
  ON public.licitacao_responsavel_historico
  FOR SELECT TO authenticated
  USING (public.user_pode_atuar_empresa(auth.uid(), empresa_id));

-- 5) Guard de UPDATE direto em public.licitacao
CREATE OR REPLACE FUNCTION public.licitacao_responsavel_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id)
     OR (NEW.assumido_em       IS DISTINCT FROM OLD.assumido_em)
     OR (NEW.assumido_por      IS DISTINCT FROM OLD.assumido_por)
  THEN
    IF current_setting('app.licitacao_responsavel_rpc', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Alteracao de responsavel deve ser feita via RPC licitacao_assumir/licitacao_transferir';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.licitacao_responsavel_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.licitacao_responsavel_guard() TO service_role;

CREATE TRIGGER licitacao_responsavel_guard_trigger
  BEFORE UPDATE ON public.licitacao
  FOR EACH ROW EXECUTE FUNCTION public.licitacao_responsavel_guard();

-- 6) Guard de consistência empresa_id no histórico
CREATE OR REPLACE FUNCTION public.lic_resp_hist_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_emp uuid;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.licitacao WHERE id = NEW.licitacao_id;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'Licitacao % nao encontrada', NEW.licitacao_id;
  END IF;
  IF NEW.empresa_id IS DISTINCT FROM v_emp THEN
    RAISE EXCEPTION 'empresa_id do historico (%) difere da licitacao (%)', NEW.empresa_id, v_emp;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lic_resp_hist_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lic_resp_hist_guard() TO service_role;

CREATE TRIGGER lic_resp_hist_guard_trigger
  BEFORE INSERT OR UPDATE ON public.licitacao_responsavel_historico
  FOR EACH ROW EXECUTE FUNCTION public.lic_resp_hist_guard();

-- 7) RPC: assumir (FOR UPDATE)
CREATE OR REPLACE FUNCTION public.licitacao_assumir(p_licitacao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_emp  uuid;
  v_resp uuid;
  v_hist uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth.uid() nulo'; END IF;

  SELECT empresa_id, responsavel_user_id
    INTO v_emp, v_resp
    FROM public.licitacao
   WHERE id = p_licitacao_id
   FOR UPDATE;

  IF v_emp IS NULL THEN RAISE EXCEPTION 'Licitacao nao encontrada'; END IF;

  IF NOT public.user_pode_atuar_empresa(v_uid, v_emp) THEN
    RAISE EXCEPTION 'Usuario nao pode atuar na empresa da licitacao';
  END IF;

  IF NOT (
       public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_permissao(v_uid, 'licitacoes','alterar','composicao')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para assumir licitacao';
  END IF;

  IF v_resp IS NOT NULL THEN
    RAISE EXCEPTION 'Licitacao ja possui responsavel; use transferencia';
  END IF;

  PERFORM set_config('app.licitacao_responsavel_rpc','on', true);

  UPDATE public.licitacao
     SET responsavel_user_id = v_uid,
         assumido_em         = now(),
         assumido_por        = v_uid,
         updated_at          = now()
   WHERE id = p_licitacao_id;

  INSERT INTO public.licitacao_responsavel_historico
    (empresa_id, licitacao_id, de_user_id, para_user_id, ator_id, acao, justificativa)
    VALUES (v_emp, p_licitacao_id, NULL, v_uid, v_uid, 'assumir', NULL)
    RETURNING id INTO v_hist;

  RETURN v_hist;
END;
$$;

-- 8) RPC: transferir (FOR UPDATE; bloqueia v_resp NULL e mesmo responsável)
CREATE OR REPLACE FUNCTION public.licitacao_transferir(
  p_licitacao_id uuid,
  p_novo_user    uuid,
  p_justificativa text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_emp  uuid;
  v_resp uuid;
  v_hist uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth.uid() nulo'; END IF;
  IF p_novo_user IS NULL THEN RAISE EXCEPTION 'Novo responsavel obrigatorio'; END IF;
  IF p_justificativa IS NULL OR length(btrim(p_justificativa)) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatoria (min 5 caracteres)';
  END IF;

  SELECT empresa_id, responsavel_user_id
    INTO v_emp, v_resp
    FROM public.licitacao
   WHERE id = p_licitacao_id
   FOR UPDATE;

  IF v_emp IS NULL THEN RAISE EXCEPTION 'Licitacao nao encontrada'; END IF;

  IF v_resp IS NULL THEN
    RAISE EXCEPTION 'Licitacao ainda nao possui responsavel; use licitacao_assumir';
  END IF;

  IF p_novo_user = v_resp THEN
    RAISE EXCEPTION 'Novo responsável deve ser diferente do responsável atual';
  END IF;

  IF NOT public.user_pode_atuar_empresa(v_uid, v_emp) THEN
    RAISE EXCEPTION 'Usuario nao pode atuar na empresa';
  END IF;

  IF NOT (
       public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_permissao(v_uid, 'licitacoes','alterar','composicao')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para transferir';
  END IF;

  IF NOT public.user_pode_atuar_empresa(p_novo_user, v_emp) THEN
    RAISE EXCEPTION 'Novo responsavel nao pode atuar na empresa';
  END IF;

  PERFORM set_config('app.licitacao_responsavel_rpc','on', true);

  UPDATE public.licitacao
     SET responsavel_user_id = p_novo_user,
         assumido_em         = now(),
         assumido_por        = v_uid,
         updated_at          = now()
   WHERE id = p_licitacao_id;

  INSERT INTO public.licitacao_responsavel_historico
    (empresa_id, licitacao_id, de_user_id, para_user_id, ator_id, acao, justificativa)
    VALUES (v_emp, p_licitacao_id, v_resp, p_novo_user, v_uid, 'transferir', p_justificativa)
    RETURNING id INTO v_hist;

  RETURN v_hist;
END;
$$;

-- 9) EXECUTE das RPCs
REVOKE ALL ON FUNCTION public.licitacao_assumir(uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.licitacao_transferir(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.licitacao_assumir(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.licitacao_transferir(uuid,uuid,text) TO authenticated;

COMMIT;
