
-- ============ FUNÇÃO DE VISIBILIDADE POR LINHA ============
CREATE OR REPLACE FUNCTION public.plano_acao_visible_by_user(
  _user uuid, _plano_id uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE r record;
BEGIN
  IF _user IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(),'admin'::public.app_role)
     AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
  THEN RETURN false; END IF;

  IF _user IS NULL OR _plano_id IS NULL THEN RETURN false; END IF;

  SELECT id, empresa_id, deleted_at,
         responsavel_profile_id, lider_setor_profile_id, lider_comite_profile_id,
         setor, area, comite
    INTO r FROM public.plano_acao WHERE id = _plano_id;
  IF NOT FOUND OR r.deleted_at IS NOT NULL THEN RETURN false; END IF;

  IF NOT public.user_pode_atuar_empresa(_user, r.empresa_id) THEN RETURN false; END IF;

  IF public.has_role(_user,'admin'::public.app_role) THEN RETURN true; END IF;

  IF EXISTS (SELECT 1 FROM public.permissoes_especiais
              WHERE user_id=_user AND permissao='plano_acao:ver_todos') THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM public.plano_acao_usuario_permissao
              WHERE empresa_id=r.empresa_id AND profile_id=_user
                AND pode_administrar = true) THEN
    RETURN true;
  END IF;

  IF _user IN (r.responsavel_profile_id, r.lider_setor_profile_id, r.lider_comite_profile_id)
    THEN RETURN true; END IF;

  IF r.setor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.setor s
     WHERE s.empresa_id=r.empresa_id AND s.gestor_profile_id=_user
       AND lower(s.nome)=lower(r.setor)) THEN RETURN true; END IF;

  IF r.area IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.area a
     WHERE a.empresa_id=r.empresa_id AND a.gestor_profile_id=_user
       AND lower(a.nome)=lower(r.area)) THEN RETURN true; END IF;

  IF r.comite IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.comite c
     WHERE c.empresa_id=r.empresa_id AND c.gestor_profile_id=_user
       AND lower(c.nome)=lower(r.comite)) THEN RETURN true; END IF;

  IF r.setor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.setor s JOIN public.area a ON a.id=s.area_id
     WHERE s.empresa_id=r.empresa_id AND lower(s.nome)=lower(r.setor)
       AND a.gestor_profile_id=_user) THEN RETURN true; END IF;

  IF r.area IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.area a JOIN public.comite c ON c.id=a.comite_id
     WHERE a.empresa_id=r.empresa_id AND lower(a.nome)=lower(r.area)
       AND c.gestor_profile_id=_user) THEN RETURN true; END IF;

  RETURN false;
END; $$;

