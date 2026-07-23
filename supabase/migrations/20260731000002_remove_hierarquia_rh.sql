-- =========================================================================
-- RH — REMOÇÃO DA HIERARQUIA + consolidação das tabelas de responsável
--
-- O módulo RH > Hierarquia foi descontinuado (jul/2026) e a responsabilidade
-- por setor virou PERMISSÃO POR USUÁRIO em CS_FORM_ACESSOS
-- (20260731000001 — papéis 'diretor_setor' e 'gerente_setor', com backfill).
--
-- Sai daqui:
--   • RH_CONTRATO_ENCARREGADO — encarregado por contrato, só a tela removida lia;
--   • RH_SETOR_DIRETOR e CS_LIDERES_SETOR — a MESMA informação que agora vive em
--     CS_FORM_ACESSOS. Ficavam por pessoa (EMPREGADOS."ID"); a régua passou a ser
--     o usuário, então virariam uma terceira cópia divergente;
--   • rh_hierarquia_dados — a RPC continua, com nome honesto: rh_cadastro_dados.
--     Ela nunca foi "da hierarquia", é a leitura enxuta do cadastro (uma chamada
--     server-side em vez de estourar o statement_timeout lendo EMPREGADOS).
--
-- ORDEM: rode DEPOIS de 20260731000001 (é ela que copia as designações antigas
-- para CS_FORM_ACESSOS). Este arquivo dropa as tabelas de origem.
-- =========================================================================

-- ── 1) Quem responde por cada setor, para as telas gerenciais ────────────
-- Substitui a leitura direta de RH_SETOR_DIRETOR / CS_LIDERES_SETOR. Devolve o
-- NOME de quem foi designado (profiles.display_name — que o vínculo com o
-- cadastro sobrescreve com o nome oficial).
-- SECURITY DEFINER: a RLS de CS_FORM_ACESSOS só deixa cada um ver a própria
-- linha, e o painel precisa do quadro inteiro (quem lidera cada setor). Expõe
-- apenas papel/setor/nome — nada sensível.
CREATE OR REPLACE FUNCTION public.cs_responsaveis_setor()
RETURNS TABLE (papel text, setor text, nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.papel, btrim(a.setor), btrim(coalesce(p.display_name, ''))
    FROM public."CS_FORM_ACESSOS" a
    LEFT JOIN public.profiles p ON p.id = a.user_id
   WHERE a.papel IN ('diretor_setor', 'gerente_setor')
     AND btrim(coalesce(a.setor, '')) <> '';
$$;
REVOKE ALL ON FUNCTION public.cs_responsaveis_setor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cs_responsaveis_setor() TO authenticated;

-- ── 2) RPC do cadastro sem o nome "hierarquia" ──────────────────────────
-- Mesmo corpo da rh_hierarquia_dados (versão com Perfil_ERP, 20260724000001).
-- plpgsql (não `sql`) de propósito: função SQL valida o corpo na criação e pega
-- lock em EMPREGADOS; plpgsql resolve a tabela só na 1ª execução, então criar a
-- função não disputa lock com a leitura viva do app.
CREATE OR REPLACE FUNCTION public.rh_cadastro_dados()
RETURNS TABLE (id bigint, nome text, setor text, nivel text, cargo text, local_desc text, situacao text, perfil text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    e."ID"::bigint,
    btrim(coalesce(e."Nome", '')),
    btrim(coalesce(e."Setor_ERP", '')),
    btrim(coalesce(e."LIDER", '')),
    coalesce(nullif(btrim(coalesce(e."Título do Cargo", '')), ''),
             nullif(btrim(coalesce(e."Nome do Cargo", '')), ''), ''),
    btrim(coalesce(e."Descrição do Local", '')),
    btrim(coalesce(e."Situação", '')),
    btrim(coalesce(e."Perfil_ERP", ''))
  FROM public."EMPREGADOS" e;
END $$;
REVOKE ALL ON FUNCTION public.rh_cadastro_dados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_cadastro_dados() TO authenticated;

DROP FUNCTION IF EXISTS public.rh_hierarquia_dados();

-- ── 3) Tabelas que saem ─────────────────────────────────────────────────
DROP TABLE IF EXISTS public."RH_CONTRATO_ENCARREGADO" CASCADE;
DROP FUNCTION IF EXISTS public.rh_contrato_enc_touch() CASCADE;

DROP TABLE IF EXISTS public."RH_SETOR_DIRETOR" CASCADE;
DROP FUNCTION IF EXISTS public.rh_setor_diretor_touch() CASCADE;

DROP TABLE IF EXISTS public."CS_LIDERES_SETOR" CASCADE;
DROP FUNCTION IF EXISTS public.cs_lideres_touch() CASCADE;

NOTIFY pgrst, 'reload schema';
