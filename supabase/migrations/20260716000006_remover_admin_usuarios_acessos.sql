-- =========================================================================
-- Reverte a delegação por usuário da tela de Usuários.
-- Vincular/Ver detalhes voltam a ser SÓ de admin — então a tabela de
-- capacidades ADMIN_USUARIOS_ACESSOS e o helper pode_acao_usuario saem, e as
-- RPCs de vínculo voltam a checar has_role(admin). Idempotente.
-- =========================================================================

-- 1) RPCs voltam a exigir admin (antes checavam pode_acao_usuario).
CREATE OR REPLACE FUNCTION public.admin_vincular_empregado(
  p_user_id     uuid,
  p_empregado_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp  public."EMPREGADOS"%ROWTYPE;
  v_bloq text[] := ARRAY['DEMITIDO','DEMITIDA','RESCISÃO','DESLIGADO','DESLIGADA'];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Apenas administradores podem vincular.');
  END IF;
  IF p_user_id IS NULL OR p_empregado_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário e colaborador são obrigatórios.');
  END IF;

  SELECT * INTO v_emp FROM public."EMPREGADOS" WHERE "ID" = p_empregado_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cadastro não encontrado.');
  END IF;

  IF upper(coalesce(v_emp."Situação",'')) = ANY (v_bloq) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Colaborador desligado — não pode ser vinculado.');
  END IF;

  IF v_emp.auth_user_id IS NOT NULL AND v_emp.auth_user_id <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este cadastro já está vinculado a outro usuário.');
  END IF;

  UPDATE public."EMPREGADOS"
     SET auth_user_id = NULL
   WHERE auth_user_id = p_user_id AND "ID" <> p_empregado_id;

  UPDATE public."EMPREGADOS"
     SET auth_user_id = p_user_id,
         "email" = CASE
                     WHEN coalesce(btrim("email"), '') = ''
                     THEN (SELECT u.email FROM auth.users u WHERE u.id = p_user_id)
                     ELSE "email"
                   END
   WHERE "ID" = p_empregado_id;

  UPDATE public.profiles SET display_name = v_emp."Nome" WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'empregado', jsonb_build_object(
    'id', v_emp."ID", 'nome', coalesce(v_emp."Nome",''), 'cargo', coalesce(v_emp."Título do Cargo",''),
    'setor', coalesce(v_emp."Setor_ERP",''), 'situacao', coalesce(v_emp."Situação",'')));
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Conflito de vínculo — recarregue e tente de novo.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_vincular_empregado(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_vincular_empregado(uuid, bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_desvincular_empregado(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Apenas administradores podem desvincular.');
  END IF;
  UPDATE public."EMPREGADOS" SET auth_user_id = NULL WHERE auth_user_id = p_user_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_desvincular_empregado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_desvincular_empregado(uuid) TO authenticated;

-- 2) Fora o helper e a tabela de capacidades (não são mais usados).
DROP FUNCTION IF EXISTS public.pode_acao_usuario(text);
DROP TABLE IF EXISTS public."ADMIN_USUARIOS_ACESSOS";

NOTIFY pgrst, 'reload schema';
