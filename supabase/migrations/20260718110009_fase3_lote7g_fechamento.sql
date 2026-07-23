-- FASE 3 (lote 7g — fechamento) — 14 itens achados na varredura final de
-- confirmação, depois do lote 7a-7f. A maioria é lógica em corpo de RPC
-- (não se corrige só trocando RLS, precisa reescrever a function inteira);
-- 2 são policies órfãs que sobreviveram por baixo de uma policy mais nova
-- (mesmo padrão de sempre — Postgres OR-combina policies permissivas).

-- ── orcamento_ciclo / orcamento_contrato: policies órfãs "oc_select"/
--    "oc_write"/"octr_select"/"octr_write" (20260429194546) nunca foram
--    dropadas quando o lote 1 criou oc_ciclo_*/oc_contrato_* — inclusive
--    ressuscitavam DELETE, que o esquema novo deliberadamente não concede
--    nessas duas tabelas. ───────────────────────────────────────────────
DROP POLICY IF EXISTS "oc_select" ON public.orcamento_ciclo;
DROP POLICY IF EXISTS "oc_write" ON public.orcamento_ciclo;
DROP POLICY IF EXISTS "octr_select" ON public.orcamento_contrato;
DROP POLICY IF EXISTS "octr_write" ON public.orcamento_contrato;

-- ── financeiro_pagamento_log: fpl_insert deixada de propósito no lote 2
--    (grava só via trigger/RPC SECURITY DEFINER, dono da tabela ignora RLS
--    na prática) — trocada mesmo assim por consistência textual. ────────
DROP POLICY IF EXISTS "fpl_insert" ON public.financeiro_pagamento_log;
CREATE POLICY fpl_insert ON public.financeiro_pagamento_log FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'validacao', 'incluir'::app_acao));

-- ── fcr_parse_chunk_erro (child de fcr_batch, mesma família FCR do lote 7b,
--    menu 'administracao') ────────────────────────────────────────────────
DROP POLICY IF EXISTS "fcr_parse_chunk_erro_select" ON public.fcr_parse_chunk_erro;
CREATE POLICY fcr_parse_chunk_erro_select ON public.fcr_parse_chunk_erro FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'visualizar'::app_acao));

