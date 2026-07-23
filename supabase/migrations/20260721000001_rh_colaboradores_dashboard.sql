-- =========================================================================
-- RH / Colaboradores — dashboard e lista calculados NO BANCO
--
-- A tela baixava as ~12.5 mil linhas da EMPREGADOS a cada abertura e fazia
-- KPIs, gráficos e paginação no navegador. Aqui o banco devolve os agregados
-- prontos (um JSON de poucos KB) e a lista já paginada — a tela passa a
-- trafegar ~50 linhas em vez de 12.556.
--
-- As regras são as MESMAS da tela (foram portadas do TSX, não reinventadas):
--   • empresa: código 1/2/3/5 → HAGG/SN/CANAÃ/NH, com fallback pelo nome;
--   • contrato: CONTRATOS ativo casado pela Filial, senão a coluna Contrato;
--   • cargo: "Título do Cargo", caindo p/ "Nome do Cargo";
--   • quadro do mês: admitido até o fim do mês e, para quem REALMENTE saiu
--     (Demitido/Desligado/Rescisão/Aposentadoria), afastamento do início do
--     mês em diante — "Data Afastamento" sozinha não vale, a folha também a
--     preenche em férias/atestado. Saída sem data legível fica FORA (a pessoa
--     saiu; sem saber quando, não dá para afirmar que estava presente).
--
-- Funções: STABLE e SECURITY INVOKER (a RLS da EMPREGADOS continua mandando).
-- =========================================================================

-- 1) Auxiliares de parse ---------------------------------------------------
-- A EMPREGADOS veio da folha: data em "DD/MM/AAAA" e salário em texto pt-BR
-- ("2.002,6900"), mas algumas colunas podem já ser date/numeric. Recebem text
-- para funcionar nos dois casos (basta chamar com ::text) e NUNCA levantam
-- erro de cast — valor estranho vira NULL/0 em vez de derrubar a consulta.

-- Expressão ÚNICA de propósito: função SQL com WITH o planejador não inlineia,
-- vira uma chamada por linha (12 mil linhas × 3 colunas) e a consulta estoura
-- o statement_timeout.
CREATE OR REPLACE FUNCTION public.rh_num(_v text)
RETURNS numeric LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN _v IS NULL OR btrim(_v) = ''  THEN 0::numeric
    WHEN _v ~ '^\s*-?[\d.]*\d,\d+\s*$' THEN replace(replace(btrim(_v), '.', ''), ',', '.')::numeric  -- 2.002,69
    WHEN _v ~ '^\s*-?\d+(\.\d+)?\s*$'  THEN btrim(_v)::numeric                                       -- 3600.21
    ELSE 0::numeric
  END;
$$;

-- Aceita "DD/MM/AAAA" e ISO, com ou sem zero à esquerda ("1/4/2019"), e trata
-- ano anterior a 1900 como SEM DATA: 30/12/1899 é o "vazio" do sistema legado
-- (serial 0 do Excel), não uma data real.
-- O ano 19xx/20xx dentro do próprio regex já descarta o 30/12/1899, e o
-- \d{1,2} aceita data sem zero à esquerda. Sem CTE, pelo mesmo motivo da rh_num.
CREATE OR REPLACE FUNCTION public.rh_data(_v text)
RETURNS date LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN _v ~ '^(0?[1-9]|[12]\d|3[01])/(0?[1-9]|1[0-2])/(19|20)\d{2}'
      THEN to_date(regexp_replace(_v, '^(\d{1,2})/(\d{1,2})/(\d{4}).*$', '\3-\2-\1'), 'YYYY-MM-DD')
    WHEN _v ~ '^(19|20)\d{2}-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])'
      THEN to_date(regexp_replace(_v, '^(\d{4})-(\d{1,2})-(\d{1,2}).*$', '\1-\2-\3'), 'YYYY-MM-DD')
    ELSE NULL
  END;
$$;

