-- RPC para retornar usuários com role 'comercial' vinculados a uma empresa.
-- SECURITY DEFINER garante que a função ignora RLS da tabela user_roles,
-- permitindo que qualquer usuário autenticado consulte a lista de colegas.
CREATE OR REPLACE FUNCTION list_usuarios_comercial_empresa(_empresa_id uuid)
RETURNS TABLE (id uuid, display_name text, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.email
  FROM user_roles ur
  JOIN user_empresa ue ON ue.user_id = ur.user_id AND ue.empresa_id = _empresa_id
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'comercial'
  ORDER BY p.display_name;
$$;

-- Histórico de justificativas de divergência por contrato na planilha de custo.
-- Formato JSONB: [{ts, usuario, texto}] — mesmo padrão do historico da grade.
ALTER TABLE planilha_custo
ADD COLUMN IF NOT EXISTS justificativa_divergencia JSONB DEFAULT '[]'::jsonb;
