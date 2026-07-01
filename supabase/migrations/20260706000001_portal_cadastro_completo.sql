-- =========================================================================
-- PORTAL DE CANDIDATURA — cadastro completo + candidatura geral
--
-- 1) Campos de perfil do candidato em WA_CURRICULOS.
-- 2) Candidatura GERAL (sem vaga): vaga_id NULL, tipo_candidatura='geral'.
-- 3) Anexos múltiplos (currículo + CTPS) em RECRUTAMENTO_CANDIDATO_ARQUIVOS.
-- 4) RPC portal_candidatar_v2(jsonb) p/ o portal público (anon).
--
-- Idempotente.
-- =========================================================================

ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS cpf                      text,
  ADD COLUMN IF NOT EXISTS cpf_cand                 text,
  ADD COLUMN IF NOT EXISTS etapa_processo           text,
  ADD COLUMN IF NOT EXISTS data_nascimento          date,
  ADD COLUMN IF NOT EXISTS rg                       text,
  ADD COLUMN IF NOT EXISTS sexo                     text,
  ADD COLUMN IF NOT EXISTS nome_mae                 text,
  ADD COLUMN IF NOT EXISTS nome_pai                 text,
  ADD COLUMN IF NOT EXISTS escolaridade             text,
  ADD COLUMN IF NOT EXISTS cidade_residencia        text,
  ADD COLUMN IF NOT EXISTS estado_desejado          text,
  ADD COLUMN IF NOT EXISTS cidade_desejada          text,
  ADD COLUMN IF NOT EXISTS cargos_interesse         text,
  ADD COLUMN IF NOT EXISTS disponibilidade_horarios text,
  ADD COLUMN IF NOT EXISTS disp_fim_semana          boolean,
  ADD COLUMN IF NOT EXISTS possui_cnh               boolean,
  ADD COLUMN IF NOT EXISTS experiencia_previa       boolean,
  ADD COLUMN IF NOT EXISTS estrangeiro              boolean,
  ADD COLUMN IF NOT EXISTS tipo_candidatura         text;

-- Candidatura geral não tem vaga → vaga_id precisa aceitar NULL.
ALTER TABLE public."WA_CURRICULOS" ALTER COLUMN vaga_id DROP NOT NULL;

-- ── Anexos do candidato (currículo + CTPS, múltiplos) ────────────────────
CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_CANDIDATO_ARQUIVOS" (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  candidato_id bigint REFERENCES public."WA_CURRICULOS"(id) ON DELETE CASCADE,
  tipo         text,        -- 'curriculo' | 'ctps'
  storage_path text,
  nome         text
);
CREATE INDEX IF NOT EXISTS rec_cand_arq_idx ON public."RECRUTAMENTO_CANDIDATO_ARQUIVOS"(candidato_id);
ALTER TABLE public."RECRUTAMENTO_CANDIDATO_ARQUIVOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RECRUTAMENTO_CANDIDATO_ARQUIVOS" TO authenticated;
DROP POLICY IF EXISTS rec_cand_arq_all ON public."RECRUTAMENTO_CANDIDATO_ARQUIVOS";
CREATE POLICY rec_cand_arq_all ON public."RECRUTAMENTO_CANDIDATO_ARQUIVOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── RPC do portal (candidatura geral OU para vaga) ───────────────────────
CREATE OR REPLACE FUNCTION public.portal_candidatar_v2(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vaga     bigint;
  v_status   text;
  v_id       bigint;
  v_tipo     text;
  v_arq      jsonb;
  v_first_cv text;
BEGIN
  v_vaga := NULLIF(p_payload->>'vaga_id', '')::bigint;
  v_tipo := CASE WHEN v_vaga IS NULL THEN 'geral' ELSE 'vaga' END;

  IF coalesce(btrim(p_payload->>'nome'), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe seu nome.');
  END IF;
  IF coalesce(btrim(p_payload->>'telefone'), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe seu telefone.');
  END IF;
  IF length(regexp_replace(coalesce(p_payload->>'cpf',''), '\D', '', 'g')) <> 11 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CPF inválido.');
  END IF;

  IF v_vaga IS NOT NULL THEN
    SELECT status INTO v_status FROM public."SISTEMA_RECRUTAMENTO" WHERE id = v_vaga;
    IF v_status IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Vaga não encontrada.'); END IF;
    IF v_status <> 'Vaga aberta - Seleção de Currículos' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Esta vaga não está mais recebendo currículos.');
    END IF;
  END IF;

  SELECT (elem->>'path') INTO v_first_cv
  FROM jsonb_array_elements(coalesce(p_payload->'curriculos', '[]'::jsonb)) elem LIMIT 1;

  INSERT INTO public."WA_CURRICULOS" (
    vaga_id, origem, tipo_candidatura, nome, telefone, email, cpf, cpf_cand, mensagem, storage_path,
    data_nascimento, rg, sexo, nome_mae, nome_pai, escolaridade, cidade_residencia,
    estado_desejado, cidade_desejada, cargos_interesse, disponibilidade_horarios,
    disp_fim_semana, possui_cnh, experiencia_previa, estrangeiro
  ) VALUES (
    v_vaga, 'Portal', v_tipo,
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
    NULLIF(p_payload->>'experiencia_previa', '')::boolean, NULLIF(p_payload->>'estrangeiro', '')::boolean
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