-- Mesma regra do EMPRESA_MAP da tela.
CREATE OR REPLACE FUNCTION public.rh_empresa(_cod text, _nome text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE btrim(coalesce(_cod, ''))
    WHEN '1' THEN 'HAGG'
    WHEN '2' THEN 'SN'
    WHEN '3' THEN 'CANAÃ'
    WHEN '5' THEN 'NH'
    ELSE CASE
      WHEN upper(coalesce(_nome, '')) LIKE '%HAGG%' THEN 'HAGG'
      WHEN upper(coalesce(_nome, '')) LIKE '%CANA%' THEN 'CANAÃ'
      WHEN upper(coalesce(_nome, '')) ~ '\mNH\M'    THEN 'NH'
      WHEN upper(coalesce(_nome, '')) ~ '\mSN\M'    THEN 'SN'
      ELSE nullif(btrim(coalesce(_nome, '')), '')
    END
  END;
$$;

-- 2) Recorte comum ---------------------------------------------------------
-- View com as colunas já normalizadas: as duas RPCs partem daqui, então
-- dashboard e lista nunca divergem de critério.
CREATE OR REPLACE VIEW public.v_rh_colaboradores AS
WITH ct AS (
  SELECT DISTINCT ON (btrim(c."Filial"::text))
         btrim(c."Filial"::text) AS filial,
         btrim(coalesce(c."NOME CONTRATO", '')) AS nome
    FROM public."CONTRATOS" c
   WHERE c."ATIVO" = 'SIM' AND c."Filial" IS NOT NULL
)
SELECT
  e."ID"                                                            AS id,
  coalesce(e."Nome", '')                                            AS nome,
  coalesce(e."CPF", '')                                             AS cpf,
  coalesce(nullif(btrim(coalesce(e."Título do Cargo", '')), ''),
           nullif(btrim(coalesce(e."Nome do Cargo", '')), ''), '—') AS cargo,
  coalesce(public.rh_empresa(e."Empresa"::text, e."Nome da Empresa"), '—') AS empresa,
  -- A EMPREGADOS não tem coluna "Contrato": o vínculo é só pela Filial. (O
  -- código da tela tinha um fallback para e["Contrato"] que nunca valia nada.)
  coalesce(nullif(ct.nome, ''), '—')                                AS contrato,
  coalesce(nullif(btrim(coalesce(e."Nome Filial", '')), ''),
           nullif(btrim(coalesce(e."Filial"::text, '')), ''), '—')  AS filial,
  btrim(coalesce(e."Situação", ''))                                 AS situacao,
  btrim(coalesce(e."Setor_ERP", ''))                                AS setor,
  public.rh_data(e."Admissão"::text)                                AS admissao,
  public.rh_data(e."Data Afastamento"::text)                        AS afastamento,
  public.rh_num(e."Valor Salário"::text)                            AS salario,
  (btrim(coalesce(e."Situação", '')) ~* '(DEMIT|DESLIG|RESCIS|APOSENT)') AS eh_saida,
  (coalesce(e."Nome", '') || ' ' || coalesce(e."CPF", '') || ' ' ||
   coalesce(e."Título do Cargo", '') || ' ' || coalesce(e."Nome do Cargo", '') || ' ' ||
   coalesce(e."Nome Filial", '') || ' ' || coalesce(e."Setor_ERP", ''))  AS busca_txt
FROM public."EMPREGADOS" e
LEFT JOIN ct ON ct.filial = btrim(e."Filial"::text);

-- A view herda a RLS da EMPREGADOS (security_invoker), não a contorna.
ALTER VIEW public.v_rh_colaboradores SET (security_invoker = true);
REVOKE ALL ON public.v_rh_colaboradores FROM PUBLIC, anon;
GRANT SELECT ON public.v_rh_colaboradores TO authenticated;

