-- =========================================================================
-- RECRUTAMENTO: novo fluxo em 2 níveis
--
-- 1. Solicitação (board externo) — fluxo curto:
--    Pendente Operacional → Pendente Recrutamento → Seleção de Candidato
--    → Concluída (manual) ; Reprovada continua existindo.
--
-- 2. Candidato (kanban interno por solicitação) — anda dentro de WA_CURRICULOS:
--    Selecionado → Pendente Jurídico → ASO → Admissão ; estado Reprovado.
--    Jurídico e SST têm fila própria via VW_RECRUTAMENTO_CANDIDATOS.
--
-- O portal público continua publicando as vagas que estão em 'Seleção de Candidato'.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- =========================================================================

-- ── 1a. Renomear/consolidar status das solicitações existentes ───────────
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Pendente Operacional'
  WHERE status = 'Aguardando Aprovação';
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Pendente Recrutamento'
  WHERE status = 'Aguardando Recrutamento';
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Seleção de Candidato'
  WHERE status IN (
    'Aprovada','Vaga Aberta','Seleção de Currículos','Em Processo Seletivo',
    'Entrevistas','Entrevista com Gestor','Entrevista com Psicóloga',
    'Aguardando Documentação','Aguardando ASO','Funcionário Selecionado'
  );
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Concluída'
  WHERE status = 'Contratado';

ALTER TABLE public."SISTEMA_RECRUTAMENTO"
  ALTER COLUMN status SET DEFAULT 'Pendente Operacional';

-- ── 1b. Colunas de processo do candidato em WA_CURRICULOS ────────────────
ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS cpf               text,
  ADD COLUMN IF NOT EXISTS cpf_cand          text,
  ADD COLUMN IF NOT EXISTS etapa_processo    text,
  ADD COLUMN IF NOT EXISTS etapa_changed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS selecionado_por   text,
  ADD COLUMN IF NOT EXISTS selecionado_em    timestamptz,
  ADD COLUMN IF NOT EXISTS juridico_ok       boolean,
  ADD COLUMN IF NOT EXISTS juridico_obs      text,
  ADD COLUMN IF NOT EXISTS juridico_por      text,
  ADD COLUMN IF NOT EXISTS juridico_em       timestamptz,
  ADD COLUMN IF NOT EXISTS sst_ok            boolean,
  ADD COLUMN IF NOT EXISTS sst_obs           text,
  ADD COLUMN IF NOT EXISTS sst_por           text,
  ADD COLUMN IF NOT EXISTS sst_em            timestamptz,
  ADD COLUMN IF NOT EXISTS admitido_em       timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao text;

CREATE INDEX IF NOT EXISTS wac_etapa_idx ON public."WA_CURRICULOS"(etapa_processo);

-- ── 1c. View das filas Jurídico/SST (candidato × vaga) ───────────────────
-- Junta os candidatos em processo (etapa_processo preenchida) com os dados da
-- vaga, para as telas de Jurídico (Pendente Jurídico) e SST (ASO).
CREATE OR REPLACE VIEW public."VW_RECRUTAMENTO_CANDIDATOS" AS
  SELECT
    c.id                        AS candidato_id,
    c.vaga_id,
    c.nome,
    c.telefone,
    c.email,
    COALESCE(c.cpf, c.cpf_cand) AS cpf,
    c.origem,
    c.storage_path,
    c.mensagem,
    c.etapa_processo,
    c.etapa_changed_at,
    c.selecionado_por,
    c.selecionado_em,
    c.juridico_ok,
    c.juridico_obs,
    c.juridico_por,
    c.juridico_em,
    c.sst_ok,
    c.sst_obs,
    c.sst_por,
    c.sst_em,
    c.admitido_em,
    c.motivo_reprovacao,
    c.created_at                AS candidatura_em,
    s.cargo,
    s.contrato,
    s.cidade,
    s.status                    AS vaga_status
  FROM public."WA_CURRICULOS" c
  JOIN public."SISTEMA_RECRUTAMENTO" s ON s.id = c.vaga_id
  WHERE c.etapa_processo IS NOT NULL;

