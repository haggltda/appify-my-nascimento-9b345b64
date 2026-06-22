-- Solicitações ERP: percentual de progresso no card.
-- Só quem é o responsável atual da solicitação pode atualizar o percentual
-- (diferente da regra de mover etapa/definir responsável, que é por código
-- de permissão — aqui é "é a pessoa designada", ponto).

ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS progresso_pct integer NOT NULL DEFAULT 0
    CHECK (progresso_pct BETWEEN 0 AND 100);

CREATE OR REPLACE FUNCTION public.checar_transicao_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_codigo text;
BEGIN
  IF NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id THEN
    IF OLD.etapa <> 'projetos_definicao_responsavel'
       OR NOT public.tem_acesso_menu('sistemas_mover_projetos_em_andamento') THEN
      RAISE EXCEPTION 'Responsável só pode ser definido na etapa "Projetos e Definição de Responsável", por quem pode mover o card dessa etapa.';
    END IF;
  END IF;

  IF NEW.progresso_pct IS DISTINCT FROM OLD.progresso_pct THEN
    IF OLD.responsavel_user_id IS NULL OR auth.uid() <> OLD.responsavel_user_id THEN
      RAISE EXCEPTION 'Só o responsável atual da solicitação pode atualizar o percentual de progresso.';
    END IF;
  END IF;

  IF NEW.etapa = OLD.etapa THEN
    RETURN NEW;
  END IF;

  v_codigo := CASE
    WHEN OLD.etapa = 'solicitacoes' AND NEW.etapa = 'aprovado_presidencia'
      THEN 'sistemas_mover_solicitacoes_aprovado_presidencia'
    WHEN OLD.etapa = 'aprovado_presidencia' AND NEW.etapa = 'projetos_definicao_responsavel'
      THEN 'sistemas_mover_aprovado_presidencia_projetos'
    WHEN OLD.etapa = 'projetos_definicao_responsavel' AND NEW.etapa = 'em_andamento'
      THEN 'sistemas_mover_projetos_em_andamento'
    WHEN OLD.etapa = 'em_andamento' AND NEW.etapa = 'validacao_presidencia'
      THEN 'sistemas_mover_em_andamento_validacao_presidencia'
    WHEN OLD.etapa = 'validacao_presidencia' AND NEW.etapa = 'teste_setor_responsavel'
      THEN 'sistemas_mover_validacao_presidencia_teste_setor'
    WHEN OLD.etapa = 'teste_setor_responsavel' AND NEW.etapa = 'treinamentos'
      THEN 'sistemas_mover_teste_setor_treinamentos'
    WHEN OLD.etapa = 'treinamentos' AND NEW.etapa = 'implantacao'
      THEN 'sistemas_mover_treinamentos_implantacao'
    ELSE NULL
  END;

  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Transição de etapa não permitida: % → %', OLD.etapa, NEW.etapa;
  END IF;

  IF NOT public.tem_acesso_menu(v_codigo) THEN
    RAISE EXCEPTION 'Sem permissão para mover de % para %', OLD.etapa, NEW.etapa;
  END IF;

  RETURN NEW;
END;
$$;