-- ── RPC gerar_orcamento_contrato ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gerar_orcamento_contrato(_contrato_id uuid, _ciclo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contrato RECORD;
  v_param RECORD;
  v_orc_id uuid;
  v_dre_receita uuid;
  v_dre_pessoal uuid;
  v_dre_beneficios uuid;
  v_dre_encargos uuid;
  v_dre_tributos uuid;
  v_competencia date;
  v_meses int;
  v_total_salarios numeric;
  v_total_beneficios numeric;
  v_total_encargos numeric;
  v_total_tributos numeric;
  v_receita_total numeric := 0;
  v_custo_total numeric := 0;
BEGIN
  SELECT * INTO v_contrato FROM public.contrato WHERE id = _contrato_id;
  IF v_contrato IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;

  IF NOT public.can_access(auth.uid(), 'orcamento', 'incluir'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_param FROM public.parametro_orcamento WHERE empresa_id = v_contrato.empresa_id;
  IF v_param IS NULL THEN
    INSERT INTO public.parametro_orcamento (empresa_id) VALUES (v_contrato.empresa_id)
    RETURNING * INTO v_param;
  END IF;

  SELECT id INTO v_dre_receita FROM public.dre_linhas
   WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
     AND natureza = 'receita' ORDER BY ordem LIMIT 1;
  SELECT id INTO v_dre_pessoal FROM public.dre_linhas
   WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
     AND descricao ILIKE '%pessoal%' AND natureza = 'custo' ORDER BY ordem LIMIT 1;
  IF v_dre_pessoal IS NULL THEN
    SELECT id INTO v_dre_pessoal FROM public.dre_linhas
     WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
       AND natureza = 'custo' ORDER BY ordem LIMIT 1;
  END IF;
  SELECT id INTO v_dre_beneficios FROM public.dre_linhas
   WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
     AND descricao ILIKE '%benef%' ORDER BY ordem LIMIT 1;
  IF v_dre_beneficios IS NULL THEN v_dre_beneficios := v_dre_pessoal; END IF;
  SELECT id INTO v_dre_encargos FROM public.dre_linhas
   WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
     AND descricao ILIKE '%encargo%' ORDER BY ordem LIMIT 1;
  IF v_dre_encargos IS NULL THEN v_dre_encargos := v_dre_pessoal; END IF;
  SELECT id INTO v_dre_tributos FROM public.dre_linhas
   WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
     AND descricao ILIKE '%tribut%' ORDER BY ordem LIMIT 1;
  IF v_dre_tributos IS NULL THEN
    SELECT id INTO v_dre_tributos FROM public.dre_linhas
     WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
       AND natureza = 'deducao' ORDER BY ordem LIMIT 1;
  END IF;

  IF v_dre_receita IS NULL OR v_dre_pessoal IS NULL THEN
    RAISE EXCEPTION 'Plano DRE incompleto: cadastre linhas de receita e pessoal';
  END IF;

  INSERT INTO public.orcamento_contrato (empresa_id, ciclo_id, contrato_id, status, gerado_em, gerado_por)
  VALUES (v_contrato.empresa_id, _ciclo_id, _contrato_id, 'rascunho', now(), auth.uid())
  ON CONFLICT (ciclo_id, contrato_id) DO UPDATE SET gerado_em = now(), gerado_por = auth.uid()
  RETURNING id INTO v_orc_id;

  DELETE FROM public.orcamento_contrato_linha
   WHERE orcamento_contrato_id = v_orc_id AND source IN ('licitacao','calculado');
  DELETE FROM public.cronograma_faturamento WHERE orcamento_contrato_id = v_orc_id;
  DELETE FROM public.fluxo_caixa_projetado WHERE orcamento_contrato_id = v_orc_id;

  SELECT
    COALESCE(SUM(quantidade * (salario_base
      + salario_base * (insalubridade_pct + periculosidade_pct)/100)),0),
    COALESCE(SUM(quantidade * (va + vt + epis + uniformes)),0)
  INTO v_total_salarios, v_total_beneficios
  FROM public.contrato_posto WHERE contrato_id = _contrato_id AND ativo = true;

  v_total_encargos := v_total_salarios * (v_param.pct_encargos_sociais + v_param.pct_provisoes) / 100.0;
  v_total_tributos := v_contrato.faturamento_mensal * v_param.pct_tributos_receita / 100.0;

  v_competencia := date_trunc('month', v_contrato.vigencia_inicio)::date;
  v_meses := 0;
  WHILE v_competencia <= v_contrato.vigencia_fim AND v_meses < 60 LOOP
    INSERT INTO public.orcamento_contrato_linha
      (empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id, competencia, valor_previsto, source, locked, memoria_calculo)
    VALUES (v_contrato.empresa_id, v_orc_id, v_dre_receita, v_contrato.centro_custo_id, v_competencia,
            v_contrato.faturamento_mensal, 'licitacao', true, 'Faturamento mensal contrato')
    ON CONFLICT DO NOTHING;
    v_receita_total := v_receita_total + v_contrato.faturamento_mensal;

    INSERT INTO public.orcamento_contrato_linha
      (empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id, competencia, valor_previsto, source, locked, memoria_calculo)
    VALUES (v_contrato.empresa_id, v_orc_id, v_dre_pessoal, v_contrato.centro_custo_id, v_competencia,
            v_total_salarios, 'licitacao', true, 'Salários + adicionais (postos)')
    ON CONFLICT DO NOTHING;

    IF v_total_beneficios > 0 THEN
      INSERT INTO public.orcamento_contrato_linha
        (empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id, competencia, valor_previsto, source, locked, memoria_calculo)
      VALUES (v_contrato.empresa_id, v_orc_id, v_dre_beneficios, v_contrato.centro_custo_id, v_competencia,
              v_total_beneficios, 'calculado', true, 'VA+VT+EPIs+Uniformes')
      ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO public.orcamento_contrato_linha
      (empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id, competencia, valor_previsto, source, locked, memoria_calculo)
    VALUES (v_contrato.empresa_id, v_orc_id, v_dre_encargos, v_contrato.centro_custo_id, v_competencia,
            v_total_encargos, 'calculado', true,
            'Salarios x ('||v_param.pct_encargos_sociais||'% encargos + '||v_param.pct_provisoes||'% provisoes)')
    ON CONFLICT DO NOTHING;

    IF v_dre_tributos IS NOT NULL AND v_total_tributos > 0 THEN
      INSERT INTO public.orcamento_contrato_linha
        (empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id, competencia, valor_previsto, source, locked, memoria_calculo)
      VALUES (v_contrato.empresa_id, v_orc_id, v_dre_tributos, v_contrato.centro_custo_id, v_competencia,
              v_total_tributos, 'calculado', true, 'Receita x '||v_param.pct_tributos_receita||'%')
      ON CONFLICT DO NOTHING;
    END IF;

    v_custo_total := v_custo_total + v_total_salarios + v_total_beneficios + v_total_encargos + v_total_tributos;

    INSERT INTO public.cronograma_faturamento
      (empresa_id, contrato_id, orcamento_contrato_id, competencia, data_emissao_prevista,
       data_recebimento_previsto, valor_previsto, status)
    VALUES (v_contrato.empresa_id, _contrato_id, v_orc_id, v_competencia,
            (v_competencia + interval '1 month - 5 days')::date,
            (v_competencia + interval '2 month')::date,
            v_contrato.faturamento_mensal, 'previsto')
    ON CONFLICT (contrato_id, competencia) DO UPDATE
      SET valor_previsto = EXCLUDED.valor_previsto, orcamento_contrato_id = v_orc_id;

    INSERT INTO public.fluxo_caixa_projetado
      (empresa_id, contrato_id, orcamento_contrato_id, data_prevista, tipo, valor, descricao, origem)
    VALUES (v_contrato.empresa_id, _contrato_id, v_orc_id,
            (v_competencia + interval '2 month')::date, 'entrada',
            v_contrato.faturamento_mensal, 'Recebimento previsto - '||v_contrato.numero, 'cronograma_faturamento');

    INSERT INTO public.fluxo_caixa_projetado
      (empresa_id, contrato_id, orcamento_contrato_id, data_prevista, tipo, valor, descricao, origem)
    VALUES (v_contrato.empresa_id, _contrato_id, v_orc_id,
            (v_competencia + interval '5 days')::date, 'saida',
            v_total_salarios + v_total_beneficios + v_total_encargos,
            'Folha + benef + encargos - '||v_contrato.numero, 'orcamento_calculado');

    v_competencia := (v_competencia + interval '1 month')::date;
    v_meses := v_meses + 1;
  END LOOP;

  UPDATE public.orcamento_contrato
     SET valor_receita_total = v_receita_total,
         valor_custo_total = v_custo_total,
         margem_estimada = v_receita_total - v_custo_total
   WHERE id = v_orc_id;

  RETURN jsonb_build_object(
    'orcamento_contrato_id', v_orc_id,
    'meses_gerados', v_meses,
    'receita_total', v_receita_total,
    'custo_total', v_custo_total,
    'margem', v_receita_total - v_custo_total
  );
END;
$$;

-- ── RPC aplicar_plano_mestre ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aplicar_plano_mestre(_empresa_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF NOT public.can_access(auth.uid(), 'plano-contas', 'incluir'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão para aplicar plano mestre nesta empresa';
  END IF;

  INSERT INTO public.conta_contabil
    (empresa_id, master_id, conta_reduzida, classificacao, descricao, tipo, natureza,
     exige_contrato, centro_custo_padrao, entra_fluxo, entra_orcamento, dre_linha_id, grupo_dre, ativo)
  SELECT _empresa_id, m.id, m.conta_reduzida, m.classificacao, m.descricao, m.tipo, m.natureza,
         m.exige_contrato, m.centro_custo_padrao, m.entra_fluxo, m.entra_orcamento, m.dre_linha_id, m.grupo_dre, m.ativo
    FROM public.plano_contas_master m
   WHERE NOT EXISTS (
     SELECT 1 FROM public.conta_contabil c
      WHERE c.empresa_id = _empresa_id AND c.classificacao = m.classificacao
   );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.conta_contabil c
     SET parent_id = p.id
    FROM public.conta_contabil p
   WHERE c.empresa_id = _empresa_id
     AND p.empresa_id = _empresa_id
     AND p.classificacao = regexp_replace(c.classificacao, '\.[^.]+$', '')
     AND p.classificacao <> c.classificacao
     AND (c.parent_id IS NULL OR c.parent_id <> p.id);

  RETURN v_count;
END;
$$;

-- ── RPC orcamento_criar_ciclo ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.orcamento_criar_ciclo(
  p_empresa_id uuid,
  p_ano integer,
  p_nome text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.can_access(auth.uid(), 'orcamento', 'incluir'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  INSERT INTO public.orcamento_ciclo(empresa_id, ano, nome, status, data_inicio, data_fim)
  VALUES (p_empresa_id, p_ano, p_nome, 'rascunho', make_date(p_ano,1,1), make_date(p_ano,12,31))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ── RPC orcamento_copiar_ano ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.orcamento_copiar_ano(
  p_empresa_id uuid,
  p_ano_origem integer,
  p_ano_destino integer,
  p_reajuste_pct numeric DEFAULT 0,
  p_nome_ciclo text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ciclo_id uuid;
  v_nome text;
  v_count integer;
BEGIN
  IF NOT public.can_access(auth.uid(), 'orcamento', 'incluir'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão para criar orçamento';
  END IF;

  v_nome := COALESCE(p_nome_ciclo, 'OBZ '||p_ano_destino||' v1');
  v_ciclo_id := public.orcamento_criar_ciclo(p_empresa_id, p_ano_destino, v_nome);

  INSERT INTO public.orcamento_contrato_linha(
    empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id,
    competencia, valor_previsto, source, locked, memoria_calculo,
    origem, ciclo_id, conta_contabil_id
  )
  SELECT
    empresa_id,
    NULL,
    dre_linha_id,
    centro_custo_id,
    (make_date(p_ano_destino, EXTRACT(MONTH FROM competencia)::int, 1)),
    valor_previsto * (1 + COALESCE(p_reajuste_pct,0)/100.0),
    'manual'::orcamento_origem_source,
    false,
    COALESCE(memoria_calculo,'') || ' [copiado de '||p_ano_origem||']',
    'manual'::orcamento_linha_origem,
    v_ciclo_id,
    conta_contabil_id
  FROM public.orcamento_contrato_linha
  WHERE empresa_id = p_empresa_id
    AND EXTRACT(YEAR FROM competencia)::int = p_ano_origem;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Copiadas % linhas para ciclo %', v_count, v_ciclo_id;
  RETURN v_ciclo_id;
END $$;

-- ── RPC nf_lancar_estoque ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.nf_lancar_estoque(_nf_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nf RECORD;
  v_item RECORD;
  v_almox uuid;
  v_count int := 0;
  v_pendente_count int;
BEGIN
  SELECT * INTO v_nf FROM nf_entrada WHERE id = _nf_id;
  IF v_nf IS NULL THEN RAISE EXCEPTION 'NF não encontrada'; END IF;

  IF NOT public.can_access(auth.uid(), 'nf-entrada', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão para lançar NF';
  END IF;

  IF v_nf.status = 'lancada_estoque' THEN
    RAISE EXCEPTION 'NF já lançada no estoque';
  END IF;

  IF v_nf.status NOT IN ('importada', 'validada') THEN
    RAISE EXCEPTION 'NF com status % não pode ser lançada', v_nf.status;
  END IF;

  SELECT COUNT(*) INTO v_pendente_count
    FROM nf_entrada_item
   WHERE nf_id = _nf_id AND status IN ('pendente_revisao', 'produto_novo');

  IF v_pendente_count > 0 THEN
    RAISE EXCEPTION 'Existem % item(ns) pendente(s) de revisão. Confirme antes de lançar.', v_pendente_count;
  END IF;

  v_almox := v_nf.almoxarifado_id;
  IF v_almox IS NULL THEN
    SELECT id INTO v_almox FROM almoxarifado
     WHERE empresa_id = v_nf.empresa_id AND is_matriz = true LIMIT 1;
  END IF;
  IF v_almox IS NULL THEN
    RAISE EXCEPTION 'Almoxarifado não definido e Matriz não encontrada';
  END IF;

  FOR v_item IN SELECT * FROM nf_entrada_item WHERE nf_id = _nf_id ORDER BY numero_item LOOP
    IF v_item.produto_id IS NULL THEN
      RAISE EXCEPTION 'Item % sem produto vinculado', v_item.numero_item;
    END IF;

    INSERT INTO estoque_movimento
      (empresa_id, almoxarifado_id, produto_id, tipo, origem, origem_id,
       quantidade, custo_unitario, contrato_id, centro_custo_id,
       documento, observacoes, user_id)
    VALUES
      (v_nf.empresa_id, v_almox, v_item.produto_id, 'entrada', 'nf_entrada', _nf_id,
       v_item.quantidade, v_item.valor_unitario, v_nf.contrato_id, v_nf.centro_custo_id,
       'NF ' || v_nf.numero || '/' || COALESCE(v_nf.serie, '1'),
       'Entrada via NF ' || v_nf.numero, auth.uid());

    v_count := v_count + 1;
  END LOOP;

  UPDATE nf_entrada SET
    status = 'lancada_estoque',
    lancado_por = auth.uid(),
    lancado_em = now(),
    almoxarifado_id = v_almox
  WHERE id = _nf_id;

  INSERT INTO nf_entrada_log (nf_id, empresa_id, evento, detalhes, user_id)
  VALUES (_nf_id, v_nf.empresa_id, 'lancada_estoque',
          jsonb_build_object('itens_lancados', v_count, 'almoxarifado_id', v_almox),
          auth.uid());

  RETURN jsonb_build_object('itens_lancados', v_count, 'almoxarifado_id', v_almox, 'nf_id', _nf_id);
END $$;

-- ── RPC recebimento_confirmar ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recebimento_confirmar(_recebimento_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $func$
DECLARE
  v_receb RECORD;
  v_nf RECORD;
  v_item RECORD;
  v_almox uuid;
  v_count_lancado int := 0;
  v_count_ocorrencias int := 0;
  v_tipo_ocor recebimento_ocorrencia_tipo;
  v_descr text;
  v_tem_divergencia boolean := false;
BEGIN
  SELECT * INTO v_receb FROM recebimento_nf WHERE id = _recebimento_id;
  IF v_receb IS NULL THEN RAISE EXCEPTION 'Recebimento não encontrado'; END IF;

  IF NOT public.can_access(auth.uid(), 'recebimentos', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão para confirmar recebimento';
  END IF;

  IF v_receb.status IN ('recebido','recebido_com_ocorrencia','cancelado') THEN
    RAISE EXCEPTION 'Recebimento já finalizado (%)', v_receb.status;
  END IF;

  SELECT * INTO v_nf FROM nf_entrada WHERE id = v_receb.nf_id;
  v_almox := v_receb.almoxarifado_id;
  IF v_almox IS NULL THEN
    SELECT id INTO v_almox FROM almoxarifado WHERE empresa_id=v_receb.empresa_id AND is_matriz=true LIMIT 1;
  END IF;

  FOR v_item IN
    SELECT ri.*, p.codigo AS produto_codigo
      FROM recebimento_nf_item ri
      LEFT JOIN produto p ON p.id = ri.produto_id
     WHERE ri.recebimento_id = _recebimento_id
  LOOP
    IF v_item.produto_id IS NULL THEN
      RAISE EXCEPTION 'Item sem produto vinculado — confira a NF antes';
    END IF;

    IF v_item.qtd_recebida > 0 THEN
      INSERT INTO estoque_movimento
        (empresa_id, almoxarifado_id, produto_id, tipo, origem, origem_id,
         quantidade, custo_unitario, contrato_id, centro_custo_id,
         documento, observacoes, user_id)
      VALUES
        (v_receb.empresa_id, v_almox, v_item.produto_id, 'entrada', 'recebimento_nf', _recebimento_id,
         v_item.qtd_recebida,
         COALESCE((SELECT valor_unitario FROM nf_entrada_item WHERE id=v_item.nf_item_id),0),
         v_nf.contrato_id, v_nf.centro_custo_id,
         'NF '||v_nf.numero||'/'||COALESCE(v_nf.serie,'1')||' (recebimento)',
         'Entrada via recebimento físico', auth.uid());
      v_count_lancado := v_count_lancado + 1;
    END IF;

    IF v_item.qtd_recebida <> v_item.qtd_nf OR v_item.condicao <> 'ok' THEN
      v_tem_divergencia := true;
      IF v_item.condicao = 'ok' AND v_item.qtd_recebida < v_item.qtd_nf THEN
        v_tipo_ocor := 'quantidade'; v_descr := 'Faltante: NF='||v_item.qtd_nf||' recebido='||v_item.qtd_recebida;
      ELSIF v_item.condicao = 'ok' AND v_item.qtd_recebida > v_item.qtd_nf THEN
        v_tipo_ocor := 'quantidade'; v_descr := 'Excedente: NF='||v_item.qtd_nf||' recebido='||v_item.qtd_recebida;
      ELSIF v_item.condicao = 'avariado' THEN
        v_tipo_ocor := 'qualidade'; v_descr := 'Avariado. '||COALESCE(v_item.observacoes,'');
      ELSIF v_item.condicao = 'trocado' THEN
        v_tipo_ocor := 'produto_trocado'; v_descr := 'Produto trocado. '||COALESCE(v_item.observacoes,'');
      ELSIF v_item.condicao = 'faltante' THEN
        v_tipo_ocor := 'quantidade'; v_descr := 'Item faltante. '||COALESCE(v_item.observacoes,'');
      ELSIF v_item.condicao = 'excedente' THEN
        v_tipo_ocor := 'quantidade'; v_descr := 'Item excedente. '||COALESCE(v_item.observacoes,'');
      ELSE
        v_tipo_ocor := 'outro'; v_descr := 'Divergência: '||COALESCE(v_item.observacoes,'');
      END IF;

      INSERT INTO recebimento_ocorrencia (empresa_id, recebimento_id, recebimento_item_id, tipo, descricao, aberta_por)
      VALUES (v_receb.empresa_id, _recebimento_id, v_item.id, v_tipo_ocor, v_descr, auth.uid());
      v_count_ocorrencias := v_count_ocorrencias + 1;
    END IF;
  END LOOP;

  UPDATE recebimento_nf SET
    status = CASE WHEN v_tem_divergencia THEN 'recebido_com_ocorrencia'::recebimento_status ELSE 'recebido'::recebimento_status END,
    recebido_por = auth.uid(),
    finalizado_em = now()
  WHERE id = _recebimento_id;

  UPDATE nf_entrada SET status='lancada_estoque', lancado_por=auth.uid(), lancado_em=now()
   WHERE id = v_receb.nf_id AND status <> 'lancada_estoque';

  RETURN jsonb_build_object(
    'itens_lancados', v_count_lancado,
    'ocorrencias_abertas', v_count_ocorrencias,
    'recebimento_id', _recebimento_id
  );
END $func$;

-- ── RPC cotacao_calcular_score ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cotacao_calcular_score(_cotacao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cot RECORD; v_param RECORD;
  v_min_preco numeric; v_min_pe int; v_max_pp int;
  v_prop RECORD;
  v_score numeric; v_s_preco numeric; v_s_pe numeric; v_s_pp numeric;
  v_count int := 0;
BEGIN
  SELECT * INTO v_cot FROM cotacao WHERE id = _cotacao_id;
  IF v_cot IS NULL THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;

  IF NOT public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_param FROM parametro_cotacao WHERE empresa_id = v_cot.empresa_id;
  IF v_param IS NULL THEN
    INSERT INTO parametro_cotacao (empresa_id) VALUES (v_cot.empresa_id) RETURNING * INTO v_param;
  END IF;

  SELECT MIN(NULLIF(valor_total,0)),
         MIN(NULLIF(prazo_entrega_dias,0)),
         MAX(NULLIF(prazo_pagamento_dias,0))
    INTO v_min_preco, v_min_pe, v_max_pp
    FROM cotacao_proposta
   WHERE cotacao_id = _cotacao_id AND valor_total > 0;

  IF v_min_preco IS NULL THEN
    RETURN jsonb_build_object('propostas_avaliadas', 0);
  END IF;

  FOR v_prop IN SELECT * FROM cotacao_proposta WHERE cotacao_id = _cotacao_id LOOP
    IF v_prop.valor_total <= 0 THEN
      UPDATE cotacao_proposta SET score = 0, ranking = NULL WHERE id = v_prop.id;
      CONTINUE;
    END IF;
    v_s_preco := (v_min_preco / v_prop.valor_total) * 100.0;
    IF v_prop.prazo_entrega_dias IS NULL OR v_prop.prazo_entrega_dias = 0 OR v_min_pe IS NULL THEN
      v_s_pe := 50;
    ELSE
      v_s_pe := (v_min_pe::numeric / v_prop.prazo_entrega_dias) * 100.0;
    END IF;
    IF v_prop.prazo_pagamento_dias IS NULL OR v_max_pp IS NULL OR v_max_pp = 0 THEN
      v_s_pp := 50;
    ELSE
      v_s_pp := (v_prop.prazo_pagamento_dias::numeric / v_max_pp) * 100.0;
    END IF;
    v_score := (v_s_preco * v_param.peso_preco
              + v_s_pe    * v_param.peso_prazo_entrega
              + v_s_pp    * v_param.peso_prazo_pagamento) / 100.0;
    UPDATE cotacao_proposta SET score = ROUND(v_score, 2) WHERE id = v_prop.id;
    v_count := v_count + 1;
  END LOOP;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC NULLS LAST, valor_total ASC) AS rk
      FROM cotacao_proposta WHERE cotacao_id = _cotacao_id
  )
  UPDATE cotacao_proposta cp SET ranking = r.rk
    FROM ranked r WHERE cp.id = r.id;

  RETURN jsonb_build_object('propostas_avaliadas', v_count, 'pesos',
    jsonb_build_object('preco', v_param.peso_preco, 'prazo_entrega', v_param.peso_prazo_entrega, 'prazo_pagamento', v_param.peso_prazo_pagamento));
END $$;

-- ── RPC cotacao_fechar ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cotacao_fechar(
  _cotacao_id uuid,
  _vencedor_fornecedor_id uuid,
  _motivo_dispensa text DEFAULT NULL,
  _justificativa text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cot RECORD; v_param RECORD; v_prop RECORD;
  v_n_propostas int; v_pc_id uuid; v_pc_numero text;
  v_item RECORD; v_rc_ids uuid[]; v_first_rc uuid;
BEGIN
  SELECT * INTO v_cot FROM cotacao WHERE id = _cotacao_id;
  IF v_cot IS NULL THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF v_cot.status = 'fechada' THEN RAISE EXCEPTION 'Cotação já fechada'; END IF;

  IF NOT public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão para fechar cotação';
  END IF;

  SELECT * INTO v_param FROM parametro_cotacao WHERE empresa_id = v_cot.empresa_id;
  IF v_param IS NULL THEN
    INSERT INTO parametro_cotacao (empresa_id) VALUES (v_cot.empresa_id) RETURNING * INTO v_param;
  END IF;

  SELECT COUNT(*) INTO v_n_propostas
    FROM cotacao_proposta WHERE cotacao_id = _cotacao_id AND valor_total > 0;
  IF v_n_propostas = 0 THEN RAISE EXCEPTION 'Não há propostas válidas para fechar'; END IF;

  SELECT * INTO v_prop FROM cotacao_proposta
   WHERE cotacao_id = _cotacao_id AND fornecedor_id = _vencedor_fornecedor_id;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'Proposta do vencedor não encontrada'; END IF;

  IF v_n_propostas < v_param.min_propostas AND v_prop.valor_total > v_param.valor_dispensa THEN
    IF _motivo_dispensa IS NULL OR _justificativa IS NULL OR length(_justificativa) < 10 THEN
      RAISE EXCEPTION 'Cotação com % propostas (mínimo %): informe motivo de dispensa e justificativa (mín 10 chars)',
        v_n_propostas, v_param.min_propostas;
    END IF;
    IF _motivo_dispensa NOT IN ('fornecedor_exclusivo','emergencia','valor_baixo','outro') THEN
      RAISE EXCEPTION 'motivo_dispensa inválido (use: fornecedor_exclusivo|emergencia|valor_baixo|outro)';
    END IF;
    IF _motivo_dispensa = 'fornecedor_exclusivo' AND NOT v_param.permite_fornecedor_exclusivo THEN
      RAISE EXCEPTION 'Empresa não permite dispensa por fornecedor exclusivo';
    END IF;
    IF _motivo_dispensa = 'emergencia' AND NOT v_param.permite_emergencia THEN
      RAISE EXCEPTION 'Empresa não permite dispensa por emergência';
    END IF;
  END IF;

  SELECT array_agg(requisicao_id) INTO v_rc_ids FROM cotacao_rc WHERE cotacao_id = _cotacao_id;
  IF v_rc_ids IS NOT NULL AND array_length(v_rc_ids,1) > 0 THEN
    v_first_rc := v_rc_ids[1];
  END IF;

  v_pc_numero := 'PC-' || LPAD(nextval('pc_cot_numero_seq')::text, 6, '0');

  INSERT INTO pedido_compra (empresa_id, numero, fornecedor_id, requisicao_id, status, data_emissao,
                              condicao_pagamento, valor_total, observacoes)
  VALUES (v_cot.empresa_id, v_pc_numero, _vencedor_fornecedor_id, v_first_rc, 'aprovado', CURRENT_DATE,
          v_prop.condicoes_pagamento, v_prop.valor_total,
          'Gerado da cotação ' || v_cot.numero ||
            CASE WHEN _justificativa IS NOT NULL THEN ' — ' || _justificativa ELSE '' END)
  RETURNING id INTO v_pc_id;

  FOR v_item IN
    SELECT ci.*, pi.preco_unitario, pi.ipi_pct, pi.desconto_pct
      FROM cotacao_item ci
      LEFT JOIN cotacao_proposta_item pi ON pi.cotacao_item_id = ci.id AND pi.proposta_id = v_prop.id
     WHERE ci.cotacao_id = _cotacao_id
     ORDER BY ci.ordem
  LOOP
    INSERT INTO pedido_compra_item (pedido_id, produto_servico_id, descricao, quantidade, preco_unitario, valor_total)
    VALUES (v_pc_id, v_item.produto_servico_id, v_item.descricao, v_item.quantidade,
            COALESCE(v_item.preco_unitario,0),
            COALESCE(v_item.preco_unitario,0) * v_item.quantidade
              * (1 - COALESCE(v_item.desconto_pct,0)/100.0)
              * (1 + COALESCE(v_item.ipi_pct,0)/100.0));
  END LOOP;

  UPDATE cotacao_fornecedor SET status = 'perdedor'
   WHERE cotacao_id = _cotacao_id AND fornecedor_id <> _vencedor_fornecedor_id;
  UPDATE cotacao_fornecedor SET status = 'vencedor'
   WHERE cotacao_id = _cotacao_id AND fornecedor_id = _vencedor_fornecedor_id;

  UPDATE cotacao SET
    status = 'fechada',
    vencedor_fornecedor_id = _vencedor_fornecedor_id,
    motivo_dispensa = _motivo_dispensa,
    justificativa_dispensa = _justificativa,
    pedido_compra_ids = ARRAY[v_pc_id],
    fechado_por = auth.uid(),
    fechado_em = now()
  WHERE id = _cotacao_id;

  IF v_rc_ids IS NOT NULL THEN
    BEGIN
      UPDATE requisicao_compra SET status_v2 = 'cotada'
       WHERE id = ANY(v_rc_ids) AND status_v2::text IN ('em_cotacao','aprovada','aprovada_total');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'pedido_compra_id', v_pc_id,
    'pedido_compra_numero', v_pc_numero,
    'cotacao_id', _cotacao_id,
    'vencedor_fornecedor_id', _vencedor_fornecedor_id,
    'valor_total', v_prop.valor_total,
    'propostas_validas', v_n_propostas
  );
END $$;

-- ── RPC emitir_titulo_de_cronograma ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.emitir_titulo_de_cronograma(
  _cronograma_id uuid,
  _data_vencimento date DEFAULT NULL,
  _meio_cobranca titulo_receber_meio DEFAULT 'boleto',
  _conta_bancaria_id uuid DEFAULT NULL,
  _sacado_nome text DEFAULT NULL,
  _sacado_documento text DEFAULT NULL,
  _sacado_email text DEFAULT NULL,
  _descricao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parc RECORD;
  v_contrato RECORD;
  v_titulo_id uuid;
  v_numero text;
  v_venc date;
BEGIN
  SELECT * INTO v_parc FROM cronograma_faturamento WHERE id = _cronograma_id;
  IF v_parc IS NULL THEN RAISE EXCEPTION 'Parcela do cronograma não encontrada'; END IF;

  SELECT * INTO v_contrato FROM contrato WHERE id = v_parc.contrato_id;
  IF v_contrato IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;

  IF NOT public.can_access(auth.uid(), 'contas-receber', 'incluir'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão para faturar';
  END IF;

  IF v_parc.valor_previsto IS NULL OR v_parc.valor_previsto <= 0 THEN
    RAISE EXCEPTION 'Parcela com valor inválido';
  END IF;

  IF v_parc.status::text IN ('cancelado','recebido') THEN
    RAISE EXCEPTION 'Parcela em status % não pode ser emitida', v_parc.status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM titulo_receber
     WHERE cronograma_id = _cronograma_id AND status <> 'cancelado'
  ) THEN
    RAISE EXCEPTION 'Parcela já possui título emitido';
  END IF;

  v_venc := COALESCE(_data_vencimento, v_parc.data_recebimento_previsto, v_parc.competencia + INTERVAL '30 days');
  v_numero := 'TR-' || to_char(now(),'YYYY') || '-' || LPAD(nextval('titulo_receber_numero_seq')::text, 6, '0');

  INSERT INTO titulo_receber (
    empresa_id, numero, numero_documento, cliente_nome, sacado_nome, sacado_documento, sacado_email,
    contrato_id, cronograma_id, competencia, valor, valor_recebido, data_emissao, data_vencimento,
    status, meio_cobranca, conta_bancaria_id, centro_custo_id, descricao, created_by
  ) VALUES (
    v_contrato.empresa_id, v_numero, v_numero,
    COALESCE(_sacado_nome, v_contrato.orgao, 'Cliente'),
    COALESCE(_sacado_nome, v_contrato.orgao, 'Cliente'),
    _sacado_documento, _sacado_email,
    v_parc.contrato_id, _cronograma_id, v_parc.competencia, v_parc.valor_previsto, 0,
    CURRENT_DATE, v_venc,
    'aberto'::titulo_status, _meio_cobranca, _conta_bancaria_id,
    v_contrato.centro_custo_id,
    COALESCE(_descricao, 'Faturamento contrato ' || v_contrato.numero || ' - competência ' || to_char(v_parc.competencia,'MM/YYYY')),
    auth.uid()
  ) RETURNING id INTO v_titulo_id;

  UPDATE cronograma_faturamento
     SET status = 'emitido',
         valor_emitido = v_parc.valor_previsto,
         numero_nf = COALESCE(numero_nf, v_numero),
         updated_at = now()
   WHERE id = _cronograma_id;

  RETURN jsonb_build_object('titulo_id', v_titulo_id, 'numero', v_numero, 'cronograma_id', _cronograma_id);
END $$;

-- ── RPC cnab_gerar_remessa_cobranca ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cnab_gerar_remessa_cobranca(_conta_bancaria_id uuid, _boleto_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conta RECORD;
  v_emp RECORD;
  v_b RECORD;
  v_remessa_id uuid;
  v_remessa_numero text;
  v_seq int;
  v_qtd int := 0;
  v_valor numeric(15,2) := 0;
  v_arq text := '';
  v_data text := to_char(now(),'DDMMYYYY');
  v_hora text := to_char(now(),'HH24MISS');
  v_cnpj text;
  v_boleto_id uuid;
  v_ordem int := 0;
  v_titulo RECORD;
BEGIN
  SELECT * INTO v_conta FROM conta_bancaria WHERE id = _conta_bancaria_id;
  IF v_conta IS NULL THEN RAISE EXCEPTION 'Conta bancária não encontrada'; END IF;

  IF NOT public.can_access(auth.uid(), 'contas-receber', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão para gerar remessa nesta conta';
  END IF;

  IF _boleto_ids IS NULL OR array_length(_boleto_ids,1) IS NULL OR array_length(_boleto_ids,1)=0 THEN
    RAISE EXCEPTION 'Selecione ao menos 1 boleto';
  END IF;

  IF v_conta.cnab_convenio IS NULL OR v_conta.cnab_codigo_empresa IS NULL THEN
    RAISE EXCEPTION 'Cadastro CNAB incompleto: configure convênio e código da empresa na conta bancária';
  END IF;

  SELECT * INTO v_emp FROM empresas WHERE id = v_conta.empresa_id;
  v_cnpj := regexp_replace(COALESCE(v_emp.cnpj,''),'[^0-9]','','g');
  v_seq := COALESCE(v_conta.cnab_proxima_sequencia, 1);
  v_remessa_numero := 'COBR-' || LPAD(nextval('remessa_cnab_seq')::text,6,'0');

  v_arq := '# CNAB 240 — REMESSA COBRANCA ' || v_remessa_numero || E'\n';
  v_arq := v_arq || '# Banco ' || COALESCE(v_conta.banco_nome,'') || ' Ag/Cc ' || v_conta.agencia || '/' || v_conta.conta || E'\n';
  v_arq := v_arq || '# Empresa ' || COALESCE(v_emp.razao_social, v_emp.nome_fantasia, '') || ' CNPJ ' || v_cnpj || E'\n';
  v_arq := v_arq || '# Gerado em ' || v_data || ' ' || v_hora || E'\n';

  FOREACH v_boleto_id IN ARRAY _boleto_ids LOOP
    v_ordem := v_ordem + 1;
    SELECT b.*, t.numero AS titulo_numero, t.valor AS titulo_valor, t.data_vencimento, t.sacado_nome, t.sacado_documento
      INTO v_b
      FROM cobranca_boleto b
      JOIN titulo_receber t ON t.id = b.titulo_id
      WHERE b.id = v_boleto_id AND b.empresa_id = v_conta.empresa_id;
    IF v_b.id IS NULL THEN CONTINUE; END IF;

    v_qtd := v_qtd + 1;
    v_valor := v_valor + COALESCE(v_b.titulo_valor,0);

    v_arq := v_arq ||
      LPAD(v_ordem::text,5,'0') || ';' ||
      rpad(v_b.nosso_numero,20,' ') || ';' ||
      rpad(COALESCE(v_b.titulo_numero,''),15,' ') || ';' ||
      to_char(v_b.data_vencimento,'DDMMYYYY') || ';' ||
      LPAD((COALESCE(v_b.titulo_valor,0)*100)::bigint::text,15,'0') || ';' ||
      rpad(left(COALESCE(v_b.sacado_nome,''),40),40,' ') || ';' ||
      regexp_replace(COALESCE(v_b.sacado_documento,''),'[^0-9]','','g') ||
      E'\n';
  END LOOP;

  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'Nenhum boleto válido encontrado entre os IDs informados';
  END IF;

  INSERT INTO remessa_cnab(
    empresa_id, conta_bancaria_id, formato, arquivo_nome, arquivo_conteudo,
    arquivo_hash, data_geracao_arquivo, status, qtd_registros, valor_total, origem
  ) VALUES (
    v_conta.empresa_id, _conta_bancaria_id, 'cnab240'::retorno_formato,
    v_remessa_numero || '.rem', v_arq,
    encode(digest(v_arq,'sha256'),'hex'),
    now(), 'gerada', v_qtd, v_valor, 'cobranca'
  )
  RETURNING id INTO v_remessa_id;

  v_ordem := 0;
  FOREACH v_boleto_id IN ARRAY _boleto_ids LOOP
    SELECT b.titulo_id, t.valor INTO v_b FROM cobranca_boleto b JOIN titulo_receber t ON t.id=b.titulo_id WHERE b.id=v_boleto_id;
    IF v_b.titulo_id IS NULL THEN CONTINUE; END IF;
    v_ordem := v_ordem + 1;
    INSERT INTO remessa_cnab_titulo(remessa_id, titulo_id, valor_remessa, ordem)
      VALUES (v_remessa_id, v_b.titulo_id, COALESCE(v_b.valor,0), v_ordem)
      ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE cobranca_boleto SET status_registro='enviado', enviado_em=now()
   WHERE id = ANY(_boleto_ids);

  UPDATE conta_bancaria SET cnab_proxima_sequencia = v_seq + 1 WHERE id = _conta_bancaria_id;

  RETURN jsonb_build_object(
    'remessa_id', v_remessa_id,
    'numero', v_remessa_numero,
    'qtd', v_qtd,
    'valor_total', v_valor
  );
END;
$function$;

-- ── RPC fcr_promover_lancamento ──────────────────────────────────────────
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
  IF NOT public.can_access(v_uid, 'administracao', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
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

-- ── RPC _bdi_assert_responsavel (helper interno usado por ~12 RPCs do
--    BDI/Composição — corrigir só esta já cobre todas elas). Removido o
--    user_pode_atuar_empresa; has_permissao(...) já cobre o acesso (e já
--    foi corrigida no complemento anterior pra rodar 100% via can_access).
--    Mantida a regra de "só o responsável atual pode alterar" — isso é
--    integridade de fluxo de trabalho (dono do registro), não bypass de
--    tenant/admin. ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._bdi_assert_responsavel(
  p_licitacao_id uuid,
  p_acao text
)
RETURNS TABLE(empresa_id uuid, responsavel_user_id uuid, status public.licitacao_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_emp uuid;
  v_resp uuid;
  v_st  public.licitacao_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000';
  END IF;

  SELECT l.empresa_id, l.responsavel_user_id, l.status
    INTO v_emp, v_resp, v_st
  FROM public.licitacao l
  WHERE l.id = p_licitacao_id;

  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'LICITACAO_NAO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;

  IF p_acao = 'visualizar' THEN
    IF NOT public.has_permissao(v_uid, 'licitacoes', 'visualizar', 'composicao') THEN
      RAISE EXCEPTION 'SEM_PERMISSAO_VISUALIZAR' USING ERRCODE = '42501';
    END IF;
  ELSIF p_acao = 'alterar' THEN
    IF NOT public.has_permissao(v_uid, 'licitacoes', 'alterar', 'composicao') THEN
      RAISE EXCEPTION 'SEM_PERMISSAO_ALTERAR' USING ERRCODE = '42501';
    END IF;
    IF v_resp IS NULL OR v_resp <> v_uid THEN
      RAISE EXCEPTION 'NAO_E_RESPONSAVEL_ATUAL' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'ACAO_INVALIDA: %', p_acao USING ERRCODE = '22023';
  END IF;

  empresa_id := v_emp;
  responsavel_user_id := v_resp;
  status := v_st;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public._bdi_assert_responsavel(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._bdi_assert_responsavel(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public._bdi_assert_responsavel(uuid,text) FROM authenticated;

NOTIFY pgrst, 'reload schema';
