-- ============================================================
-- SUPERBLOCO FINAL v9 — Caixa + Presidência (Migration A)
-- (Arquivo aprovado: superbloco_final_v10 / Migration A)
-- ============================================================
BEGIN;

-- 1) parse_mz40_valor(text) -> numeric
CREATE OR REPLACE FUNCTION public.parse_mz40_valor(_v text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $func$
DECLARE
  s   text;
  neg boolean := false;
  out numeric;
BEGIN
  IF _v IS NULL THEN RETURN NULL; END IF;
  s := btrim(_v);
  IF s = '' THEN RETURN NULL; END IF;
  IF s ~ '^\(.*\)$' THEN
    neg := true;
    s := substring(s from 2 for length(s)-2);
  END IF;
  s := regexp_replace(s, '[^0-9,\.-]', '', 'g');
  IF s = '' OR s = '-' THEN RETURN NULL; END IF;
  IF position(',' in s) > 0 AND position('.' in s) > 0 THEN
    s := replace(s, '.', '');
    s := replace(s, ',', '.');
  ELSIF position(',' in s) > 0 THEN
    s := replace(s, ',', '.');
  END IF;
  BEGIN
    out := s::numeric;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF neg THEN out := -out; END IF;
  RETURN out;
END;
$func$;

REVOKE ALL ON FUNCTION public.parse_mz40_valor(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.parse_mz40_valor(text) TO authenticated, service_role;

-- 2) normaliza_alias_banco(text) -> text
CREATE OR REPLACE FUNCTION public.normaliza_alias_banco(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $func$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          upper(
            translate(
              COALESCE(_v, ''),
              'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ–—',
              'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN--'
            )
          ),
          '[\s]+', ' ', 'g'
        ),
        '\s*-\s*', '-', 'g'
      )
    ), ''
  );
$func$;

REVOKE ALL ON FUNCTION public.normaliza_alias_banco(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normaliza_alias_banco(text) TO authenticated, service_role;

-- 3) Auditoria persistente
CREATE TABLE IF NOT EXISTS public.aud_alias_bancario_snapshot (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  superbloco      text NOT NULL,
  executado_por   uuid,
  executado_em    timestamptz NOT NULL DEFAULT now(),
  empresa_id      uuid NOT NULL,
  alias           text NOT NULL,
  acao            text NOT NULL CHECK (acao IN ('INSERT','UPDATE','NOOP','SKIP')),
  before_row      jsonb,
  after_row       jsonb,
  motivo          text
);

GRANT SELECT, INSERT ON public.aud_alias_bancario_snapshot TO authenticated;
GRANT ALL ON public.aud_alias_bancario_snapshot TO service_role;

ALTER TABLE public.aud_alias_bancario_snapshot ENABLE ROW LEVEL SECURITY;

DO $pol$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='aud_alias_bancario_snapshot'
       AND policyname='aud_alias_bancario_admin_select'
  ) THEN
    CREATE POLICY aud_alias_bancario_admin_select
      ON public.aud_alias_bancario_snapshot
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='aud_alias_bancario_snapshot'
       AND policyname='aud_alias_bancario_admin_insert'
  ) THEN
    CREATE POLICY aud_alias_bancario_admin_insert
      ON public.aud_alias_bancario_snapshot
      FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$pol$;

CREATE INDEX IF NOT EXISTS idx_aud_alias_bsnap_superbloco
  ON public.aud_alias_bancario_snapshot (superbloco, executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_aud_alias_bsnap_empresa_alias
  ON public.aud_alias_bancario_snapshot (empresa_id, alias);

-- 4) Stage TEMP (33 linhas)
CREATE TEMP TABLE _stage_aliases_hagg (
  alias_orig        text NOT NULL,
  qtd_movimentos    integer NOT NULL,
  classificacao     text NOT NULL,
  conta_bancaria_id uuid,
  status            integ_alias_status NOT NULL,
  motivo            text
) ON COMMIT DROP;

