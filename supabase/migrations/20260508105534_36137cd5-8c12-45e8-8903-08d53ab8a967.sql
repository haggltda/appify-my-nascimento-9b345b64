
-- Bloco 4 — Função de DIAGNÓSTICO da promoção razão (read-only)
-- Mapeia mz_32 → lancamento_contabil/partida e retorna estatísticas SEM inserir.

CREATE OR REPLACE FUNCTION public.mz_32_diagnosticar_razao(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Acesso: admin ou controladoria
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'controladoria')) THEN
    RAISE EXCEPTION 'Acesso negado: requer role admin ou controladoria';
  END IF;

  WITH src AS (
    SELECT
      m.mz_id,
      m.id_lct_mestre,
      m.id_partida,
      UPPER(TRIM(m.empresa)) AS sigla,
      e.id AS empresa_id,
      m.codigo_conta,
      cc.id AS conta_contabil_id,
      m.centro_custo,
      ccu.id AS centro_custo_id,
      m.contrato,
      NULLIF(m.data_lancamento,'')::date AS data_lcto,
      NULLIF(m.periodo,'')::date AS competencia,
      COALESCE(NULLIF(REPLACE(REPLACE(m.valor_debito_razao,'.',''),',','.'),'')::numeric, 0) AS deb,
      COALESCE(NULLIF(REPLACE(REPLACE(m.valor_credito_razao,'.',''),',','.'),'')::numeric, 0) AS cre
    FROM public.mz_32_fato_razao_contabil m
    LEFT JOIN public.empresas e ON UPPER(e.nome_fantasia) = UPPER(TRIM(m.empresa))
    LEFT JOIN public.conta_contabil cc
      ON cc.empresa_id = e.id AND cc.classificacao = m.codigo_conta
    LEFT JOIN public.centros_custo ccu
      ON ccu.empresa_id = e.id AND ccu.codigo = m.centro_custo
    WHERE m.migration_batch_id = p_batch_id
  ),
  classified AS (
    SELECT *,
      CASE
        WHEN empresa_id IS NULL THEN 'PENDENTE_EMPRESA'
        WHEN conta_contabil_id IS NULL THEN 'PENDENTE_CONTA'
        WHEN deb = 0 AND cre = 0 THEN 'INVALIDO_VALOR_ZERO'
        WHEN data_lcto IS NULL THEN 'INVALIDO_DATA'
        ELSE 'OK'
      END AS status_promocao
    FROM src
  ),
  por_status AS (
    SELECT status_promocao, count(*) AS qt, sum(deb) AS total_deb, sum(cre) AS total_cre
    FROM classified GROUP BY status_promocao
  ),
  por_empresa AS (
    SELECT sigla, empresa_id, count(*) AS linhas,
           count(*) FILTER (WHERE status_promocao='OK') AS ok,
           sum(deb) FILTER (WHERE status_promocao='OK') AS deb_ok,
           sum(cre) FILTER (WHERE status_promocao='OK') AS cre_ok
    FROM classified GROUP BY sigla, empresa_id
  ),
  balanco_lct AS (
    SELECT id_lct_mestre,
           sum(deb) AS deb_lct, sum(cre) AS cre_lct,
           ABS(sum(deb) - sum(cre)) AS diff
    FROM classified WHERE status_promocao='OK' GROUP BY id_lct_mestre
  ),
  balanco_resumo AS (
    SELECT
      count(*) AS lct_mestres_ok,
      count(*) FILTER (WHERE diff < 0.01) AS balanceados,
      count(*) FILTER (WHERE diff >= 0.01) AS desbalanceados,
      sum(diff) FILTER (WHERE diff >= 0.01) AS soma_diferencas
    FROM balanco_lct
  )
  SELECT jsonb_build_object(
    'batch_id', p_batch_id,
    'gerado_em', now(),
    'totais_por_status', (SELECT jsonb_agg(to_jsonb(p)) FROM por_status p),
    'por_empresa', (SELECT jsonb_agg(to_jsonb(pe)) FROM por_empresa pe),
    'balanco_partidas', (SELECT to_jsonb(b) FROM balanco_resumo b)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mz_32_diagnosticar_razao(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mz_32_diagnosticar_razao(uuid) TO authenticated;

COMMENT ON FUNCTION public.mz_32_diagnosticar_razao(uuid) IS
'Bloco 4 - Diagnóstico read-only da promoção mz_32_fato_razao_contabil → lancamento_contabil/partida. Retorna jsonb com estatísticas por status, por empresa e balanço de partidas. NÃO insere nada.';
