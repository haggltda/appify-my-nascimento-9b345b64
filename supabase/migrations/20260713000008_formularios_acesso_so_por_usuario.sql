-- =========================================================================
-- NASCIMENTO FORMULARIOS - acesso SO por usuario (remove heranca por setor)
--
-- Antes, cs_form_cap concedia a capacidade se o SETOR (Setor_ERP) do usuario
-- tivesse o grant - entao desmarcar tudo no nivel do usuario nao adiantava se
-- o setor dele ja liberava. Agora a capacidade vem so de:
--   - admin (faz tudo)
--   - 'responder' (default de todo autenticado)
--   - grant explicito do PROPRIO usuario (CS_FORM_ACESSOS.user_id)
--
-- Idempotente.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.cs_form_cap(_cap text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR _cap = 'responder'
      OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                  WHERE a.papel = _cap AND a.user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_cap(text) TO authenticated;

-- Modelo por setor abandonado: remove os grants concedidos a setores.
-- (A classificacao Administrativo/Operacional em CS_FORM_SETOR_GRUPO fica,
--  pois ainda e usada pelo escopo das capacidades ver_admin/ver_op.)
DELETE FROM public."CS_FORM_ACESSOS" WHERE setor IS NOT NULL;

NOTIFY pgrst, 'reload schema';
