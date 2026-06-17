CREATE OR REPLACE FUNCTION public.fluxo_caixa_diario_consolidado(_data_ini date, _data_fim date)
RETURNS TABLE(bloco text, categoria text, dia date, valor numeric, saldo_inicial numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'presidencia'::app_role)
    OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil admin, presidencia ou diretor_adm';
  END IF;

  RETURN QUERY
  SELECT f.bloco, f.categoria, f.dia, f.valor, f.saldo_inicial
  FROM public.fluxo_caixa_diario(NULL::uuid, _data_ini, _data_fim) f;
END;
$$;

CREATE OR REPLACE FUNCTION public.fluxo_caixa_diario_orcado_consolidado(_data_ini date, _data_fim date)
RETURNS TABLE(bloco text, categoria text, dia date, valor numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'presidencia'::app_role)
    OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil admin, presidencia ou diretor_adm';
  END IF;

  RETURN QUERY
  SELECT f.bloco, f.categoria, f.dia, f.valor
  FROM public.fluxo_caixa_diario_orcado(NULL::uuid, _data_ini, _data_fim) f;
END;
$$;