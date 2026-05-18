-- 1) Flag de exclusão do fluxo (preserva rastreabilidade)
ALTER TABLE public.mz_40_fato_fluxo_caixa_realizado
  ADD COLUMN IF NOT EXISTS excluir_do_fluxo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_exclusao_fluxo text;

-- 2) Marcar SALDO ANTERIOR como não-movimento (saldo de abertura do extrato)
UPDATE public.mz_40_fato_fluxo_caixa_realizado
SET excluir_do_fluxo = true,
    motivo_exclusao_fluxo = 'SALDO ANTERIOR (abertura de extrato) — saldo oficial vive em saldos_iniciais_caixa'
WHERE classificacao_original = 'SALDO ANTERIOR'
  AND excluir_do_fluxo = false;

CREATE INDEX IF NOT EXISTS idx_mz40_excluir_fluxo
  ON public.mz_40_fato_fluxo_caixa_realizado(excluir_do_fluxo)
  WHERE excluir_do_fluxo = false;

-- 3) RPC passa a ignorar linhas marcadas
CREATE OR REPLACE FUNCTION public.fluxo_caixa_diario(_empresa_id uuid, _data_ini date, _data_fim date)
 RETURNS TABLE(bloco text, categoria text, dia date, valor numeric, saldo_inicial numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH emp AS (
    SELECT id, codigo FROM public.empresas
    WHERE (_empresa_id IS NULL AND ativa = true) OR (id = _empresa_id)
  ),
  mov AS (
    SELECT
      NULLIF(m.data_caixa,'')::date AS dia,
      NULLIF(m.valor,'0')::numeric  AS valor,
      m.tipo_movimento,
      m.classificacao_gerencial,
      COALESCE(NULLIF(m.conta_resultado_nome,''), 'Outros') AS categoria
    FROM public.mz_40_fato_fluxo_caixa_realizado m
    JOIN emp ON emp.codigo = m.empresa
    WHERE NULLIF(m.data_caixa,'') IS NOT NULL
      AND NULLIF(m.valor,'') IS NOT NULL
      AND m.excluir_do_fluxo = false
  ),
  classificado AS (
    SELECT
      CASE
        WHEN tipo_movimento ILIKE 'ENTRADA%' THEN 'ENTRADAS'
        WHEN classificacao_gerencial IN ('CUSTO','DESPESA') THEN 'SAIDAS_OP'
        ELSE 'SAIDAS_NAO_OP'
      END AS bloco,
      categoria, dia,
      CASE WHEN tipo_movimento ILIKE 'ENTRADA%' THEN valor ELSE -valor END AS valor_assinado
    FROM mov
  ),
  ref_dt AS (
    SELECT MAX(data_referencia) AS dt
    FROM public.saldos_iniciais_caixa
    WHERE (_empresa_id IS NULL OR empresa_id = _empresa_id)
      AND data_referencia <= _data_ini
  ),
  saldo_base AS (
    SELECT COALESCE(SUM(valor),0) AS v
    FROM public.saldos_iniciais_caixa
    WHERE (_empresa_id IS NULL OR empresa_id = _empresa_id)
      AND data_referencia = (SELECT dt FROM ref_dt)
  ),
  saldo_mov_pre AS (
    SELECT COALESCE(SUM(valor_assinado),0) AS v
    FROM classificado
    WHERE dia >= COALESCE((SELECT dt FROM ref_dt), DATE '1900-01-01')
      AND dia < _data_ini
  )
  SELECT
    c.bloco, c.categoria, c.dia,
    SUM(c.valor_assinado)::numeric AS valor,
    ((SELECT v FROM saldo_base) + (SELECT v FROM saldo_mov_pre))::numeric AS saldo_inicial
  FROM classificado c
  WHERE c.dia BETWEEN _data_ini AND _data_fim
  GROUP BY c.bloco, c.categoria, c.dia;
$function$;