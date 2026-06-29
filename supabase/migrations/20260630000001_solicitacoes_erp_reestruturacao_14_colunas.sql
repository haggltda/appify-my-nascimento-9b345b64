-- Solicitações ERP: reestruturação completa do fluxo, pedida pelo CEO via
-- planilha "KANBAN CARDS.xlsx" + imagens de referência. Resumo das mudanças:
--   - 12 etapas -> 14 etapas. "Projeto" (3 sub-campos numa coluna só) vira 4
--     colunas independentes (Análise de Necessidade [nova] + Levantamento
--     Funcional + Documentação Funcional + Análise Técnica, reaproveitando as
--     colunas de texto/prazo que já existiam). "Aprovações e Priorização" +
--     "Definição de Responsável" virou 1 coluna só.
--   - Vários papéis trocam de dono (ver tabela completa no plano aprovado).
--   - Prazos em dias úteis com prorrogação automática (+2 dias úteis) e
--     auto-retorno pra coluna 1 quando a prorrogação também vence — modelo
--     "lazy": corrigido sob demanda, no carregamento do quadro (sem pg_cron).
--   - "Testes Internos" (ex-Homologação Técnica): cada uma das 3 aprovações
--     nominais só pode ser marcada pela própria pessoa vinculada (não mais
--     qualquer um do Comitê).
--   - Nova aba "Assinaturas" (tabela isolada, sem relação com o `etapa`).
--
-- ORDEM IMPORTANTE: o editor SQL do Supabase não garante que o script inteiro
-- rode como uma transação só (statements já vimos comitarem isoladamente) —
-- então, ao invés de confiar em ordem/flag de sessão, a primeira coisa que
-- este script faz é DESLIGAR o trigger de transição (ALTER TABLE ... DISABLE
-- TRIGGER), independente do que ele contém hoje. Com o trigger desligado, o
-- remapeamento de dados (seção 4) roda sem qualquer checagem, e só DEPOIS o
-- trigger é religado já com o corpo novo (substituído na seção 3).

-- ============================================================================
-- 0) Desliga TODOS os triggers de sistema_solicitacao antes de tocar em
--    qualquer dado/coluna — não é só o de transição: o de log
--    (trg_log_sistema_solicitacao) e o de reajuste de prioridade
--    (trg_reajustar_prioridade_sistema_solicitacao) também rodam em UPDATE e
--    citam as colunas antigas (homologacao_aprov_1/2/3) até serem
--    substituídos nas seções 7/8 — sem desligar esses dois também, o mesmo
--    erro de "campo não existe" acontece neles.
-- ============================================================================
ALTER TABLE public.sistema_solicitacao DISABLE TRIGGER trg_checar_transicao_sistema_solicitacao;
ALTER TABLE public.sistema_solicitacao DISABLE TRIGGER trg_log_sistema_solicitacao;
ALTER TABLE public.sistema_solicitacao DISABLE TRIGGER trg_reajustar_prioridade_sistema_solicitacao;

-- ============================================================================
-- 1) Colunas novas
-- ============================================================================
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS analise_necessidade_texto text,
  ADD COLUMN IF NOT EXISTS analise_necessidade_prazo date,
  ADD COLUMN IF NOT EXISTS criterio_triagem text;

-- Renomeia só se a coluna antiga ainda existir — torna seguro rodar este
-- script de novo mesmo se uma tentativa anterior já tiver renomeado.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sistema_solicitacao' AND column_name = 'homologacao_aprov_1') THEN
    ALTER TABLE public.sistema_solicitacao RENAME COLUMN homologacao_aprov_1 TO testes_interno_aprov_1;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sistema_solicitacao' AND column_name = 'homologacao_aprov_2') THEN
    ALTER TABLE public.sistema_solicitacao RENAME COLUMN homologacao_aprov_2 TO testes_interno_aprov_2;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sistema_solicitacao' AND column_name = 'homologacao_aprov_3') THEN
    ALTER TABLE public.sistema_solicitacao RENAME COLUMN homologacao_aprov_3 TO testes_interno_aprov_3;
  END IF;
END $$;

