-- Restringe a transição triagem_inicial → analise_necessidade:
-- apenas Controladoria pode avançar (Comitê pode editar campos, mas não avançar).
-- RODAR MANUALMENTE no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION public.checar_transicao_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_ok boolean;
  v_papeis_assinatura text[];
  v_papel text;
  v_assinado boolean;
  v_faltando text[];
BEGIN
  IF current_setting('app.bypass_etapa_check', true) = 'true' THEN
    NEW.etapa_entrada_em := now();
    IF OLD.etapa = 'aprovacao_priorizacao' THEN
      NEW.prioridade := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Recusar/Encerrar
  IF NEW.recusado IS DISTINCT FROM OLD.recusado AND NEW.recusado = true THEN
    v_ok := CASE OLD.etapa
      WHEN 'solicitacao_demanda' THEN public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria')
      WHEN 'triagem_inicial' THEN public.tem_acesso_menu('sistemas_comite')
      WHEN 'analise_necessidade' THEN public.tem_acesso_menu('sistemas_comite')
      WHEN 'aprovacao_priorizacao' THEN public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_gerente_sistemas')
      ELSE NULL
    END;
    IF v_ok IS NULL OR NOT v_ok THEN
      RAISE EXCEPTION 'Sem permissão para recusar/encerrar nesta etapa.';
    END IF;
  END IF;

  -- Reativar: só Controladoria
  IF OLD.recusado = true AND NEW.recusado = false THEN
    IF NEW.etapa <> 'solicitacao_demanda' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Só a Controladoria pode reativar um card recusado.';
    END IF;
  END IF;

  -- Critério da Triagem Inicial: só Comitê
  IF NEW.criterio_triagem IS DISTINCT FROM OLD.criterio_triagem THEN
    IF OLD.etapa <> 'triagem_inicial' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Critério só pode ser definido na etapa Triagem Inicial, por Comitê.';
    END IF;
  END IF;

  -- Análise de Necessidade: só Comitê
  IF NEW.analise_necessidade_texto IS DISTINCT FROM OLD.analise_necessidade_texto
     OR NEW.analise_necessidade_prazo IS DISTINCT FROM OLD.analise_necessidade_prazo THEN
    IF OLD.etapa <> 'analise_necessidade' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Esses campos só podem ser editados na etapa Análise de Necessidade, por Comitê.';
    END IF;
  END IF;

  -- Levantamento Funcional: só Controladoria
  IF NEW.levantamento_funcional_texto IS DISTINCT FROM OLD.levantamento_funcional_texto
     OR NEW.levantamento_funcional_prazo IS DISTINCT FROM OLD.levantamento_funcional_prazo THEN
    IF OLD.etapa <> 'levantamento_funcional' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Esses campos só podem ser editados na etapa Levantamento Funcional, por Controladoria.';
    END IF;
  END IF;

  -- Documentação Funcional: só Controladoria
  IF NEW.documentacao_tecnica_texto IS DISTINCT FROM OLD.documentacao_tecnica_texto
     OR NEW.documentacao_tecnica_prazo IS DISTINCT FROM OLD.documentacao_tecnica_prazo THEN
    IF OLD.etapa <> 'documentacao_funcional' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Esses campos só podem ser editados na etapa Documentação Funcional, por Controladoria.';
    END IF;
  END IF;

  -- Análise Técnica: só Gerente de Sistemas
  IF NEW.analise_tecnica_texto IS DISTINCT FROM OLD.analise_tecnica_texto
     OR NEW.analise_tecnica_prazo IS DISTINCT FROM OLD.analise_tecnica_prazo THEN
    IF OLD.etapa <> 'analise_tecnica' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Esses campos só podem ser editados na etapa Análise Técnica, por Gerente de Sistemas.';
    END IF;
  END IF;

  -- Prioridade: só Comitê
  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    IF OLD.etapa <> 'aprovacao_priorizacao' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Prioridade só pode ser definida na etapa Aprovação e Priorização, por Comitê.';
    END IF;
  END IF;

  -- Responsável e Complexidade: só Gerente de Sistemas
  IF NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id THEN
    IF OLD.etapa <> 'aprovacao_priorizacao' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Responsável só pode ser definido na etapa Aprovação e Priorização, por Gerente de Sistemas.';
    END IF;
  END IF;
  IF NEW.complexidade IS DISTINCT FROM OLD.complexidade THEN
    IF OLD.etapa <> 'aprovacao_priorizacao' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Complexidade só pode ser definida na etapa Aprovação e Priorização, por Gerente de Sistemas.';
    END IF;
  END IF;

  -- Progresso, prazo e status: Desenvolvedores ou Gerente de Sistemas
  IF NEW.progresso_pct IS DISTINCT FROM OLD.progresso_pct
     OR NEW.data_fim IS DISTINCT FROM OLD.data_fim
     OR NEW.status_desenvolvimento IS DISTINCT FROM OLD.status_desenvolvimento THEN
    IF OLD.etapa <> 'desenvolvimento' OR NOT (public.tem_acesso_menu('sistemas_desenvolvedores') OR public.tem_acesso_menu('sistemas_gerente_sistemas')) THEN
      RAISE EXCEPTION 'Progresso, prazo e status de desenvolvimento só podem ser atualizados na etapa Desenvolvimento, por Desenvolvedores ou Gerente de Sistemas.';
    END IF;
  END IF;

  -- Testes Internos: cada aprovação só pela própria pessoa vinculada
  IF NEW.testes_interno_aprov_1 IS DISTINCT FROM OLD.testes_interno_aprov_1 THEN
    IF OLD.etapa <> 'testes_internos' OR auth.uid() IS DISTINCT FROM public.testes_interno_aprovador_user_id(1) THEN
      RAISE EXCEPTION 'Essa aprovação só pode ser marcada pela própria pessoa, na etapa Testes Internos.';
    END IF;
  END IF;
  IF NEW.testes_interno_aprov_2 IS DISTINCT FROM OLD.testes_interno_aprov_2 THEN
    IF OLD.etapa <> 'testes_internos' OR auth.uid() IS DISTINCT FROM public.testes_interno_aprovador_user_id(2) THEN
      RAISE EXCEPTION 'Essa aprovação só pode ser marcada pela própria pessoa, na etapa Testes Internos.';
    END IF;
  END IF;
  IF NEW.testes_interno_aprov_3 IS DISTINCT FROM OLD.testes_interno_aprov_3 THEN
    IF OLD.etapa <> 'testes_internos' OR auth.uid() IS DISTINCT FROM public.testes_interno_aprovador_user_id(3) THEN
      RAISE EXCEPTION 'Essa aprovação só pode ser marcada pela própria pessoa, na etapa Testes Internos.';
    END IF;
  END IF;

  -- Data de treinamento: só Gerente de Sistemas
  IF NEW.treinamento_data IS DISTINCT FROM OLD.treinamento_data THEN
    IF OLD.etapa <> 'treinamento' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Data de treinamento só pode ser definida na etapa Treinamento, por Gerente de Sistemas.';
    END IF;
  END IF;

  -- Status de implantação: só Gerente de Sistemas
  IF NEW.implantacao_status IS DISTINCT FROM OLD.implantacao_status THEN
    IF OLD.etapa <> 'implantacao' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Status de implantação só pode ser definido na etapa Implantação, por Gerente de Sistemas.';
    END IF;
  END IF;

  -- Pesquisa de Avaliação: criador, convidado, ou Controladoria
  IF NEW.pesquisa_atendeu_necessidade IS DISTINCT FROM OLD.pesquisa_atendeu_necessidade
     OR NEW.pesquisa_levantamento_claro IS DISTINCT FROM OLD.pesquisa_levantamento_claro
     OR NEW.pesquisa_conducao_ti IS DISTINCT FROM OLD.pesquisa_conducao_ti
     OR NEW.pesquisa_treinamento_suporte IS DISTINCT FROM OLD.pesquisa_treinamento_suporte
     OR NEW.pesquisa_avaliacao_geral IS DISTINCT FROM OLD.pesquisa_avaliacao_geral
     OR NEW.pesquisa_pode_encerrar IS DISTINCT FROM OLD.pesquisa_pode_encerrar THEN
    IF OLD.etapa <> 'encerramento' OR NOT public.sistema_pode_agir_homologacao_usuario(OLD.criado_por, OLD.id) THEN
      RAISE EXCEPTION 'A pesquisa só pode ser respondida na etapa Encerramento, por quem criou, convidados, ou Controladoria.';
    END IF;
  END IF;

  -- Finalizar demanda: só Controladoria
  IF NEW.finalizado IS DISTINCT FROM OLD.finalizado AND NEW.finalizado = true THEN
    IF OLD.etapa <> 'encerramento' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Só pode finalizar a demanda na etapa Encerramento, por Controladoria.';
    END IF;
    IF OLD.pesquisa_atendeu_necessidade IS NULL OR OLD.pesquisa_levantamento_claro IS NULL
       OR OLD.pesquisa_conducao_ti IS NULL OR OLD.pesquisa_treinamento_suporte IS NULL
       OR OLD.pesquisa_avaliacao_geral IS NULL OR OLD.pesquisa_pode_encerrar IS NULL THEN
      RAISE EXCEPTION 'A Pesquisa de Avaliação da Demanda precisa estar respondida antes de finalizar.';
    END IF;
  END IF;

  -- Transição de etapa
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN

    -- Travas específicas
    IF OLD.etapa = 'triagem_inicial' AND NEW.etapa = 'analise_necessidade'
       AND OLD.triagem_classificacao IS DISTINCT FROM 'sistema' THEN
      RAISE EXCEPTION 'Só é possível avançar se o critério for "Necessidade de Sistemas".';
    END IF;

    IF OLD.etapa = 'aprovacao_priorizacao' AND NEW.etapa = 'desenvolvimento' THEN
      IF OLD.prioridade IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'Só é possível avançar o card que estiver com prioridade 1. Mova-o primeiro.';
      END IF;
      IF OLD.responsavel_user_id IS NULL OR OLD.complexidade IS NULL THEN
        RAISE EXCEPTION 'Defina responsável e complexidade antes de avançar.';
      END IF;
    END IF;

    IF OLD.etapa = 'desenvolvimento' AND NEW.etapa = 'testes_internos'
       AND NOT (OLD.progresso_pct = 100 AND OLD.status_desenvolvimento = 'finalizado') THEN
      RAISE EXCEPTION 'Só é possível avançar com 100%% de progresso e status "Finalizado".';
    END IF;

    IF OLD.etapa = 'testes_internos' AND NEW.etapa = 'homologacao_area_solicitante'
       AND NOT (OLD.testes_interno_aprov_1 AND OLD.testes_interno_aprov_2 AND OLD.testes_interno_aprov_3) THEN
      RAISE EXCEPTION 'É preciso marcar as 3 aprovações necessárias antes de avançar.';
    END IF;

    -- Matriz de transição com checagem de papel:
    v_ok := CASE
      WHEN OLD.etapa = 'solicitacao_demanda' AND NEW.etapa = 'triagem_inicial'
        THEN public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria')

      WHEN OLD.etapa = 'triagem_inicial' AND NEW.etapa = 'analise_necessidade'
        THEN public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'triagem_inicial' AND NEW.etapa = 'solicitacao_demanda' AND OLD.recusado = false
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'triagem_inicial' AND NEW.etapa = 'solicitacao_demanda' AND OLD.recusado = true
        THEN true

      WHEN OLD.etapa = 'analise_necessidade' AND NEW.etapa = 'levantamento_funcional'
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'analise_necessidade' AND NEW.etapa = 'solicitacao_demanda' AND OLD.recusado = true
        THEN true

      WHEN OLD.etapa = 'levantamento_funcional' AND NEW.etapa = 'documentacao_funcional'
        THEN public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'levantamento_funcional' AND NEW.etapa = 'analise_necessidade'
        THEN public.tem_acesso_menu('sistemas_controladoria')

      WHEN OLD.etapa = 'documentacao_funcional' AND NEW.etapa = 'analise_tecnica'
        THEN public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'documentacao_funcional' AND NEW.etapa = 'analise_necessidade'
        THEN public.tem_acesso_menu('sistemas_controladoria')

      WHEN OLD.etapa = 'analise_tecnica' AND NEW.etapa = 'aprovacao_priorizacao'
        THEN public.tem_acesso_menu('sistemas_gerente_sistemas')
      WHEN OLD.etapa = 'analise_tecnica' AND NEW.etapa = 'analise_necessidade'
        THEN public.tem_acesso_menu('sistemas_gerente_sistemas')

      WHEN OLD.etapa = 'aprovacao_priorizacao' AND NEW.etapa = 'desenvolvimento'
        THEN public.tem_acesso_menu('sistemas_gerente_sistemas')
      WHEN OLD.etapa = 'aprovacao_priorizacao' AND NEW.etapa = 'solicitacao_demanda' AND OLD.recusado = true
        THEN true

      WHEN OLD.etapa = 'desenvolvimento' AND NEW.etapa = 'testes_internos'
        THEN public.tem_acesso_menu('sistemas_desenvolvedores')
      WHEN OLD.etapa = 'desenvolvimento' AND NEW.etapa IN ('analise_necessidade', 'levantamento_funcional')
        THEN public.tem_acesso_menu('sistemas_desenvolvedores') OR public.tem_acesso_menu('sistemas_gerente_sistemas')

      WHEN OLD.etapa = 'testes_internos' AND NEW.etapa = 'homologacao_area_solicitante'
        THEN public.tem_acesso_menu('sistemas_desenvolvedores')
      WHEN OLD.etapa = 'testes_internos' AND NEW.etapa = 'desenvolvimento'
        THEN public.tem_acesso_menu('sistemas_desenvolvedores')

      WHEN OLD.etapa = 'homologacao_area_solicitante' AND NEW.etapa IN ('treinamento', 'triagem_inicial', 'desenvolvimento')
        THEN public.sistema_pode_agir_homologacao_usuario(OLD.criado_por, OLD.id)

      WHEN OLD.etapa = 'treinamento' AND NEW.etapa = 'implantacao'
        THEN public.tem_acesso_menu('sistemas_gerente_sistemas')

      WHEN OLD.etapa = 'implantacao' AND NEW.etapa = 'acompanhamento_assistido'
        THEN public.tem_acesso_menu('sistemas_gerente_sistemas')

      WHEN OLD.etapa = 'acompanhamento_assistido' AND NEW.etapa = 'encerramento'
        THEN public.tem_acesso_menu('sistemas_gerente_sistemas')

      ELSE NULL
    END;

    IF v_ok IS NULL THEN
      RAISE EXCEPTION 'Transição de etapa não permitida: % → %', OLD.etapa, NEW.etapa;
    END IF;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'Sem permissão para mover de % para %', OLD.etapa, NEW.etapa;
    END IF;

    -- Assinaturas obrigatórias antes de avançar
    v_papeis_assinatura := CASE
      WHEN OLD.etapa = 'solicitacao_demanda' AND NEW.etapa = 'triagem_inicial'
        THEN ARRAY['criar_solicitacao','sistemas_controladoria','sistemas_gerente_sistemas']
      WHEN OLD.etapa = 'triagem_inicial' AND NEW.etapa = 'analise_necessidade'
        THEN ARRAY['criar_solicitacao','sistemas_controladoria','sistemas_gerente_sistemas']
      WHEN OLD.etapa = 'analise_necessidade' AND NEW.etapa = 'levantamento_funcional'
        THEN ARRAY['sistemas_comite','sistemas_controladoria','sistemas_gerente_sistemas']
      WHEN OLD.etapa = 'levantamento_funcional' AND NEW.etapa = 'documentacao_funcional'
        THEN ARRAY['criar_solicitacao','sistemas_controladoria','sistemas_gerente_sistemas']
      WHEN OLD.etapa = 'documentacao_funcional' AND NEW.etapa = 'analise_tecnica'
        THEN ARRAY['criar_solicitacao','sistemas_controladoria','sistemas_gerente_sistemas']
      WHEN OLD.etapa = 'analise_tecnica' AND NEW.etapa = 'aprovacao_priorizacao'
        THEN ARRAY['sistemas_desenvolvedores','sistemas_controladoria','sistemas_gerente_sistemas']
      WHEN OLD.etapa = 'aprovacao_priorizacao' AND NEW.etapa = 'desenvolvimento'
        THEN ARRAY['sistemas_comite','sistemas_gerente_sistemas','sistemas_controladoria']
      WHEN OLD.etapa = 'desenvolvimento' AND NEW.etapa = 'testes_internos'
        THEN ARRAY['sistemas_desenvolvedores','sistemas_gerente_sistemas']
      WHEN OLD.etapa = 'testes_internos' AND NEW.etapa = 'homologacao_area_solicitante'
        THEN ARRAY['sistemas_desenvolvedores','sistemas_gerente_sistemas','sistemas_controladoria']
      WHEN OLD.etapa = 'homologacao_area_solicitante' AND NEW.etapa = 'treinamento'
        THEN ARRAY['criar_solicitacao','sistemas_controladoria','sistemas_gerente_sistemas']
      WHEN OLD.etapa = 'treinamento' AND NEW.etapa = 'implantacao'
        THEN ARRAY['sistemas_gerente_sistemas','sistemas_controladoria','criar_solicitacao']
      WHEN OLD.etapa = 'implantacao' AND NEW.etapa = 'acompanhamento_assistido'
        THEN ARRAY['sistemas_gerente_sistemas','sistemas_controladoria','criar_solicitacao']
      WHEN OLD.etapa = 'acompanhamento_assistido' AND NEW.etapa = 'encerramento'
        THEN ARRAY['sistemas_gerente_sistemas','sistemas_controladoria','criar_solicitacao']
      ELSE NULL
    END;

    IF v_papeis_assinatura IS NOT NULL THEN
      v_faltando := ARRAY[]::text[];
      FOREACH v_papel IN ARRAY v_papeis_assinatura LOOP
        IF v_papel = 'criar_solicitacao' THEN
          SELECT EXISTS (
            SELECT 1 FROM public.sistema_solicitacao_assinatura
             WHERE solicitacao_id = OLD.id AND etapa = OLD.etapa AND user_id = OLD.criado_por
          ) INTO v_assinado;
          IF NOT v_assinado THEN v_faltando := v_faltando || 'quem criou a solicitação'; END IF;
        ELSE
          SELECT EXISTS (
            SELECT 1 FROM public.sistema_solicitacao_assinatura a
            JOIN public.screen_permission_user spu
              ON spu.user_id = a.user_id AND spu.menu_codigo = v_papel
             AND spu.acao = 'visualizar' AND spu.allow = true AND spu.empresa_id IS NULL
            WHERE a.solicitacao_id = OLD.id AND a.etapa = OLD.etapa
          ) INTO v_assinado;
          IF NOT v_assinado THEN
            v_faltando := v_faltando || CASE v_papel
              WHEN 'sistemas_comite' THEN 'Comitê'
              WHEN 'sistemas_controladoria' THEN 'Controladoria'
              WHEN 'sistemas_gerente_sistemas' THEN 'Gerente de Sistemas'
              WHEN 'sistemas_desenvolvedores' THEN 'Desenvolvedores'
              ELSE v_papel
            END;
          END IF;
        END IF;
      END LOOP;
      IF array_length(v_faltando, 1) > 0 THEN
        RAISE EXCEPTION 'Faltam assinaturas obrigatórias nesta etapa: %', array_to_string(v_faltando, ', ');
      END IF;
    END IF;

    NEW.etapa_entrada_em := now();

    IF NEW.etapa = 'solicitacao_demanda' THEN
      NEW.recusado := false;
    END IF;

    IF OLD.etapa = 'aprovacao_priorizacao' THEN
      NEW.prioridade := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