-- 3) Dashboard -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_colaboradores_dashboard(
  _ano int, _mes int,
  _empresa text DEFAULT '', _contrato text DEFAULT '', _situacao text DEFAULT '', _busca text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_ini date := make_date(_ano, _mes, 1);
  v_fim date := (make_date(_ano, _mes, 1) + interval '1 month' - interval '1 day')::date;
  v_q   text := nullif(btrim(coalesce(_busca, '')), '');
  -- coalesce nos filtros: um NULL vindo do cliente faria `NULL = ''` virar
  -- NULL e o WHERE descartaria tudo silenciosamente.
  v_emp text := coalesce(_empresa, '');
  v_ctr text := coalesce(_contrato, '');
  v_sit text := coalesce(_situacao, '');
  v_ano int  := extract(year from current_date)::int;
  v_out jsonb;
BEGIN
  WITH flags AS (
    SELECT v.*,
      -- No quadro do mês: admitido até o fim do mês e, para quem tem situação
      -- de SAÍDA, com afastamento do início do mês em diante. Saída sem data
      -- legível fica de fora: a pessoa saiu, só não sabemos quando — contá-la
      -- como presente em TODO mês inflava o quadro com demitidos antigos.
      ((v.admissao IS NULL OR v.admissao <= v_fim)
        AND (NOT v.eh_saida OR (v.afastamento IS NOT NULL AND v.afastamento >= v_ini))) AS no_mes,
      (v_emp = '' OR v.empresa  = v_emp) AS f_emp,
      (v_ctr = '' OR v.contrato = v_ctr) AS f_ctr,
      (v_sit = '' OR v.situacao = v_sit) AS f_sit,
      (v_q IS NULL OR v.busca_txt ILIKE '%' || v_q || '%') AS f_bus
    FROM public.v_rh_colaboradores v
  ),
  fil    AS (SELECT * FROM flags WHERE no_mes AND f_emp AND f_ctr AND f_sit AND f_bus),
  semsit AS (SELECT * FROM flags WHERE no_mes AND f_emp AND f_ctr AND f_bus),
  tempo  AS (SELECT * FROM flags WHERE f_emp AND f_ctr)
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'ativos_mes', (SELECT count(*) FROM semsit),
      'no_recorte', (SELECT count(*) FROM fil),
      'total',      (SELECT count(*) FROM flags),
      'folha',      (SELECT coalesce(sum(salario), 0) FROM fil),
      'admitidos',  (SELECT count(*) FROM tempo WHERE admissao BETWEEN v_ini AND v_fim),
      'desligados', (SELECT count(*) FROM tempo WHERE eh_saida AND afastamento BETWEEN v_ini AND v_fim)
    ),
    'por_empresa',   (SELECT coalesce(jsonb_agg(jsonb_build_object('k', k, 'v', v) ORDER BY v DESC), '[]'::jsonb)
                        FROM (SELECT empresa AS k, count(*) AS v FROM fil GROUP BY 1) t),
    'folha_empresa', (SELECT coalesce(jsonb_agg(jsonb_build_object('k', k, 'v', v) ORDER BY v DESC), '[]'::jsonb)
                        FROM (SELECT empresa AS k, coalesce(sum(salario), 0) AS v FROM fil GROUP BY 1) t),
    'por_situacao',  (SELECT coalesce(jsonb_agg(jsonb_build_object('k', k, 'v', v) ORDER BY v DESC), '[]'::jsonb)
                        FROM (SELECT coalesce(nullif(situacao, ''), '—') AS k, count(*) AS v FROM semsit GROUP BY 1) t),
    'por_cargo',     (SELECT coalesce(jsonb_agg(jsonb_build_object('k', k, 'v', v) ORDER BY v DESC), '[]'::jsonb)
                        FROM (SELECT cargo AS k, count(*) AS v FROM semsit GROUP BY 1) t),
    'por_contrato',  (SELECT coalesce(jsonb_agg(jsonb_build_object('k', k, 'v', v) ORDER BY v DESC), '[]'::jsonb)
                        FROM (SELECT contrato AS k, count(*) AS v FROM fil GROUP BY 1 ORDER BY 2 DESC LIMIT 10) t),
    'por_faixa',     (SELECT jsonb_agg(jsonb_build_object('label', f.label, 'n',
                              (SELECT count(*) FROM fil x
                                WHERE x.admissao IS NOT NULL
                                  AND ((current_date - x.admissao) / 365.25) >= f.mn
                                  AND ((current_date - x.admissao) / 365.25) <  f.mx)) ORDER BY f.ord)
                        FROM (VALUES (1, '< 1 ano', 0::numeric, 1::numeric), (2, '1–3 anos', 1, 3),
                                     (3, '3–5 anos', 3, 5), (4, '5–10 anos', 5, 10),
                                     (5, '10+ anos', 10, 9999)) AS f(ord, label, mn, mx)),
    'timeline',      (SELECT coalesce(jsonb_agg(jsonb_build_object('ano', ano, 'adm', adm, 'desl', desl) ORDER BY ano), '[]'::jsonb)
                        FROM (SELECT a.ano,
                                     count(*) FILTER (WHERE a.tipo = 'adm')  AS adm,
                                     count(*) FILTER (WHERE a.tipo = 'desl') AS desl
                                FROM (SELECT extract(year from admissao)::int AS ano, 'adm' AS tipo
                                        FROM tempo WHERE admissao IS NOT NULL
                                       UNION ALL
                                      SELECT extract(year from afastamento)::int, 'desl'
                                        FROM tempo WHERE eh_saida AND afastamento IS NOT NULL) a
                               WHERE a.ano BETWEEN v_ano - 6 AND v_ano
                               GROUP BY a.ano) z),
    'opcoes', jsonb_build_object(
      'empresas',  (SELECT coalesce(jsonb_agg(DISTINCT empresa  ORDER BY empresa),  '[]'::jsonb) FROM flags WHERE empresa  <> '—'),
      'contratos', (SELECT coalesce(jsonb_agg(DISTINCT contrato ORDER BY contrato), '[]'::jsonb) FROM flags WHERE contrato <> '—'),
      'situacoes', (SELECT coalesce(jsonb_agg(DISTINCT situacao ORDER BY situacao), '[]'::jsonb) FROM flags WHERE situacao <> ''),
      'setores',   (SELECT coalesce(jsonb_agg(DISTINCT setor    ORDER BY setor),    '[]'::jsonb) FROM flags WHERE setor    <> '')
    )
  ) INTO v_out;
  RETURN v_out;
