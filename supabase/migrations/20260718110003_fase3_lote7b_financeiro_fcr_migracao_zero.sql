-- FASE 3 (lote 7b, parte 2 — Financeiro/Migração Zero — FCR) — ferramenta
-- interna de carga histórica (Excel → sistema), rota /app/admin/migracao-zero
-- (MigracaoZero.tsx → MigracaoFcr.tsx), sem gate de menu no front hoje —
-- mesmo padrão do resto do app (sidebar/rotas são cosméticas, RLS é o real).
-- Gate: menu 'administracao', mesmo usado nas outras ferramentas internas do
-- painel (lote 7a). fcr_raw_excel/fcr_sugestoes_pendencias/
-- fcr_reconciliacao_lote não têm INSERT para authenticated (só service_role,
-- conforme comentário original) — não criado agora.

-- ── fcr_batch ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS fcr_batch_select ON public.fcr_batch;
CREATE POLICY fcr_batch_select ON public.fcr_batch FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS fcr_batch_insert ON public.fcr_batch;
CREATE POLICY fcr_batch_insert ON public.fcr_batch FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid() AND public.can_access(auth.uid(), 'administracao', 'incluir'::app_acao));
DROP POLICY IF EXISTS fcr_batch_update ON public.fcr_batch;
CREATE POLICY fcr_batch_update ON public.fcr_batch FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));
DROP POLICY IF EXISTS fcr_batch_delete ON public.fcr_batch;
CREATE POLICY fcr_batch_delete ON public.fcr_batch FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'excluir'::app_acao));

-- ── fcr_raw_excel (só SELECT) ────────────────────────────────────────────
DROP POLICY IF EXISTS fcr_raw_select ON public.fcr_raw_excel;
CREATE POLICY fcr_raw_select ON public.fcr_raw_excel FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'visualizar'::app_acao));

-- ── fcr_sugestoes_pendencias (SELECT/UPDATE/DELETE) ─────────────────────
DROP POLICY IF EXISTS fcr_pend_select ON public.fcr_sugestoes_pendencias;
CREATE POLICY fcr_pend_select ON public.fcr_sugestoes_pendencias FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS fcr_pend_update ON public.fcr_sugestoes_pendencias;
CREATE POLICY fcr_pend_update ON public.fcr_sugestoes_pendencias FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));
DROP POLICY IF EXISTS fcr_pend_delete ON public.fcr_sugestoes_pendencias;
CREATE POLICY fcr_pend_delete ON public.fcr_sugestoes_pendencias FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'excluir'::app_acao));

-- ── fcr_reconciliacao_lote (só SELECT) ───────────────────────────────────
DROP POLICY IF EXISTS fcr_recon_select ON public.fcr_reconciliacao_lote;
CREATE POLICY fcr_recon_select ON public.fcr_reconciliacao_lote FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'visualizar'::app_acao));

-- ── mz_29/mz_31/mz_50 (staging da própria Migração Zero — has_role(admin)
--    puro, sem dimensão de empresa; achado à parte, mesmo padrão) ─────────
DROP POLICY IF EXISTS "mz_29_admin" ON public.mz_29_stg_titulos_migracao;
CREATE POLICY mz_29_admin ON public.mz_29_stg_titulos_migracao FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));

DROP POLICY IF EXISTS "mz_31_admin" ON public.mz_31_fato_partidas_dobradas;
CREATE POLICY mz_31_admin ON public.mz_31_fato_partidas_dobradas FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));

DROP POLICY IF EXISTS "mz_50_admin" ON public.mz_50_fato_orcamento_contratos_competencia;
CREATE POLICY mz_50_admin ON public.mz_50_fato_orcamento_contratos_competencia FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));