GRANT SELECT ON public."VW_RECRUTAMENTO_CANDIDATOS" TO authenticated;

-- ── 1d. RPCs do portal: publicar vagas em 'Seleção de Candidato' ─────────
CREATE OR REPLACE FUNCTION public.portal_cidades_com_vagas()
RETURNS TABLE (cidade text, vagas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NULLIF(btrim("cidade"), '') AS cidade, count(*)::bigint AS vagas
  FROM public."SISTEMA_RECRUTAMENTO"
  WHERE "status" = 'Seleção de Candidato'
    AND NULLIF(btrim("cidade"), '') IS NOT NULL
  GROUP BY NULLIF(btrim("cidade"), '')
  ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.portal_cidades_com_vagas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cidades_com_vagas() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_vagas_por_cidade(p_cidade text)
RETURNS TABLE (
  id integer, cargo text, contrato text, cidade text,
  escala text, salario text, beneficios text, quantidade_vagas integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT "id", "cargo", "contrato", "cidade",
         "escala", "salario", "beneficios", "quantidade_vagas"
  FROM public."SISTEMA_RECRUTAMENTO"
  WHERE "status" = 'Seleção de Candidato'
    AND btrim(lower("cidade")) = btrim(lower(coalesce(p_cidade, '')))
  ORDER BY "cargo";
$$;
REVOKE ALL ON FUNCTION public.portal_vagas_por_cidade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_vagas_por_cidade(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_candidatar(
  p_vaga_id      integer,
  p_nome         text,
  p_telefone     text,
  p_email        text,
  p_cpf          text,
  p_mensagem     text,
  p_arquivo_nome text,
  p_storage_path text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status text;
  v_id     bigint;
  v_field  record;
  v_col    text;
BEGIN
  IF coalesce(btrim(p_nome), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe seu nome.');
  END IF;
  IF coalesce(btrim(p_telefone), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe seu telefone.');
  END IF;

  SELECT "status" INTO v_status FROM public."SISTEMA_RECRUTAMENTO" WHERE "id" = p_vaga_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vaga não encontrada.');
  END IF;
  IF v_status <> 'Seleção de Candidato' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta vaga não está mais recebendo currículos.');
  END IF;

  INSERT INTO public."WA_CURRICULOS" (vaga_id, origem)
  VALUES (p_vaga_id, 'Portal')
  RETURNING id INTO v_id;

  FOR v_field IN
    SELECT t.cands, t.val FROM (VALUES
      (ARRAY['nome','nome_cand','nome_candidato'],    btrim(p_nome)),
      (ARRAY['telefone','fone','celular','whatsapp'], btrim(p_telefone)),
      (ARRAY['email','email_cand'],                   NULLIF(btrim(p_email), '')),
      (ARRAY['cpf','cpf_cand'],                       NULLIF(btrim(p_cpf), '')),
      (ARRAY['mensagem','observacao','obs'],          NULLIF(btrim(p_mensagem), '')),
      (ARRAY['arquivo_nome','nome_arquivo'],          NULLIF(btrim(p_arquivo_nome), '')),
      (ARRAY['storage_path','arquivo_path','path'],   NULLIF(btrim(p_storage_path), ''))
    ) AS t(cands, val)
    WHERE t.val IS NOT NULL
  LOOP
    SELECT c.column_name INTO v_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'WA_CURRICULOS'
      AND c.column_name::text = ANY (v_field.cands)
    ORDER BY array_position(v_field.cands, c.column_name::text)
    LIMIT 1;
    IF v_col IS NOT NULL THEN
      EXECUTE format('UPDATE public."WA_CURRICULOS" SET %I = $1 WHERE id = $2', v_col)
        USING v_field.val, v_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_candidatar(integer,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_candidatar(integer,text,text,text,text,text,text,text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
