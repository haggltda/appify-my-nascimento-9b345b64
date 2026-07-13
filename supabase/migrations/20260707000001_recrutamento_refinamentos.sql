-- =========================================================================
-- RECRUTAMENTO — refinamentos
-- 1) Candidatura a vaga entra DIRETO em ENTRADA (portal_candidatar_v2).
-- 2) 3 experiências relevantes.
-- 3) SST em 2 partes (agendar data/hora/local → realizar).
-- 4) EPIs: flag "obrigatório"; Compras informa data de chegada.
-- 5) Roteiro de entrevista (RECRUTAMENTO_ENTREVISTA).
-- 6) "Enviar para Admissão" → status final "Contratado".
-- Idempotente.
-- =========================================================================

ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS experiencia_1       text,
  ADD COLUMN IF NOT EXISTS experiencia_2       text,
  ADD COLUMN IF NOT EXISTS experiencia_3       text,
  ADD COLUMN IF NOT EXISTS sst_data_exame      date,
  ADD COLUMN IF NOT EXISTS sst_hora_exame      text,
  ADD COLUMN IF NOT EXISTS sst_local_exame     text,
  ADD COLUMN IF NOT EXISTS sst_agendado_por    text,
  ADD COLUMN IF NOT EXISTS sst_agendado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS compras_data_chegada date;

ALTER TABLE public."RECRUTAMENTO_EPIS"
  ADD COLUMN IF NOT EXISTS obrigatorio boolean;

-- ── Roteiro de entrevista (perguntas/respostas por candidato/etapa) ──────
CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_ENTREVISTA" (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  candidato_id bigint REFERENCES public."WA_CURRICULOS"(id) ON DELETE CASCADE,
  etapa        text,        -- 'ENTREVISTA' | 'ENTREVISTA GESTOR'
  ordem        int,
  pergunta     text,
  resposta     text
);
CREATE INDEX IF NOT EXISTS rec_entrev_idx ON public."RECRUTAMENTO_ENTREVISTA"(candidato_id, etapa);
ALTER TABLE public."RECRUTAMENTO_ENTREVISTA" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RECRUTAMENTO_ENTREVISTA" TO authenticated;
DROP POLICY IF EXISTS rec_entrev_all ON public."RECRUTAMENTO_ENTREVISTA";
CREATE POLICY rec_entrev_all ON public."RECRUTAMENTO_ENTREVISTA"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Status final: "Concluído - Enviado para Admissão" → "Contratado" ─────
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Contratado'
  WHERE status = 'Concluído - Enviado para Admissão';

-- ── Trigger de auto-status: DOCUMENTAÇÃO + enviado → Contratado ──────────
CREATE OR REPLACE FUNCTION public.sr_sync_status_solicitacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_vaga bigint; v_atual text; v_rank int; v_epis boolean; v_envadm timestamptz; v_new text;
BEGIN
  v_vaga := COALESCE(NEW.vaga_id, OLD.vaga_id);
  IF v_vaga IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT status INTO v_atual FROM public."SISTEMA_RECRUTAMENTO" WHERE id = v_vaga;
  IF v_atual IS NULL OR v_atual IN ('Pendente Operacional','Pendente Recrutamento','Reprovada') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT sr_rank_etapa(c.etapa_processo), c.epis_informados, c.enviado_admissao_em
    INTO v_rank, v_epis, v_envadm
  FROM public."WA_CURRICULOS" c
  WHERE c.vaga_id = v_vaga AND c.etapa_processo IS NOT NULL AND c.etapa_processo <> 'Reprovado'
  ORDER BY sr_rank_etapa(c.etapa_processo) DESC, c.enviado_admissao_em DESC NULLS LAST, c.epis_informados DESC NULLS LAST
  LIMIT 1;
  IF v_rank IS NULL OR v_rank <= 2 THEN v_new := 'Vaga aberta - Seleção de Currículos';
  ELSIF v_rank = 3 THEN v_new := 'Em análise jurídica';
  ELSIF v_rank = 4 THEN v_new := 'Entrevista e Avaliação';
  ELSIF v_rank = 5 THEN v_new := 'Entrevista com Gestor';
  ELSIF v_rank = 6 THEN v_new := 'Aprovado - Aguardando SST';
  ELSIF v_rank = 7 THEN v_new := 'Encaminhado para SST (ASO)';
  ELSIF v_rank = 8 THEN v_new := CASE WHEN COALESCE(v_epis,false) THEN 'Aguardando Confirmação Compras' ELSE 'ASO Aprovado - Aguardando Informe de EPIs' END;
  ELSIF v_rank = 9 THEN v_new := CASE WHEN v_envadm IS NOT NULL THEN 'Contratado' ELSE 'Compras Confirmou - Aguardando Documentação' END;
  ELSE v_new := v_atual; END IF;
  IF v_new IS DISTINCT FROM v_atual THEN
    UPDATE public."SISTEMA_RECRUTAMENTO" SET status = v_new WHERE id = v_vaga;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── portal_candidatar_v2: candidatura a vaga entra DIRETO em ENTRADA ─────
