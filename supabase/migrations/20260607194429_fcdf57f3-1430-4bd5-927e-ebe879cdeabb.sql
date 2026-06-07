-- =====================================================================
-- P3.H0-D1 v4 — Vínculo banco→contábil HAGG + inativação lógica
-- batch_id: p3h0-d1-vinculo-banco-contabil-20260605
-- =====================================================================

-- 1) DDL da tabela de auditoria
CREATE TABLE IF NOT EXISTS public.aud_p3h0_conta_bancaria_snapshot (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                   text NOT NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  conta_bancaria_id          uuid NOT NULL,
  empresa_id                 uuid,
  banco_codigo               text,
  banco_nome                 text,
  ativa_anterior             boolean,
  conta_contabil_id_anterior uuid,
  ativa_nova                 boolean,
  conta_contabil_id_nova     uuid,
  acao                       text NOT NULL,
  motivo                     text NOT NULL,
  rollback_aplicado          boolean NOT NULL DEFAULT false,
  rollback_em                timestamptz,
  observacao                 text
);

CREATE INDEX        IF NOT EXISTS ix_aud_p3h0_batch    ON public.aud_p3h0_conta_bancaria_snapshot(batch_id);
CREATE INDEX        IF NOT EXISTS ix_aud_p3h0_cb       ON public.aud_p3h0_conta_bancaria_snapshot(conta_bancaria_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_aud_p3h0_batch_cb ON public.aud_p3h0_conta_bancaria_snapshot(batch_id, conta_bancaria_id);

GRANT SELECT ON public.aud_p3h0_conta_bancaria_snapshot TO authenticated;
GRANT ALL    ON public.aud_p3h0_conta_bancaria_snapshot TO service_role;

ALTER TABLE public.aud_p3h0_conta_bancaria_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aud_p3h0_select_admin  ON public.aud_p3h0_conta_bancaria_snapshot;
DROP POLICY IF EXISTS aud_p3h0_select_escopo ON public.aud_p3h0_conta_bancaria_snapshot;

CREATE POLICY aud_p3h0_select_escopo
  ON public.aud_p3h0_conta_bancaria_snapshot
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'controladoria'::public.app_role)
      AND empresa_id IS NOT NULL
      AND public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    )
  );

-- 2) Validação de schema do snapshot (nomes + tipos críticos)
DO $schema$
DECLARE
  v_missing_nomes int;
  v_tipo_bad      int;
BEGIN
  SELECT 16 - COUNT(*) INTO v_missing_nomes
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='aud_p3h0_conta_bancaria_snapshot'
    AND column_name IN (
      'id','batch_id','created_at','conta_bancaria_id','empresa_id',
      'banco_codigo','banco_nome','ativa_anterior','conta_contabil_id_anterior',
      'ativa_nova','conta_contabil_id_nova','acao','motivo',
      'rollback_aplicado','rollback_em','observacao');
  IF v_missing_nomes <> 0 THEN
    RAISE EXCEPTION 'TRAVADO_SCHEMA_SNAPSHOT_INCOMPATIVEL_P3H0_D1 (colunas faltando=%)', v_missing_nomes;
  END IF;

  SELECT COUNT(*) INTO v_tipo_bad
  FROM (VALUES
    ('batch_id','text'),
    ('conta_bancaria_id','uuid'),
    ('empresa_id','uuid'),
    ('ativa_anterior','bool'),
    ('conta_contabil_id_anterior','uuid'),
    ('ativa_nova','bool'),
    ('conta_contabil_id_nova','uuid'),
    ('rollback_aplicado','bool')
  ) e(col, udt)
  LEFT JOIN information_schema.columns c
    ON c.table_schema='public'
   AND c.table_name='aud_p3h0_conta_bancaria_snapshot'
   AND c.column_name = e.col
  WHERE c.udt_name IS DISTINCT FROM e.udt;

  IF v_tipo_bad <> 0 THEN
    RAISE EXCEPTION 'TRAVADO_SCHEMA_SNAPSHOT_INCOMPATIVEL_P3H0_D1 (tipos divergentes=%)', v_tipo_bad;
  END IF;
END
$schema$;