-- ── RPCs de promoção mz_29/mz_31/mz_50 → tabelas reais ───────────────────
CREATE OR REPLACE FUNCTION public.tp_promover_titulo_pagar(_mz_id bigint, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _empresa uuid; _already uuid; _new_id uuid;
BEGIN
  SELECT empresa_id_resolvida, destino_id INTO _empresa, _already
    FROM mz_29_stg_titulos_migracao WHERE mz_id = _mz_id;
  IF _empresa IS NULL THEN RAISE EXCEPTION 'mz_29 #% não encontrado ou sem empresa resolvida', _mz_id; END IF;
  IF NOT public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _already IS NOT NULL THEN RAISE EXCEPTION 'mz_29 #% já promovido (destino %)', _mz_id, _already; END IF;

  INSERT INTO titulo_pagar
  SELECT * FROM jsonb_populate_record(null::titulo_pagar, _payload || jsonb_build_object('empresa_id', _empresa))
  RETURNING id INTO _new_id;

  UPDATE mz_29_stg_titulos_migracao
    SET promovido_em=now(), promovido_por=auth.uid(), destino_id=_new_id, destino_tabela='titulo_pagar'
    WHERE mz_id=_mz_id;
  RETURN _new_id;
END$$;

CREATE OR REPLACE FUNCTION public.tr_promover_titulo_receber(_mz_id bigint, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _empresa uuid; _already uuid; _new_id uuid;
BEGIN
  SELECT empresa_id_resolvida, destino_id INTO _empresa, _already
    FROM mz_29_stg_titulos_migracao WHERE mz_id = _mz_id;
  IF _empresa IS NULL THEN RAISE EXCEPTION 'mz_29 #% não encontrado ou sem empresa resolvida', _mz_id; END IF;
  IF NOT public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _already IS NOT NULL THEN RAISE EXCEPTION 'mz_29 #% já promovido (destino %)', _mz_id, _already; END IF;

  INSERT INTO titulo_receber
  SELECT * FROM jsonb_populate_record(null::titulo_receber, _payload || jsonb_build_object('empresa_id', _empresa))
  RETURNING id INTO _new_id;

  UPDATE mz_29_stg_titulos_migracao
    SET promovido_em=now(), promovido_por=auth.uid(), destino_id=_new_id, destino_tabela='titulo_receber'
    WHERE mz_id=_mz_id;
  RETURN _new_id;
END$$;

CREATE OR REPLACE FUNCTION public.oc_promover_orcamento_linha(_mz_id bigint, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _empresa uuid; _already uuid; _new_id uuid;
BEGIN
  SELECT empresa_id_resolvida, destino_id INTO _empresa, _already
    FROM mz_50_fato_orcamento_contratos_competencia WHERE mz_id = _mz_id;
  IF _empresa IS NULL THEN RAISE EXCEPTION 'mz_50 #% não encontrado ou sem empresa resolvida', _mz_id; END IF;
  IF NOT public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _already IS NOT NULL THEN RAISE EXCEPTION 'mz_50 #% já promovido (destino %)', _mz_id, _already; END IF;

  INSERT INTO orcamento_contrato_linha
  SELECT * FROM jsonb_populate_record(null::orcamento_contrato_linha, _payload || jsonb_build_object('empresa_id', _empresa))
  RETURNING id INTO _new_id;

  UPDATE mz_50_fato_orcamento_contratos_competencia
    SET promovido_em=now(), promovido_por=auth.uid(), destino_id=_new_id
    WHERE mz_id=_mz_id;
  RETURN _new_id;
END$$;

CREATE OR REPLACE FUNCTION public.lc_promover_partida_contabil(_mz_id bigint, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _empresa_mz uuid; _empresa_lc uuid; _lanc_id uuid; _already uuid; _new_id uuid;
BEGIN
  SELECT empresa_id_resolvida, destino_id INTO _empresa_mz, _already
    FROM mz_31_fato_partidas_dobradas WHERE mz_id = _mz_id;
  IF _empresa_mz IS NULL THEN RAISE EXCEPTION 'mz_31 #% não encontrado ou sem empresa resolvida', _mz_id; END IF;
  IF NOT public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _already IS NOT NULL THEN RAISE EXCEPTION 'mz_31 #% já promovido (destino %)', _mz_id, _already; END IF;

  _lanc_id := (_payload->>'lancamento_id')::uuid;
  IF _lanc_id IS NULL THEN RAISE EXCEPTION 'payload precisa de lancamento_id'; END IF;
  SELECT empresa_id INTO _empresa_lc FROM lancamento_contabil WHERE id = _lanc_id;
  IF _empresa_lc IS NULL THEN RAISE EXCEPTION 'lancamento_contabil % não encontrado', _lanc_id; END IF;
  IF _empresa_lc <> _empresa_mz THEN RAISE EXCEPTION 'Empresa do lançamento (%) não bate com staging (%)', _empresa_lc, _empresa_mz; END IF;

  INSERT INTO lancamento_partida
  SELECT * FROM jsonb_populate_record(null::lancamento_partida, _payload)
  RETURNING id INTO _new_id;

  UPDATE mz_31_fato_partidas_dobradas
    SET promovido_em=now(), promovido_por=auth.uid(), destino_id=_new_id
    WHERE mz_id=_mz_id;
  RETURN _new_id;
END$$;

NOTIFY pgrst, 'reload schema';
