-- Corrige a última policy atípica
DROP POLICY IF EXISTS fcr_raw_select ON public.fcr_raw_excel;
CREATE POLICY fcr_raw_select ON public.fcr_raw_excel
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'presidencia'::app_role)
    OR has_role(auth.uid(), 'diretor_adm'::app_role)
    OR (
      (has_role(auth.uid(), 'controladoria'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
      AND user_pode_atuar_empresa(auth.uid(), empresa_id_resolvida)
    )
  );

-- Colunas de rastreio
ALTER TABLE public.mz_29_stg_titulos_migracao
  ADD COLUMN IF NOT EXISTS promovido_em timestamptz,
  ADD COLUMN IF NOT EXISTS promovido_por uuid,
  ADD COLUMN IF NOT EXISTS destino_id uuid,
  ADD COLUMN IF NOT EXISTS destino_tabela text;

ALTER TABLE public.mz_31_fato_partidas_dobradas
  ADD COLUMN IF NOT EXISTS promovido_em timestamptz,
  ADD COLUMN IF NOT EXISTS promovido_por uuid,
  ADD COLUMN IF NOT EXISTS destino_id uuid;

ALTER TABLE public.mz_50_fato_orcamento_contratos_competencia
  ADD COLUMN IF NOT EXISTS promovido_em timestamptz,
  ADD COLUMN IF NOT EXISTS promovido_por uuid,
  ADD COLUMN IF NOT EXISTS destino_id uuid;

CREATE INDEX IF NOT EXISTS idx_mz_29_promovido_em ON public.mz_29_stg_titulos_migracao(promovido_em);
CREATE INDEX IF NOT EXISTS idx_mz_31_promovido_em ON public.mz_31_fato_partidas_dobradas(promovido_em);
CREATE INDEX IF NOT EXISTS idx_mz_50_promovido_em ON public.mz_50_fato_orcamento_contratos_competencia(promovido_em);

-- A3: mz_29 → titulo_pagar
CREATE OR REPLACE FUNCTION public.tp_promover_titulo_pagar(_mz_id bigint, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _empresa uuid; _already uuid; _new_id uuid;
BEGIN
  SELECT empresa_id_resolvida, destino_id INTO _empresa, _already
    FROM mz_29_stg_titulos_migracao WHERE mz_id = _mz_id;
  IF _empresa IS NULL THEN RAISE EXCEPTION 'mz_29 #% não encontrado ou sem empresa resolvida', _mz_id; END IF;
  IF NOT user_pode_atuar_empresa(auth.uid(), _empresa) THEN RAISE EXCEPTION 'Sem permissão para empresa %', _empresa; END IF;
  IF _already IS NOT NULL THEN RAISE EXCEPTION 'mz_29 #% já promovido (destino %)', _mz_id, _already; END IF;

  INSERT INTO titulo_pagar
  SELECT * FROM jsonb_populate_record(null::titulo_pagar, _payload || jsonb_build_object('empresa_id', _empresa))
  RETURNING id INTO _new_id;

  UPDATE mz_29_stg_titulos_migracao
    SET promovido_em=now(), promovido_por=auth.uid(), destino_id=_new_id, destino_tabela='titulo_pagar'
    WHERE mz_id=_mz_id;
  RETURN _new_id;
END$$;

-- A4: mz_29 → titulo_receber
CREATE OR REPLACE FUNCTION public.tr_promover_titulo_receber(_mz_id bigint, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _empresa uuid; _already uuid; _new_id uuid;
BEGIN
  SELECT empresa_id_resolvida, destino_id INTO _empresa, _already
    FROM mz_29_stg_titulos_migracao WHERE mz_id = _mz_id;
  IF _empresa IS NULL THEN RAISE EXCEPTION 'mz_29 #% não encontrado ou sem empresa resolvida', _mz_id; END IF;
  IF NOT user_pode_atuar_empresa(auth.uid(), _empresa) THEN RAISE EXCEPTION 'Sem permissão para empresa %', _empresa; END IF;
  IF _already IS NOT NULL THEN RAISE EXCEPTION 'mz_29 #% já promovido (destino %)', _mz_id, _already; END IF;

  INSERT INTO titulo_receber
  SELECT * FROM jsonb_populate_record(null::titulo_receber, _payload || jsonb_build_object('empresa_id', _empresa))
  RETURNING id INTO _new_id;

  UPDATE mz_29_stg_titulos_migracao
    SET promovido_em=now(), promovido_por=auth.uid(), destino_id=_new_id, destino_tabela='titulo_receber'
    WHERE mz_id=_mz_id;
  RETURN _new_id;
END$$;

-- A5: mz_50 → orcamento_contrato_linha
CREATE OR REPLACE FUNCTION public.oc_promover_orcamento_linha(_mz_id bigint, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _empresa uuid; _already uuid; _new_id uuid;
BEGIN
  SELECT empresa_id_resolvida, destino_id INTO _empresa, _already
    FROM mz_50_fato_orcamento_contratos_competencia WHERE mz_id = _mz_id;
  IF _empresa IS NULL THEN RAISE EXCEPTION 'mz_50 #% não encontrado ou sem empresa resolvida', _mz_id; END IF;
  IF NOT user_pode_atuar_empresa(auth.uid(), _empresa) THEN RAISE EXCEPTION 'Sem permissão para empresa %', _empresa; END IF;
  IF _already IS NOT NULL THEN RAISE EXCEPTION 'mz_50 #% já promovido (destino %)', _mz_id, _already; END IF;

  INSERT INTO orcamento_contrato_linha
  SELECT * FROM jsonb_populate_record(null::orcamento_contrato_linha, _payload || jsonb_build_object('empresa_id', _empresa))
  RETURNING id INTO _new_id;

  UPDATE mz_50_fato_orcamento_contratos_competencia
    SET promovido_em=now(), promovido_por=auth.uid(), destino_id=_new_id
    WHERE mz_id=_mz_id;
  RETURN _new_id;
END$$;

-- A6: mz_31 → lancamento_partida (valida empresa via lancamento_contabil)
CREATE OR REPLACE FUNCTION public.lc_promover_partida_contabil(_mz_id bigint, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _empresa_mz uuid; _empresa_lc uuid; _lanc_id uuid; _already uuid; _new_id uuid;
BEGIN
  SELECT empresa_id_resolvida, destino_id INTO _empresa_mz, _already
    FROM mz_31_fato_partidas_dobradas WHERE mz_id = _mz_id;
  IF _empresa_mz IS NULL THEN RAISE EXCEPTION 'mz_31 #% não encontrado ou sem empresa resolvida', _mz_id; END IF;
  IF NOT user_pode_atuar_empresa(auth.uid(), _empresa_mz) THEN RAISE EXCEPTION 'Sem permissão para empresa %', _empresa_mz; END IF;
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

REVOKE ALL ON FUNCTION public.tp_promover_titulo_pagar(bigint, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.tr_promover_titulo_receber(bigint, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.oc_promover_orcamento_linha(bigint, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.lc_promover_partida_contabil(bigint, jsonb) FROM public;

GRANT EXECUTE ON FUNCTION public.tp_promover_titulo_pagar(bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tr_promover_titulo_receber(bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.oc_promover_orcamento_linha(bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_promover_partida_contabil(bigint, jsonb) TO authenticated;
