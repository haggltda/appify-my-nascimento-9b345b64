-- =========================================================================
-- ADMIN — vincular login ↔ cadastro EMPREGADOS (Senior) e puxar o nome oficial
--
-- Complementa o autoatendimento (vincular_meu_empregado). Agora o admin também
-- amarra manualmente um usuário a um colaborador (pesquisando o cadastro), e ao
-- vincular (nos DOIS fluxos) o profiles.display_name passa a ser o Nome oficial
-- da Senior (EMPREGADOS."Nome").
--
-- Regra dos desligados reusada do vincular_meu_empregado:
--   DEMITIDO / DEMITIDA / RESCISÃO / DESLIGADO / DESLIGADA  → nunca vincula.
-- Idempotente.
-- =========================================================================

-- ── 1) Admin vincula um usuário a um colaborador (por ID do cadastro) ─────
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

  -- Um usuário só pode estar em UM cadastro (índice único parcial de auth_user_id):
  -- solta o vínculo anterior deste usuário antes de amarrar o novo.
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

  -- Puxa o nome oficial da Senior para o login.
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

-- ── 2) Admin desfaz o vínculo de um usuário ──────────────────────────────
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

-- ── 3) Autoatendimento também puxa o nome oficial da Senior ──────────────
-- Recria vincular_meu_empregado idêntica à 20260618000002, adicionando o
-- UPDATE em profiles.display_name no ramo de confirmação.
CREATE OR REPLACE FUNCTION public.vincular_meu_empregado(
  p_cpf        text,
  p_nascimento text,
  p_confirmar  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_cpf     text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_nasc    text := regexp_replace(coalesce(p_nascimento, ''), '\D', '', 'g');
  v_cpf_fmt text;
  v_emp     public."EMPREGADOS"%ROWTYPE;
  v_bloq    text[] := ARRAY['DEMITIDO','DEMITIDA','RESCISÃO','DESLIGADO','DESLIGADA'];
  v_preview jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Não autenticado');
  END IF;
  IF length(v_cpf) <> 11 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe um CPF válido (11 dígitos).');
  END IF;
  IF length(v_nasc) <> 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe a data de nascimento (DD/MM/AAAA).');
  END IF;

  v_cpf_fmt := substr(v_cpf,1,3) || '.' || substr(v_cpf,4,3) || '.' || substr(v_cpf,7,3) || '-' || substr(v_cpf,10,2);

  SELECT * INTO v_emp
  FROM public."EMPREGADOS" e
  WHERE e."CPF" IN (v_cpf, v_cpf_fmt)
  ORDER BY
    (CASE WHEN upper(coalesce(e."Situação",'')) = ANY (v_bloq) THEN 1 ELSE 0 END) ASC,
    (CASE WHEN e."Admissão" ~ '^\d{2}/\d{2}/\d{4}$'
          THEN (substr(e."Admissão",7,4) || substr(e."Admissão",4,2) || substr(e."Admissão",1,2))::bigint
          ELSE 0 END) DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CPF não encontrado.');
  END IF;

  IF upper(coalesce(v_emp."Situação",'')) = ANY (v_bloq) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cadastro consta como desligado. Procure o RH.');
  END IF;

  IF regexp_replace(coalesce(v_emp."Nascimento",''), '\D', '', 'g') <> v_nasc THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CPF e data de nascimento não conferem.');
  END IF;

  IF v_emp.auth_user_id IS NOT NULL AND v_emp.auth_user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este cadastro já está vinculado a outro usuário. Procure o RH.');
  END IF;

  v_preview := jsonb_build_object(
    'id',       v_emp."ID",
    'nome',     coalesce(v_emp."Nome", ''),
    'cargo',    coalesce(v_emp."Título do Cargo", ''),
    'setor',    coalesce(v_emp."Setor_ERP", ''),
    'perfil',   coalesce(v_emp."Perfil_ERP", ''),
    'lider',    coalesce(v_emp."LIDER", ''),
    'situacao', coalesce(v_emp."Situação", ''),
    'admissao', coalesce(v_emp."Admissão", ''),
    'empresa',  coalesce(v_emp."Nome da Empresa", ''),
    'filial',   coalesce(v_emp."Nome Filial", '')
  );

  IF NOT p_confirmar THEN
    RETURN jsonb_build_object('ok', true, 'ja_vinculado', (v_emp.auth_user_id = v_uid), 'empregado', v_preview);
  END IF;

  UPDATE public."EMPREGADOS"
     SET auth_user_id = v_uid,
         "email" = CASE
                     WHEN coalesce(btrim("email"), '') = ''
                     THEN (SELECT u.email FROM auth.users u WHERE u.id = v_uid)
                     ELSE "email"
                   END
   WHERE "ID" = v_emp."ID";

  -- Puxa o nome oficial da Senior para o login.
  UPDATE public.profiles SET display_name = v_emp."Nome" WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'vinculado', true, 'empregado', v_preview);

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sua conta já está vinculada a outro cadastro.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.vincular_meu_empregado(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_meu_empregado(text, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
