-- =========================================================================
-- VÍNCULO: conta Supabase Auth  ⇄  registro EMPREGADOS
--
-- Permite que um usuário (logado por email OU por CPF) fique amarrado ao seu
-- cadastro em EMPREGADOS, herdando cargo / setor / líder / situação.
--
-- 1. Coluna auth_user_id em EMPREGADOS (o elo). Único por usuário.
-- 2. RPC meu_empregado(): retorna SÓ campos não-sensíveis do cadastro do
--    usuário atual (nunca Senha/chave_secreta). SECURITY DEFINER para não
--    depender de abrir a tabela inteira no client.
-- =========================================================================

ALTER TABLE public."EMPREGADOS"
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Um usuário Auth só pode estar amarrado a UM registro de EMPREGADOS.
CREATE UNIQUE INDEX IF NOT EXISTS empregados_auth_user_id_uidx
  ON public."EMPREGADOS"(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Leitura segura do "meu cadastro" (campos não-sensíveis).
CREATE OR REPLACE FUNCTION public.meu_empregado()
RETURNS TABLE (
  id        bigint,
  nome      text,
  cpf       text,
  cargo     text,
  setor     text,
  perfil    text,
  lider     text,
  situacao  text,
  admissao  text,
  empresa   text,
  filial    text,
  email     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    "ID", "Nome", "CPF", "Título do Cargo", "Setor_ERP", "Perfil_ERP",
    "LIDER", "Situação", "Admissão", "Nome da Empresa", "Nome Filial", "email"
  FROM public."EMPREGADOS"
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.meu_empregado() TO authenticated;
