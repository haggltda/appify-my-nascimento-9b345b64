-- =========================================================================
-- RECRUTAMENTO — dois trilhos de status
--
-- 1) Status da Solicitação (SISTEMA_RECRUTAMENTO.status) avança AUTOMATICAMENTE
--    espelhando o candidato selecionado mais avançado (trigger).
-- 2) Status do Candidato (WA_CURRICULOS.etapa_processo) = kanban de 9 colunas:
--    ENTRADA → TRIAGEM → JURÍDICO → ENTREVISTA → ENTREVISTA GESTOR → APROVADOS →
--    EXAME SST → COMPRAS → DOCUMENTAÇÃO  (+ Reprovado).
--
-- Idempotente.
-- =========================================================================

-- ── Colunas usadas pela view/fluxo (auto-suficiente: não depende de
--    migrations anteriores; IF NOT EXISTS é idempotente) ──────────────────
ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS cpf                  text,
  ADD COLUMN IF NOT EXISTS cpf_cand             text,
  ADD COLUMN IF NOT EXISTS etapa_processo       text,
  ADD COLUMN IF NOT EXISTS etapa_changed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS selecionado_por      text,
  ADD COLUMN IF NOT EXISTS selecionado_em       timestamptz,
  ADD COLUMN IF NOT EXISTS juridico_ok          boolean,
  ADD COLUMN IF NOT EXISTS juridico_obs         text,
  ADD COLUMN IF NOT EXISTS juridico_por         text,
  ADD COLUMN IF NOT EXISTS juridico_em          timestamptz,
  ADD COLUMN IF NOT EXISTS sst_ok               boolean,
  ADD COLUMN IF NOT EXISTS sst_obs              text,
  ADD COLUMN IF NOT EXISTS sst_por              text,
  ADD COLUMN IF NOT EXISTS sst_em               timestamptz,
  ADD COLUMN IF NOT EXISTS compras_necessidades text,
  ADD COLUMN IF NOT EXISTS compras_por          text,
  ADD COLUMN IF NOT EXISTS compras_em           timestamptz,
  ADD COLUMN IF NOT EXISTS compras_obs          text,
  ADD COLUMN IF NOT EXISTS admitido_por         text,
  ADD COLUMN IF NOT EXISTS admitido_em          timestamptz,
  ADD COLUMN IF NOT EXISTS empregado_id         bigint,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao    text,
  ADD COLUMN IF NOT EXISTS epis_informados      boolean,
  ADD COLUMN IF NOT EXISTS epis_informados_em   timestamptz,
  ADD COLUMN IF NOT EXISTS enviado_admissao_por text,
  ADD COLUMN IF NOT EXISTS enviado_admissao_em  timestamptz;

-- Lista de restrições por CPF (garante existência p/ o LEFT JOIN da view).
CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_CPF_BLACKLIST" (
  cpf_digits text PRIMARY KEY,
  cpf_fmt    text,
  motivo     text,
  criado_por text,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."RECRUTAMENTO_CPF_BLACKLIST" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RECRUTAMENTO_CPF_BLACKLIST" TO authenticated;
DROP POLICY IF EXISTS rec_cpf_bl_all ON public."RECRUTAMENTO_CPF_BLACKLIST";
CREATE POLICY rec_cpf_bl_all ON public."RECRUTAMENTO_CPF_BLACKLIST"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Migrar etapas antigas → novas ────────────────────────────────────────
UPDATE public."WA_CURRICULOS" SET etapa_processo = CASE etapa_processo
  WHEN 'Selecionado'              THEN 'ENTRADA'
  WHEN 'Pendente Jurídico'        THEN 'JURÍDICO'
  WHEN 'Entrevista Comportamental'THEN 'ENTREVISTA'
  WHEN 'Entrevista Técnica'       THEN 'ENTREVISTA GESTOR'
  WHEN 'ASO'                      THEN 'EXAME SST'
  WHEN 'Exame Médico'             THEN 'EXAME SST'
  WHEN 'Compras'                  THEN 'COMPRAS'
  WHEN 'Admissão'                 THEN 'DOCUMENTAÇÃO'
  ELSE etapa_processo END
WHERE etapa_processo IN ('Selecionado','Pendente Jurídico','Entrevista Comportamental',
  'Entrevista Técnica','ASO','Exame Médico','Compras','Admissão');

-- ── Migrar status da solicitação ─────────────────────────────────────────
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Vaga aberta - Seleção de Currículos'
  WHERE status = 'Seleção de Candidato';
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Concluído - Enviado para Admissão'
  WHERE status = 'Concluída';

