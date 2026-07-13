-- =========================================================================
-- CONSOLIDAÇÃO E RENOMEAÇÃO DE TABELAS
--
-- Reduz o número de tabelas e deixa os nomes autoexplicativos.
--
--  1. Dropa tabelas mortas (JUR_CONTAS / JUR_CONTA_LANCAMENTOS) — já fundidas
--     em JUR_OBRIGACOES (migration ...013). Refaz o merge por segurança.
--  2. Cria SISTEMA_COMENTARIOS (feed único polimórfico) e migra para ela os 4
--     feeds antigos (comentários de patrimônio/processo, chat de férias/bonif),
--     depois dropa os 4.
--  3. Renomeia as filhas de patrimônio (JUR_* -> JUR_PATRIMONIO_*) e os nomes
--     herdados do Flask (SISTEMA_JURIDICORT* -> JUR_PROCESSOS*).
--
-- Idempotente: pode rodar mais de uma vez. Renames usam to_regclass; o backfill
-- some sozinho ao re-rodar (as origens já foram dropadas).
-- =========================================================================

-- ── 1. Contas (mortas) → Obrigações, depois drop ────────────────────────
-- Refaz o merge da 013 (NOT EXISTS evita duplicar) caso ainda não tenha rodado.
DO $$
BEGIN
  IF to_regclass('public."JUR_CONTAS"') IS NOT NULL
     AND to_regclass('public."JUR_OBRIGACOES"') IS NOT NULL THEN
    INSERT INTO public."JUR_OBRIGACOES"
      (patrimonio_id, categoria, descricao, valor, vencimento, periodicidade, responsavel, status, created_at)
    SELECT
      c.patrimonio_id,
      COALESCE(NULLIF(btrim(c.categoria), ''), 'Outros'),
      c.descricao, c.valor, c.data_inicio,
      CASE WHEN c.possui_recorrencia THEN 'Mensal' ELSE 'Único' END,
      c.responsavel, 'Pendente', c.created_at
    FROM public."JUR_CONTAS" c
    WHERE c.patrimonio_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public."JUR_OBRIGACOES" o
        WHERE o.patrimonio_id = c.patrimonio_id
          AND COALESCE(o.descricao, '') = COALESCE(c.descricao, '')
          AND o.categoria = COALESCE(NULLIF(btrim(c.categoria), ''), 'Outros')
          AND o.valor IS NOT DISTINCT FROM c.valor
      );
  END IF;
END $$;

DROP TABLE IF EXISTS public."JUR_CONTA_LANCAMENTOS";
DROP TABLE IF EXISTS public."JUR_CONTAS";

-- ── 2. Feed único de comentários (polimórfico) ──────────────────────────
CREATE TABLE IF NOT EXISTS public."SISTEMA_COMENTARIOS" (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  modulo      text NOT NULL,   -- 'patrimonio' | 'processo' | 'ferias' | 'bonificacao'
  entidade_id text NOT NULL,   -- patrimonio_id / numero_processo / solicitacao_id (como texto)
  autor_nome  text,
  autor_cpf   text,
  texto       text NOT NULL
);
CREATE INDEX IF NOT EXISTS sistema_coment_ent_idx
  ON public."SISTEMA_COMENTARIOS"(modulo, entidade_id);