ALTER TABLE public.sistema_solicitacao DROP CONSTRAINT IF EXISTS sistema_solicitacao_criterio_triagem_check;
ALTER TABLE public.sistema_solicitacao ADD CONSTRAINT sistema_solicitacao_criterio_triagem_check
  CHECK (criterio_triagem IS NULL OR criterio_triagem IN (
    'falha_processo', 'necessidade_treinamento', 'possibilidade_parametrizacao', 'necessidade_desenvolvimento'
  ));

-- "Grau de Urgência" deixa de ser texto livre e vira dropdown fixo. NOT VALID
-- pelo mesmo motivo do tipo_solicitacao (20260629000001): já existem cards
-- antigos com texto livre nesse campo.
ALTER TABLE public.sistema_solicitacao DROP CONSTRAINT IF EXISTS sistema_solicitacao_grau_urgencia_check;
ALTER TABLE public.sistema_solicitacao ADD CONSTRAINT sistema_solicitacao_grau_urgencia_check
  CHECK (grau_urgencia IS NULL OR grau_urgencia IN ('baixa', 'media', 'alta')) NOT VALID;

UPDATE public.sistema_solicitacao
   SET grau_urgencia = NULL
 WHERE grau_urgencia IS NOT NULL AND grau_urgencia NOT IN ('baixa', 'media', 'alta');

ALTER TABLE public.sistema_solicitacao VALIDATE CONSTRAINT sistema_solicitacao_grau_urgencia_check;

-- Solta o CHECK antigo de etapa agora — ele só conhece as 12 chaves antigas e
-- bloquearia o remapeamento de dados feito na seção 4. O CHECK definitivo com
-- as 14 chaves novas entra na seção 5, depois que os dados já migraram.
ALTER TABLE public.sistema_solicitacao DROP CONSTRAINT IF EXISTS sistema_solicitacao_etapa_check;

-- ============================================================================
-- 2) Funções auxiliares (precisam existir antes do trigger principal, que as chama)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dias_uteis_entre(p_inicio timestamptz, p_fim timestamptz)
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT COUNT(*)::integer
    FROM generate_series(date_trunc('day', p_inicio) + interval '1 day', date_trunc('day', p_fim), interval '1 day') AS d
   WHERE EXTRACT(ISODOW FROM d) < 6;
$$;

-- Prazo normal (dias úteis) por etapa — etapas sem prazo retornam NULL.
CREATE OR REPLACE FUNCTION public.prazo_dias_uteis_etapa(p_etapa text)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_etapa
    WHEN 'triagem_inicial' THEN 2
    WHEN 'analise_necessidade' THEN 5
    WHEN 'levantamento_funcional' THEN 10
    WHEN 'documentacao_funcional' THEN 5
    WHEN 'analise_tecnica' THEN 5
    WHEN 'testes_internos' THEN 3
    WHEN 'homologacao_area_solicitante' THEN 5
    WHEN 'treinamento' THEN 5
    WHEN 'acompanhamento_assistido' THEN 10
    ELSE NULL
  END;
$$;

-- Dias úteis de prorrogação automática além do prazo normal, antes de
-- devolver o card pra "Solicitação da Demanda".
CREATE OR REPLACE FUNCTION public.dias_uteis_prorrogacao()
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$ SELECT 2; $$;

-- Correção "lazy" dos prazos vencidos — chamada pelo front-end ao carregar o
-- quadro. A trava de "venceu de verdade" é recalculada aqui dentro (não confia
-- em nada vindo do cliente). set_config com bypass pra esse UPDATE não cair
-- nas regras normais de permissão por papel da transição de etapa.
CREATE OR REPLACE FUNCTION public.sistema_corrigir_prazos_vencidos()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.bypass_etapa_check', 'true', true);
  UPDATE public.sistema_solicitacao
     SET etapa = 'solicitacao_demanda'
   WHERE finalizado = false
     AND recusado = false
     AND etapa <> 'solicitacao_demanda'
     AND public.prazo_dias_uteis_etapa(etapa) IS NOT NULL
     AND public.dias_uteis_entre(etapa_entrada_em, now()) > public.prazo_dias_uteis_etapa(etapa) + public.dias_uteis_prorrogacao();
END;
$$;
REVOKE ALL ON FUNCTION public.sistema_corrigir_prazos_vencidos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sistema_corrigir_prazos_vencidos() TO authenticated;