CREATE OR REPLACE FUNCTION public.portal_candidatar_v2(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vaga bigint; v_status text; v_id bigint; v_tipo text; v_arq jsonb; v_first_cv text;
  v_etapa text; v_now timestamptz := now();
BEGIN
  v_vaga := NULLIF(p_payload->>'vaga_id', '')::bigint;
  v_tipo := CASE WHEN v_vaga IS NULL THEN 'geral' ELSE 'vaga' END;
  v_etapa := CASE WHEN v_vaga IS NULL THEN NULL ELSE 'ENTRADA' END;

  IF coalesce(btrim(p_payload->>'nome'), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Informe seu nome.'); END IF;
  IF coalesce(btrim(p_payload->>'telefone'), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Informe seu telefone.'); END IF;
  IF length(regexp_replace(coalesce(p_payload->>'cpf',''), '\D', '', 'g')) <> 11 THEN RETURN jsonb_build_object('ok', false, 'error', 'CPF inválido.'); END IF;

  IF v_vaga IS NOT NULL THEN
    SELECT status INTO v_status FROM public."SISTEMA_RECRUTAMENTO" WHERE id = v_vaga;
    IF v_status IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Vaga não encontrada.'); END IF;
    IF v_status <> 'Vaga aberta - Seleção de Currículos' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Esta vaga não está mais recebendo currículos.');
    END IF;
  END IF;

  SELECT (elem->>'path') INTO v_first_cv FROM jsonb_array_elements(coalesce(p_payload->'curriculos', '[]'::jsonb)) elem LIMIT 1;

  INSERT INTO public."WA_CURRICULOS" (
    vaga_id, origem, tipo_candidatura, etapa_processo, etapa_changed_at, selecionado_por, selecionado_em,
    nome, telefone, email, cpf, cpf_cand, mensagem, storage_path,
    data_nascimento, rg, sexo, nome_mae, nome_pai, escolaridade, cidade_residencia,
    estado_desejado, cidade_desejada, cargos_interesse, disponibilidade_horarios,
    disp_fim_semana, possui_cnh, experiencia_previa, estrangeiro,
    experiencia_1, experiencia_2, experiencia_3
  ) VALUES (
    v_vaga, 'Portal', v_tipo, v_etapa,
    CASE WHEN v_etapa IS NULL THEN NULL ELSE v_now END,
    CASE WHEN v_etapa IS NULL THEN NULL ELSE 'Portal' END,
    CASE WHEN v_etapa IS NULL THEN NULL ELSE v_now END,
    btrim(p_payload->>'nome'), btrim(p_payload->>'telefone'), NULLIF(btrim(p_payload->>'email'), ''),
    NULLIF(btrim(p_payload->>'cpf'), ''), NULLIF(btrim(p_payload->>'cpf'), ''),
    NULLIF(btrim(p_payload->>'mensagem'), ''), v_first_cv,
    NULLIF(p_payload->>'data_nascimento', '')::date, NULLIF(btrim(p_payload->>'rg'), ''),
    NULLIF(btrim(p_payload->>'sexo'), ''), NULLIF(btrim(p_payload->>'nome_mae'), ''),
    NULLIF(btrim(p_payload->>'nome_pai'), ''), NULLIF(btrim(p_payload->>'escolaridade'), ''),
    NULLIF(btrim(p_payload->>'cidade_residencia'), ''), NULLIF(btrim(p_payload->>'estado_desejado'), ''),
    NULLIF(btrim(p_payload->>'cidade_desejada'), ''), NULLIF(btrim(p_payload->>'cargos_interesse'), ''),
    NULLIF(btrim(p_payload->>'disponibilidade_horarios'), ''),
    NULLIF(p_payload->>'disp_fim_semana', '')::boolean, NULLIF(p_payload->>'possui_cnh', '')::boolean,
    NULLIF(p_payload->>'experiencia_previa', '')::boolean, NULLIF(p_payload->>'estrangeiro', '')::boolean,
    NULLIF(btrim(p_payload->>'experiencia_1'), ''), NULLIF(btrim(p_payload->>'experiencia_2'), ''),
    NULLIF(btrim(p_payload->>'experiencia_3'), '')
  ) RETURNING id INTO v_id;

  FOR v_arq IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'curriculos', '[]'::jsonb)) LOOP
    INSERT INTO public."RECRUTAMENTO_CANDIDATO_ARQUIVOS"(candidato_id, tipo, storage_path, nome)
    VALUES (v_id, 'curriculo', v_arq->>'path', v_arq->>'nome');
  END LOOP;
  FOR v_arq IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'ctps', '[]'::jsonb)) LOOP
    INSERT INTO public."RECRUTAMENTO_CANDIDATO_ARQUIVOS"(candidato_id, tipo, storage_path, nome)
    VALUES (v_id, 'ctps', v_arq->>'path', v_arq->>'nome');
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_candidatar_v2(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_candidatar_v2(jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
