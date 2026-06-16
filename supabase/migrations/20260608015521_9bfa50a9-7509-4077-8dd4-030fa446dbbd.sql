BEGIN;

DO $$
DECLARE v_missing int;
BEGIN
  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'TRAVADO_FUNCAO_HAS_ROLE_NAO_LOCALIZADA';
  END IF;
  IF to_regprocedure('public.user_pode_atuar_empresa(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'TRAVADO_FUNCAO_USER_PODE_ATUAR_EMPRESA_NAO_LOCALIZADA';
  END IF;
  IF to_regprocedure('public.can_access(uuid, text, public.app_acao, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'TRAVADO_FUNCAO_CAN_ACCESS_NAO_LOCALIZADA';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.aud_empresas_cnpj_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  empresa_id uuid NOT NULL,
  codigo text NOT NULL,
  razao_social_anterior text,
  cnpj_anterior text,
  razao_social_nova text,
  cnpj_novo text,
  rollback_aplicado boolean NOT NULL DEFAULT false,
  rollback_em timestamptz,
  observacao text
);

GRANT SELECT ON public.aud_empresas_cnpj_snapshot TO authenticated;
GRANT ALL ON public.aud_empresas_cnpj_snapshot TO service_role;

ALTER TABLE public.aud_empresas_cnpj_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aud_empresas_cnpj_snapshot_select_admin ON public.aud_empresas_cnpj_snapshot;
CREATE POLICY aud_empresas_cnpj_snapshot_select_admin
ON public.aud_empresas_cnpj_snapshot
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'presidencia'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'controladoria'::public.app_role)
    AND public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  )
);