-- Testes Internos: cada aprovação só pela pessoa vinculada (3 pessoas fixas).
-- Resolve o user_id pelo nome (excluindo contas de teste/duplicadas, mesmo
-- cuidado já usado em outras buscas por nome neste projeto).
CREATE OR REPLACE FUNCTION public.testes_interno_aprovador_user_id(p_slot integer)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.profiles
   WHERE display_name = CASE p_slot
           WHEN 1 THEN 'Érica Souza Ávila'
           WHEN 2 THEN 'Yuri Rosa'
           WHEN 3 THEN 'Iury de Jesus Silva'
         END
     AND display_name NOT ILIKE '%teste%'
     AND ativo = true
   ORDER BY created_at ASC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.testes_interno_aprovador_user_id(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.testes_interno_aprovador_user_id(integer) TO authenticated;

-- RPC pro front-end saber qual slot (1/2/3) pertence a qual usuário, pra
-- habilitar a caixinha certa pra cada pessoa.
CREATE OR REPLACE FUNCTION public.listar_aprovadores_testes_internos()
RETURNS TABLE(slot integer, user_id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT s.slot, p.id, p.display_name
    FROM generate_series(1, 3) AS s(slot)
    LEFT JOIN public.profiles p ON p.id = public.testes_interno_aprovador_user_id(s.slot);
$$;
REVOKE ALL ON FUNCTION public.listar_aprovadores_testes_internos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_aprovadores_testes_internos() TO authenticated;

-- ============================================================================
-- 3) Trigger principal: reescrito do zero pras 14 etapas
-- ============================================================================
CREATE OR REPLACE FUNCTION public.checar_transicao_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_ok boolean;
BEGIN
  -- Bypass: usado só pela correção automática de prazo vencido
  -- (sistema_corrigir_prazos_vencidos), que já recalculou o vencimento no
  -- servidor antes de chamar este UPDATE — não passa por nenhuma das
  -- checagens de papel abaixo. (A migração de dados em si desliga o trigger
  -- inteiro via DISABLE TRIGGER, não usa este flag.)
  IF current_setting('app.bypass_etapa_check', true) = 'true' THEN
    NEW.etapa_entrada_em := now();
    IF OLD.etapa = 'aprovacao_priorizacao' THEN
      NEW.prioridade := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Recusar/Encerrar: liberado em algumas etapas específicas, cada uma com seu dono.
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

  -- Reativar um card recusado: só Controladoria, e sempre volta pra Solicitação da Demanda.
  IF OLD.recusado = true AND NEW.recusado = false THEN
    IF NEW.etapa <> 'solicitacao_demanda' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Só a Controladoria pode reativar um card recusado.';
    END IF;
  END IF;

  -- Critério da Triagem Inicial: só Comitê, só nessa etapa.
  IF NEW.criterio_triagem IS DISTINCT FROM OLD.criterio_triagem THEN
    IF OLD.etapa <> 'triagem_inicial' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Critério só pode ser definido na etapa Triagem Inicial, por Comitê.';
    END IF;
  END IF;

  -- Análise de Necessidade: só Comitê, só nessa etapa.
  IF NEW.analise_necessidade_texto IS DISTINCT FROM OLD.analise_necessidade_texto
     OR NEW.analise_necessidade_prazo IS DISTINCT FROM OLD.analise_necessidade_prazo THEN
    IF OLD.etapa <> 'analise_necessidade' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Esses campos só podem ser editados na etapa Análise de Necessidade, por Comitê.';
    END IF;
  END IF;

  -- Levantamento Funcional: só Controladoria, só nessa etapa.
  IF NEW.levantamento_funcional_texto IS DISTINCT FROM OLD.levantamento_funcional_texto
     OR NEW.levantamento_funcional_prazo IS DISTINCT FROM OLD.levantamento_funcional_prazo THEN
    IF OLD.etapa <> 'levantamento_funcional' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Esses campos só podem ser editados na etapa Levantamento Funcional, por Controladoria.';
    END IF;
  END IF;

  -- Documentação Funcional: só Controladoria, só nessa etapa.
  IF NEW.documentacao_tecnica_texto IS DISTINCT FROM OLD.documentacao_tecnica_texto
     OR NEW.documentacao_tecnica_prazo IS DISTINCT FROM OLD.documentacao_tecnica_prazo THEN
    IF OLD.etapa <> 'documentacao_funcional' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Esses campos só podem ser editados na etapa Documentação Funcional, por Controladoria.';
    END IF;
  END IF;

  -- Análise Técnica: só Gerente de Sistemas, só nessa etapa.
  IF NEW.analise_tecnica_texto IS DISTINCT FROM OLD.analise_tecnica_texto
     OR NEW.analise_tecnica_prazo IS DISTINCT FROM OLD.analise_tecnica_prazo THEN
    IF OLD.etapa <> 'analise_tecnica' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Esses campos só podem ser editados na etapa Análise Técnica, por Gerente de Sistemas.';
    END IF;
  END IF;

  -- Prioridade: só Comitê, só na Aprovação e Priorização.
  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    IF OLD.etapa <> 'aprovacao_priorizacao' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Prioridade só pode ser definida na etapa Aprovação e Priorização, por Comitê.';
    END IF;
  END IF;

  -- Responsável e Complexidade: só Gerente de Sistemas, só na Aprovação e Priorização
  -- (a coluna "Definição de Responsável" deixou de existir, foi mesclada nessa).
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

  -- Progresso, prazo e status de desenvolvimento: Desenvolvedores OU Gerente de
  -- Sistemas, só em Desenvolvimento (a restrição pra só Desenvolvedores é só no
  -- botão de avançar, na checagem de transição mais abaixo).
  IF NEW.progresso_pct IS DISTINCT FROM OLD.progresso_pct
     OR NEW.data_fim IS DISTINCT FROM OLD.data_fim
     OR NEW.status_desenvolvimento IS DISTINCT FROM OLD.status_desenvolvimento THEN
    IF OLD.etapa <> 'desenvolvimento' OR NOT (public.tem_acesso_menu('sistemas_desenvolvedores') OR public.tem_acesso_menu('sistemas_gerente_sistemas')) THEN
      RAISE EXCEPTION 'Progresso, prazo e status de desenvolvimento só podem ser atualizados na etapa Desenvolvimento, por Desenvolvedores ou Gerente de Sistemas.';
    END IF;
  END IF;

  -- Testes Internos: cada aprovação só pela pessoa vinculada àquele slot.
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

  -- Data de treinamento: só Gerente de Sistemas, só na etapa Treinamento.
  IF NEW.treinamento_data IS DISTINCT FROM OLD.treinamento_data THEN
    IF OLD.etapa <> 'treinamento' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Data de treinamento só pode ser definida na etapa Treinamento, por Gerente de Sistemas.';
    END IF;
  END IF;

  -- Status de implantação: só Gerente de Sistemas, só na etapa Implantação.
  IF NEW.implantacao_status IS DISTINCT FROM OLD.implantacao_status THEN
    IF OLD.etapa <> 'implantacao' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Status de implantação só pode ser definido na etapa Implantação, por Gerente de Sistemas.';
    END IF;
  END IF;

  -- Pesquisa de Avaliação da Demanda: quem criou, convidados, ou Controladoria, só no Encerramento.
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

  -- Finalizar demanda: só Controladoria, só no Encerramento, com a pesquisa completa.
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

  -- Transição de etapa.
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN

    -- Guards específicos com mensagem clara (antes da checagem genérica de papel).
    IF OLD.etapa = 'triagem_inicial' AND NEW.etapa = 'analise_necessidade'
       AND OLD.criterio_triagem IS DISTINCT FROM 'necessidade_desenvolvimento' THEN
      RAISE EXCEPTION 'Só é possível avançar se o critério for "Necessidade de Desenvolvimento".';
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

    v_ok := CASE
      WHEN OLD.etapa = 'solicitacao_demanda' AND NEW.etapa = 'triagem_inicial'
        THEN public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria')

      WHEN OLD.etapa = 'triagem_inicial' AND NEW.etapa = 'analise_necessidade'
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'triagem_inicial' AND NEW.etapa = 'solicitacao_demanda' AND OLD.recusado = false
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'triagem_inicial' AND NEW.etapa = 'solicitacao_demanda' AND OLD.recusado = true
        THEN true -- já validado na checagem de reativação acima

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

-- ============================================================================
-- 4) Migra os dados existentes (trigger desligado desde a secao 0)
-- ============================================================================
UPDATE public.sistema_solicitacao SET etapa = 'solicitacao_demanda' WHERE etapa = 'registro_oficial';
UPDATE public.sistema_solicitacao SET etapa = 'triagem_inicial' WHERE etapa = 'triagem_inicial_comite';
UPDATE public.sistema_solicitacao SET etapa = 'analise_necessidade' WHERE etapa = 'projeto';
UPDATE public.sistema_solicitacao SET etapa = 'aprovacao_priorizacao' WHERE etapa IN ('aprovacoes_priorizacao', 'definicao_responsavel');
UPDATE public.sistema_solicitacao SET etapa = 'desenvolvimento' WHERE etapa = 'desenvolvimento_ajustes';
UPDATE public.sistema_solicitacao SET etapa = 'testes_internos' WHERE etapa = 'homologacao_tecnica';
UPDATE public.sistema_solicitacao SET etapa = 'homologacao_area_solicitante' WHERE etapa = 'homologacao_usuario';
UPDATE public.sistema_solicitacao SET etapa = 'treinamento' WHERE etapa = 'treinamentos';
-- implantacao, acompanhamento_assistido, encerramento mantêm a mesma chave.
-- Os 3 triggers só são religados no final do script (seção 10), depois que
-- log_sistema_solicitacao() e reajustar_prioridade_sistema_solicitacao()
-- também já tiverem sido substituídas (seções 7 e 8).

