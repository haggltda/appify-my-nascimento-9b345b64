-- Fix integration_promote_batch to handle colaborador_full_v1 (colaboradores)
-- Also adds colaborador_ativo_v1 -> alocacao_colaborador (placeholder noop for now since alocação requires contrato/posto resolution)

CREATE OR REPLACE FUNCTION public.integration_promote_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_batch    record;
  v_layout   record;
  v_empresa  uuid;
  v_promoted int := 0;
  v_skipped  int := 0;
  v_msg      text := '';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_batch FROM public.integration_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'lote não encontrado'; END IF;
  IF v_batch.status <> 'aprovado' THEN
    RAISE EXCEPTION 'lote precisa estar aprovado (status atual: %)', v_batch.status;
  END IF;

  v_empresa := v_batch.empresa_id;

  FOR v_layout IN
    SELECT DISTINCT l.codigo, l.staging_tabela, l.destino_tabela
      FROM public.integration_batch_files bf
      JOIN public.integration_layouts l ON l.id = bf.layout_detectado_id
     WHERE bf.batch_id = p_batch_id
       AND bf.layout_detectado_id IS NOT NULL
  LOOP
    IF v_layout.codigo = 'licitacoes_v1' THEN
      INSERT INTO public.licitacao
        (empresa_id, numero, objeto, orgao, modalidade, abertura, observacoes,
         status, batch_id, origem_carga)
      SELECT v_empresa,
             COALESCE(NULLIF(s.edital,''), 'LIC-' || s.linha_origem),
             s.objeto, NULL, s.fase, s.data_sessao,
             trim(both ' ' from concat_ws(' | ', s.cidade, s.uf, s.status_obs, s.empresa_obs)),
             'em_andamento'::licitacao_status, p_batch_id, 'integracao'
        FROM public.stg_licitacoes s
       WHERE s.batch_id = p_batch_id;
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('licitacoes_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'contrato_master_v1' THEN
      INSERT INTO public.contrato
        (empresa_id, numero, objeto, vigencia_inicio, faturamento_mensal,
         observacoes, status, batch_id)
      SELECT v_empresa,
             COALESCE(NULLIF(s.numero_edital,''), 'CT-' || s.linha_origem),
             COALESCE(s.contrato_nome, 'Contrato sem nome'),
             COALESCE(s.data_inicio, CURRENT_DATE),
             COALESCE(s.valor_mensal, 0),
             concat_ws(' | ', 'Resp: ' || COALESCE(s.responsavel,''),
                              'Cidade: ' || COALESCE(s.cidade,''),
                              'Func: ' || COALESCE(s.quant_funcionarios::text,'')),
             'ativo'::contrato_status, p_batch_id
        FROM public.stg_contratos_master s
       WHERE s.batch_id = p_batch_id
         AND s.contrato_resolvido_id IS NULL;
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('contrato_master_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'fluxo_realizado_v1' THEN
      INSERT INTO public.realizado_lancamentos
        (empresa_id, data_lancamento, valor, descricao, contraparte,
         classificadores, hash_dedup, batch_id, pendente_conta_contabil)
      SELECT v_empresa,
             COALESCE(s.data_lancamento, CURRENT_DATE),
             COALESCE(s.valor, 0),
             COALESCE(s.historico, s.classificacao),
             s.empresa_origem,
             jsonb_build_object(
               'classificacao', s.classificacao,
               'tipo', s.tipo,
               'centro_custo', s.centro_custo_origem,
               'banco', s.banco_origem,
               'forma_pagamento', s.forma_pagamento_origem
             ),
             encode(digest(
               coalesce(s.id_origem,'') || '|' ||
               coalesce(s.data_lancamento::text,'') || '|' ||
               coalesce(s.valor::text,'') || '|' ||
               coalesce(s.historico,''), 'sha256'), 'hex'),
             p_batch_id,
             (s.conta_contabil_resolvida_id IS NULL)
        FROM public.stg_fluxo_caixa_realizado s
       WHERE s.batch_id = p_batch_id
       ON CONFLICT (hash_dedup) DO NOTHING;
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('fluxo_realizado_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'colaborador_full_v1' THEN
      -- Promote staging colaboradores -> public.colaborador
      -- Dedupe by (empresa_id, cpf_normalized) within source and against existing rows
      WITH src AS (
        SELECT
          v_empresa AS empresa_id,
          NULLIF(regexp_replace(coalesce(s.cpf,''), '[^0-9]', '', 'g'), '') AS cpf_norm,
          NULLIF(trim(s.nome), '') AS nome,
          s.linha_origem,
          NULLIF(trim(s.filial), '') AS filial,
          NULLIF(trim(s.situacao), '') AS situacao
        FROM public.stg_colaboradores_base s
        WHERE s.batch_id = p_batch_id
          AND coalesce(s.valido, true) = true
      ), src_clean AS (
        SELECT * FROM src
         WHERE cpf_norm IS NOT NULL AND nome IS NOT NULL
      ), src_dedup AS (
        SELECT DISTINCT ON (empresa_id, cpf_norm)
               empresa_id, cpf_norm, nome, linha_origem, filial, situacao
          FROM src_clean
         ORDER BY empresa_id, cpf_norm, linha_origem
      )
      INSERT INTO public.colaborador
        (empresa_id, cpf, nome, matricula, data_admissao, status, observacoes, batch_id)
      SELECT
        d.empresa_id,
        d.cpf_norm,
        d.nome,
        NULL,
        CURRENT_DATE,
        CASE
          WHEN lower(coalesce(d.situacao,'')) LIKE '%demit%' THEN 'demitido'::colab_status
          WHEN lower(coalesce(d.situacao,'')) LIKE '%afast%' THEN 'afastado'::colab_status
          WHEN lower(coalesce(d.situacao,'')) LIKE '%feria%' THEN 'ferias'::colab_status
          ELSE 'ativo'::colab_status
        END,
        concat_ws(' | ',
          NULLIF('Filial: ' || coalesce(d.filial,''), 'Filial: '),
          NULLIF('Situação: ' || coalesce(d.situacao,''), 'Situação: ')
        ),
        p_batch_id
      FROM src_dedup d
      ON CONFLICT (empresa_id, cpf) DO NOTHING;
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('colaborador_full_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'colaborador_ativo_v1' THEN
      v_skipped := v_skipped + 1;
      v_msg := v_msg || 'colaborador_ativo_v1: requer resolução de contrato/posto (não promovido automaticamente); ';

    ELSE
      v_skipped := v_skipped + 1;
      v_msg := v_msg || format('%s: promoção não implementada; ', v_layout.codigo);
    END IF;
  END LOOP;

  UPDATE public.integration_batches
     SET status = 'carregado'::integ_batch_status,
         observacoes = COALESCE(observacoes,'') || E'\n[CARREGADO] ' || v_msg,
         updated_at = now()
   WHERE id = p_batch_id;

  RETURN jsonb_build_object('layouts_skipped', v_skipped, 'detalhe', v_msg);
END;
$function$;

-- Backfill: promote the existing batch that was marked carregado but never inserted into colaborador
DO $$
DECLARE
  v_bid uuid;
  v_emp uuid;
  v_count int;
BEGIN
  SELECT id, empresa_id INTO v_bid, v_emp
    FROM public.integration_batches
   WHERE codigo = 'BATCH-2026-04-30-QU2C';

  IF v_bid IS NOT NULL THEN
    WITH src AS (
      SELECT
        v_emp AS empresa_id,
        NULLIF(regexp_replace(coalesce(s.cpf,''), '[^0-9]', '', 'g'), '') AS cpf_norm,
        NULLIF(trim(s.nome), '') AS nome,
        s.linha_origem,
        NULLIF(trim(s.filial), '') AS filial,
        NULLIF(trim(s.situacao), '') AS situacao
      FROM public.stg_colaboradores_base s
      WHERE s.batch_id = v_bid
        AND coalesce(s.valido, true) = true
    ), src_clean AS (
      SELECT * FROM src WHERE cpf_norm IS NOT NULL AND nome IS NOT NULL
    ), src_dedup AS (
      SELECT DISTINCT ON (empresa_id, cpf_norm)
             empresa_id, cpf_norm, nome, linha_origem, filial, situacao
        FROM src_clean
       ORDER BY empresa_id, cpf_norm, linha_origem
    )
    INSERT INTO public.colaborador
      (empresa_id, cpf, nome, matricula, data_admissao, status, observacoes, batch_id)
    SELECT
      d.empresa_id, d.cpf_norm, d.nome, NULL, CURRENT_DATE,
      CASE
        WHEN lower(coalesce(d.situacao,'')) LIKE '%demit%' THEN 'demitido'::colab_status
        WHEN lower(coalesce(d.situacao,'')) LIKE '%afast%' THEN 'afastado'::colab_status
        WHEN lower(coalesce(d.situacao,'')) LIKE '%feria%' THEN 'ferias'::colab_status
        ELSE 'ativo'::colab_status
      END,
      concat_ws(' | ',
        NULLIF('Filial: ' || coalesce(d.filial,''), 'Filial: '),
        NULLIF('Situação: ' || coalesce(d.situacao,''), 'Situação: ')
      ),
      v_bid
    FROM src_dedup d
    ON CONFLICT (empresa_id, cpf) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.integration_batches
       SET observacoes = COALESCE(observacoes,'') || E'\n[BACKFILL colaboradores] ' || v_count::text || ' linhas inseridas via migration.',
           updated_at = now()
     WHERE id = v_bid;
  END IF;
END$$;