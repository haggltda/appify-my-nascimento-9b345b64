
CREATE OR REPLACE VIEW public.v_fluxo_caixa_consolidado AS
WITH base AS (
  SELECT empresa_id, data_recebimento::date AS data_caixa,
         COALESCE(valor_recebido, valor) AS valor,
         'entrada'::text AS direcao, 'realizado'::text AS regime
    FROM public.titulo_receber
   WHERE status IN ('pago','parcial') AND data_recebimento IS NOT NULL
  UNION ALL
  SELECT empresa_id, data_pagamento::date, COALESCE(valor_pago, valor),
         'saida'::text, 'realizado'::text
    FROM public.titulo_pagar
   WHERE status IN ('pago','parcial') AND data_pagamento IS NOT NULL
  UNION ALL
  SELECT empresa_id, data_vencimento::date,
         valor - COALESCE(valor_recebido,0),
         'entrada'::text, 'projetado'::text
    FROM public.titulo_receber
   WHERE status IN ('aberto','parcial','vencido')
  UNION ALL
  SELECT empresa_id, COALESCE(data_agendamento, data_vencimento)::date,
         valor - COALESCE(valor_pago,0),
         'saida'::text, 'projetado'::text
    FROM public.titulo_pagar
   WHERE status IN ('aberto','agendado','parcial','vencido')
)
SELECT empresa_id,
       EXTRACT(YEAR FROM data_caixa)::int AS ano,
       EXTRACT(MONTH FROM data_caixa)::int AS mes,
       regime,
       SUM(CASE WHEN direcao='entrada' THEN valor ELSE 0 END) AS entradas,
       SUM(CASE WHEN direcao='saida' THEN valor ELSE 0 END) AS saidas,
       SUM(CASE WHEN direcao='entrada' THEN valor ELSE -valor END) AS saldo
  FROM base
 WHERE data_caixa IS NOT NULL
 GROUP BY empresa_id, EXTRACT(YEAR FROM data_caixa), EXTRACT(MONTH FROM data_caixa), regime;

GRANT SELECT ON public.v_fluxo_caixa_consolidado TO authenticated;

CREATE OR REPLACE FUNCTION public.obz_versao_criar(_empresa_id uuid, _ano int, _nome text DEFAULT NULL, _descricao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_versao int; m int;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT COALESCE(MAX(versao),0)+1 INTO v_versao FROM obz_versoes WHERE empresa_id=_empresa_id AND ano=_ano;
  INSERT INTO obz_versoes(empresa_id, ano, versao, revisao, nome, descricao, status, criado_por)
  VALUES (_empresa_id, _ano, v_versao, 0, COALESCE(_nome, 'OBZ '||_ano||' v'||v_versao), _descricao, 'rascunho'::obz_status, auth.uid())
  RETURNING id INTO v_id;
  FOR m IN 1..12 LOOP
    INSERT INTO obz_periodos(versao_id, mes, status) VALUES (v_id, m, 'rascunho'::obz_status);
  END LOOP;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.obz_versao_submeter(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE obz_versoes SET status='em_aprovacao'::obz_status WHERE id=_id AND status='rascunho';
  IF NOT FOUND THEN RAISE EXCEPTION 'Versão não está em rascunho'; END IF;
  UPDATE obz_periodos SET status='em_aprovacao'::obz_status WHERE versao_id=_id AND status='rascunho';
END $$;

CREATE OR REPLACE FUNCTION public.obz_versao_aprovar(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Apenas admin, controladoria ou diretor adm aprovam OBZ';
  END IF;
  UPDATE obz_versoes SET status='aprovada'::obz_status, aprovado_por=auth.uid(), aprovado_em=now()
   WHERE id=_id AND status='em_aprovacao';
  IF NOT FOUND THEN RAISE EXCEPTION 'Versão não está em aprovação'; END IF;
  UPDATE obz_periodos SET status='aprovada'::obz_status WHERE versao_id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.obz_versao_arquivar(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE obz_versoes SET status='arquivada'::obz_status WHERE id=_id;
  UPDATE obz_periodos SET status='arquivada'::obz_status WHERE versao_id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.obz_valor_upsert(
  _versao_id uuid, _dre_linha_id uuid, _centro_custo_id uuid, _mes int, _valor numeric, _memoria text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_per uuid; v_ver_status obz_status; v_id uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm') OR has_role(auth.uid(),'gestor_cc')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT status INTO v_ver_status FROM obz_versoes WHERE id=_versao_id;
  IF v_ver_status IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;
  IF v_ver_status NOT IN ('rascunho','em_aprovacao') THEN RAISE EXCEPTION 'Versão já aprovada/arquivada — não editável'; END IF;
  SELECT id INTO v_per FROM obz_periodos WHERE versao_id=_versao_id AND mes=_mes;
  IF v_per IS NULL THEN RAISE EXCEPTION 'Período mês % não existe', _mes; END IF;

  SELECT id INTO v_id FROM obz_valores
   WHERE versao_id=_versao_id AND periodo_id=v_per AND dre_linha_id=_dre_linha_id
     AND centro_custo_id IS NOT DISTINCT FROM _centro_custo_id;
  IF v_id IS NULL THEN
    INSERT INTO obz_valores(versao_id, periodo_id, dre_linha_id, centro_custo_id, valor, memoria_calculo)
    VALUES (_versao_id, v_per, _dre_linha_id, _centro_custo_id, _valor, _memoria) RETURNING id INTO v_id;
  ELSE
    UPDATE obz_valores SET valor=_valor, memoria_calculo=_memoria WHERE id=v_id;
  END IF;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.obz_versao_criar(uuid,int,text,text),
                          public.obz_versao_submeter(uuid),
                          public.obz_versao_aprovar(uuid),
                          public.obz_versao_arquivar(uuid),
                          public.obz_valor_upsert(uuid,uuid,uuid,int,numeric,text) TO authenticated;
