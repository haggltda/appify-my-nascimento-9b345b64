
CREATE TABLE IF NOT EXISTS public.saldos_iniciais_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data_referencia date NOT NULL,
  banco text NOT NULL,
  categoria text,
  subcategoria text,
  tipo text,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, data_referencia, banco)
);

CREATE INDEX IF NOT EXISTS idx_sic_empresa_data ON public.saldos_iniciais_caixa(empresa_id, data_referencia);

ALTER TABLE public.saldos_iniciais_caixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read saldos iniciais" ON public.saldos_iniciais_caixa;
CREATE POLICY "auth read saldos iniciais" ON public.saldos_iniciais_caixa FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin write saldos iniciais" ON public.saldos_iniciais_caixa;
CREATE POLICY "admin write saldos iniciais" ON public.saldos_iniciais_caixa FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DELETE FROM public.saldos_iniciais_caixa WHERE data_referencia = '2026-01-01';

INSERT INTO public.saldos_iniciais_caixa (empresa_id, data_referencia, banco, categoria, subcategoria, tipo, valor)
SELECT e.id, '2026-01-01'::date, v.banco, v.categoria, v.subcategoria, v.tipo, v.valor
FROM (VALUES
  ('AGPS','BANRI AGPS','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',270.22),
  ('HAGG','TICKET','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',4970.67),
  ('HAGG','SICREDI HAGG 155','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',164.59),
  ('CANAA','BANRI CANAA','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',217.23),
  ('HAGG','BANRI HAGG','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',1217.50),
  ('LF','BANRI LF','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',478.38),
  ('NH','BANRI NH','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',760.43),
  ('SN','BANRI SN','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',1472.32),
  ('HAGG','BB HAGG','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',5715.91),
  ('SN','BB SN','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',51362.07),
  ('HAGG','CAIXA HAGG','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',771.49),
  ('SN','CAIXA SN','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',320.61),
  ('HAGG','SICREDI HAGG 119','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',28269.68),
  ('SN','BRADESCO SN','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',606.39),
  ('HAGG','BRADESCO HAGG','SALDO ANTERIOR','AJUSTES DE CONTAS','TRANSFERÊNCIA',2087.86),
  ('HAGG','BB HAGG - EMBRAPA 2021/93','SALDO ANTERIOR','AJUSTES DE CONTAS - CONTA VINCULADA','TRANSFERÊNCIA',162705.03),
  ('HAGG','BB HAGG - EMBRAPA CANOINHA 47/2024','SALDO ANTERIOR','AJUSTES DE CONTAS - CONTA VINCULADA','TRANSFERÊNCIA',16632.86),
  ('HAGG','BB HAGG - FURG-HU 006/2023','SALDO ANTERIOR','AJUSTES DE CONTAS - CONTA VINCULADA','TRANSFERÊNCIA',264871.32),
  ('HAGG','BB HAGG - FURG JARDINAGEM 049/2022','SALDO ANTERIOR','AJUSTES DE CONTAS - CONTA VINCULADA','TRANSFERÊNCIA',95327.50),
  ('HAGG','BB HAGG - HCPA 1249781/2024','SALDO ANTERIOR','AJUSTES DE CONTAS - CONTA VINCULADA','TRANSFERÊNCIA',94866.08),
  ('HAGG','BB HAGG - UFFS 041/2021','SALDO ANTERIOR','AJUSTES DE CONTAS - CONTA VINCULADA','TRANSFERÊNCIA',1806951.81),
  ('HAGG','CAIXA - BENTO GONÇALVES ADM 002/2021','SALDO ANTERIOR','AJUSTES DE CONTAS - CONTA VINCULADA','TRANSFERÊNCIA',314839.27),
  ('HAGG','CAIXA - HUSM 020/2021','SALDO ANTERIOR','AJUSTES DE CONTAS - CONTA VINCULADA','TRANSFERÊNCIA',345353.04),
  ('HAGG','CAIXA -BENTO GONÇALVES  - LIMPEZA - 067/2019','SALDO ANTERIOR','AJUSTES DE CONTAS - CONTA VINCULADA','TRANSFERÊNCIA',301998.26),
  ('SN','BB SN - FURG- PORTARIA 55/2023','SALDO ANTERIOR','AJUSTES DE CONTAS - CONTA VINCULADA','TRANSFERÊNCIA',722009.95),
  ('HAGG','CDB INTER','SALDO ANTERIOR','AJUSTES DE CONTAS - APLICAÇÃO','TRANSFERÊNCIA',551.32),
  ('HAGG','BB HAGG- APLICAÇÃO','SALDO ANTERIOR','AJUSTES DE CONTAS - APLICAÇÃO','TRANSFERÊNCIA',80000.00),
  ('HAGG','INTER','SALDO ANTERIOR','AJUSTES DE CONTA','TRANSFERÊNCIA',2.16),
  ('HAGG','TICKET 2','SALDO ANTERIOR','AJUSTES DE CONTA','TRANSFERÊNCIA',0.00),
  ('HAGG','SICREDI 155 POUPANÇA','SALDO ANTERIOR','AJUSTES DE CONTA','TRANSFERÊNCIA',2648.11)
) AS v(empresa_codigo,banco,categoria,subcategoria,tipo,valor)
JOIN public.empresas e ON e.codigo = v.empresa_codigo;

CREATE OR REPLACE FUNCTION public.fluxo_caixa_diario(_empresa_id uuid, _data_ini date, _data_fim date)
RETURNS TABLE(bloco text, categoria text, dia date, valor numeric, saldo_inicial numeric)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  WITH emp AS (
    SELECT id, codigo FROM public.empresas WHERE id = _empresa_id
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
    WHERE empresa_id = _empresa_id AND data_referencia <= _data_ini
  ),
  saldo_base AS (
    SELECT COALESCE(SUM(valor),0) AS v
    FROM public.saldos_iniciais_caixa
    WHERE empresa_id = _empresa_id AND data_referencia = (SELECT dt FROM ref_dt)
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
$$;