-- ── Tabela TR de EPIs/uniforme (preenchida pelo Recrutamento) ────────────
CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_EPIS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  candidato_id  bigint REFERENCES public."WA_CURRICULOS"(id) ON DELETE CASCADE,
  vaga_id       bigint,
  item          text,        -- Itens do TR
  tamanho       text,        -- Tamanho por item
  quantidade    text,        -- Quantidade prevista
  periodicidade text,        -- Periodicidade
  observacoes   text,        -- Observações
  responsavel   text         -- Responsável (automático)
);
CREATE INDEX IF NOT EXISTS rec_epis_cand_idx ON public."RECRUTAMENTO_EPIS"(candidato_id);
ALTER TABLE public."RECRUTAMENTO_EPIS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RECRUTAMENTO_EPIS" TO authenticated;
DROP POLICY IF EXISTS rec_epis_all ON public."RECRUTAMENTO_EPIS";
CREATE POLICY rec_epis_all ON public."RECRUTAMENTO_EPIS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Trigger: status da solicitação = candidato mais avançado ─────────────
CREATE OR REPLACE FUNCTION public.sr_rank_etapa(p text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
    WHEN 'ENTRADA' THEN 1 WHEN 'TRIAGEM' THEN 2 WHEN 'JURÍDICO' THEN 3
    WHEN 'ENTREVISTA' THEN 4 WHEN 'ENTREVISTA GESTOR' THEN 5 WHEN 'APROVADOS' THEN 6
    WHEN 'EXAME SST' THEN 7 WHEN 'COMPRAS' THEN 8 WHEN 'DOCUMENTAÇÃO' THEN 9 ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.sr_sync_status_solicitacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_vaga   bigint;
  v_atual  text;
  v_rank   int;
  v_epis   boolean;
  v_envadm timestamptz;
  v_new    text;
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
  ORDER BY sr_rank_etapa(c.etapa_processo) DESC,
           c.enviado_admissao_em DESC NULLS LAST,
           c.epis_informados DESC NULLS LAST
  LIMIT 1;

  IF v_rank IS NULL OR v_rank <= 2 THEN
    v_new := 'Vaga aberta - Seleção de Currículos';
  ELSIF v_rank = 3 THEN v_new := 'Em análise jurídica';
  ELSIF v_rank = 4 THEN v_new := 'Entrevista e Avaliação';
  ELSIF v_rank = 5 THEN v_new := 'Entrevista com Gestor';
  ELSIF v_rank = 6 THEN v_new := 'Aprovado - Aguardando SST';
  ELSIF v_rank = 7 THEN v_new := 'Encaminhado para SST (ASO)';
  ELSIF v_rank = 8 THEN
    v_new := CASE WHEN COALESCE(v_epis,false) THEN 'Aguardando Confirmação Compras'
                  ELSE 'ASO Aprovado - Aguardando Informe de EPIs' END;
  ELSIF v_rank = 9 THEN
    v_new := CASE WHEN v_envadm IS NOT NULL THEN 'Concluído - Enviado para Admissão'
                  ELSE 'Compras Confirmou - Aguardando Documentação' END;
  ELSE v_new := v_atual;
  END IF;

  IF v_new IS DISTINCT FROM v_atual THEN
    UPDATE public."SISTEMA_RECRUTAMENTO" SET status = v_new WHERE id = v_vaga;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sr_sync_status ON public."WA_CURRICULOS";
CREATE TRIGGER trg_sr_sync_status
  AFTER INSERT OR UPDATE ON public."WA_CURRICULOS"
  FOR EACH ROW EXECUTE FUNCTION public.sr_sync_status_solicitacao();

-- ── View das filas (inclui flags novas) ──────────────────────────────────
-- DROP antes de criar: a ordem/colunas mudaram e CREATE OR REPLACE não permite
-- renomear/reordenar colunas existentes.
DROP VIEW IF EXISTS public."VW_RECRUTAMENTO_CANDIDATOS";
CREATE VIEW public."VW_RECRUTAMENTO_CANDIDATOS" AS
  SELECT
    c.id AS candidato_id, c.vaga_id, c.nome, c.telefone, c.email,
    COALESCE(c.cpf, c.cpf_cand) AS cpf, c.origem, c.storage_path, c.mensagem,
    c.etapa_processo, c.etapa_changed_at, c.selecionado_por, c.selecionado_em,
    c.juridico_ok, c.juridico_obs, c.juridico_por, c.juridico_em,
    c.sst_ok, c.sst_obs, c.sst_por, c.sst_em,
    c.compras_necessidades, c.compras_por, c.compras_em, c.compras_obs,
    c.epis_informados, c.epis_informados_em,
    c.enviado_admissao_por, c.enviado_admissao_em,
    c.admitido_por, c.admitido_em, c.empregado_id, c.motivo_reprovacao,
    c.created_at AS candidatura_em,
    s.cargo, s.contrato, s.cidade, s.status AS vaga_status,
    s.motivo_vaga, s.nome_substituido, s.escala, s.horario, s.salario,
    s.beneficios, s.insalubridade_recebe, s.insalubridade_quanto, s.local_exato,
    s.data_inicio_prevista, s.quantidade_vagas, s.req_obrigatorios, s.req_desejaveis,
    s.exp_minima, s.exp_minima_qual, s.grau_urgencia, s.solicitante_nome,
    (b.cpf_digits IS NOT NULL) AS possui_restricao, b.motivo AS restricao_motivo
  FROM public."WA_CURRICULOS" c
  JOIN public."SISTEMA_RECRUTAMENTO" s ON s.id = c.vaga_id
  LEFT JOIN public."RECRUTAMENTO_CPF_BLACKLIST" b
    ON b.cpf_digits = regexp_replace(COALESCE(c.cpf, c.cpf_cand, ''), '\D', '', 'g')
  WHERE c.etapa_processo IS NOT NULL;
GRANT SELECT ON public."VW_RECRUTAMENTO_CANDIDATOS" TO authenticated;

-- ── RPCs do portal: publicar onde 'Vaga aberta - Seleção de Currículos' ──
CREATE OR REPLACE FUNCTION public.portal_cidades_com_vagas()
RETURNS TABLE (cidade text, vagas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NULLIF(btrim("cidade"), '') AS cidade, count(*)::bigint AS vagas
  FROM public."SISTEMA_RECRUTAMENTO"
  WHERE "status" = 'Vaga aberta - Seleção de Currículos'
    AND NULLIF(btrim("cidade"), '') IS NOT NULL
  GROUP BY NULLIF(btrim("cidade"), '') ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.portal_cidades_com_vagas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cidades_com_vagas() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_vagas_por_cidade(p_cidade text)
RETURNS TABLE (id integer, cargo text, contrato text, cidade text, escala text, salario text, beneficios text, quantidade_vagas integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "id", "cargo", "contrato", "cidade", "escala", "salario", "beneficios", "quantidade_vagas"
  FROM public."SISTEMA_RECRUTAMENTO"
  WHERE "status" = 'Vaga aberta - Seleção de Currículos'
    AND btrim(lower("cidade")) = btrim(lower(coalesce(p_cidade, '')))
  ORDER BY "cargo";
$$;
REVOKE ALL ON FUNCTION public.portal_vagas_por_cidade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_vagas_por_cidade(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_candidatar(
  p_vaga_id integer, p_nome text, p_telefone text, p_email text, p_cpf text,
  p_mensagem text, p_arquivo_nome text, p_storage_path text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_id bigint; v_field record; v_col text;
BEGIN
  IF coalesce(btrim(p_nome), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Informe seu nome.'); END IF;
  IF coalesce(btrim(p_telefone), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Informe seu telefone.'); END IF;
  SELECT "status" INTO v_status FROM public."SISTEMA_RECRUTAMENTO" WHERE "id" = p_vaga_id;
  IF v_status IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Vaga não encontrada.'); END IF;
  IF v_status <> 'Vaga aberta - Seleção de Currículos' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta vaga não está mais recebendo currículos.');
  END IF;
  INSERT INTO public."WA_CURRICULOS" (vaga_id, origem) VALUES (p_vaga_id, 'Portal') RETURNING id INTO v_id;
  FOR v_field IN
    SELECT t.cands, t.val FROM (VALUES
      (ARRAY['nome','nome_cand','nome_candidato'], btrim(p_nome)),
      (ARRAY['telefone','fone','celular','whatsapp'], btrim(p_telefone)),
      (ARRAY['email','email_cand'], NULLIF(btrim(p_email), '')),
      (ARRAY['cpf','cpf_cand'], NULLIF(btrim(p_cpf), '')),
      (ARRAY['mensagem','observacao','obs'], NULLIF(btrim(p_mensagem), '')),
      (ARRAY['arquivo_nome','nome_arquivo'], NULLIF(btrim(p_arquivo_nome), '')),
      (ARRAY['storage_path','arquivo_path','path'], NULLIF(btrim(p_storage_path), ''))
    ) AS t(cands, val) WHERE t.val IS NOT NULL
  LOOP
    SELECT c.column_name INTO v_col FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'WA_CURRICULOS' AND c.column_name::text = ANY (v_field.cands)
    ORDER BY array_position(v_field.cands, c.column_name::text) LIMIT 1;
    IF v_col IS NOT NULL THEN
      EXECUTE format('UPDATE public."WA_CURRICULOS" SET %I = $1 WHERE id = $2', v_col) USING v_field.val, v_id;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_candidatar(integer,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_candidatar(integer,text,text,text,text,text,text,text) TO anon, authenticated;

-- ── EMPREGADOS: liberar INSERT (admissão cria novo colaborador) ──────────
ALTER TABLE public."EMPREGADOS" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."EMPREGADOS" TO authenticated;
DROP POLICY IF EXISTS empregados_insert_auth ON public."EMPREGADOS";
CREATE POLICY empregados_insert_auth ON public."EMPREGADOS"
  FOR INSERT TO authenticated WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