DO $$
DECLARE
  v_batch text := 'hotfix-pres-caixa-cnpj-20260607';
  v_total int;
  v_bad int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.aud_empresas_cnpj_snapshot WHERE batch_id = v_batch) THEN
    RAISE EXCEPTION 'TRAVADO_BATCH_EMPRESAS_CNPJ_JA_EXECUTADO';
  END IF;

  WITH mapa(codigo, razao_social, cnpj) AS (
    VALUES
      ('AGPS',  'AGPS ADMINISTRADORA E PARTICIPACOES LTDA',        '29.722.947/0001-98'),
      ('CANAA', 'INSTITUTO DE ENSINO CANAA',                       '24.354.749/0001-03'),
      ('HAGG',  'NASCIMENTO SERVICOS DE LIMPEZA LTDA',             '03.644.009/0001-23'),
      ('NH',    'NH PRESTACAO DE SERVICOS LTDA',                   '18.615.832/0001-88'),
      ('SN',    'SN SERVICOS DE LIMPEZA E ZELADORIA PREDIAL LTDA', '17.290.783/0001-98'),
      ('LF',    'LF ZELADORIA LTDA',                               '27.579.296/0001-01')
  )
  SELECT COUNT(*) INTO v_total FROM public.empresas e JOIN mapa m ON m.codigo=e.codigo;
  IF v_total <> 6 THEN RAISE EXCEPTION 'TRAVADO_EMPRESAS_ESPERADAS_NAO_ENCONTRADAS (encontradas=%)', v_total; END IF;

  WITH mapa(codigo, razao_social, cnpj) AS (
    VALUES
      ('AGPS',  'AGPS ADMINISTRADORA E PARTICIPACOES LTDA',        '29.722.947/0001-98'),
      ('CANAA', 'INSTITUTO DE ENSINO CANAA',                       '24.354.749/0001-03'),
      ('HAGG',  'NASCIMENTO SERVICOS DE LIMPEZA LTDA',             '03.644.009/0001-23'),
      ('NH',    'NH PRESTACAO DE SERVICOS LTDA',                   '18.615.832/0001-88'),
      ('SN',    'SN SERVICOS DE LIMPEZA E ZELADORIA PREDIAL LTDA', '17.290.783/0001-98'),
      ('LF',    'LF ZELADORIA LTDA',                               '27.579.296/0001-01')
  )
  SELECT COUNT(*) INTO v_bad
  FROM public.empresas e JOIN mapa m ON m.codigo=e.codigo
  WHERE e.cnpj IS NOT NULL AND e.cnpj <> ''
    AND e.cnpj NOT LIKE '00.000.000/0001-%'
    AND e.cnpj <> m.cnpj;
  IF v_bad <> 0 THEN RAISE EXCEPTION 'TRAVADO_CNPJ_REAL_DIFERENTE_JA_EXISTENTE (qtd=%)', v_bad; END IF;

  WITH mapa(codigo, razao_social, cnpj) AS (
    VALUES
      ('AGPS',  'AGPS ADMINISTRADORA E PARTICIPACOES LTDA',        '29.722.947/0001-98'),
      ('CANAA', 'INSTITUTO DE ENSINO CANAA',                       '24.354.749/0001-03'),
      ('HAGG',  'NASCIMENTO SERVICOS DE LIMPEZA LTDA',             '03.644.009/0001-23'),
      ('NH',    'NH PRESTACAO DE SERVICOS LTDA',                   '18.615.832/0001-88'),
      ('SN',    'SN SERVICOS DE LIMPEZA E ZELADORIA PREDIAL LTDA', '17.290.783/0001-98'),
      ('LF',    'LF ZELADORIA LTDA',                               '27.579.296/0001-01')
  )
  INSERT INTO public.aud_empresas_cnpj_snapshot
    (batch_id, empresa_id, codigo, razao_social_anterior, cnpj_anterior,
     razao_social_nova, cnpj_novo, observacao)
  SELECT v_batch, e.id, e.codigo, e.razao_social, e.cnpj, m.razao_social, m.cnpj,
         'Correção cadastral de razão social/CNPJ sem alterar empresa_id/codigo/permissões'
  FROM public.empresas e JOIN mapa m ON m.codigo=e.codigo;
  GET DIAGNOSTICS v_total = ROW_COUNT;
  IF v_total <> 6 THEN RAISE EXCEPTION 'TRAVADO_SNAPSHOT_EMPRESAS_CNPJ_DIVERGE (snapshot=%)', v_total; END IF;

  WITH mapa(codigo, razao_social, cnpj) AS (
    VALUES
      ('AGPS',  'AGPS ADMINISTRADORA E PARTICIPACOES LTDA',        '29.722.947/0001-98'),
      ('CANAA', 'INSTITUTO DE ENSINO CANAA',                       '24.354.749/0001-03'),
      ('HAGG',  'NASCIMENTO SERVICOS DE LIMPEZA LTDA',             '03.644.009/0001-23'),
      ('NH',    'NH PRESTACAO DE SERVICOS LTDA',                   '18.615.832/0001-88'),
      ('SN',    'SN SERVICOS DE LIMPEZA E ZELADORIA PREDIAL LTDA', '17.290.783/0001-98'),
      ('LF',    'LF ZELADORIA LTDA',                               '27.579.296/0001-01')
  )
  UPDATE public.empresas e
     SET razao_social=m.razao_social, cnpj=m.cnpj
    FROM mapa m WHERE e.codigo=m.codigo;
  GET DIAGNOSTICS v_total = ROW_COUNT;
  IF v_total <> 6 THEN RAISE EXCEPTION 'TRAVADO_UPDATE_EMPRESAS_CNPJ_DIVERGE (atualizadas=%)', v_total; END IF;

  WITH mapa(codigo, razao_social, cnpj) AS (
    VALUES
      ('AGPS',  'AGPS ADMINISTRADORA E PARTICIPACOES LTDA',        '29.722.947/0001-98'),
      ('CANAA', 'INSTITUTO DE ENSINO CANAA',                       '24.354.749/0001-03'),
      ('HAGG',  'NASCIMENTO SERVICOS DE LIMPEZA LTDA',             '03.644.009/0001-23'),
      ('NH',    'NH PRESTACAO DE SERVICOS LTDA',                   '18.615.832/0001-88'),
      ('SN',    'SN SERVICOS DE LIMPEZA E ZELADORIA PREDIAL LTDA', '17.290.783/0001-98'),
      ('LF',    'LF ZELADORIA LTDA',                               '27.579.296/0001-01')
  )
  SELECT COUNT(*) INTO v_bad
  FROM public.empresas e JOIN mapa m ON m.codigo=e.codigo
  WHERE e.cnpj IS DISTINCT FROM m.cnpj OR e.razao_social IS DISTINCT FROM m.razao_social;
  IF v_bad <> 0 THEN RAISE EXCEPTION 'TRAVADO_POSCHECK_EMPRESAS_CNPJ_DIVERGE (divergentes=%)', v_bad; END IF;
END $$;

