-- =========================================================================
-- JURÍDICO — Patrimônio: funde 4 filhas-sidecar numa só (JUR_PATRIMONIO_ITENS)
--
-- Reduz as filhas de patrimônio de 5 -> 2. JUR_PATRIMONIO_OBRIGACOES (núcleo
-- financeiro estruturado) FICA separada. As outras 4 — CONTATOS, ACESSOS,
-- DOCUMENTOS, HISTORICO — viram linhas de JUR_PATRIMONIO_ITENS, discriminadas
-- pela coluna `kind`. Colunas tipadas (sem JSONB); cada campo original mantém
-- o nome (o discriminador é `kind`, não `tipo`, pra não colidir com o `tipo`
-- de contato/documento).
--
-- Idempotente: ao re-rodar, as origens já foram dropadas (to_regclass IS NULL)
-- e o backfill é pulado.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."JUR_PATRIMONIO_ITENS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  kind          text NOT NULL,        -- 'contato' | 'acesso' | 'documento' | 'historico'
  -- contato / documento
  tipo          text,                 -- contato: Corretor/Imobiliária... | documento: Escritura/Apólice...
  nome          text,                 -- contato.nome | documento.nome
  telefone      text,                 -- contato
  email         text,                 -- contato
  observacao    text,                 -- contato | acesso
  -- acesso
  servico       text,
  link          text,
  usuario       text,
  local_senha   text,                 -- ONDE a senha está (nunca a senha)
  -- documento
  storage_path  text,
  versao        int,
  criado_por    text,
  -- historico
  acao          text,
  detalhe       text,
  autor         text
);
CREATE INDEX IF NOT EXISTS jur_pat_itens_idx ON public."JUR_PATRIMONIO_ITENS"(patrimonio_id, kind);

-- Backfill + drop das 4 origens (pulado no re-run: origens já dropadas).
DO $$
BEGIN
  IF to_regclass('public."JUR_PATRIMONIO_CONTATOS"') IS NOT NULL THEN
    INSERT INTO public."JUR_PATRIMONIO_ITENS" (patrimonio_id, kind, tipo, nome, telefone, email, observacao, created_at)
    SELECT patrimonio_id, 'contato', tipo, nome, telefone, email, observacao, created_at
      FROM public."JUR_PATRIMONIO_CONTATOS";
    DROP TABLE public."JUR_PATRIMONIO_CONTATOS";
  END IF;
  IF to_regclass('public."JUR_PATRIMONIO_ACESSOS"') IS NOT NULL THEN
    INSERT INTO public."JUR_PATRIMONIO_ITENS" (patrimonio_id, kind, servico, link, usuario, local_senha, observacao, created_at)
    SELECT patrimonio_id, 'acesso', servico, link, usuario, local_senha, observacao, created_at
      FROM public."JUR_PATRIMONIO_ACESSOS";
    DROP TABLE public."JUR_PATRIMONIO_ACESSOS";
  END IF;
  IF to_regclass('public."JUR_PATRIMONIO_DOCUMENTOS"') IS NOT NULL THEN
    INSERT INTO public."JUR_PATRIMONIO_ITENS" (patrimonio_id, kind, tipo, nome, storage_path, versao, criado_por, created_at)
    SELECT patrimonio_id, 'documento', tipo, nome, storage_path, versao, criado_por, created_at
      FROM public."JUR_PATRIMONIO_DOCUMENTOS";
    DROP TABLE public."JUR_PATRIMONIO_DOCUMENTOS";
  END IF;
  IF to_regclass('public."JUR_PATRIMONIO_HISTORICO"') IS NOT NULL THEN
    INSERT INTO public."JUR_PATRIMONIO_ITENS" (patrimonio_id, kind, acao, detalhe, autor, created_at)
    SELECT patrimonio_id, 'historico', acao, detalhe, autor, created_at
      FROM public."JUR_PATRIMONIO_HISTORICO";
    DROP TABLE public."JUR_PATRIMONIO_HISTORICO";
  END IF;
END $$;

ALTER TABLE public."JUR_PATRIMONIO_ITENS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."JUR_PATRIMONIO_ITENS" TO authenticated;
DROP POLICY IF EXISTS "JUR_PATRIMONIO_ITENS_all_auth" ON public."JUR_PATRIMONIO_ITENS";
CREATE POLICY "JUR_PATRIMONIO_ITENS_all_auth" ON public."JUR_PATRIMONIO_ITENS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