-- 3) Bloco operacional
DO $mig$
DECLARE
  v_batch        text := 'p3h0-d1-vinculo-banco-contabil-20260605';
  v_empresa_hagg uuid := '5a61c769-21d8-4e61-b9bb-506b8db0bce8';

  v_bad           int;
  v_faltando      int;
  v_fora_hagg     int;
  v_ja_vinculadas int;
  v_ativas        int;
  v_inativas      int;

  v_ref_banco_layout           int;
  v_ref_cobranca_boleto        int;
  v_ref_cobranca_pix           int;
  v_ref_extrato_bancario       int;
  v_ref_integration_alias_banc int;
  v_ref_malote_pagamento       int;
  v_ref_movimento_bancario     int;
  v_ref_remessa_cnab           int;
  v_ref_retorno_bancario       int;
  v_ref_titulo_pagar           int;
  v_ref_titulo_receber         int;
  v_ref_titulo_receber_baixa   int;
  v_ref_total                  int;

  v_locked        int;
  v_snap_inserted int;
  v_snap_count    int;
  v_snap_vinc     int;
  v_snap_inat     int;
  v_snap_hagg     int;
  v_snap_sem_cc   int;
  v_upd_vinc      int;
  v_upd_inat      int;

  canonicas_arr uuid[] := ARRAY[
    '14d539f9-5fbc-49e9-9fad-67f36524f598','ef17d107-7306-4f25-aeb6-6308583dc2e0',
    '23fa05d4-50df-45d5-b7ae-a4935090f540','2fad14a9-8141-4f62-b2e0-eff272194732',
    'd9308787-f415-4f9d-b6ff-4166dabc9242','54137906-a2ec-444e-9ecf-63934c2fb59f',
    'a9f043a0-848e-4ea2-b1ff-c76cd3fea779'
  ]::uuid[];
  duplicadas_arr uuid[] := ARRAY[
    '015225e0-9839-40c0-89f0-450c2bccfe52','7f1a617d-ab3d-4cc1-b677-67f15eebe4ee',
    '1296909a-183f-4c02-a57d-19b84f63a112','584415c4-31bb-4df8-9283-d201b3106b14',
    '9207f249-2f1a-42e6-824d-fa7299a1b0ae','aa80067d-776a-4329-bb90-891eb859b4da',
    'b72a2370-aa71-49fe-be73-2473b9d6d083','e4392441-b4bb-4d3a-b439-f057f0d887ea',
    '33d0ce37-f0ff-4c85-85df-086441aa6eeb','5c5ab78d-492f-47ac-8e94-7289c4631b5a',
    'c8773c52-395d-4bb7-b3ec-5693b81b50dd','bd8b4b58-90d4-4efc-8041-8ea2e977fbf7'
  ]::uuid[];
  todas_arr uuid[];