-- ============================================================================
-- 5) CHECK de etapa com as 14 chaves novas (só agora, com os dados já migrados)
-- ============================================================================
ALTER TABLE public.sistema_solicitacao ALTER COLUMN etapa SET DEFAULT 'solicitacao_demanda';

ALTER TABLE public.sistema_solicitacao ADD CONSTRAINT sistema_solicitacao_etapa_check CHECK (etapa IN (
  'solicitacao_demanda',
  'triagem_inicial',
  'analise_necessidade',
  'levantamento_funcional',
  'documentacao_funcional',
  'analise_tecnica',
  'aprovacao_priorizacao',
  'desenvolvimento',
  'testes_internos',
  'homologacao_area_solicitante',
  'treinamento',
  'implantacao',
  'acompanhamento_assistido',
  'encerramento'
));

DROP INDEX IF EXISTS idx_sistema_solicitacao_prioridade_unica;
CREATE UNIQUE INDEX idx_sistema_solicitacao_prioridade_unica
  ON public.sistema_solicitacao (prioridade)
  WHERE etapa = 'aprovacao_priorizacao';

-- ============================================================================
-- 6) RLS / triggers que citavam etapas antigas por nome
-- ============================================================================
DROP POLICY IF EXISTS sistema_solicitacao_insert ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_insert ON public.sistema_solicitacao
  FOR INSERT TO authenticated
  WITH CHECK (
    etapa = 'solicitacao_demanda'
    AND criado_por = auth.uid()
    AND public.tem_acesso_menu('sistemas_criar_solicitacao')
  );

