-- =========================================================================
-- JURÍDICO — Gestão Patrimonial e Obrigações
--
-- Tabelas:
--   JUR_PATRIMONIOS   — imóveis, veículos, terrenos, equipamentos...
--   JUR_OBRIGACOES    — despesas/obrigações por patrimônio (IPTU, energia,
--                       seguro, IPVA...) com vencimento, status e campos de seguro
--   JUR_DOCUMENTOS    — documentos anexados (escritura, apólice, CRLV...)
--   JUR_CONTATOS      — corretor, imobiliária, administradora, seguradora...
--   JUR_ACESSOS       — portais/sistemas: link, usuário e ONDE a senha está
--                       (por segurança NÃO guarda a senha)
--   JUR_HISTORICO     — movimentações (anexos, renovações, pagamentos...)
--
-- Bucket de Storage 'juridico-docs' (privado) para os documentos.
-- RLS: authenticated (padrão do app). Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."JUR_PATRIMONIOS" (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  codigo      text,
  tipo        text NOT NULL DEFAULT 'Imóvel',   -- Imóvel, Veículo, Terreno, Equipamento, Outros
  descricao   text NOT NULL,
  localizacao text,
  placa       text,
  cidade      text,
  empresa     text,
  responsavel text,
  centro_custo text,
  status      text NOT NULL DEFAULT 'Ativo',    -- Ativo / Inativo
  observacoes text,
  onde_pagar  text                              -- tipo 'Conta': URL do site de pagamento
);
-- garante a coluna mesmo se a tabela já existir
ALTER TABLE public."JUR_PATRIMONIOS" ADD COLUMN IF NOT EXISTS onde_pagar text;

CREATE TABLE IF NOT EXISTS public."JUR_OBRIGACOES" (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  patrimonio_id   bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  categoria       text NOT NULL,                -- IPTU, Condomínio, Energia, Água, Internet, Seguro, Aluguel, IPVA, Licenciamento, Manutenção...
  descricao       text,
  valor           numeric,
  vencimento      date,
  periodicidade   text DEFAULT 'Mensal',        -- Mensal, Anual, Único, Trimestral...
  forma_pagamento text,                         -- Boleto, Débito em conta, Pix...
  responsavel     text,
  status          text NOT NULL DEFAULT 'Pendente',  -- Pendente, Pago, Vencido
  pago_em         date,
  -- seguro (categoria = 'Seguro')
  seguradora      text,
  apolice         text,
  vigencia_inicio date,
  vigencia_fim    date,
  premio          numeric,
  parcelas        text
);

CREATE TABLE IF NOT EXISTS public."JUR_DOCUMENTOS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  tipo          text,        -- Escritura, Matrícula, Contrato, IPTU, Apólice, CRLV, NF, Laudo...
  nome          text,
  storage_path  text,
  versao        int DEFAULT 1,
  criado_por    text
);

CREATE TABLE IF NOT EXISTS public."JUR_CONTATOS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  tipo          text,        -- Corretor, Imobiliária, Administradora, Seguradora...
  nome          text,
  telefone      text,
  email         text,
  observacao    text
);

CREATE TABLE IF NOT EXISTS public."JUR_ACESSOS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  servico       text,        -- Energia, Condomínio, Seguro, Água...
  link          text,
  usuario       text,
  local_senha   text,        -- ONDE a senha está guardada (Cofre, TI...) — nunca a senha
  observacao    text
);

CREATE TABLE IF NOT EXISTS public."JUR_HISTORICO" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  acao          text NOT NULL,
  detalhe       text,
  autor         text
);

CREATE INDEX IF NOT EXISTS jur_obr_pat_idx  ON public."JUR_OBRIGACOES"(patrimonio_id);
CREATE INDEX IF NOT EXISTS jur_obr_venc_idx ON public."JUR_OBRIGACOES"(vencimento);
CREATE INDEX IF NOT EXISTS jur_doc_pat_idx  ON public."JUR_DOCUMENTOS"(patrimonio_id);
CREATE INDEX IF NOT EXISTS jur_cont_pat_idx ON public."JUR_CONTATOS"(patrimonio_id);
CREATE INDEX IF NOT EXISTS jur_acc_pat_idx  ON public."JUR_ACESSOS"(patrimonio_id);
CREATE INDEX IF NOT EXISTS jur_hist_pat_idx ON public."JUR_HISTORICO"(patrimonio_id);

-- RLS: liberado para authenticated (padrão do app; controle fino fica no painel de acessos).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['JUR_PATRIMONIOS','JUR_OBRIGACOES','JUR_DOCUMENTOS','JUR_CONTATOS','JUR_ACESSOS','JUR_HISTORICO'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_auth', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_all_auth', t);
  END LOOP;
END $$;

-- Bucket privado para documentos do patrimônio.
INSERT INTO storage.buckets (id, name, public)
VALUES ('juridico-docs', 'juridico-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "jur_docs_rw_auth" ON storage.objects;
CREATE POLICY "jur_docs_rw_auth" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'juridico-docs') WITH CHECK (bucket_id = 'juridico-docs');

NOTIFY pgrst, 'reload schema';
