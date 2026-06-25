-- Fix: o reajuste de prioridade (migration 20260625000001) ainda colidia com o
-- próprio card que está saindo da coluna. O trigger que faz o reajuste é BEFORE
-- UPDATE, e dentro de um BEFORE UPDATE a linha que disparou o trigger AINDA está
-- gravada no banco com o valor ANTIGO até o trigger terminar (a escrita da própria
-- linha só acontece depois que ele retorna). Como agora só é permitido mover o card
-- de prioridade 1, o reajuste sempre tentava atribuir o valor 1 a um dos irmãos
-- enquanto o card que está saindo ainda ocupava esse mesmo valor 1 no índice único
-- -> colisão garantida ("duplicate key value violates unique constraint
-- idx_sistema_solicitacao_prioridade_unica").
--
-- Solução: o BEFORE UPDATE só limpa a própria prioridade (NEW.prioridade := NULL,
-- que é só um valor em memória, não uma escrita na tabela ainda). O reajuste dos
-- irmãos passa para um trigger AFTER UPDATE, que só roda depois que a própria linha
-- já foi de fato gravada com o novo valor — aí ela já não conta mais para o índice
-- único parcial, e não tem como colidir.

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

  -- Finalizar demanda: só Controladoria, só na etapa Encerramento.
  IF NEW.finalizado IS DISTINCT FROM OLD.finalizado AND NEW.finalizado = true THEN
    IF OLD.etapa <> 'encerramento' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Só pode finalizar a demanda na etapa Encerramento, por Controladoria.';
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
        THEN public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_desenvolvedores')
      WHEN OLD.etapa = 'aprovacoes_priorizacao' AND NEW.etapa = 'definicao_responsavel'
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'definicao_responsavel' AND NEW.etapa = 'desenvolvimento_ajustes'
        THEN public.tem_acesso_menu('sistemas_gerente_sistemas')
      WHEN OLD.etapa = 'desenvolvimento_ajustes' AND NEW.etapa = 'homologacao_tecnica'
        THEN public.tem_acesso_menu('sistemas_desenvolvedores') OR public.tem_acesso_menu('sistemas_gerente_sistemas')
      WHEN OLD.etapa = 'homologacao_tecnica' AND NEW.etapa IN ('homologacao_usuario', 'desenvolvimento_ajustes')
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
    -- (trg_reajustar_prioridade_sistema_solicitacao), depois que esta linha já tiver
    -- sido de fato escrita com etapa nova / prioridade NULL.
    IF OLD.etapa = 'aprovacoes_priorizacao' THEN
      NEW.prioridade := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Reajuste das prioridades dos irmãos: AFTER UPDATE, pra não colidir com a própria
-- linha (que nesse momento já está com o valor novo gravado e gravado).
CREATE OR REPLACE FUNCTION public.reajustar_prioridade_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.etapa = 'aprovacoes_priorizacao' AND NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    -- Passo 1: joga os irmãos pra valores negativos temporários (sem colisão possível).
    UPDATE public.sistema_solicitacao
       SET prioridade = -prioridade
     WHERE etapa = 'aprovacoes_priorizacao' AND id <> OLD.id AND prioridade IS NOT NULL;

    -- Passo 2: aplica os valores finais 1..N, na ordem original.
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY -prioridade) AS rn
        FROM public.sistema_solicitacao
       WHERE etapa = 'aprovacoes_priorizacao' AND id <> OLD.id AND prioridade IS NOT NULL
    )
    UPDATE public.sistema_solicitacao s
       SET prioridade = ranked.rn
      FROM ranked
     WHERE s.id = ranked.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reajustar_prioridade_sistema_solicitacao ON public.sistema_solicitacao;
CREATE TRIGGER trg_reajustar_prioridade_sistema_solicitacao
  AFTER UPDATE ON public.sistema_solicitacao
  FOR EACH ROW EXECUTE FUNCTION public.reajustar_prioridade_sistema_solicitacao();