END $$;

REVOKE ALL ON FUNCTION public.rh_colaboradores_dashboard(int, int, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_colaboradores_dashboard(int, int, text, text, text, text) TO authenticated;

-- 4) Lista paginada --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_colaboradores_lista(
  _ano int, _mes int,
  _empresa text DEFAULT '', _contrato text DEFAULT '', _situacao text DEFAULT '', _busca text DEFAULT '',
  _offset int DEFAULT 0, _limite int DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_ini date := make_date(_ano, _mes, 1);
  v_fim date := (make_date(_ano, _mes, 1) + interval '1 month' - interval '1 day')::date;
  v_q   text := nullif(btrim(coalesce(_busca, '')), '');
  v_emp text := coalesce(_empresa, '');
  v_ctr text := coalesce(_contrato, '');
  v_sit text := coalesce(_situacao, '');
  v_out jsonb;
BEGIN
  WITH fil AS (
    SELECT v.* FROM public.v_rh_colaboradores v
     WHERE (v.admissao IS NULL OR v.admissao <= v_fim)
       AND (NOT v.eh_saida OR (v.afastamento IS NOT NULL AND v.afastamento >= v_ini))
       AND (v_emp = '' OR v.empresa  = v_emp)
       AND (v_ctr = '' OR v.contrato = v_ctr)
       AND (v_sit = '' OR v.situacao = v_sit)
       AND (v_q IS NULL OR v.busca_txt ILIKE '%' || v_q || '%')
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM fil),
    'linhas', (SELECT coalesce(jsonb_agg(to_jsonb(p) - 'busca_txt' - 'eh_saida'), '[]'::jsonb)
                 FROM (SELECT * FROM fil ORDER BY nome, id OFFSET greatest(_offset, 0) LIMIT least(greatest(_limite, 1), 500)) p)
  ) INTO v_out;
  RETURN v_out;
END $$;

REVOKE ALL ON FUNCTION public.rh_colaboradores_lista(int, int, text, text, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_colaboradores_lista(int, int, text, text, text, text, int, int) TO authenticated;

-- 5) Índices que sustentam os filtros --------------------------------------
CREATE INDEX IF NOT EXISTS empregados_nome_idx     ON public."EMPREGADOS" ("Nome");
CREATE INDEX IF NOT EXISTS empregados_situacao_idx ON public."EMPREGADOS" ("Situação");
CREATE INDEX IF NOT EXISTS empregados_filial_idx   ON public."EMPREGADOS" ("Filial");

NOTIFY pgrst, 'reload schema';
