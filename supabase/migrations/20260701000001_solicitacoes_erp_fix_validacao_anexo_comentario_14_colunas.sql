-- Corrige os triggers de validacao de anexo/comentario (checar_anexo_campo_sistema_solicitacao
-- e checar_comentario_tipo_sistema_solicitacao), que ainda referenciavam as etapas antigas
-- (projeto, treinamentos, homologacao_tecnica, homologacao_usuario) de antes da reestruturacao
-- de 14 colunas (20260630000001). Como essas etapas nao existem mais, as condicoes de etapa
-- eram sempre verdadeiras e bloqueavam o anexo/comentario para todo mundo, independente do papel.

CREATE OR REPLACE FUNCTION public.checar_anexo_campo_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_etapa text;
BEGIN
  IF NEW.campo IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT etapa INTO v_etapa FROM public.sistema_solicitacao WHERE id = NEW.solicitacao_id;

  IF NEW.campo = 'analise_necessidade' THEN
    IF v_etapa <> 'analise_necessidade' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Análise de Necessidade, pelo Comitê.';
    END IF;
  ELSIF NEW.campo = 'levantamento_funcional' THEN
    IF v_etapa <> 'levantamento_funcional' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Levantamento Funcional, pela Controladoria.';
    END IF;
  ELSIF NEW.campo = 'documentacao_tecnica' THEN
    IF v_etapa <> 'documentacao_funcional' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Documentação Funcional, pela Controladoria.';
    END IF;
  ELSIF NEW.campo = 'analise_tecnica' THEN
    IF v_etapa <> 'analise_tecnica' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Análise Técnica, pelo Gerente de Sistemas.';
    END IF;
  ELSIF NEW.campo = 'treinamento' THEN
    IF v_etapa <> 'treinamento' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Treinamento, pelo Gerente de Sistemas.';
    END IF;
  ELSIF NEW.campo IN ('acompanhamento', 'encerramento') THEN
    IF NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Esse anexo só é permitido pra Controladoria.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.checar_comentario_tipo_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_etapa text;
  v_criado_por uuid;
BEGIN
  IF NEW.tipo IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT etapa, criado_por INTO v_etapa, v_criado_por
    FROM public.sistema_solicitacao WHERE id = NEW.solicitacao_id;

  IF NEW.tipo = 'justificativa_retorno' THEN
    IF v_etapa <> 'testes_internos'
       OR NOT (public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria') OR public.tem_acesso_menu('sistemas_desenvolvedores')) THEN
      RAISE EXCEPTION 'Justificativa de retorno só é permitida em Testes Internos, por Comitê, Controladoria ou Desenvolvedores.';
    END IF;
  ELSIF NEW.tipo IN ('aprovado_ressalva', 'reprovado') THEN
    IF v_etapa <> 'homologacao_area_solicitante' OR NOT public.sistema_pode_agir_homologacao_usuario(v_criado_por, NEW.solicitacao_id) THEN
      RAISE EXCEPTION 'Essa ação só é permitida na Homologação da Área Solicitante, por quem criou, foi convidado, ou Controladoria.';
    END IF;
  ELSIF NEW.tipo IN ('faltou_funcoes', 'encontrado_bug') THEN
    IF v_etapa <> 'treinamento' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Esse comentário só é permitido na etapa Treinamento, pelo Gerente de Sistemas.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