-- Generaliza: recusado pode acontecer em mais de uma etapa agora (ver trigger
-- de transição), então o DELETE não fica mais travado numa etapa específica.
DROP POLICY IF EXISTS sistema_solicitacao_delete ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_delete ON public.sistema_solicitacao
  FOR DELETE TO authenticated
  USING (recusado = true AND public.tem_acesso_menu('sistemas_controladoria'));

DROP POLICY IF EXISTS sistema_solicitacao_convidado_delete ON public.sistema_solicitacao_convidado;
CREATE POLICY sistema_solicitacao_convidado_delete ON public.sistema_solicitacao_convidado
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sistema_solicitacao s
       WHERE s.id = solicitacao_id AND s.criado_por = auth.uid() AND s.etapa = 'solicitacao_demanda'
    )
  );

CREATE OR REPLACE FUNCTION public.checar_convidado_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_etapa text;
  v_criado_por uuid;
BEGIN
  SELECT etapa, criado_por INTO v_etapa, v_criado_por
    FROM public.sistema_solicitacao WHERE id = NEW.solicitacao_id;

  IF v_criado_por IS DISTINCT FROM auth.uid() OR v_etapa <> 'solicitacao_demanda' THEN
    RAISE EXCEPTION 'Convidado só pode ser adicionado pelo criador, enquanto o card está em "Solicitação da Demanda".';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.screen_permission_user
     WHERE user_id = NEW.user_id AND menu_codigo = 'sistemas_convidado'
       AND acao = 'visualizar' AND allow = true AND empresa_id IS NULL
  ) THEN
    RAISE EXCEPTION 'O usuário selecionado não tem a permissão de Convidado habilitada.';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 7) Reajuste de prioridade (AFTER trigger) — só a chave de etapa muda
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reajustar_prioridade_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.etapa = 'aprovacao_priorizacao' AND NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    UPDATE public.sistema_solicitacao
       SET prioridade = -prioridade
     WHERE etapa = 'aprovacao_priorizacao' AND id <> OLD.id AND prioridade IS NOT NULL;

    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY -prioridade) AS rn
        FROM public.sistema_solicitacao
       WHERE etapa = 'aprovacao_priorizacao' AND id <> OLD.id AND prioridade IS NOT NULL
    )
    UPDATE public.sistema_solicitacao s
       SET prioridade = ranked.rn
      FROM ranked
     WHERE s.id = ranked.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 8) Log de auditoria: novos campos
