-- =========================================================================
-- MÓDULO RECRUTAMENTO E SELEÇÃO: tabelas base
--
-- 1. SISTEMA_RECRUTAMENTO        — solicitações de vaga (tabela principal)
-- 2. WA_MENSAGENS_RECRUTAMENTO   — chat/observações por solicitação
-- 3. WA_CURRICULOS               — currículos recebidos (WhatsApp / link público)
--
-- Nomes em MAIÚSCULAS entre aspas para casar com o que o front consulta.
-- IDs numéricos (bigint identity) porque o front usa `#${id}` e .eq("id", number).
-- RLS liberado para authenticated; o filtro por solicitante é feito no client.
-- =========================================================================

-- 1. SISTEMA_RECRUTAMENTO ------------------------------------------------
CREATE TABLE IF NOT EXISTS public."SISTEMA_RECRUTAMENTO" (
  id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at              timestamptz NOT NULL DEFAULT now(),
  -- Etapa 1: identificação da vaga
  motivo_vaga             text,
  nome_substituido        text,
  contrato                text,
  cargo                   text,
  estado                  text,
  cidade                  text,
  -- Etapa 2: detalhes
  quantidade_vagas        integer DEFAULT 1,
  data_inicio_prevista    text,
  escala                  text,
  horario                 text,
  salario                 text,
  insalubridade_recebe    text,
  insalubridade_quanto    text,
  beneficios              text,
  local_exato             text,
  grau_urgencia           text,
  alta_rotatividade       text,
  -- Etapa 3: requisitos
  req_obrigatorios        text,
  req_desejaveis          text,
  exp_minima              text,
  exp_minima_qual         text,
  motivos_saida           text,
  recomendacao            text,
  observacao_importante   text,
  -- Fluxo / status
  status                  text DEFAULT 'Aguardando Aprovação',
  solicitante_nome        text,
  solicitante_cpf         text,
  analista_nome           text,
  aprovado_por_nome       text,
  motivo_reprovacao       text,
  funcionario_selecionado text,
  contratado_nome         text,
  contratado_contato      text,
  contratado_data_inicio  text
);

CREATE INDEX IF NOT EXISTS sr_status_idx       ON public."SISTEMA_RECRUTAMENTO"(status);
CREATE INDEX IF NOT EXISTS sr_solicitante_idx  ON public."SISTEMA_RECRUTAMENTO"(solicitante_cpf);

ALTER TABLE public."SISTEMA_RECRUTAMENTO" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_RECRUTAMENTO" TO authenticated;

DROP POLICY IF EXISTS sr_all_auth ON public."SISTEMA_RECRUTAMENTO";
CREATE POLICY sr_all_auth ON public."SISTEMA_RECRUTAMENTO"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. WA_MENSAGENS_RECRUTAMENTO -------------------------------------------
CREATE TABLE IF NOT EXISTS public."WA_MENSAGENS_RECRUTAMENTO" (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),
  solicitacao_id  bigint REFERENCES public."SISTEMA_RECRUTAMENTO"(id) ON DELETE CASCADE,
  mensagem        text,
  autor_nome      text,
  autor_cpf       text,
  is_treinamento  boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS wamr_solicitacao_idx ON public."WA_MENSAGENS_RECRUTAMENTO"(solicitacao_id);

ALTER TABLE public."WA_MENSAGENS_RECRUTAMENTO" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."WA_MENSAGENS_RECRUTAMENTO" TO authenticated;

DROP POLICY IF EXISTS wamr_all_auth ON public."WA_MENSAGENS_RECRUTAMENTO";
CREATE POLICY wamr_all_auth ON public."WA_MENSAGENS_RECRUTAMENTO"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. WA_CURRICULOS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."WA_CURRICULOS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  vaga_id       bigint REFERENCES public."SISTEMA_RECRUTAMENTO"(id) ON DELETE CASCADE,
  origem        text,
  nome          text,
  telefone      text,
  email         text,
  mensagem      text,
  storage_path  text
);

CREATE INDEX IF NOT EXISTS wac_vaga_idx ON public."WA_CURRICULOS"(vaga_id);

ALTER TABLE public."WA_CURRICULOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."WA_CURRICULOS" TO authenticated;

DROP POLICY IF EXISTS wac_all_auth ON public."WA_CURRICULOS";
CREATE POLICY wac_all_auth ON public."WA_CURRICULOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
