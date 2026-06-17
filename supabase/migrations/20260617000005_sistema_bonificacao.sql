-- =========================================================================
-- GESTÃO DE BONIFICAÇÕES (RH)
--
-- 1. SISTEMA_SOLICITACOES_BONIFICACAO — cabeçalho do pedido (mês, descrição)
-- 2. SISTEMA_BONIFICACAO_ITENS        — colaboradores que vão receber
-- 3. SISTEMA_SOL_BONIF_CHAT           — conversa por solicitação
--
-- Um pedido contém vários colaboradores. RLS liberado para authenticated
-- (acesso à página de gestão é controlado pelo menu/RouteGuard).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."SISTEMA_SOLICITACOES_BONIFICACAO" (
  id                  BIGSERIAL PRIMARY KEY,
  solicitante_nome    TEXT,
  solicitante_email   TEXT,
  solicitante_cargo   TEXT,
  mes_pagamento       TEXT,              -- formato YYYY-MM
  descricao           TEXT,
  total_colaboradores INT  DEFAULT 0,
  status              TEXT DEFAULT 'Pendente',
  aprovado_por        TEXT,
  aprovado_em         TIMESTAMPTZ,
  motivo_reprovacao   TEXT,
  criado_em           TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sb_status_idx      ON public."SISTEMA_SOLICITACOES_BONIFICACAO"(status);
CREATE INDEX IF NOT EXISTS sb_solicitante_idx ON public."SISTEMA_SOLICITACOES_BONIFICACAO"(solicitante_email);

ALTER TABLE public."SISTEMA_SOLICITACOES_BONIFICACAO" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_SOLICITACOES_BONIFICACAO" TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."SISTEMA_SOLICITACOES_BONIFICACAO_id_seq" TO authenticated;

DROP POLICY IF EXISTS sb_all_auth ON public."SISTEMA_SOLICITACOES_BONIFICACAO";
CREATE POLICY sb_all_auth ON public."SISTEMA_SOLICITACOES_BONIFICACAO"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Itens (colaboradores) ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public."SISTEMA_BONIFICACAO_ITENS" (
  id                 BIGSERIAL PRIMARY KEY,
  solicitacao_id     BIGINT REFERENCES public."SISTEMA_SOLICITACOES_BONIFICACAO"(id) ON DELETE CASCADE,
  colaborador_id     BIGINT,
  colaborador_nome   TEXT,
  colaborador_cpf    TEXT,
  colaborador_cargo  TEXT,
  colaborador_filial TEXT,
  criado_em          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sbi_sol_idx ON public."SISTEMA_BONIFICACAO_ITENS"(solicitacao_id);

ALTER TABLE public."SISTEMA_BONIFICACAO_ITENS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_BONIFICACAO_ITENS" TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."SISTEMA_BONIFICACAO_ITENS_id_seq" TO authenticated;

DROP POLICY IF EXISTS sbi_all_auth ON public."SISTEMA_BONIFICACAO_ITENS";
CREATE POLICY sbi_all_auth ON public."SISTEMA_BONIFICACAO_ITENS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Chat ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."SISTEMA_SOL_BONIF_CHAT" (
  id             BIGSERIAL PRIMARY KEY,
  solicitacao_id BIGINT NOT NULL,
  autor_nome     TEXT,
  autor_cpf      TEXT,
  mensagem       TEXT NOT NULL,
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sbc_sol_idx ON public."SISTEMA_SOL_BONIF_CHAT"(solicitacao_id);

ALTER TABLE public."SISTEMA_SOL_BONIF_CHAT" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_SOL_BONIF_CHAT" TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."SISTEMA_SOL_BONIF_CHAT_id_seq" TO authenticated;

DROP POLICY IF EXISTS sbc_all_auth ON public."SISTEMA_SOL_BONIF_CHAT";
CREATE POLICY sbc_all_auth ON public."SISTEMA_SOL_BONIF_CHAT"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
