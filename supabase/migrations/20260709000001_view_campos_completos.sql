-- =========================================================================
-- RECRUTAMENTO — recria VW_RECRUTAMENTO_CANDIDATOS com TODAS as colunas
-- (agendamento SST, data de chegada Compras, experiências, favorito).
-- Corrige "column ... does not exist" nas telas dos setores.
-- Auto-suficiente e idempotente.
-- =========================================================================

-- Garante as colunas usadas pela view (idempotente).
ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS sst_data_exame       date,
  ADD COLUMN IF NOT EXISTS sst_hora_exame       text,
  ADD COLUMN IF NOT EXISTS sst_local_exame      text,
  ADD COLUMN IF NOT EXISTS sst_agendado_por     text,
  ADD COLUMN IF NOT EXISTS sst_agendado_em      timestamptz,
  ADD COLUMN IF NOT EXISTS compras_data_chegada date,
  ADD COLUMN IF NOT EXISTS experiencia_1        text,
  ADD COLUMN IF NOT EXISTS experiencia_2        text,
  ADD COLUMN IF NOT EXISTS experiencia_3        text,
  ADD COLUMN IF NOT EXISTS favorito             boolean;

DROP VIEW IF EXISTS public."VW_RECRUTAMENTO_CANDIDATOS";
CREATE VIEW public."VW_RECRUTAMENTO_CANDIDATOS" AS
  SELECT
    c.id AS candidato_id, c.vaga_id, c.nome, c.telefone, c.email,
    COALESCE(c.cpf, c.cpf_cand) AS cpf, c.origem, c.storage_path, c.mensagem,
    c.etapa_processo, c.etapa_changed_at, c.selecionado_por, c.selecionado_em,
    c.juridico_ok, c.juridico_obs, c.juridico_por, c.juridico_em,
    c.sst_ok, c.sst_obs, c.sst_por, c.sst_em,
    c.sst_data_exame, c.sst_hora_exame, c.sst_local_exame, c.sst_agendado_por, c.sst_agendado_em,
    c.compras_necessidades, c.compras_por, c.compras_em, c.compras_obs, c.compras_data_chegada,
    c.epis_informados, c.epis_informados_em,
    c.enviado_admissao_por, c.enviado_admissao_em,
    c.admitido_por, c.admitido_em, c.empregado_id, c.motivo_reprovacao,
    c.experiencia_1, c.experiencia_2, c.experiencia_3, c.favorito, c.tipo_candidatura,
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

NOTIFY pgrst, 'reload schema';