REVOKE ALL ON FUNCTION public.plano_acao_visible_by_user(uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.plano_acao_visible_by_user(uuid,uuid) TO authenticated;

-- ============ plano_acao ============
DROP POLICY IF EXISTS pa_select ON public.plano_acao;
DROP POLICY IF EXISTS pa_update ON public.plano_acao;
DROP POLICY IF EXISTS pa_insert ON public.plano_acao;

CREATE POLICY pa_select ON public.plano_acao FOR SELECT TO authenticated
  USING (
        public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND public.plano_acao_can_access(auth.uid(), empresa_id, 'visualizar')
    AND public.plano_acao_visible_by_user(auth.uid(), id)
  );

CREATE POLICY pa_insert ON public.plano_acao FOR INSERT TO authenticated
  WITH CHECK (
        public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND public.plano_acao_can_access(auth.uid(), empresa_id, 'criar')
  );

CREATE POLICY pa_update ON public.plano_acao FOR UPDATE TO authenticated
  USING (
        public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND public.plano_acao_can_access(auth.uid(), empresa_id, 'editar')
    AND public.plano_acao_visible_by_user(auth.uid(), id))
  WITH CHECK (
        public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND public.plano_acao_can_access(auth.uid(), empresa_id, 'editar')
    AND public.plano_acao_visible_by_user(auth.uid(), id));

-- ============ plano_acao_anexo ============
DROP POLICY IF EXISTS paa_select ON public.plano_acao_anexo;
DROP POLICY IF EXISTS paa_insert ON public.plano_acao_anexo;
DROP POLICY IF EXISTS paa_delete ON public.plano_acao_anexo;

CREATE POLICY paa_select ON public.plano_acao_anexo FOR SELECT TO authenticated
  USING (public.plano_acao_visible_by_user(auth.uid(), plano_acao_id));

CREATE POLICY paa_insert ON public.plano_acao_anexo FOR INSERT TO authenticated
  WITH CHECK (
        public.plano_acao_can_access(auth.uid(), empresa_id,'editar')
    AND public.plano_acao_visible_by_user(auth.uid(), plano_acao_id)
    AND EXISTS (SELECT 1 FROM public.plano_acao p
                 WHERE p.id = plano_acao_id AND p.empresa_id = empresa_id));

CREATE POLICY paa_delete ON public.plano_acao_anexo FOR DELETE TO authenticated
  USING (
        public.plano_acao_can_access(auth.uid(), empresa_id,'editar')
    AND public.plano_acao_visible_by_user(auth.uid(), plano_acao_id));

-- ============ plano_acao_comentario ============
DROP POLICY IF EXISTS pac_select ON public.plano_acao_comentario;
DROP POLICY IF EXISTS pac_insert ON public.plano_acao_comentario;
DROP POLICY IF EXISTS pac_update ON public.plano_acao_comentario;
DROP POLICY IF EXISTS pac_delete ON public.plano_acao_comentario;

CREATE POLICY pac_select ON public.plano_acao_comentario FOR SELECT TO authenticated
  USING (public.plano_acao_visible_by_user(auth.uid(), plano_acao_id));

CREATE POLICY pac_insert ON public.plano_acao_comentario FOR INSERT TO authenticated
  WITH CHECK (
        public.plano_acao_can_access(auth.uid(), empresa_id,'visualizar')
    AND public.plano_acao_visible_by_user(auth.uid(), plano_acao_id)
    AND EXISTS (SELECT 1 FROM public.plano_acao p
                 WHERE p.id = plano_acao_id AND p.empresa_id = empresa_id)
    AND criado_por = auth.uid());

CREATE POLICY pac_update ON public.plano_acao_comentario FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (
        (criado_por = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))
    AND public.plano_acao_visible_by_user(auth.uid(), plano_acao_id)
    AND EXISTS (SELECT 1 FROM public.plano_acao p
                 WHERE p.id = plano_acao_id AND p.empresa_id = empresa_id));

CREATE POLICY pac_delete ON public.plano_acao_comentario FOR DELETE TO authenticated
  USING (
        (criado_por = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))
    AND public.plano_acao_visible_by_user(auth.uid(), plano_acao_id));

-- ============ plano_acao_historico ============
DROP POLICY IF EXISTS pah_select ON public.plano_acao_historico;
DROP POLICY IF EXISTS pah_insert ON public.plano_acao_historico;

CREATE POLICY pah_select ON public.plano_acao_historico FOR SELECT TO authenticated
  USING (public.plano_acao_visible_by_user(auth.uid(), plano_acao_id));

CREATE POLICY pah_insert ON public.plano_acao_historico FOR INSERT TO authenticated
  WITH CHECK (
        public.plano_acao_can_access(auth.uid(), empresa_id,'visualizar')
    AND public.plano_acao_visible_by_user(auth.uid(), plano_acao_id)
    AND EXISTS (SELECT 1 FROM public.plano_acao p
                 WHERE p.id = plano_acao_id AND p.empresa_id = empresa_id));

-- ============ ÍNDICES ============
CREATE INDEX IF NOT EXISTS plano_acao_lider_setor_idx
  ON public.plano_acao(lider_setor_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS plano_acao_lider_comite_idx
  ON public.plano_acao(lider_comite_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS comite_emp_gestor_idx ON public.comite(empresa_id, gestor_profile_id);
CREATE INDEX IF NOT EXISTS area_emp_gestor_idx   ON public.area  (empresa_id, gestor_profile_id);
CREATE INDEX IF NOT EXISTS setor_emp_gestor_idx  ON public.setor (empresa_id, gestor_profile_id);
CREATE INDEX IF NOT EXISTS permissoes_especiais_user_perm_idx
  ON public.permissoes_especiais(user_id, permissao);
CREATE INDEX IF NOT EXISTS pa_user_perm_admin_idx
  ON public.plano_acao_usuario_permissao(profile_id, empresa_id) WHERE pode_administrar = true;
