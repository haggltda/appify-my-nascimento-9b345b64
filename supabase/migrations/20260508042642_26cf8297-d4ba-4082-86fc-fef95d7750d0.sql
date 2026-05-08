CREATE OR REPLACE FUNCTION public.admin_exec_dml(p_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permite execução quando chamada via service_role (edge functions confiáveis)
  -- ou quando o usuário autenticado é admin.
  IF current_setting('role', true) = 'service_role'
     OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    EXECUTE p_sql;
    RETURN;
  END IF;
  RAISE EXCEPTION 'apenas administradores podem executar admin_exec_dml';
END;
$$;