DROP FUNCTION IF EXISTS public.parse_mz40_valor(text);
CREATE FUNCTION public.parse_mz40_valor(_in text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text; n_dot int; n_com int; last_dot int; last_com int;
BEGIN
  IF _in IS NULL THEN RETURN NULL; END IF;
  s := btrim(_in);
  IF s = '' OR s = '-' THEN RETURN 0; END IF;
  IF s ~ '[^0-9\.\,\-]' THEN RETURN NULL; END IF;
  IF position('-' in substr(s, 2)) > 0 THEN RETURN NULL; END IF;
  n_dot := length(s) - length(replace(s, '.', ''));
  n_com := length(s) - length(replace(s, ',', ''));
  IF n_dot > 0 AND n_com > 0 THEN
    last_dot := length(s) - position('.' in reverse(s));
    last_com := length(s) - position(',' in reverse(s));
    IF last_com > last_dot THEN
      IF n_com > 1 THEN RETURN NULL; END IF;
      s := replace(s, '.', '');
      s := replace(s, ',', '.');
    ELSE
      IF n_dot > 1 THEN RETURN NULL; END IF;
      s := replace(s, ',', '');
    END IF;
  ELSIF n_com > 0 THEN
    IF n_com > 1 THEN RETURN NULL; END IF;
    s := replace(s, ',', '.');
  ELSIF n_dot > 1 THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN s::numeric;
  EXCEPTION WHEN others THEN RETURN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.parse_mz40_valor(text) TO authenticated, service_role;

DO $$
BEGIN
  IF public.parse_mz40_valor(NULL) IS DISTINCT FROM NULL THEN RAISE EXCEPTION 'TRAVADO_PARSE_NULL'; END IF;
  IF public.parse_mz40_valor('') IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'TRAVADO_PARSE_VAZIO'; END IF;
  IF public.parse_mz40_valor('-') IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'TRAVADO_PARSE_HIFEN'; END IF;
  IF public.parse_mz40_valor('1.234,56') IS DISTINCT FROM 1234.56 THEN RAISE EXCEPTION 'TRAVADO_PARSE_BR'; END IF;
  IF public.parse_mz40_valor('1234.56') IS DISTINCT FROM 1234.56 THEN RAISE EXCEPTION 'TRAVADO_PARSE_DECIMAL'; END IF;
  IF public.parse_mz40_valor('1,234.56') IS DISTINCT FROM 1234.56 THEN RAISE EXCEPTION 'TRAVADO_PARSE_US'; END IF;
  IF public.parse_mz40_valor('27,42') IS DISTINCT FROM 27.42 THEN RAISE EXCEPTION 'TRAVADO_PARSE_VIRGULA_DECIMAL'; END IF;
  IF public.parse_mz40_valor('27,042,27') IS NOT NULL THEN RAISE EXCEPTION 'TRAVADO_PARSE_MULTI_VIRGULA_DEVERIA_NULL'; END IF;
  IF public.parse_mz40_valor('abc') IS NOT NULL THEN RAISE EXCEPTION 'TRAVADO_PARSE_TEXTO_DEVERIA_NULL'; END IF;
  IF public.parse_mz40_valor('12-3') IS NOT NULL THEN RAISE EXCEPTION 'TRAVADO_PARSE_HIFEN_INTERNO_DEVERIA_NULL'; END IF;
END $$;

DROP FUNCTION IF EXISTS public.normaliza_alias_banco(text);
CREATE FUNCTION public.normaliza_alias_banco(_in text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        upper(
          translate(
            btrim(coalesce(_in,'')),
            E'\u00E1\u00E0\u00E2\u00E3\u00E4\u00E9\u00E8\u00EA\u00EB\u00ED\u00EC\u00EE\u00EF\u00F3\u00F2\u00F4\u00F5\u00F6\u00FA\u00F9\u00FB\u00FC\u00E7\u00C1\u00C0\u00C2\u00C3\u00C4\u00C9\u00C8\u00CA\u00CB\u00CD\u00CC\u00CE\u00CF\u00D3\u00D2\u00D4\u00D5\u00D6\u00DA\u00D9\u00DB\u00DC\u00C7\u2010\u2011\u2012\u2013\u2014\u2015',
            'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC------'
          )
        ),
        '\s*-\s*', '-', 'g'
      ),
      '\s+', ' ', 'g'
    ),
  '');
$$;

GRANT EXECUTE ON FUNCTION public.normaliza_alias_banco(text) TO authenticated, service_role;