BEGIN
  todas_arr := canonicas_arr || duplicadas_arr;

  -- Idempotência por batch
  IF EXISTS (SELECT 1 FROM public.aud_p3h0_conta_bancaria_snapshot WHERE batch_id = v_batch) THEN
    RAISE EXCEPTION 'TRAVADO_BATCH_JA_EXECUTADO_P3H0_D1 (batch=%)', v_batch;
  END IF;

  -- Pré-check 1: canônicas
  SELECT COUNT(*) INTO v_bad
  FROM (VALUES
    ('14d539f9-5fbc-49e9-9fad-67f36524f598'::uuid,'ab7445e8-485c-46d4-8bfa-20b868360526'::uuid),
    ('ef17d107-7306-4f25-aeb6-6308583dc2e0'::uuid,'c1e12df1-db5f-4462-ae17-1a7fe2ec3934'::uuid),
    ('23fa05d4-50df-45d5-b7ae-a4935090f540'::uuid,'a240110f-f2ef-48be-9a0f-24ca6b908df0'::uuid),
    ('2fad14a9-8141-4f62-b2e0-eff272194732'::uuid,'7835c0b7-fedf-4ca6-ad1b-6741d8d2a6b2'::uuid),
    ('d9308787-f415-4f9d-b6ff-4166dabc9242'::uuid,'3bd67e77-25b6-46bb-99d2-60ebf232e6b9'::uuid),
    ('54137906-a2ec-444e-9ecf-63934c2fb59f'::uuid,'7be15358-9493-4061-ab09-5b2dd28d5ed3'::uuid),
    ('a9f043a0-848e-4ea2-b1ff-c76cd3fea779'::uuid,'98589810-97b3-4a52-b890-0464df210f8f'::uuid)
  ) e(cb_id, cc_id)
  LEFT JOIN public.conta_bancaria cb ON cb.id = e.cb_id
  LEFT JOIN public.conta_contabil  cc ON cc.id = e.cc_id
  WHERE cb.id IS NULL OR cc.id IS NULL
     OR cb.conta_contabil_id IS NOT NULL
     OR cb.empresa_id <> v_empresa_hagg OR cc.empresa_id <> v_empresa_hagg
     OR cb.ativa IS NOT TRUE OR cc.ativo IS NOT TRUE
     OR lower(cc.tipo::text) <> 'analitica';
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'TRAVADO_PRECHECK_CANONICAS_P3H0_D1 (invalidas=%)', v_bad;
  END IF;

  -- Pré-check 2: duplicadas
  SELECT
    COUNT(*) FILTER (WHERE cb.id IS NULL),
    COUNT(*) FILTER (WHERE cb.id IS NOT NULL AND cb.empresa_id <> v_empresa_hagg),
    COUNT(*) FILTER (WHERE cb.id IS NOT NULL AND cb.conta_contabil_id IS NOT NULL),
    COUNT(*) FILTER (WHERE cb.id IS NOT NULL AND cb.ativa IS TRUE),
    COUNT(*) FILTER (WHERE cb.id IS NOT NULL AND cb.ativa IS FALSE)
  INTO v_faltando, v_fora_hagg, v_ja_vinculadas, v_ativas, v_inativas
  FROM unnest(duplicadas_arr) AS d(id)
  LEFT JOIN public.conta_bancaria cb ON cb.id = d.id;

  IF v_faltando <> 0 OR v_fora_hagg <> 0 OR v_ja_vinculadas <> 0
     OR v_ativas <> 11 OR v_inativas <> 1 THEN
    RAISE EXCEPTION 'TRAVADO_PRECHECK_DUPLICADAS_P3H0_D1 (faltando=%, fora_hagg=%, ja_vinculadas=%, ativas=%, inativas=%)',
      v_faltando, v_fora_hagg, v_ja_vinculadas, v_ativas, v_inativas;
  END IF;

  -- Pré-check 3: referências operacionais (12 tabelas)
  SELECT COUNT(*) INTO v_ref_banco_layout           FROM public.banco_layout             WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_cobranca_boleto        FROM public.cobranca_boleto          WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_cobranca_pix           FROM public.cobranca_pix             WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_extrato_bancario       FROM public.extrato_bancario         WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_integration_alias_banc FROM public.integration_alias_bancos WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_malote_pagamento       FROM public.malote_pagamento         WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_movimento_bancario     FROM public.movimento_bancario       WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_remessa_cnab           FROM public.remessa_cnab             WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_retorno_bancario       FROM public.retorno_bancario         WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_titulo_pagar           FROM public.titulo_pagar             WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_titulo_receber         FROM public.titulo_receber           WHERE conta_bancaria_id = ANY(duplicadas_arr);
  SELECT COUNT(*) INTO v_ref_titulo_receber_baixa   FROM public.titulo_receber_baixa     WHERE conta_bancaria_id = ANY(duplicadas_arr);

  v_ref_total := v_ref_banco_layout + v_ref_cobranca_boleto + v_ref_cobranca_pix
               + v_ref_extrato_bancario + v_ref_integration_alias_banc + v_ref_malote_pagamento
               + v_ref_movimento_bancario + v_ref_remessa_cnab + v_ref_retorno_bancario
               + v_ref_titulo_pagar + v_ref_titulo_receber + v_ref_titulo_receber_baixa;

  IF v_ref_total <> 0 THEN
    RAISE EXCEPTION 'TRAVADO_POR_REFERENCIA_OPERACIONAL_ATIVA_CONTA_BANCARIA_DUPLICADA (banco_layout=%, cobranca_boleto=%, cobranca_pix=%, extrato_bancario=%, integration_alias_bancos=%, malote_pagamento=%, movimento_bancario=%, remessa_cnab=%, retorno_bancario=%, titulo_pagar=%, titulo_receber=%, titulo_receber_baixa=%)',
      v_ref_banco_layout, v_ref_cobranca_boleto, v_ref_cobranca_pix,
      v_ref_extrato_bancario, v_ref_integration_alias_banc, v_ref_malote_pagamento,
      v_ref_movimento_bancario, v_ref_remessa_cnab, v_ref_retorno_bancario,
      v_ref_titulo_pagar, v_ref_titulo_receber, v_ref_titulo_receber_baixa;
  END IF;

  -- LOCK TRANSACIONAL nas 19 linhas
  PERFORM 1 FROM public.conta_bancaria WHERE id = ANY(todas_arr) FOR UPDATE;
  GET DIAGNOSTICS v_locked = ROW_COUNT;
  IF v_locked <> 19 THEN
    RAISE EXCEPTION 'TRAVADO_LOCK_LINHAS_P3H0_D1 (locked=%, esperado=19)', v_locked;
  END IF;

  -- Snapshot 19 linhas
  INSERT INTO public.aud_p3h0_conta_bancaria_snapshot
    (batch_id, conta_bancaria_id, empresa_id, banco_codigo, banco_nome,
     ativa_anterior, conta_contabil_id_anterior,
     ativa_nova,    conta_contabil_id_nova,
     acao, motivo)
  SELECT
    v_batch, cb.id, cb.empresa_id, cb.banco_codigo, cb.banco_nome,
    cb.ativa, cb.conta_contabil_id,
    CASE WHEN x.acao='VINCULAR' THEN cb.ativa ELSE false END,
    CASE WHEN x.acao='VINCULAR' THEN x.cc_id  ELSE cb.conta_contabil_id END,
    x.acao,
    'P3H0-D1 v4 vinculo banco contabil HAGG + inativacao logica duplicadas'
  FROM public.conta_bancaria cb
  JOIN (
    VALUES
      ('14d539f9-5fbc-49e9-9fad-67f36524f598'::uuid,'ab7445e8-485c-46d4-8bfa-20b868360526'::uuid,'VINCULAR'),
      ('ef17d107-7306-4f25-aeb6-6308583dc2e0'::uuid,'c1e12df1-db5f-4462-ae17-1a7fe2ec3934'::uuid,'VINCULAR'),
      ('23fa05d4-50df-45d5-b7ae-a4935090f540'::uuid,'a240110f-f2ef-48be-9a0f-24ca6b908df0'::uuid,'VINCULAR'),
      ('2fad14a9-8141-4f62-b2e0-eff272194732'::uuid,'7835c0b7-fedf-4ca6-ad1b-6741d8d2a6b2'::uuid,'VINCULAR'),
      ('d9308787-f415-4f9d-b6ff-4166dabc9242'::uuid,'3bd67e77-25b6-46bb-99d2-60ebf232e6b9'::uuid,'VINCULAR'),
      ('54137906-a2ec-444e-9ecf-63934c2fb59f'::uuid,'7be15358-9493-4061-ab09-5b2dd28d5ed3'::uuid,'VINCULAR'),
      ('a9f043a0-848e-4ea2-b1ff-c76cd3fea779'::uuid,'98589810-97b3-4a52-b890-0464df210f8f'::uuid,'VINCULAR'),
      ('015225e0-9839-40c0-89f0-450c2bccfe52'::uuid,NULL::uuid,'INATIVAR_DUPLICADA'),
      ('7f1a617d-ab3d-4cc1-b677-67f15eebe4ee'::uuid,NULL,'INATIVAR_DUPLICADA'),
      ('1296909a-183f-4c02-a57d-19b84f63a112'::uuid,NULL,'INATIVAR_DUPLICADA'),
      ('584415c4-31bb-4df8-9283-d201b3106b14'::uuid,NULL,'INATIVAR_DUPLICADA'),
      ('9207f249-2f1a-42e6-824d-fa7299a1b0ae'::uuid,NULL,'INATIVAR_DUPLICADA'),
      ('aa80067d-776a-4329-bb90-891eb859b4da'::uuid,NULL,'INATIVAR_DUPLICADA'),
      ('b72a2370-aa71-49fe-be73-2473b9d6d083'::uuid,NULL,'INATIVAR_DUPLICADA'),
      ('e4392441-b4bb-4d3a-b439-f057f0d887ea'::uuid,NULL,'INATIVAR_DUPLICADA'),
      ('33d0ce37-f0ff-4c85-85df-086441aa6eeb'::uuid,NULL,'INATIVAR_DUPLICADA'),
      ('5c5ab78d-492f-47ac-8e94-7289c4631b5a'::uuid,NULL,'INATIVAR_DUPLICADA'),
      ('c8773c52-395d-4bb7-b3ec-5693b81b50dd'::uuid,NULL,'INATIVAR_DUPLICADA'),
      ('bd8b4b58-90d4-4efc-8041-8ea2e977fbf7'::uuid,NULL,'INATIVAR_DUPLICADA')
  ) x(cb_id, cc_id, acao) ON x.cb_id = cb.id;

  GET DIAGNOSTICS v_snap_inserted = ROW_COUNT;
  IF v_snap_inserted <> 19 THEN
    RAISE EXCEPTION 'TRAVADO_SNAPSHOT_COUNT_P3H0_D1 (inseridas=%, esperado=19)', v_snap_inserted;
  END IF;

  -- Pós-check de auditoria
  SELECT
    COUNT(*) FILTER (WHERE acao='VINCULAR'),
    COUNT(*) FILTER (WHERE acao='INATIVAR_DUPLICADA'),
    COUNT(*) FILTER (WHERE empresa_id = v_empresa_hagg),
    COUNT(*) FILTER (WHERE conta_contabil_id_anterior IS NULL)
  INTO v_snap_vinc, v_snap_inat, v_snap_hagg, v_snap_sem_cc
  FROM public.aud_p3h0_conta_bancaria_snapshot
  WHERE batch_id = v_batch;

  IF v_snap_vinc <> 7 OR v_snap_inat <> 12 OR v_snap_hagg <> 19 OR v_snap_sem_cc <> 19 THEN
    RAISE EXCEPTION 'TRAVADO_AUDIT_SNAPSHOT_P3H0_D1 (vincular=%, inativar=%, hagg=%, sem_cc_ant=%, esperado=7/12/19/19)',
      v_snap_vinc, v_snap_inat, v_snap_hagg, v_snap_sem_cc;
  END IF;

  -- UPDATE 1: vincular 7 canônicas
  WITH aprovado(cb_id, cc_id) AS (
    VALUES
      ('14d539f9-5fbc-49e9-9fad-67f36524f598'::uuid,'ab7445e8-485c-46d4-8bfa-20b868360526'::uuid),
      ('ef17d107-7306-4f25-aeb6-6308583dc2e0'::uuid,'c1e12df1-db5f-4462-ae17-1a7fe2ec3934'::uuid),
      ('23fa05d4-50df-45d5-b7ae-a4935090f540'::uuid,'a240110f-f2ef-48be-9a0f-24ca6b908df0'::uuid),
      ('2fad14a9-8141-4f62-b2e0-eff272194732'::uuid,'7835c0b7-fedf-4ca6-ad1b-6741d8d2a6b2'::uuid),
      ('d9308787-f415-4f9d-b6ff-4166dabc9242'::uuid,'3bd67e77-25b6-46bb-99d2-60ebf232e6b9'::uuid),
      ('54137906-a2ec-444e-9ecf-63934c2fb59f'::uuid,'7be15358-9493-4061-ab09-5b2dd28d5ed3'::uuid),
      ('a9f043a0-848e-4ea2-b1ff-c76cd3fea779'::uuid,'98589810-97b3-4a52-b890-0464df210f8f'::uuid)
  )
  UPDATE public.conta_bancaria cb
     SET conta_contabil_id = a.cc_id
    FROM aprovado a
   WHERE cb.id = a.cb_id AND cb.conta_contabil_id IS NULL;
  GET DIAGNOSTICS v_upd_vinc = ROW_COUNT;
  IF v_upd_vinc <> 7 THEN
    RAISE EXCEPTION 'TRAVADO_UPDATE_VINCULACAO_P3H0_D1 (atualizadas=%, esperado=7)', v_upd_vinc;
  END IF;

  -- UPDATE 2: inativar 11 duplicadas
  UPDATE public.conta_bancaria cb
     SET ativa = false
   WHERE cb.id = ANY(duplicadas_arr) AND cb.ativa IS TRUE;
  GET DIAGNOSTICS v_upd_inat = ROW_COUNT;
  IF v_upd_inat <> 11 THEN
    RAISE EXCEPTION 'TRAVADO_UPDATE_INATIVACAO_P3H0_D1 (inativadas=%, esperado=11)', v_upd_inat;
  END IF;

  -- Pós-check 1: canônicas vinculadas
  SELECT COUNT(*) INTO v_bad
  FROM (VALUES
    ('14d539f9-5fbc-49e9-9fad-67f36524f598'::uuid,'ab7445e8-485c-46d4-8bfa-20b868360526'::uuid),
    ('ef17d107-7306-4f25-aeb6-6308583dc2e0'::uuid,'c1e12df1-db5f-4462-ae17-1a7fe2ec3934'::uuid),
    ('23fa05d4-50df-45d5-b7ae-a4935090f540'::uuid,'a240110f-f2ef-48be-9a0f-24ca6b908df0'::uuid),
    ('2fad14a9-8141-4f62-b2e0-eff272194732'::uuid,'7835c0b7-fedf-4ca6-ad1b-6741d8d2a6b2'::uuid),
    ('d9308787-f415-4f9d-b6ff-4166dabc9242'::uuid,'3bd67e77-25b6-46bb-99d2-60ebf232e6b9'::uuid),
    ('54137906-a2ec-444e-9ecf-63934c2fb59f'::uuid,'7be15358-9493-4061-ab09-5b2dd28d5ed3'::uuid),
    ('a9f043a0-848e-4ea2-b1ff-c76cd3fea779'::uuid,'98589810-97b3-4a52-b890-0464df210f8f'::uuid)
  ) a(cb_id, cc_id)
  JOIN public.conta_bancaria cb ON cb.id = a.cb_id
  WHERE cb.conta_contabil_id IS DISTINCT FROM a.cc_id OR cb.ativa IS NOT TRUE;
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'TRAVADO_POSCHECK_CANONICAS_P3H0_D1 (divergentes=%)', v_bad;
  END IF;

  -- Pós-check 2: duplicadas inativas + sem cc
  SELECT
    COUNT(*) FILTER (WHERE cb.ativa IS FALSE),
    COUNT(*) FILTER (WHERE cb.conta_contabil_id IS NULL)
  INTO v_inativas, v_faltando
  FROM public.conta_bancaria cb
  WHERE cb.id = ANY(duplicadas_arr);
  IF v_inativas <> 12 OR v_faltando <> 12 THEN
    RAISE EXCEPTION 'TRAVADO_POSCHECK_DUPLICADAS_P3H0_D1 (inativas=%, sem_cc=%, esperado=12/12)', v_inativas, v_faltando;
  END IF;

  -- Pós-check 3: cross-empresa
  SELECT COUNT(*) INTO v_bad
  FROM public.conta_bancaria cb
  JOIN public.conta_contabil  cc ON cc.id = cb.conta_contabil_id
  WHERE cb.id = ANY(canonicas_arr) AND cb.empresa_id <> cc.empresa_id;
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'TRAVADO_POSCHECK_CROSS_EMPRESA_P3H0_D1 (linhas=%)', v_bad;
  END IF;

  -- Pós-check 4: refs op. = 0
  SELECT
    (SELECT COUNT(*) FROM public.banco_layout             WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.cobranca_boleto          WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.cobranca_pix             WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.extrato_bancario         WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.integration_alias_bancos WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.malote_pagamento         WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.movimento_bancario       WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.remessa_cnab             WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.retorno_bancario         WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.titulo_pagar             WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.titulo_receber           WHERE conta_bancaria_id = ANY(duplicadas_arr))
  + (SELECT COUNT(*) FROM public.titulo_receber_baixa     WHERE conta_bancaria_id = ANY(duplicadas_arr))
  INTO v_bad;
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'TRAVADO_POSCHECK_REFS_OP_P3H0_D1 (refs=%)', v_bad;
  END IF;

  -- Pós-check 5: snapshot = 19
  SELECT COUNT(*) INTO v_snap_count
  FROM public.aud_p3h0_conta_bancaria_snapshot WHERE batch_id = v_batch;
  IF v_snap_count <> 19 THEN
    RAISE EXCEPTION 'TRAVADO_POSCHECK_SNAPSHOT_COUNT_P3H0_D1 (snapshot=%, esperado=19)', v_snap_count;
  END IF;

  RAISE NOTICE 'P3.H0-D1 v4 OK | batch=% | locked=% | vinculadas=% | inativadas=% | snapshot=% | refs=0',
    v_batch, v_locked, v_upd_vinc, v_upd_inat, v_snap_count;
END
$mig$;