INSERT INTO _stage_aliases_hagg
  (alias_orig, qtd_movimentos, classificacao, conta_bancaria_id, status, motivo) VALUES
  ('BANRI HAGG',        453, 'ALIAS_DE_CONTA_CANONICA_EXISTENTE', 'ef17d107-7306-4f25-aeb6-6308583dc2e0'::uuid, 'aprovado'::integ_alias_status, 'canonico_p3h0_d1b_v2'),
  ('MENTORE HAGG',       50, 'ALIAS_DE_CONTA_CANONICA_EXISTENTE', 'd9308787-f415-4f9d-b6ff-4166dabc9242'::uuid, 'aprovado'::integ_alias_status, 'canonico_p3h0_d1b_v2'),
  ('SICREDI HAGG 119',   28, 'ALIAS_DE_CONTA_CANONICA_EXISTENTE', '54137906-a2ec-444e-9ecf-63934c2fb59f'::uuid, 'aprovado'::integ_alias_status, 'canonico_p3h0_d1b_v2'),
  ('BB HAGG',            26, 'ALIAS_DE_CONTA_CANONICA_EXISTENTE', '23fa05d4-50df-45d5-b7ae-a4935090f540'::uuid, 'aprovado'::integ_alias_status, 'canonico_p3h0_d1b_v2'),
  ('BRADESCO HAGG',       1, 'ALIAS_DE_CONTA_CANONICA_EXISTENTE', 'a9f043a0-848e-4ea2-b1ff-c76cd3fea779'::uuid, 'aprovado'::integ_alias_status, 'canonico_p3h0_d1b_v2'),
  ('CAIXA HAGG',          0, 'ALIAS_DE_CONTA_CANONICA_EXISTENTE', '14d539f9-5fbc-49e9-9fad-67f36524f598'::uuid, 'aprovado'::integ_alias_status, 'canonico_complementar_sem_movimento'),
  ('SICREDI HAGG 155',    0, 'ALIAS_DE_CONTA_CANONICA_EXISTENTE', '2fad14a9-8141-4f62-b2e0-eff272194732'::uuid, 'aprovado'::integ_alias_status, 'canonico_complementar_sem_movimento'),
  ('BB HAGG- APLICAÇÃO',                                234, 'CRIAR_CONTA_CONTABIL_APLICACAO_FINANCEIRA', NULL, 'pendente'::integ_alias_status, 'aplicacao_financeira'),
  ('BANRI SN',                                          202, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa'),
  ('BB HAGG - UFFS 041/2021',                            28, 'CONTA_VINCULADA_CONTRATO_CONVENIO',        NULL, 'pendente'::integ_alias_status, 'contrato_convenio'),
  ('BB SN',                                              22, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa'),
  ('BANRI NH',                                           22, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa'),
  ('INTER',                                              17, 'REVISAR_HUMANO',                            NULL, 'pendente'::integ_alias_status, 'revisao_humana'),
  ('CAIXA - BENTO GONÇALVES ADM 002/2021',               16, 'CONTA_VINCULADA_CONTRATO_CONVENIO',        NULL, 'pendente'::integ_alias_status, 'contrato_convenio'),
  ('BANRI CANAA',                                        15, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa'),
  ('CAIXA - HUSM 020/2021',                              14, 'CONTA_VINCULADA_CONTRATO_CONVENIO',        NULL, 'pendente'::integ_alias_status, 'contrato_convenio'),
  ('BB HAGG - EMBRAPA 2021/93',                          11, 'CONTA_VINCULADA_CONTRATO_CONVENIO',        NULL, 'pendente'::integ_alias_status, 'contrato_convenio'),
  ('BB HAGG - FURG JARDINAGEM 049/2022',                 10, 'CONTA_VINCULADA_CONTRATO_CONVENIO',        NULL, 'pendente'::integ_alias_status, 'contrato_convenio'),
  ('BB HAGG - EMBRAPA CANOINHA 47/2024',                  9, 'CONTA_VINCULADA_CONTRATO_CONVENIO',        NULL, 'pendente'::integ_alias_status, 'contrato_convenio'),
  ('BRADESCO SN',                                         7, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa'),
  ('BB HAGG - HCPA 1249781/2024',                         4, 'CONTA_VINCULADA_CONTRATO_CONVENIO',        NULL, 'pendente'::integ_alias_status, 'contrato_convenio'),
  ('CAIXA SN',                                            4, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa'),
  ('CDB INTER',                                           3, 'CRIAR_CONTA_CONTABIL_APLICACAO_FINANCEIRA', NULL, 'pendente'::integ_alias_status, 'aplicacao_financeira'),
  ('BB HAGG - FURG-HU 006/2023',                          3, 'CONTA_VINCULADA_CONTRATO_CONVENIO',        NULL, 'pendente'::integ_alias_status, 'contrato_convenio'),
  ('TICKET',                                              2, 'MEIO_PAGAMENTO_NAO_BANCO',                  NULL, 'pendente'::integ_alias_status, 'meio_pagamento'),
  ('CAIXA - BENTO GONÇALVES  - LIMPEZA - 029/2025',       2, 'CONTA_VINCULADA_CONTRATO_CONVENIO',        NULL, 'pendente'::integ_alias_status, 'contrato_convenio'),
  ('MENTORE CANAA',                                       2, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa'),
  ('BANRI AGPS',                                          2, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa'),
  ('BANRI LF',                                            2, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa'),
  ('SICREDI 155 POUPANÇA',                                1, 'CRIAR_CONTA_CONTABIL_APLICACAO_FINANCEIRA', NULL, 'pendente'::integ_alias_status, 'aplicacao_financeira'),
  ('CAIXA -BENTO GONÇALVES  - LIMPEZA - 067/2019',        1, 'CONTA_VINCULADA_CONTRATO_CONVENIO',        NULL, 'pendente'::integ_alias_status, 'contrato_convenio'),
  ('MENTORE SN',                                          1, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa'),
  ('MENTORE NH',                                          1, 'BANCO_DE_OUTRA_EMPRESA_EM_HAGG',           NULL, 'pendente'::integ_alias_status, 'outra_empresa');

DO $blk$
DECLARE
  v_total int; v_sum int; v_canon int; v_pend int; v_blank int;
BEGIN
  SELECT count(*), sum(qtd_movimentos),
         count(*) FILTER (WHERE status='aprovado'),
         count(*) FILTER (WHERE status='pendente'),
         count(*) FILTER (WHERE public.normaliza_alias_banco(alias_orig) IS NULL
                              OR public.normaliza_alias_banco(alias_orig) = 'EM BRANCO')
    INTO v_total, v_sum, v_canon, v_pend, v_blank
    FROM _stage_aliases_hagg;
  IF v_total <> 33 THEN
    RAISE EXCEPTION 'STAGE: esperado 33 linhas, encontrado %', v_total;
  END IF;
  IF v_sum <> 1193 THEN
    RAISE EXCEPTION 'STAGE: soma qtd_movimentos esperada 1193, encontrada %', v_sum;
  END IF;
  IF v_canon <> 7 THEN
    RAISE EXCEPTION 'STAGE: canônicos esperados 7, encontrado %', v_canon;
  END IF;
  IF v_pend <> 26 THEN
    RAISE EXCEPTION 'STAGE: pendentes esperados 26, encontrado %', v_pend;
  END IF;
  IF v_blank <> 0 THEN
    RAISE EXCEPTION 'STAGE: alias em branco detectado (proibido), encontrado %', v_blank;
  END IF;
  PERFORM 1 FROM _stage_aliases_hagg s
   WHERE s.conta_bancaria_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.conta_bancaria cb
        WHERE cb.id = s.conta_bancaria_id
          AND cb.empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid
     );
  IF FOUND THEN
    RAISE EXCEPTION 'STAGE: conta_bancaria_id canônico não pertence ao HAGG';
  END IF;
END$blk$;

-- 5) Snapshot BEFORE
INSERT INTO public.aud_alias_bancario_snapshot
  (superbloco, executado_por, empresa_id, alias, acao, before_row, after_row, motivo)
SELECT
  'superbloco_final_v9',
  auth.uid(),
  '5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid,
  s.alias_orig,
  'NOOP',
  to_jsonb(iab.*),
  NULL::jsonb,
  'before_upsert'
FROM _stage_aliases_hagg s
LEFT JOIN public.integration_alias_bancos iab
  ON iab.empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid
 AND iab.alias = s.alias_orig;

-- 6) UPSERT idempotente
INSERT INTO public.integration_alias_bancos
  (empresa_id, alias, conta_bancaria_id, status, origem)
SELECT
  '5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid,
  s.alias_orig,
  s.conta_bancaria_id,
  s.status,
  'superbloco_final_v9'
FROM _stage_aliases_hagg s
ON CONFLICT (empresa_id, alias) DO UPDATE
SET conta_bancaria_id = EXCLUDED.conta_bancaria_id,
    status            = EXCLUDED.status,
    origem            = EXCLUDED.origem;

-- 7) Snapshot AFTER
INSERT INTO public.aud_alias_bancario_snapshot
  (superbloco, executado_por, empresa_id, alias, acao, before_row, after_row, motivo)
SELECT
  'superbloco_final_v9',
  auth.uid(),
  iab.empresa_id,
  iab.alias,
  CASE
    WHEN snap.before_row IS NULL                                THEN 'INSERT'
    WHEN snap.before_row::jsonb - 'created_at'
       = to_jsonb(iab.*)::jsonb - 'created_at'                  THEN 'NOOP'
    ELSE 'UPDATE'
  END,
  snap.before_row,
  to_jsonb(iab.*),
  s.motivo
FROM _stage_aliases_hagg s
JOIN public.integration_alias_bancos iab
  ON iab.empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid
 AND iab.alias = s.alias_orig
LEFT JOIN LATERAL (
  SELECT a.before_row
    FROM public.aud_alias_bancario_snapshot a
   WHERE a.superbloco = 'superbloco_final_v9'
     AND a.motivo = 'before_upsert'
     AND a.empresa_id = iab.empresa_id
     AND a.alias = iab.alias
   ORDER BY a.executado_em DESC
   LIMIT 1
) snap ON true;

DO $blk$
DECLARE
  v_apr int; v_pen int;
BEGIN
  SELECT count(*) FILTER (WHERE iab.status='aprovado'),
         count(*) FILTER (WHERE iab.status='pendente')
    INTO v_apr, v_pen
    FROM public.integration_alias_bancos iab
    JOIN _stage_aliases_hagg s ON s.alias_orig = iab.alias
   WHERE iab.empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid;
  IF v_apr <> 7 OR v_pen <> 26 THEN
    RAISE EXCEPTION 'UPSERT: contagens fora do esperado (apr=%, pen=%)', v_apr, v_pen;
  END IF;
  PERFORM 1 FROM public.integration_alias_bancos
   WHERE empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid
     AND (public.normaliza_alias_banco(alias) IS NULL
          OR public.normaliza_alias_banco(alias) = 'EM BRANCO');
  IF FOUND THEN
    RAISE EXCEPTION 'UPSERT: alias em branco encontrado em integration_alias_bancos';
  END IF;
END$blk$;

-- 8) RPC pres_caixa_status()
CREATE OR REPLACE FUNCTION public.pres_caixa_status()
RETURNS TABLE (
  empresa_id uuid,
  empresa_codigo text,
  saldo_inicial numeric,
  total_entradas numeric,
  total_saidas numeric,
  saldo_liquido numeric,
  qtd_movimentos_com_alias bigint,
  qtd_movimentos_sem_match bigint,
  qtd_valores_invalidos bigint,
  qtd_pendencias_alias bigint,
  status_confiabilidade text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_access(
       _user    => auth.uid(),
       _menu    => 'presidencia',
       _acao    => 'visualizar'::app_acao,
       _empresa => NULL,
       _modulo  => NULL
     ) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO_PRESIDENCIA' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH emp AS (
    SELECT e.id AS empresa_id, e.codigo AS empresa_codigo
      FROM public.empresas e
     WHERE e.ativa = true
       AND public.user_pode_atuar_empresa(auth.uid(), e.id)
  ),
  saldos AS (
    SELECT sic.empresa_id, COALESCE(sum(sic.valor),0)::numeric AS saldo_inicial
      FROM public.saldos_iniciais_caixa sic
     WHERE sic.empresa_id IN (SELECT empresa_id FROM emp)
     GROUP BY sic.empresa_id
  ),
  mov AS (
    SELECT
      e.empresa_id,
      COALESCE(NULLIF(btrim(m.banco), ''), m.conta_banco_nome) AS banco_efetivo,
      public.parse_mz40_valor(m.valor_entrada) AS ve,
      public.parse_mz40_valor(m.valor_saida)   AS vs,
      m.valor_entrada AS raw_ve,
      m.valor_saida   AS raw_vs
    FROM public.mz_40_fato_fluxo_caixa_realizado m
    JOIN emp e ON e.empresa_codigo = m.empresa
    WHERE COALESCE(m.excluir_do_fluxo, false) = false
  ),
  mov_x AS (
    SELECT
      mv.empresa_id,
      iab.id AS alias_id,
      mv.ve, mv.vs, mv.raw_ve, mv.raw_vs
    FROM mov mv
    LEFT JOIN public.integration_alias_bancos iab
      ON iab.empresa_id = mv.empresa_id
     AND iab.status = 'aprovado'::integ_alias_status
     AND public.normaliza_alias_banco(iab.alias)
       = public.normaliza_alias_banco(mv.banco_efetivo)
  ),
  agg AS (
    SELECT
      mx.empresa_id,
      COALESCE(sum(mx.ve),0)::numeric AS total_entradas,
      COALESCE(sum(mx.vs),0)::numeric AS total_saidas,
      count(*) FILTER (WHERE mx.alias_id IS NOT NULL)::bigint AS qtd_com_alias,
      count(*) FILTER (WHERE mx.alias_id IS NULL)::bigint     AS qtd_sem_match,
      count(*) FILTER (WHERE
          (mx.raw_ve IS NOT NULL AND btrim(mx.raw_ve) <> '' AND mx.ve IS NULL)
       OR (mx.raw_vs IS NOT NULL AND btrim(mx.raw_vs) <> '' AND mx.vs IS NULL)
      )::bigint AS qtd_invalidos
    FROM mov_x mx
    GROUP BY mx.empresa_id
  ),
  pend AS (
    SELECT iab.empresa_id, count(*)::bigint AS qtd_pend
      FROM public.integration_alias_bancos iab
     WHERE iab.status = 'pendente'::integ_alias_status
       AND iab.empresa_id IN (SELECT empresa_id FROM emp)
     GROUP BY iab.empresa_id
  )
  SELECT
    e.empresa_id,
    e.empresa_codigo,
    COALESCE(s.saldo_inicial, 0)::numeric                                 AS saldo_inicial,
    COALESCE(a.total_entradas, 0)::numeric                                AS total_entradas,
    COALESCE(a.total_saidas, 0)::numeric                                  AS total_saidas,
    (COALESCE(s.saldo_inicial,0)
      + COALESCE(a.total_entradas,0)
      - COALESCE(a.total_saidas,0))::numeric                              AS saldo_liquido,
    COALESCE(a.qtd_com_alias, 0)::bigint                                  AS qtd_movimentos_com_alias,
    COALESCE(a.qtd_sem_match, 0)::bigint                                  AS qtd_movimentos_sem_match,
    COALESCE(a.qtd_invalidos, 0)::bigint                                  AS qtd_valores_invalidos,
    COALESCE(p.qtd_pend, 0)::bigint                                       AS qtd_pendencias_alias,
    CASE
      WHEN COALESCE(a.qtd_invalidos,0) > 0                                THEN 'BLOQUEADO'
      WHEN COALESCE(a.qtd_sem_match,0) > 0 OR COALESCE(p.qtd_pend,0) > 0  THEN 'PENDENTE'
      WHEN COALESCE(s.saldo_inicial,0) = 0                                THEN 'INFERIDO'
      ELSE 'VALIDADO'
    END::text                                                             AS status_confiabilidade
  FROM emp e
  LEFT JOIN saldos s ON s.empresa_id = e.empresa_id
  LEFT JOIN agg    a ON a.empresa_id = e.empresa_id
  LEFT JOIN pend   p ON p.empresa_id = e.empresa_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.pres_caixa_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pres_caixa_status() TO authenticated;

COMMIT;