DO $$
DECLARE v_ref text := 'BB HAGG-APLICACAO';
BEGIN
  IF public.normaliza_alias_banco('BB HAGG- APLICAÇÃO') IS DISTINCT FROM v_ref THEN
    RAISE EXCEPTION 'TRAVADO_NORMALIZA_ALIAS_1: %', public.normaliza_alias_banco('BB HAGG- APLICAÇÃO');
  END IF;
  IF public.normaliza_alias_banco('BB HAGG - APLICAÇÃO') IS DISTINCT FROM v_ref THEN
    RAISE EXCEPTION 'TRAVADO_NORMALIZA_ALIAS_2: %', public.normaliza_alias_banco('BB HAGG - APLICAÇÃO');
  END IF;
  IF public.normaliza_alias_banco('BB HAGG – APLICACAO') IS DISTINCT FROM v_ref THEN
    RAISE EXCEPTION 'TRAVADO_NORMALIZA_ALIAS_3: %', public.normaliza_alias_banco('BB HAGG – APLICACAO');
  END IF;
  IF public.normaliza_alias_banco('bb  hagg  -  aplicacao') IS DISTINCT FROM v_ref THEN
    RAISE EXCEPTION 'TRAVADO_NORMALIZA_ALIAS_4: %', public.normaliza_alias_banco('bb  hagg  -  aplicacao');
  END IF;
  IF public.normaliza_alias_banco('   ') IS NOT NULL THEN
    RAISE EXCEPTION 'TRAVADO_NORMALIZA_ALIAS_VAZIO';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.pres_caixa_status();
CREATE FUNCTION public.pres_caixa_status()
RETURNS TABLE (
  empresa_id uuid,
  empresa_codigo text,
  eh_hagg boolean,
  saldo_inicial numeric,
  entradas numeric,
  saidas numeric,
  saldo_liquido numeric,
  mov_com_alias bigint,
  mov_sem_match bigint,
  qtd_valores_invalidos bigint,
  pend_outra_empresa bigint,
  pend_aplicacao bigint,
  pend_convenio bigint,
  pend_revisar_humano bigint,
  pend_meio_pagamento bigint,
  status_confiabilidade text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_presidencia boolean := false;
  v_acessa_todas boolean := false;
  v_tem_permissao boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sem_sessao' USING ERRCODE = '42501';
  END IF;
  v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);
  v_is_presidencia := public.has_role(v_uid, 'presidencia'::public.app_role);
  SELECT COALESCE(p.acessa_todas_empresas, false) INTO v_acessa_todas
  FROM public.profiles p WHERE p.id = v_uid;
  v_acessa_todas := COALESCE(v_acessa_todas, false);
  v_tem_permissao := v_is_admin OR v_is_presidencia
    OR public.can_access(v_uid, 'presidencia', 'visualizar'::public.app_acao, NULL::uuid, NULL::text);
  IF NOT v_tem_permissao THEN
    RAISE EXCEPTION 'permissao_negada_presidencia' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH escopo AS (
    SELECT e.id, e.codigo, (e.codigo = 'HAGG') AS eh_hagg
    FROM public.empresas e
    WHERE e.ativa = true
      AND (v_is_admin OR v_is_presidencia OR v_acessa_todas OR public.user_pode_atuar_empresa(v_uid, e.id))
  ),
  saldo AS (
    SELECT cc.empresa_id, SUM(COALESCE(cc.saldo_inicial,0)) AS saldo_inicial
    FROM public.conta_contabil cc
    WHERE cc.tipo = 'analitica' AND cc.ativo = true AND cc.classificacao LIKE '01.1.1%'
    GROUP BY cc.empresa_id
  ),
  mov AS (
    SELECT
      esc.id AS empresa_id,
      COALESCE(SUM(COALESCE(public.parse_mz40_valor(m.valor_entrada),0)),0) AS entradas,
      COALESCE(SUM(COALESCE(public.parse_mz40_valor(m.valor_saida),0)),0) AS saidas,
      COUNT(*) FILTER (WHERE a.id IS NOT NULL) AS mov_com_alias,
      COUNT(*) FILTER (WHERE a.id IS NULL AND m.empresa IS NOT NULL) AS mov_sem_match,
      COUNT(*) FILTER (
        WHERE m.empresa IS NOT NULL
          AND (
            (NULLIF(btrim(COALESCE(m.valor_entrada,'')), '') IS NOT NULL AND public.parse_mz40_valor(m.valor_entrada) IS NULL)
            OR
            (NULLIF(btrim(COALESCE(m.valor_saida,'')), '') IS NOT NULL AND public.parse_mz40_valor(m.valor_saida) IS NULL)
          )
      ) AS qtd_valores_invalidos
    FROM escopo esc
    LEFT JOIN public.mz_40_fato_fluxo_caixa_realizado m
      ON m.empresa = esc.codigo AND m.excluir_do_fluxo = false
    LEFT JOIN public.integration_alias_bancos a
      ON a.empresa_id = esc.id
     AND a.status = 'aprovado'::public.integ_alias_status
     AND a.alias = public.normaliza_alias_banco(COALESCE(m.banco, m.conta_banco_nome))
    GROUP BY esc.id
  ),
  pend AS (
    SELECT a.empresa_id,
      COUNT(*) FILTER (WHERE a.origem = 'pend:banco_de_outra_empresa_em_hagg') AS pend_outra_empresa,
      COUNT(*) FILTER (WHERE a.origem = 'pend:criar_conta_contabil_aplicacao_financeira') AS pend_aplicacao,
      COUNT(*) FILTER (WHERE a.origem = 'pend:conta_vinculada_contrato_convenio') AS pend_convenio,
      COUNT(*) FILTER (WHERE a.origem = 'pend:revisar_humano') AS pend_revisar_humano,
      COUNT(*) FILTER (WHERE a.origem = 'pend:meio_pagamento_nao_banco') AS pend_meio_pagamento
    FROM public.integration_alias_bancos a
    WHERE a.status = 'pendente'::public.integ_alias_status
    GROUP BY a.empresa_id
  )
  SELECT
    esc.id, esc.codigo, esc.eh_hagg,
    COALESCE(s.saldo_inicial,0),
    COALESCE(mv.entradas,0),
    COALESCE(mv.saidas,0),
    COALESCE(mv.entradas,0) - COALESCE(mv.saidas,0),
    COALESCE(mv.mov_com_alias,0),
    COALESCE(mv.mov_sem_match,0),
    COALESCE(mv.qtd_valores_invalidos,0),
    COALESCE(p.pend_outra_empresa,0),
    COALESCE(p.pend_aplicacao,0),
    COALESCE(p.pend_convenio,0),
    COALESCE(p.pend_revisar_humano,0),
    COALESCE(p.pend_meio_pagamento,0),
    CASE
      WHEN COALESCE(mv.qtd_valores_invalidos,0) > 0 THEN 'BLOQUEADO'
      WHEN esc.eh_hagg AND COALESCE(mv.mov_sem_match,0) = 0 THEN 'VALIDADO'
      WHEN esc.eh_hagg THEN 'INFERIDO'
      WHEN COALESCE(mv.mov_com_alias,0) > 0 THEN 'PENDENTE'
      ELSE 'BLOQUEADO'
    END
  FROM escopo esc
  LEFT JOIN saldo s ON s.empresa_id = esc.id
  LEFT JOIN mov mv ON mv.empresa_id = esc.id
  LEFT JOIN pend p ON p.empresa_id = esc.id
  ORDER BY esc.codigo;