-- Backfill + drop das 4 origens. Ao re-rodar, as origens já foram dropadas
-- (to_regclass IS NULL) e cada bloco é simplesmente pulado — sem duplicar.
DO $$
BEGIN
  IF to_regclass('public."JUR_COMENTARIOS"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, texto, created_at)
    SELECT 'patrimonio', c.patrimonio_id::text, c.autor, c.texto, c.created_at
      FROM public."JUR_COMENTARIOS" c WHERE c.patrimonio_id IS NOT NULL;
    DROP TABLE public."JUR_COMENTARIOS";
  END IF;

  IF to_regclass('public."SISTEMA_JURIDICO_COMENTARIOS"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, texto, created_at)
    SELECT 'processo', c.numero_processo, c.autor, c.comentario, c.criado_em
      FROM public."SISTEMA_JURIDICO_COMENTARIOS" c WHERE c.numero_processo IS NOT NULL;
    DROP TABLE public."SISTEMA_JURIDICO_COMENTARIOS";
  END IF;

  IF to_regclass('public."SISTEMA_SOL_FERIAS_CHAT"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, autor_cpf, texto, created_at)
    SELECT 'ferias', c.solicitacao_id::text, c.autor_nome, c.autor_cpf, c.mensagem, c.criado_em
      FROM public."SISTEMA_SOL_FERIAS_CHAT" c WHERE c.solicitacao_id IS NOT NULL;
    DROP TABLE public."SISTEMA_SOL_FERIAS_CHAT";
  END IF;

  IF to_regclass('public."SISTEMA_SOL_BONIF_CHAT"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, autor_cpf, texto, created_at)
    SELECT 'bonificacao', c.solicitacao_id::text, c.autor_nome, c.autor_cpf, c.mensagem, c.criado_em
      FROM public."SISTEMA_SOL_BONIF_CHAT" c WHERE c.solicitacao_id IS NOT NULL;
    DROP TABLE public."SISTEMA_SOL_BONIF_CHAT";
  END IF;
END $$;

ALTER TABLE public."SISTEMA_COMENTARIOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_COMENTARIOS" TO authenticated;
DROP POLICY IF EXISTS "SISTEMA_COMENTARIOS_all_auth" ON public."SISTEMA_COMENTARIOS";
CREATE POLICY "SISTEMA_COMENTARIOS_all_auth" ON public."SISTEMA_COMENTARIOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 3. Renomeia tabelas p/ nomes autoexplicativos ───────────────────────
-- (FKs, índices, grants e policies acompanham o rename. Dropamos a policy de
--  nome antigo logo após cada rename, p/ não deixar duplicata.)
DO $$
BEGIN
  IF to_regclass('public."JUR_OBRIGACOES"') IS NOT NULL AND to_regclass('public."JUR_PATRIMONIO_OBRIGACOES"') IS NULL THEN
    ALTER TABLE public."JUR_OBRIGACOES" RENAME TO "JUR_PATRIMONIO_OBRIGACOES";
    DROP POLICY IF EXISTS "JUR_OBRIGACOES_all_auth" ON public."JUR_PATRIMONIO_OBRIGACOES";
  END IF;
  IF to_regclass('public."JUR_DOCUMENTOS"') IS NOT NULL AND to_regclass('public."JUR_PATRIMONIO_DOCUMENTOS"') IS NULL THEN
    ALTER TABLE public."JUR_DOCUMENTOS" RENAME TO "JUR_PATRIMONIO_DOCUMENTOS";
    DROP POLICY IF EXISTS "JUR_DOCUMENTOS_all_auth" ON public."JUR_PATRIMONIO_DOCUMENTOS";
  END IF;
  IF to_regclass('public."JUR_CONTATOS"') IS NOT NULL AND to_regclass('public."JUR_PATRIMONIO_CONTATOS"') IS NULL THEN
    ALTER TABLE public."JUR_CONTATOS" RENAME TO "JUR_PATRIMONIO_CONTATOS";
    DROP POLICY IF EXISTS "JUR_CONTATOS_all_auth" ON public."JUR_PATRIMONIO_CONTATOS";
  END IF;
  IF to_regclass('public."JUR_ACESSOS"') IS NOT NULL AND to_regclass('public."JUR_PATRIMONIO_ACESSOS"') IS NULL THEN
    ALTER TABLE public."JUR_ACESSOS" RENAME TO "JUR_PATRIMONIO_ACESSOS";
    DROP POLICY IF EXISTS "JUR_ACESSOS_all_auth" ON public."JUR_PATRIMONIO_ACESSOS";
  END IF;
  IF to_regclass('public."JUR_HISTORICO"') IS NOT NULL AND to_regclass('public."JUR_PATRIMONIO_HISTORICO"') IS NULL THEN
    ALTER TABLE public."JUR_HISTORICO" RENAME TO "JUR_PATRIMONIO_HISTORICO";
    DROP POLICY IF EXISTS "JUR_HISTORICO_all_auth" ON public."JUR_PATRIMONIO_HISTORICO";
  END IF;
  IF to_regclass('public."SISTEMA_JURIDICORT"') IS NOT NULL AND to_regclass('public."JUR_PROCESSOS"') IS NULL THEN
    ALTER TABLE public."SISTEMA_JURIDICORT" RENAME TO "JUR_PROCESSOS";
    DROP POLICY IF EXISTS "SISTEMA_JURIDICORT_all_auth" ON public."JUR_PROCESSOS";
  END IF;
  IF to_regclass('public."SISTEMA_JURIDICORT_dort"') IS NOT NULL AND to_regclass('public."JUR_PROCESSOS_DORT"') IS NULL THEN
    ALTER TABLE public."SISTEMA_JURIDICORT_dort" RENAME TO "JUR_PROCESSOS_DORT";
    DROP POLICY IF EXISTS "SISTEMA_JURIDICORT_dort_all_auth" ON public."JUR_PROCESSOS_DORT";
  END IF;
END $$;

-- Garante RLS/grants/policy nos nomes novos (idempotente).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'JUR_PATRIMONIO_OBRIGACOES','JUR_PATRIMONIO_DOCUMENTOS','JUR_PATRIMONIO_CONTATOS',
    'JUR_PATRIMONIO_ACESSOS','JUR_PATRIMONIO_HISTORICO','JUR_PROCESSOS','JUR_PROCESSOS_DORT'
  ] LOOP
    IF to_regclass('public."'||t||'"') IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_auth', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_all_auth', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
