-- Onda A2 (B-mínimo): backend de promoção FCR mz_40 → realizado_lancamentos

ALTER TABLE public.mz_40_fato_fluxo_caixa_realizado
  ADD COLUMN IF NOT EXISTS promovido_em timestamptz,
  ADD COLUMN IF NOT EXISTS promovido_por uuid,
  ADD COLUMN IF NOT EXISTS realizado_lancamento_id uuid;

CREATE INDEX IF NOT EXISTS ix_mz40_promovido_em
  ON public.mz_40_fato_fluxo_caixa_realizado (promovido_em)
  WHERE promovido_em IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fcr_promover_lancamento(
  _mz_id           bigint,
  _empresa_id      uuid,
  _centro_custo_id uuid,
  _dre_linha_id    uuid,
  _data_lancamento date,
  _data_competencia date,
  _valor           numeric,
  _descricao       text,
  _documento       text DEFAULT NULL,
  _contraparte     text DEFAULT NULL,
  _observacoes     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existente uuid;
  v_novo uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.user_pode_atuar_empresa(v_uid, _empresa_id) THEN
    RAISE EXCEPTION 'Sem acesso à empresa de destino';
  END IF;

  SELECT realizado_lancamento_id INTO v_existente
  FROM public.mz_40_fato_fluxo_caixa_realizado
  WHERE mz_id = _mz_id;

  IF v_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Lançamento já promovido (id=%)', v_existente;
  END IF;

  INSERT INTO public.realizado_lancamentos (
    empresa_id, data_lancamento, data_competencia, valor,
    dre_linha_id, centro_custo_id, descricao, documento,
    contraparte, observacoes, origem_externa_id
  ) VALUES (
    _empresa_id, _data_lancamento, _data_competencia, _valor,
    _dre_linha_id, _centro_custo_id, _descricao, _documento,
    _contraparte, _observacoes, 'mz_40:' || _mz_id::text
  )
  RETURNING id INTO v_novo;

  UPDATE public.mz_40_fato_fluxo_caixa_realizado
  SET promovido_em = now(),
      promovido_por = v_uid,
      realizado_lancamento_id = v_novo
  WHERE mz_id = _mz_id;

  RETURN v_novo;
END
$$;

REVOKE ALL ON FUNCTION public.fcr_promover_lancamento(bigint,uuid,uuid,uuid,date,date,numeric,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fcr_promover_lancamento(bigint,uuid,uuid,uuid,date,date,numeric,text,text,text,text) TO authenticated;