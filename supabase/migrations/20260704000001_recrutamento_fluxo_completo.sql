-- =========================================================================
-- RECRUTAMENTO: pipeline completo por setor
--
-- Etapas do candidato (WA_CURRICULOS.etapa_processo):
--   Selecionado → Pendente Jurídico → Entrevista Comportamental →
--   (Exame Médico | Entrevista Técnica → Exame Médico) → Compras → Admissão
--   ; Reprovado (terminal).
--
-- Cada setor tem fila própria via VW_RECRUTAMENTO_CANDIDATOS (agora com a vaga
-- COMPLETA + restrição do CPF). Restrição = RECRUTAMENTO_CPF_BLACKLIST (só o
-- Jurídico define), por CPF, aparece em qualquer vaga.
--
-- Idempotente.
-- =========================================================================

-- ── Colunas novas das etapas em WA_CURRICULOS ────────────────────────────
ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS comportamental_por   text,
  ADD COLUMN IF NOT EXISTS comportamental_em    timestamptz,
  ADD COLUMN IF NOT EXISTS comportamental_obs   text,
  ADD COLUMN IF NOT EXISTS tecnica_por          text,
  ADD COLUMN IF NOT EXISTS tecnica_em           timestamptz,
  ADD COLUMN IF NOT EXISTS tecnica_obs          text,
  ADD COLUMN IF NOT EXISTS compras_necessidades text,
  ADD COLUMN IF NOT EXISTS compras_por          text,
  ADD COLUMN IF NOT EXISTS compras_em           timestamptz,
  ADD COLUMN IF NOT EXISTS compras_obs          text,
  ADD COLUMN IF NOT EXISTS admitido_por         text,
  ADD COLUMN IF NOT EXISTS empregado_id         bigint;

-- Dados antigos: ASO vira "Exame Médico".
UPDATE public."WA_CURRICULOS" SET etapa_processo = 'Exame Médico'
  WHERE etapa_processo = 'ASO';

-- ── View das filas: vaga COMPLETA + candidato + restrição do CPF ─────────
-- DROP antes de criar (CREATE OR REPLACE não permite reordenar colunas).
DROP VIEW IF EXISTS public."VW_RECRUTAMENTO_CANDIDATOS";
CREATE VIEW public."VW_RECRUTAMENTO_CANDIDATOS" AS
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
    c.juridico_ok,   c.juridico_obs,   c.juridico_por,   c.juridico_em,
    c.comportamental_por, c.comportamental_em, c.comportamental_obs,
    c.tecnica_por,   c.tecnica_em,     c.tecnica_obs,
    c.sst_ok,        c.sst_obs,        c.sst_por,        c.sst_em,
    c.compras_necessidades,
    c.compras_por,   c.compras_em,     c.compras_obs,
    c.admitido_por,  c.admitido_em,    c.empregado_id,
    c.motivo_reprovacao,
    c.created_at                AS candidatura_em,
    -- Vaga (completa)
    s.cargo, s.contrato, s.cidade, s.status AS vaga_status,
    s.motivo_vaga, s.nome_substituido, s.escala, s.horario, s.salario,
    s.beneficios, s.insalubridade_recebe, s.insalubridade_quanto, s.local_exato,
    s.data_inicio_prevista, s.quantidade_vagas, s.req_obrigatorios, s.req_desejaveis,
    s.exp_minima, s.exp_minima_qual, s.grau_urgencia, s.solicitante_nome,
    -- Restrição do CPF (definida só pelo Jurídico)
    (b.cpf_digits IS NOT NULL)  AS possui_restricao,
    b.motivo                    AS restricao_motivo
  FROM public."WA_CURRICULOS" c
  JOIN public."SISTEMA_RECRUTAMENTO" s ON s.id = c.vaga_id
  LEFT JOIN public."RECRUTAMENTO_CPF_BLACKLIST" b
    ON b.cpf_digits = regexp_replace(COALESCE(c.cpf, c.cpf_cand, ''), '\D', '', 'g')
  WHERE c.etapa_processo IS NOT NULL;

GRANT SELECT ON public."VW_RECRUTAMENTO_CANDIDATOS" TO authenticated;

-- ── EMPREGADOS: liberar INSERT (admissão cria novo colaborador) ──────────
-- Hoje só existe policy de UPDATE; a tela "Novas Admissões" precisa inserir.
ALTER TABLE public."EMPREGADOS" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."EMPREGADOS" TO authenticated;

DROP POLICY IF EXISTS empregados_insert_auth ON public."EMPREGADOS";
CREATE POLICY empregados_insert_auth ON public."EMPREGADOS"
  FOR INSERT TO authenticated WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
