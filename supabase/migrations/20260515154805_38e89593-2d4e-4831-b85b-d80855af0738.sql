
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.dre_gerencial_competencia(
  _empresa_id uuid, _ano int, _versao_obz uuid DEFAULT NULL
)
RETURNS TABLE (
  dre_linha_id uuid, codigo text, descricao text, natureza text, ordem int,
  mes int, realizado numeric, orcado numeric, variacao numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH meses AS (SELECT generate_series(1,12) AS mes),
linhas AS (
  SELECT id, codigo, descricao, natureza::text AS natureza, ordem
  FROM public.dre_linhas
  WHERE ativo = true AND (empresa_id = _empresa_id OR empresa_id IS NULL)
),
versao AS (
  SELECT id FROM public.obz_versoes
  WHERE empresa_id = _empresa_id AND ano = _ano
    AND ((_versao_obz IS NOT NULL AND id = _versao_obz)
         OR (_versao_obz IS NULL AND status = 'aprovada'))
  ORDER BY revisao DESC, versao DESC, updated_at DESC LIMIT 1
),
partidas AS (
  SELECT cc.dre_linha_id,
    EXTRACT(MONTH FROM COALESCE(lc.competencia, lc.data_lancamento))::int AS mes,
    CASE WHEN cc.natureza::text IN ('receita','passivo','patrimonio_liquido')
         THEN CASE WHEN p.dc='C' THEN p.valor ELSE -p.valor END
         ELSE CASE WHEN p.dc='D' THEN p.valor ELSE -p.valor END
    END AS valor
  FROM public.lancamento_partida p
  JOIN public.lancamento_contabil lc ON lc.id = p.lancamento_id
  JOIN public.conta_contabil cc ON cc.id = p.conta_contabil_id
  WHERE lc.empresa_id = _empresa_id AND lc.status = 'efetivado'
    AND cc.dre_linha_id IS NOT NULL
    AND EXTRACT(YEAR FROM COALESCE(lc.competencia, lc.data_lancamento)) = _ano
),
realizado_m AS (SELECT dre_linha_id, mes, SUM(valor) AS valor FROM partidas GROUP BY dre_linha_id, mes),
orcado_m AS (
  SELECT v.dre_linha_id, per.mes, SUM(v.valor) AS valor
  FROM public.obz_valores v JOIN public.obz_periodos per ON per.id = v.periodo_id
  WHERE v.versao_id = (SELECT id FROM versao) GROUP BY v.dre_linha_id, per.mes
)
SELECT l.id, l.codigo, l.descricao, l.natureza, l.ordem, m.mes,
       COALESCE(r.valor,0)::numeric, COALESCE(o.valor,0)::numeric,
       (COALESCE(r.valor,0) - COALESCE(o.valor,0))::numeric
FROM linhas l CROSS JOIN meses m
LEFT JOIN realizado_m r ON r.dre_linha_id = l.id AND r.mes = m.mes
LEFT JOIN orcado_m o ON o.dre_linha_id = l.id AND o.mes = m.mes
ORDER BY l.ordem, l.codigo, m.mes;
$$;

CREATE TABLE IF NOT EXISTS public.folha_periodo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  status text NOT NULL DEFAULT 'aberto',
  data_provisao date, data_pagamento date, data_encargos date,
  conta_banco_id uuid REFERENCES public.conta_bancaria(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, competencia)
);

