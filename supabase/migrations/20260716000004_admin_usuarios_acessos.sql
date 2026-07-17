-- =========================================================================
-- ADMIN › Usuários — capacidades delegáveis por usuário
--
-- Duas ações da tela de Usuários que antes eram só de admin passam a poder ser
-- concedidas a usuários específicos pelo painel "Acesso por Usuário":
--   • vincular_usuario     — ligar um login a um cadastro EMPREGADOS
--   • ver_detalhe_usuario  — abrir a ficha do colaborador vinculado
--
-- Espelha o modelo dos Formulários (CS_FORM_ACESSOS): tabela por usuário +
-- helper que a RPC e o front consultam. Admin sempre pode (bypass no helper).
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."ADMIN_USUARIOS_ACESSOS" (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL,
  papel      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."ADMIN_USUARIOS_ACESSOS" DROP CONSTRAINT IF EXISTS admin_usuarios_acessos_papel_check;
ALTER TABLE public."ADMIN_USUARIOS_ACESSOS" ADD  CONSTRAINT admin_usuarios_acessos_papel_check
  CHECK (papel IN ('vincular_usuario', 'ver_detalhe_usuario'));

CREATE UNIQUE INDEX IF NOT EXISTS admin_usuarios_acessos_unq
  ON public."ADMIN_USUARIOS_ACESSOS"(user_id, papel);

ALTER TABLE public."ADMIN_USUARIOS_ACESSOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public."ADMIN_USUARIOS_ACESSOS" TO authenticated;

-- Cada usuário lê as próprias capacidades; admin lê/gerencia todas.
DROP POLICY IF EXISTS admin_usuarios_acessos_select ON public."ADMIN_USUARIOS_ACESSOS";
CREATE POLICY admin_usuarios_acessos_select ON public."ADMIN_USUARIOS_ACESSOS"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS admin_usuarios_acessos_insert ON public."ADMIN_USUARIOS_ACESSOS";
CREATE POLICY admin_usuarios_acessos_insert ON public."ADMIN_USUARIOS_ACESSOS"
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS admin_usuarios_acessos_delete ON public."ADMIN_USUARIOS_ACESSOS";
CREATE POLICY admin_usuarios_acessos_delete ON public."ADMIN_USUARIOS_ACESSOS"
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Helper: admin OU tem a capacidade concedida.
CREATE OR REPLACE FUNCTION public.pode_acao_usuario(_papel text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public."ADMIN_USUARIOS_ACESSOS" a
                  WHERE a.user_id = auth.uid() AND a.papel = _papel);
$$;
REVOKE ALL ON FUNCTION public.pode_acao_usuario(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_acao_usuario(text) TO authenticated;

-- ── Vínculo passa a aceitar admin OU a capacidade 'vincular_usuario' ─────
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
  IF NOT public.pode_acao_usuario('vincular_usuario') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sem permissão para vincular usuários.');
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
  IF NOT public.pode_acao_usuario('vincular_usuario') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sem permissão para desvincular usuários.');
  END IF;
  UPDATE public."EMPREGADOS" SET auth_user_id = NULL WHERE auth_user_id = p_user_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_desvincular_empregado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_desvincular_empregado(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