END;
$$;

REVOKE ALL ON FUNCTION public.pres_caixa_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pres_caixa_status() TO authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.pres_caixa_status() LIMIT 1;
  EXCEPTION WHEN sqlstate '42501' THEN NULL;
  END;
END $$;

DO $$
DECLARE v_bad int;
BEGIN
  WITH mapa(codigo, razao_social, cnpj) AS (
    VALUES
      ('AGPS',  'AGPS ADMINISTRADORA E PARTICIPACOES LTDA',        '29.722.947/0001-98'),
      ('CANAA', 'INSTITUTO DE ENSINO CANAA',                       '24.354.749/0001-03'),
      ('HAGG',  'NASCIMENTO SERVICOS DE LIMPEZA LTDA',             '03.644.009/0001-23'),
      ('NH',    'NH PRESTACAO DE SERVICOS LTDA',                   '18.615.832/0001-88'),
      ('SN',    'SN SERVICOS DE LIMPEZA E ZELADORIA PREDIAL LTDA', '17.290.783/0001-98'),
      ('LF',    'LF ZELADORIA LTDA',                               '27.579.296/0001-01')
  )
  SELECT COUNT(*) INTO v_bad
  FROM public.empresas e JOIN mapa m ON m.codigo=e.codigo
  WHERE e.cnpj IS DISTINCT FROM m.cnpj OR e.razao_social IS DISTINCT FROM m.razao_social;
  IF v_bad <> 0 THEN RAISE EXCEPTION 'TRAVADO_POSCHECK_FINAL_CNPJ_DIVERGENTE (qtd=%)', v_bad; END IF;
END $$;

COMMIT;