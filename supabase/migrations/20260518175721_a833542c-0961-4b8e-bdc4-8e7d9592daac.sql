-- 1) Vincular Helena à alçada existente
UPDATE public.alcada_aprovacao
SET responsavel_user_id = '60e5bb0a-c0ae-4434-950f-9fdaecb01ea7',
    responsavel_nome = 'Helena Nascimento'
WHERE responsavel_user_id IS NULL AND etapa = 'Presidência';

-- 2) Tornar responsavel_user_id obrigatório
ALTER TABLE public.alcada_aprovacao
  ALTER COLUMN responsavel_user_id SET NOT NULL;

-- 3) Reescrever submeter para usar alçada + setar aprovador + criar notificação
CREATE OR REPLACE FUNCTION public.programacao_submeter_aprovacao(p_programacao_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emp uuid; v_valor numeric; v_qtd int; v_data date;
  v_apr_id uuid; v_aprovador uuid; v_etapa_nome text; v_codigo text;
BEGIN
  SELECT empresa_id, valor_total, qtd_titulos, data_pagamento
    INTO v_emp, v_valor, v_qtd, v_data
  FROM malote_pagamento WHERE id = p_programacao_id FOR UPDATE;

  IF v_emp IS NULL THEN RAISE EXCEPTION 'Programação não encontrada'; END IF;
  IF v_qtd = 0 THEN RAISE EXCEPTION 'Programação sem títulos'; END IF;
  IF v_data IS NULL THEN RAISE EXCEPTION 'Data programada de pagamento obrigatória'; END IF;

  -- Buscar alçada por faixa de valor
  SELECT responsavel_user_id, etapa
    INTO v_aprovador, v_etapa_nome
  FROM alcada_aprovacao
  WHERE empresa_id = v_emp
    AND ativo = true
    AND v_valor >= valor_min
    AND (valor_max IS NULL OR v_valor <= valor_max)
  ORDER BY ordem, valor_min DESC
  LIMIT 1;

  IF v_aprovador IS NULL THEN
    RAISE EXCEPTION 'Nenhuma alçada configurada para o valor R$ % nesta empresa. Cadastre em Administração > Alçadas.', v_valor;
  END IF;

  UPDATE malote_pagamento
     SET aprovacao_status = 'pendente',
         enviado_aprovacao_por = auth.uid(),
         enviado_aprovacao_em = now(),
         status = 'enviado'
   WHERE id = p_programacao_id;

  INSERT INTO financeiro_pagamento_aprovacao
    (empresa_id, programacao_id, etapa, decisao, valor_aprovado, data_pagamento_aprovada, aprovador_id)
  VALUES
    (v_emp, p_programacao_id, 1, 'pendente', v_valor, v_data, v_aprovador)
  RETURNING id INTO v_apr_id;

  -- Notificação para o aprovador
  INSERT INTO notificacoes (user_id, empresa_id, titulo, mensagem, tipo, link)
  VALUES (
    v_aprovador, v_emp,
    'Pagamento aguardando sua aprovação',
    format('Programação de R$ %s com %s título(s) aguarda aprovação da etapa %s.',
           to_char(v_valor, 'FM999G999G990D00'), v_qtd, v_etapa_nome),
    'aprovacao_pagamento',
    '/app/aprovacoes/inbox?id=' || p_programacao_id::text
  );

  INSERT INTO financeiro_pagamento_log (empresa_id, programacao_id, acao, detalhes, usuario_id)
  VALUES (v_emp, p_programacao_id, 'submeter_aprovacao',
          jsonb_build_object('valor', v_valor, 'qtd', v_qtd, 'aprovador', v_aprovador, 'etapa', v_etapa_nome),
          auth.uid());

  RETURN v_apr_id;
END $function$;