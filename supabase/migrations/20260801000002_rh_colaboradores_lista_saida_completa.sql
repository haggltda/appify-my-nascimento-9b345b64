-- =========================================================================
-- RH — Colaboradores: lista de SAÍDA mostra o histórico completo
--
-- Bug: filtrar por uma situação de saída (Demitido/Desligado/Rescisão/
-- Aposentadoria) trazia só quem "saiu no mês" de referência, porque a lista
-- aplicava a mesma regra de PRESENÇA do dashboard (afastamento >= inicio do
-- mes). Resultado: "Demitido" mostrava um punhado em vez de todos.
--
-- Correção: quando o filtro _situacao e uma situacao de SAIDA, a lista ignora
-- o recorte de presença no mês e devolve TODOS com aquela situacao (para
-- consulta/edição do cadastro). O dashboard (rh_colaboradores_dashboard)
-- continua com a régua de presença no mês, inalterado.
--
-- Só recria rh_colaboradores_lista (CREATE OR REPLACE, mesma assinatura).
-- Idempotente. Aplicar no banco do app.
-- =========================================================================

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
  -- Filtro explicito por situacao de SAIDA: navegar o historico completo.
  v_saida boolean := v_sit ~* '(DEMIT|DESLIG|RESCIS|APOSENT)';
  v_out jsonb;
BEGIN
  WITH fil AS (
    SELECT v.* FROM public.v_rh_colaboradores v
     WHERE (v_saida
            OR ((v.admissao IS NULL OR v.admissao <= v_fim)
                AND (NOT v.eh_saida OR (v.afastamento IS NOT NULL AND v.afastamento >= v_ini))))
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

NOTIFY pgrst, 'reload schema';
