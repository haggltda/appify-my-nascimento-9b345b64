-- Solicitações ERP: "Pesquisa de Avaliação da Demanda" na etapa Encerramento.
-- Respondida por quem criou a solicitação, convidados, ou Controladoria (mesma
-- elegibilidade da Homologação do Usuário). As 6 perguntas (5 de escala 1-5 +
-- 1 sim/não) são obrigatórias pra Controladoria poder finalizar a demanda — mas
-- a resposta da pergunta final não bloqueia o "Finalizar", é só informativa.

ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS pesquisa_atendeu_necessidade smallint CHECK (pesquisa_atendeu_necessidade IS NULL OR pesquisa_atendeu_necessidade BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pesquisa_levantamento_claro smallint CHECK (pesquisa_levantamento_claro IS NULL OR pesquisa_levantamento_claro BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pesquisa_conducao_ti smallint CHECK (pesquisa_conducao_ti IS NULL OR pesquisa_conducao_ti BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pesquisa_treinamento_suporte smallint CHECK (pesquisa_treinamento_suporte IS NULL OR pesquisa_treinamento_suporte BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pesquisa_avaliacao_geral smallint CHECK (pesquisa_avaliacao_geral IS NULL OR pesquisa_avaliacao_geral BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pesquisa_pode_encerrar boolean;

CREATE OR REPLACE FUNCTION public.checar_transicao_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_ok boolean;
BEGIN
  -- Recusar (fica na mesma coluna, recusado false -> true): só Comitê.
  IF NEW.recusado IS DISTINCT FROM OLD.recusado AND NEW.recusado = true THEN
    IF OLD.etapa <> 'triagem_inicial_comite' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Só o Comitê pode recusar, e só na Triagem Inicial.';
    END IF;
  END IF;

  -- Prioridade: só Comitê, só na coluna de Aprovações e Priorização.
  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    IF OLD.etapa <> 'aprovacoes_priorizacao' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Prioridade só pode ser definida na etapa Aprovações e Priorização, por Comitê.';
    END IF;
  END IF;

  -- Responsável: só Gerente de Sistemas, só na coluna Definição de Responsável.
  IF NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id THEN
    IF OLD.etapa <> 'definicao_responsavel' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Responsável só pode ser definido na etapa Definição de Responsável, por Gerente de Sistemas.';
    END IF;
  END IF;

  -- Complexidade: só Gerente de Sistemas, só na coluna Definição de Responsável.
  IF NEW.complexidade IS DISTINCT FROM OLD.complexidade THEN
    IF OLD.etapa <> 'definicao_responsavel' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Complexidade só pode ser definida na etapa Definição de Responsável, por Gerente de Sistemas.';
    END IF;
  END IF;

  -- Progresso e prazo: só Desenvolvedores/Gerente de Sistemas, só em Desenvolvimento e Ajustes.
  IF NEW.progresso_pct IS DISTINCT FROM OLD.progresso_pct OR NEW.data_fim IS DISTINCT FROM OLD.data_fim THEN
    IF OLD.etapa <> 'desenvolvimento_ajustes' OR NOT (public.tem_acesso_menu('sistemas_desenvolvedores') OR public.tem_acesso_menu('sistemas_gerente_sistemas')) THEN
      RAISE EXCEPTION 'Progresso e prazo só podem ser atualizados na etapa Desenvolvimento e Ajustes, por Desenvolvedores ou Gerente de Sistemas.';
    END IF;
  END IF;

  -- Campos do card Projeto: só Comitê/Desenvolvedores, só na etapa Projeto.
  IF NEW.levantamento_funcional_texto IS DISTINCT FROM OLD.levantamento_funcional_texto
     OR NEW.levantamento_funcional_prazo IS DISTINCT FROM OLD.levantamento_funcional_prazo
     OR NEW.documentacao_tecnica_texto IS DISTINCT FROM OLD.documentacao_tecnica_texto
     OR NEW.documentacao_tecnica_prazo IS DISTINCT FROM OLD.documentacao_tecnica_prazo
     OR NEW.analise_tecnica_texto IS DISTINCT FROM OLD.analise_tecnica_texto
     OR NEW.analise_tecnica_prazo IS DISTINCT FROM OLD.analise_tecnica_prazo THEN
    IF OLD.etapa <> 'projeto' OR NOT (public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_desenvolvedores')) THEN
      RAISE EXCEPTION 'Esses campos só podem ser editados na etapa Projeto, por Comitê ou Desenvolvedores.';
    END IF;
  END IF;

  -- Data de treinamento: só Comitê/Controladoria, só na etapa Treinamentos.
  IF NEW.treinamento_data IS DISTINCT FROM OLD.treinamento_data THEN
    IF OLD.etapa <> 'treinamentos' OR NOT (public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria')) THEN
      RAISE EXCEPTION 'Data de treinamento só pode ser definida na etapa Treinamentos, por Comitê ou Controladoria.';
    END IF;
  END IF;

  -- Status de implantação: só Controladoria, só na etapa Implantação.
  IF NEW.implantacao_status IS DISTINCT FROM OLD.implantacao_status THEN
    IF OLD.etapa <> 'implantacao' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Status de implantação só pode ser definido na etapa Implantação, por Controladoria.';
    END IF;
  END IF;

  -- Pesquisa de Avaliação da Demanda: quem criou, convidados, ou Controladoria,
  -- só na etapa Encerramento.
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

  -- Finalizar demanda: só Controladoria, só na etapa Encerramento, com a pesquisa completa.
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

  -- Aprovações nominais da Homologação Técnica: só Comitê, só nessa etapa.
  IF NEW.homologacao_aprov_1 IS DISTINCT FROM OLD.homologacao_aprov_1
     OR NEW.homologacao_aprov_2 IS DISTINCT FROM OLD.homologacao_aprov_2
     OR NEW.homologacao_aprov_3 IS DISTINCT FROM OLD.homologacao_aprov_3 THEN
    IF OLD.etapa <> 'homologacao_tecnica' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'As aprovações só podem ser marcadas na etapa Homologação Técnica, por Comitê.';
    END IF;
  END IF;

  -- Transição de etapa.
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN

    -- Guards específicos com mensagem clara (antes da checagem genérica de papel).
    IF OLD.etapa = 'aprovacoes_priorizacao' AND NEW.etapa = 'definicao_responsavel' AND OLD.prioridade IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'Só é possível avançar o card que estiver com prioridade 1. Mova-o primeiro.';
    END IF;

    IF OLD.etapa = 'homologacao_tecnica' AND NEW.etapa = 'homologacao_usuario'
       AND NOT (OLD.homologacao_aprov_1 AND OLD.homologacao_aprov_2 AND OLD.homologacao_aprov_3) THEN
      RAISE EXCEPTION 'É preciso marcar as 3 aprovações necessárias antes de avançar.';
    END IF;

    IF OLD.etapa = 'definicao_responsavel' AND NEW.etapa = 'desenvolvimento_ajustes' AND OLD.complexidade IS NULL THEN
      RAISE EXCEPTION 'Defina a complexidade da demanda antes de avançar.';
    END IF;

    v_ok := CASE
      WHEN OLD.etapa = 'registro_oficial' AND NEW.etapa = 'triagem_inicial_comite'
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'triagem_inicial_comite' AND NEW.etapa = 'projeto'
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'triagem_inicial_comite' AND NEW.etapa = 'registro_oficial' AND OLD.recusado = false
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'triagem_inicial_comite' AND NEW.etapa = 'registro_oficial' AND OLD.recusado = true
        THEN public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'projeto' AND NEW.etapa = 'aprovacoes_priorizacao'
        THEN public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'aprovacoes_priorizacao' AND NEW.etapa = 'definicao_responsavel'
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'definicao_responsavel' AND NEW.etapa = 'desenvolvimento_ajustes'
        THEN public.tem_acesso_menu('sistemas_gerente_sistemas')
      WHEN OLD.etapa = 'desenvolvimento_ajustes' AND NEW.etapa = 'homologacao_tecnica'
        THEN public.tem_acesso_menu('sistemas_desenvolvedores') OR public.tem_acesso_menu('sistemas_gerente_sistemas')
      WHEN OLD.etapa = 'homologacao_tecnica' AND NEW.etapa = 'homologacao_usuario'
        THEN public.tem_acesso_menu('sistemas_gerente_sistemas') OR public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'homologacao_tecnica' AND NEW.etapa = 'desenvolvimento_ajustes'
        THEN public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria') OR public.tem_acesso_menu('sistemas_desenvolvedores')
      WHEN OLD.etapa = 'homologacao_usuario' AND NEW.etapa IN ('treinamentos', 'triagem_inicial_comite', 'desenvolvimento_ajustes')
        THEN public.sistema_pode_agir_homologacao_usuario(OLD.criado_por, OLD.id)
      WHEN OLD.etapa = 'treinamentos' AND NEW.etapa IN ('implantacao', 'triagem_inicial_comite', 'desenvolvimento_ajustes')
        THEN public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'implantacao' AND NEW.etapa = 'acompanhamento_assistido'
        THEN public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'acompanhamento_assistido' AND NEW.etapa = 'encerramento'
        THEN public.tem_acesso_menu('sistemas_controladoria')
      ELSE NULL
    END;

    IF v_ok IS NULL THEN
      RAISE EXCEPTION 'Transição de etapa não permitida: % → %', OLD.etapa, NEW.etapa;
    END IF;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'Sem permissão para mover de % para %', OLD.etapa, NEW.etapa;
    END IF;

    NEW.etapa_entrada_em := now();

    -- Voltar pra Registro Oficial (Devolver ou Voltar para Solicitações) sempre limpa o estado recusado.
    IF NEW.etapa = 'registro_oficial' THEN
      NEW.recusado := false;
    END IF;

    -- Saiu da coluna de Priorização: só limpa a própria prioridade aqui (valor em
    -- memória, ainda não gravado). O reajuste dos irmãos é feito no trigger AFTER
    -- (trg_reajustar_prioridade_sistema_solicitacao).
    IF OLD.etapa = 'aprovacoes_priorizacao' THEN
      NEW.prioridade := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, etapa_para, detalhe)
    VALUES (NEW.id, auth.uid(), 'criado', NEW.etapa, NEW.titulo);
    RETURN NEW;
  END IF;

  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, etapa_de, etapa_para)
    VALUES (NEW.id, auth.uid(), 'mover_etapa', OLD.etapa, NEW.etapa);
  END IF;
  IF NEW.recusado IS DISTINCT FROM OLD.recusado THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'recusado', NEW.recusado::text);
  END IF;
  IF NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_responsavel', NEW.responsavel_user_id::text);
  END IF;
  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_prioridade', NEW.prioridade::text);
  END IF;
  IF NEW.progresso_pct IS DISTINCT FROM OLD.progresso_pct THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'atualizar_progresso', NEW.progresso_pct::text);
  END IF;
  IF NEW.data_fim IS DISTINCT FROM OLD.data_fim THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_prazo', NEW.data_fim::text);
  END IF;
  IF NEW.implantacao_status IS DISTINCT FROM OLD.implantacao_status THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_status_implantacao', NEW.implantacao_status);
  END IF;
  IF NEW.finalizado IS DISTINCT FROM OLD.finalizado THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'finalizado', NEW.finalizado::text);
  END IF;
  IF NEW.homologacao_aprov_1 IS DISTINCT FROM OLD.homologacao_aprov_1 THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'aprovacao_homologacao_1', NEW.homologacao_aprov_1::text);
  END IF;
  IF NEW.homologacao_aprov_2 IS DISTINCT FROM OLD.homologacao_aprov_2 THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'aprovacao_homologacao_2', NEW.homologacao_aprov_2::text);
  END IF;
  IF NEW.homologacao_aprov_3 IS DISTINCT FROM OLD.homologacao_aprov_3 THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'aprovacao_homologacao_3', NEW.homologacao_aprov_3::text);
  END IF;
  IF NEW.pesquisa_atendeu_necessidade IS DISTINCT FROM OLD.pesquisa_atendeu_necessidade THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'pesquisa_atendeu_necessidade', NEW.pesquisa_atendeu_necessidade::text);
  END IF;
  IF NEW.pesquisa_levantamento_claro IS DISTINCT FROM OLD.pesquisa_levantamento_claro THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'pesquisa_levantamento_claro', NEW.pesquisa_levantamento_claro::text);
  END IF;
  IF NEW.pesquisa_conducao_ti IS DISTINCT FROM OLD.pesquisa_conducao_ti THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'pesquisa_conducao_ti', NEW.pesquisa_conducao_ti::text);
  END IF;
  IF NEW.pesquisa_treinamento_suporte IS DISTINCT FROM OLD.pesquisa_treinamento_suporte THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'pesquisa_treinamento_suporte', NEW.pesquisa_treinamento_suporte::text);
  END IF;
  IF NEW.pesquisa_avaliacao_geral IS DISTINCT FROM OLD.pesquisa_avaliacao_geral THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'pesquisa_avaliacao_geral', NEW.pesquisa_avaliacao_geral::text);
  END IF;
  IF NEW.pesquisa_pode_encerrar IS DISTINCT FROM OLD.pesquisa_pode_encerrar THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'pesquisa_pode_encerrar', NEW.pesquisa_pode_encerrar::text);
  END IF;

  RETURN NEW;
END;
$$;
