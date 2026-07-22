-- FASE 3 (lote 7b, parte 1 — Financeiro/Builder de Layouts Bancários) —
-- `banco_layout` já tinha sido corrigido no lote 2 (menu
-- 'integracao-bancaria'), mas banco_layout_versao/template/teste e as 4 RPCs
-- do builder ficaram de fora (mesmo arquivo de origem, 20260430012239,
-- nunca redefinido depois — confirmado via grep, sem risco de policy órfã).

-- ── banco_layout_versao ──────────────────────────────────────────────────
DROP POLICY IF EXISTS blv_select ON public.banco_layout_versao;
CREATE POLICY blv_select ON public.banco_layout_versao FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS blv_modify ON public.banco_layout_versao;
CREATE POLICY blv_modify ON public.banco_layout_versao FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao));

-- ── banco_layout_template (SELECT: templates globais continuam visíveis a
--    todo autenticado; das próprias empresas passa a exigir can_access) ───
DROP POLICY IF EXISTS blt_select ON public.banco_layout_template;
CREATE POLICY blt_select ON public.banco_layout_template FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR public.can_access(auth.uid(), 'integracao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS blt_modify ON public.banco_layout_template;
CREATE POLICY blt_modify ON public.banco_layout_template FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao));

-- ── banco_layout_teste ────────────────────────────────────────────────────
DROP POLICY IF EXISTS blteste_select ON public.banco_layout_teste;
CREATE POLICY blteste_select ON public.banco_layout_teste FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS blteste_modify ON public.banco_layout_teste;
CREATE POLICY blteste_modify ON public.banco_layout_teste FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao));

-- ── RPC layout_submeter_aprovacao ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.layout_submeter_aprovacao(_versao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v RECORD;
BEGIN
  SELECT * INTO v FROM banco_layout_versao WHERE id = _versao_id;
  IF v IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;
  IF NOT public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF v.status NOT IN ('rascunho','rejeitada') THEN
    RAISE EXCEPTION 'Versão não pode ser submetida (status: %)', v.status;
  END IF;
  UPDATE banco_layout_versao
     SET status='pendente_aprovacao', submetido_por=auth.uid(), submetido_em=now()
   WHERE id=_versao_id;
  RETURN jsonb_build_object('versao_id',_versao_id,'status','pendente_aprovacao');
END $$;

-- ── RPC layout_aprovar_versao ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.layout_aprovar_versao(_versao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v RECORD; v_anterior uuid;
BEGIN
  SELECT * INTO v FROM banco_layout_versao WHERE id = _versao_id;
  IF v IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;
  IF NOT public.can_access(auth.uid(), 'integracao-bancaria', 'aprovar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar';
  END IF;
  IF v.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'Versão não está pendente (status: %)', v.status;
  END IF;
  IF v.criado_por = auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido aprovar a própria versão';
  END IF;

  -- Arquiva a anterior
  SELECT versao_ativa_id INTO v_anterior FROM banco_layout WHERE id = v.layout_id;
  IF v_anterior IS NOT NULL AND v_anterior <> _versao_id THEN
    UPDATE banco_layout_versao SET status='arquivada' WHERE id = v_anterior;
  END IF;

  UPDATE banco_layout_versao
     SET status='aprovada', aprovado_por=auth.uid(), aprovado_em=now()
   WHERE id=_versao_id;

  UPDATE banco_layout SET versao_ativa_id=_versao_id WHERE id=v.layout_id;

  RETURN jsonb_build_object('versao_id',_versao_id,'layout_id',v.layout_id,'status','aprovada');
END $$;

-- ── RPC layout_rejeitar_versao ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.layout_rejeitar_versao(_versao_id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v RECORD;
BEGIN
  SELECT * INTO v FROM banco_layout_versao WHERE id = _versao_id;
  IF v IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;
  IF NOT public.can_access(auth.uid(), 'integracao-bancaria', 'aprovar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar';
  END IF;
  IF v.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'Versão não está pendente';
  END IF;
  IF _motivo IS NULL OR length(_motivo) < 5 THEN
    RAISE EXCEPTION 'Informe motivo da rejeição (mín 5 caracteres)';
  END IF;
  UPDATE banco_layout_versao
     SET status='rejeitada', rejeitado_por=auth.uid(), rejeitado_em=now(), motivo_rejeicao=_motivo
   WHERE id=_versao_id;
  RETURN jsonb_build_object('versao_id',_versao_id,'status','rejeitada');
END $$;

-- ── RPC layout_nova_versao ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.layout_nova_versao(_layout_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_layout RECORD;
  v_ultima RECORD;
  v_nova_id uuid;
  v_proximo int;
BEGIN
  SELECT * INTO v_layout FROM banco_layout WHERE id = _layout_id;
  IF v_layout IS NULL THEN RAISE EXCEPTION 'Layout não encontrado'; END IF;
  IF NOT public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT COALESCE(MAX(numero_versao),0)+1 INTO v_proximo
    FROM banco_layout_versao WHERE layout_id = _layout_id;

  SELECT * INTO v_ultima FROM banco_layout_versao
   WHERE layout_id = _layout_id ORDER BY numero_versao DESC LIMIT 1;

  INSERT INTO banco_layout_versao (empresa_id, layout_id, numero_versao, status, estrutura, criado_por)
  VALUES (v_layout.empresa_id, _layout_id, v_proximo, 'rascunho',
          COALESCE(v_ultima.estrutura, '{}'::jsonb), auth.uid())
  RETURNING id INTO v_nova_id;

  RETURN jsonb_build_object('versao_id', v_nova_id, 'numero_versao', v_proximo);
END $$;

NOTIFY pgrst, 'reload schema';
