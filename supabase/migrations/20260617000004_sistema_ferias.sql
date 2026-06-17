-- =========================================================================
-- GESTÃO DE FÉRIAS (RH)
--
-- 1. SISTEMA_SOLICITACOES_FERIAS — pedidos de férias (encarregados / RH)
-- 2. SISTEMA_SOL_FERIAS_CHAT      — conversa por solicitação
--
-- Schema espelha o sistema legado (routes.py) + solicitante_email para o
-- filtro "minhas solicitações" no React. RLS liberado para authenticated
-- (o acesso à página de gestão é controlado pelo menu/RouteGuard).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."SISTEMA_SOLICITACOES_FERIAS" (
  id                   BIGSERIAL PRIMARY KEY,
  solicitante_id       BIGINT,
  solicitante_nome     TEXT,
  solicitante_cargo    TEXT,
  solicitante_email    TEXT,
  colaborador_id       BIGINT,
  colaborador_nome     TEXT,
  colaborador_cpf      TEXT,
  colaborador_cargo    TEXT,
  colaborador_filial   TEXT,
  colaborador_admissao DATE,
  colaborador_email    TEXT,
  colaborador_telefone TEXT,
  data_saida           DATE,
  data_retorno         DATE,
  dias_ferias          INT  DEFAULT 30,
  dias_vendidos        INT  DEFAULT 0,
  observacoes          TEXT,
  status               TEXT DEFAULT 'Pendente',
  aprovado_por         TEXT,
  aprovado_em          TIMESTAMPTZ,
  motivo_reprovacao    TEXT,
  criado_em            TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ DEFAULT NOW()
);

-- Caso a tabela já exista (criada pelo sistema legado), garante a coluna extra.
ALTER TABLE public."SISTEMA_SOLICITACOES_FERIAS"
  ADD COLUMN IF NOT EXISTS solicitante_email TEXT;

CREATE INDEX IF NOT EXISTS sf_status_idx       ON public."SISTEMA_SOLICITACOES_FERIAS"(status);
CREATE INDEX IF NOT EXISTS sf_solicitante_idx  ON public."SISTEMA_SOLICITACOES_FERIAS"(solicitante_email);

ALTER TABLE public."SISTEMA_SOLICITACOES_FERIAS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_SOLICITACOES_FERIAS" TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."SISTEMA_SOLICITACOES_FERIAS_id_seq" TO authenticated;

DROP POLICY IF EXISTS sf_all_auth ON public."SISTEMA_SOLICITACOES_FERIAS";
CREATE POLICY sf_all_auth ON public."SISTEMA_SOLICITACOES_FERIAS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Chat ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."SISTEMA_SOL_FERIAS_CHAT" (
  id             BIGSERIAL PRIMARY KEY,
  solicitacao_id BIGINT NOT NULL,
  autor_nome     TEXT,
  autor_cpf      TEXT,
  mensagem       TEXT NOT NULL,
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sfc_sol_idx ON public."SISTEMA_SOL_FERIAS_CHAT"(solicitacao_id);

ALTER TABLE public."SISTEMA_SOL_FERIAS_CHAT" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_SOL_FERIAS_CHAT" TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."SISTEMA_SOL_FERIAS_CHAT_id_seq" TO authenticated;

DROP POLICY IF EXISTS sfc_all_auth ON public."SISTEMA_SOL_FERIAS_CHAT";
CREATE POLICY sfc_all_auth ON public."SISTEMA_SOL_FERIAS_CHAT"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
