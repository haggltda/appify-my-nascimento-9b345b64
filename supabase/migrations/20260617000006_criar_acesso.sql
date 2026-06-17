-- =========================================================================
-- CRIAR ACESSO (autosserviço no login)
--
-- Encarregados/administrativos criam o próprio login (CPF + senha) a partir
-- do cadastro EMPREGADOS, confirmando identidade por CPF + nascimento.
-- Encarregado escolhe o contrato pelo qual é responsável.
--
-- 1. Colunas em EMPREGADOS: tipo_acesso + contrato responsável.
-- 2. RPC contratos_publicos(): lista contratos ativos para a tela pública
--    (roda como anon, antes do login) sem expor a tabela CONTRATOS inteira.
-- =========================================================================

ALTER TABLE public."EMPREGADOS"
  ADD COLUMN IF NOT EXISTS tipo_acesso             text,
  ADD COLUMN IF NOT EXISTS contrato_responsavel_id bigint,
  ADD COLUMN IF NOT EXISTS contrato_responsavel    text;

CREATE OR REPLACE FUNCTION public.contratos_publicos()
RETURNS TABLE (id bigint, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id::bigint, "NOME CONTRATO"
  FROM public."CONTRATOS"
  WHERE UPPER(COALESCE("ATIVO", '')) = 'SIM'
  ORDER BY "NOME CONTRATO";
$$;

-- Tela de criar acesso é pública (usuário ainda não logado) → anon também executa.
GRANT EXECUTE ON FUNCTION public.contratos_publicos() TO anon, authenticated;
