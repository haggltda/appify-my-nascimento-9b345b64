-- Libera anexo nas 4 colunas que ganharam upload de arquivo agora (pros
-- documentos oficiais Anexo IV-VII da aba "Documentos e Assinaturas"):
-- Aprovação e Priorização, Testes Internos, Homologação da Área Solicitante,
-- Implantação. Sem isso, esses 4 campos novos passariam batido sem nenhuma
-- checagem de papel/etapa (a função só valida os campos que conhece).

CREATE OR REPLACE FUNCTION public.checar_anexo_campo_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_etapa text;
  v_criado_por uuid;
BEGIN
  IF NEW.campo IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT etapa, criado_por INTO v_etapa, v_criado_por FROM public.sistema_solicitacao WHERE id = NEW.solicitacao_id;

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
  ELSIF NEW.campo = 'aprovacao_priorizacao' THEN
    IF v_etapa <> 'aprovacao_priorizacao' OR NOT (public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_gerente_sistemas')) THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Aprovação e Priorização, por Comitê ou Gerente de Sistemas.';
    END IF;
  ELSIF NEW.campo = 'testes_internos' THEN
    IF v_etapa <> 'testes_internos' OR NOT public.tem_acesso_menu('sistemas_desenvolvedores') THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Testes Internos, por Desenvolvedores.';
    END IF;
  ELSIF NEW.campo = 'homologacao_area_solicitante' THEN
    IF v_etapa <> 'homologacao_area_solicitante' OR NOT public.sistema_pode_agir_homologacao_usuario(v_criado_por, NEW.solicitacao_id) THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Homologação da Área Solicitante, por quem criou, foi convidado, ou Controladoria.';
    END IF;
  ELSIF NEW.campo = 'implantacao' THEN
    IF v_etapa <> 'implantacao' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Implantação, pelo Gerente de Sistemas.';
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