-- ============================================================================
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
  IF NEW.criterio_triagem IS DISTINCT FROM OLD.criterio_triagem THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_criterio_triagem', NEW.criterio_triagem);
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
  IF NEW.status_desenvolvimento IS DISTINCT FROM OLD.status_desenvolvimento THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_status_desenvolvimento', NEW.status_desenvolvimento);
  END IF;
  IF NEW.implantacao_status IS DISTINCT FROM OLD.implantacao_status THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_status_implantacao', NEW.implantacao_status);
  END IF;
  IF NEW.finalizado IS DISTINCT FROM OLD.finalizado THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'finalizado', NEW.finalizado::text);
  END IF;
  IF NEW.testes_interno_aprov_1 IS DISTINCT FROM OLD.testes_interno_aprov_1 THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'aprovacao_testes_internos_1', NEW.testes_interno_aprov_1::text);
  END IF;
  IF NEW.testes_interno_aprov_2 IS DISTINCT FROM OLD.testes_interno_aprov_2 THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'aprovacao_testes_internos_2', NEW.testes_interno_aprov_2::text);
  END IF;
  IF NEW.testes_interno_aprov_3 IS DISTINCT FROM OLD.testes_interno_aprov_3 THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'aprovacao_testes_internos_3', NEW.testes_interno_aprov_3::text);
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

-- ============================================================================
-- 9) Aba "Assinaturas" — tabela isolada, sem relação com o `etapa`
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sistema_solicitacao_assinatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.sistema_solicitacao(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  etapa text NOT NULL,
  assinatura_png text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sistema_solicitacao_assinatura_solicitacao
  ON public.sistema_solicitacao_assinatura (solicitacao_id);

ALTER TABLE public.sistema_solicitacao_assinatura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sistema_solicitacao_assinatura_select ON public.sistema_solicitacao_assinatura;
CREATE POLICY sistema_solicitacao_assinatura_select ON public.sistema_solicitacao_assinatura
  FOR SELECT TO authenticated
  USING (public.sistema_pode_ver((SELECT criado_por FROM public.sistema_solicitacao WHERE id = solicitacao_id), solicitacao_id));

DROP POLICY IF EXISTS sistema_solicitacao_assinatura_insert ON public.sistema_solicitacao_assinatura;
CREATE POLICY sistema_solicitacao_assinatura_insert ON public.sistema_solicitacao_assinatura
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.sistema_pode_ver((SELECT criado_por FROM public.sistema_solicitacao WHERE id = solicitacao_id), solicitacao_id)
  );

-- ============================================================================
-- 10) Religa os 3 triggers desligados na seção 0 — só agora, com TODOS os
--     corpos de função (transição, log e reajuste de prioridade) já
--     substituídos pelas versões novas.
-- ============================================================================
ALTER TABLE public.sistema_solicitacao ENABLE TRIGGER trg_checar_transicao_sistema_solicitacao;
ALTER TABLE public.sistema_solicitacao ENABLE TRIGGER trg_log_sistema_solicitacao;
ALTER TABLE public.sistema_solicitacao ENABLE TRIGGER trg_reajustar_prioridade_sistema_solicitacao;