CREATE TABLE IF NOT EXISTS public.folha_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folha_periodo_id uuid NOT NULL REFERENCES public.folha_periodo(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  colaborador_id uuid REFERENCES public.colaborador(id),
  centro_custo_id uuid REFERENCES public.centros_custo(id),
  tipo text NOT NULL,
  descricao text,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folha_evento_periodo ON public.folha_evento(folha_periodo_id);
CREATE INDEX IF NOT EXISTS idx_folha_periodo_emp_comp ON public.folha_periodo(empresa_id, competencia);

ALTER TABLE public.folha_periodo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folha_evento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS folha_periodo_rw ON public.folha_periodo;
CREATE POLICY folha_periodo_rw ON public.folha_periodo FOR ALL TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS folha_evento_rw ON public.folha_evento;
CREATE POLICY folha_evento_rw ON public.folha_evento FOR ALL TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS trg_folha_periodo_updated ON public.folha_periodo;
CREATE TRIGGER trg_folha_periodo_updated BEFORE UPDATE ON public.folha_periodo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.contabilizar_folha(_periodo_id uuid, _evento text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_per folha_periodo%ROWTYPE;
  v_codigo_evento text; v_data date; v_total numeric := 0;
  v_lanc uuid; v_tipo_filtro text; v_conta_banco uuid;
BEGIN
  SELECT * INTO v_per FROM folha_periodo WHERE id = _periodo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Período de folha não encontrado'; END IF;
  IF _evento = 'provisao' THEN
    v_codigo_evento := 'EVT-008'; v_tipo_filtro := 'provisao';
    v_data := COALESCE(v_per.data_provisao, v_per.competencia);
  ELSIF _evento = 'pagamento' THEN
    v_codigo_evento := 'EVT-009'; v_tipo_filtro := 'pagamento';
    v_data := COALESCE(v_per.data_pagamento, CURRENT_DATE);
    v_conta_banco := v_per.conta_banco_id;
    IF v_conta_banco IS NULL THEN RAISE EXCEPTION 'Conta bancária obrigatória para pagamento'; END IF;
  ELSIF _evento = 'encargos' THEN
    v_codigo_evento := 'EVT-010'; v_tipo_filtro := 'encargos';
    v_data := COALESCE(v_per.data_encargos, CURRENT_DATE);
    v_conta_banco := v_per.conta_banco_id;
    IF v_conta_banco IS NULL THEN RAISE EXCEPTION 'Conta bancária obrigatória para encargos'; END IF;
  ELSE
    RAISE EXCEPTION 'Evento inválido: %', _evento;
  END IF;
  SELECT COALESCE(SUM(valor),0) INTO v_total
    FROM folha_evento WHERE folha_periodo_id = _periodo_id AND tipo = v_tipo_filtro;
  IF v_total <= 0 THEN RAISE EXCEPTION 'Sem eventos % no período', v_tipo_filtro; END IF;
  v_lanc := public.gerar_lancamento_contabil(
    v_per.empresa_id, v_codigo_evento, v_data, v_total,
    'Folha ' || _evento || ' ' || to_char(v_per.competencia,'MM/YYYY'),
    'folha_periodo', _periodo_id, NULL, v_conta_banco
  );
  RETURN v_lanc;
END $$;

CREATE OR REPLACE VIEW public.vw_conciliacao_eventos AS
WITH src AS (
  SELECT 'nota_fiscal'::text AS origem_tipo, nf.id AS origem_id, nf.empresa_id,
         nf.numero::text AS doc, nf.data_emissao::date AS data,
         nf.valor_total::numeric AS valor, nf.status::text AS status_origem
    FROM public.nota_fiscal nf
  UNION ALL
  SELECT 'titulo_receber', tr.id, tr.empresa_id, tr.numero::text, tr.data_emissao,
         tr.valor::numeric, tr.status::text
    FROM public.titulo_receber tr
  UNION ALL
  SELECT 'titulo_pagar', tp.id, tp.empresa_id, tp.numero_documento::text, tp.data_emissao,
         tp.valor::numeric, tp.status::text
    FROM public.titulo_pagar tp
  UNION ALL
  SELECT 'titulo_receber_baixa', b.id, b.empresa_id, tr.numero::text, b.data_baixa,
         b.valor::numeric, 'baixa'::text
    FROM public.titulo_receber_baixa b
    JOIN public.titulo_receber tr ON tr.id = b.titulo_id
  UNION ALL
  SELECT 'estoque_movimento', em.id, em.empresa_id, COALESCE(em.documento,'')::text,
         em.data_movimento::date, em.valor_total::numeric, em.tipo::text
    FROM public.estoque_movimento em WHERE em.tipo::text = 'saida'
  UNION ALL
  SELECT 'folha_periodo', fp.id, fp.empresa_id, to_char(fp.competencia,'MM/YYYY'),
         fp.competencia,
         (SELECT COALESCE(SUM(valor),0) FROM public.folha_evento WHERE folha_periodo_id=fp.id)::numeric,
         fp.status::text
    FROM public.folha_periodo fp
)
SELECT s.origem_tipo, s.origem_id, s.empresa_id, s.doc, s.data, s.valor, s.status_origem,
       lc.id AS lancamento_id, lc.numero AS lancamento_numero, lc.status::text AS lancamento_status,
       (lc.id IS NOT NULL) AS contabilizado
FROM src s
LEFT JOIN public.lancamento_contabil lc
  ON lc.empresa_id = s.empresa_id
 AND lc.origem_tipo = s.origem_tipo
 AND lc.origem_id   = s.origem_id;

CREATE OR REPLACE FUNCTION public.trg_estoque_saida_contabiliza()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_valor numeric;
BEGIN
  IF NEW.tipo::text <> 'saida' THEN RETURN NEW; END IF;
  v_valor := COALESCE(NEW.valor_total, NEW.quantidade * COALESCE(NEW.custo_unitario,0));
  IF v_valor IS NULL OR v_valor <= 0 THEN RETURN NEW; END IF;
  BEGIN
    PERFORM public.gerar_lancamento_contabil(
      NEW.empresa_id, 'EVT-015', NEW.data_movimento::date, v_valor,
      'Baixa estoque ' || COALESCE(NEW.documento,''),
      'estoque_movimento', NEW.id, NEW.centro_custo_id, NULL
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_estoque_saida_ct ON public.estoque_movimento;
CREATE TRIGGER trg_estoque_saida_ct AFTER INSERT ON public.estoque_movimento
  FOR EACH ROW EXECUTE FUNCTION public.trg_estoque_saida_contabiliza();
