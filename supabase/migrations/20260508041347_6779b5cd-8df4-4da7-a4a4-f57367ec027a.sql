-- Função utilitária restrita: executa SQL arbitrário apenas para admin autenticado.
-- Usada pela edge function 'pacote02-load' para popular as tabelas de staging.
CREATE OR REPLACE FUNCTION public.admin_exec_dml(p_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'apenas administradores podem executar admin_exec_dml';
  END IF;
  EXECUTE p_sql;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_exec_dml(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_exec_dml(text) TO authenticated;