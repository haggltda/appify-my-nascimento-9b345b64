-- Bloco F: Razão contábil RPC
CREATE OR REPLACE FUNCTION public.razao_contabil(
  _empresa_id uuid, _conta_id uuid, _data_ini date, _data_fim date
) RETURNS TABLE (
  data_lancamento date,
  numero text,
  historico text,
  contrapartida text,
  dc text,
  debito numeric,
  credito numeric,
  saldo numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_natureza text;
  v_sign int;
  v_saldo numeric := 0;
  r record;
BEGIN
  SELECT natureza::text, COALESCE(saldo_inicial, 0)
    INTO v_natureza, v_saldo
  FROM conta_contabil WHERE id = _conta_id;

  v_sign := CASE WHEN v_natureza = 'D' THEN 1 ELSE -1 END;

  -- Saldo anterior = saldo_inicial + movimentos antes de _data_ini
  SELECT v_saldo + COALESCE(SUM(
    (CASE WHEN lp.dc::text = 'D' THEN lp.valor ELSE -lp.valor END) * v_sign
  ), 0)
  INTO v_saldo
  FROM public.lancamento_partida lp
  JOIN public.lancamento_contabil lc ON lc.id = lp.lancamento_id
  WHERE lp.conta_contabil_id = _conta_id
    AND lc.empresa_id = _empresa_id
    AND lc.status::text = 'efetivado'
    AND lc.data_lancamento < _data_ini;

  -- Linha de saldo anterior
  RETURN QUERY SELECT _data_ini, NULL::text, 'SALDO ANTERIOR'::text, ''::text, ''::text,
                      0::numeric, 0::numeric, v_saldo;

  FOR r IN
    SELECT lc.data_lancamento, lc.numero,
           COALESCE(lp.historico, lc.historico) AS hist,
           lp.dc::text AS dc, lp.valor, lp.id AS lp_id, lp.lancamento_id
      FROM public.lancamento_partida lp
      JOIN public.lancamento_contabil lc ON lc.id = lp.lancamento_id
     WHERE lp.conta_contabil_id = _conta_id
       AND lc.empresa_id = _empresa_id
       AND lc.status::text = 'efetivado'
       AND lc.data_lancamento BETWEEN _data_ini AND _data_fim
     ORDER BY lc.data_lancamento, lc.numero, lp.id
  LOOP
    v_saldo := v_saldo + (CASE WHEN r.dc = 'D' THEN r.valor ELSE -r.valor END) * v_sign;
    RETURN QUERY SELECT
      r.data_lancamento,
      r.numero,
      r.hist,
      (SELECT string_agg(cc.classificacao || ' ' || cc.descricao, ' / ')
         FROM public.lancamento_partida lp2
         JOIN public.conta_contabil cc ON cc.id = lp2.conta_contabil_id
        WHERE lp2.lancamento_id = r.lancamento_id AND lp2.id <> r.lp_id),
      r.dc,
      CASE WHEN r.dc = 'D' THEN r.valor ELSE 0 END,
      CASE WHEN r.dc = 'C' THEN r.valor ELSE 0 END,
      v_saldo;
  END LOOP;
END;
$$;