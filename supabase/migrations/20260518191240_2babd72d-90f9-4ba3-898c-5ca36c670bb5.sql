
CREATE OR REPLACE FUNCTION public.has_permissao(_user uuid, _modulo text, _acao text, _menu text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user AND role::text = 'admin')
    OR EXISTS (
      SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role::text = ur.role::text
       WHERE ur.user_id = _user
         AND rp.acao::text = _acao
         AND (rp.modulo = '*' OR rp.modulo = _modulo)
         AND (rp.menu_codigo IS NULL OR rp.menu_codigo = _menu)
    );
$$;

CREATE TABLE IF NOT EXISTS public.colaborador_conta_bancaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaborador(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  banco_codigo text NOT NULL,
  banco_nome text NOT NULL,
  agencia text NOT NULL,
  agencia_digito text,
  conta text NOT NULL,
  conta_digito text,
  tipo text NOT NULL DEFAULT 'corrente',
  titular_nome text,
  titular_documento text,
  pix_tipo text,
  pix_chave text,
  principal boolean NOT NULL DEFAULT false,
  ativa boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_colab_conta_bancaria_colab ON public.colaborador_conta_bancaria(colaborador_id, ativa);
CREATE INDEX IF NOT EXISTS idx_colab_conta_bancaria_emp ON public.colaborador_conta_bancaria(empresa_id);
ALTER TABLE public.colaborador_conta_bancaria ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_colab_conta_bancaria_updated_at ON public.colaborador_conta_bancaria;
CREATE TRIGGER trg_colab_conta_bancaria_updated_at
  BEFORE UPDATE ON public.colaborador_conta_bancaria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.colaborador_conta_bancaria_principal_unica()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.principal THEN
    UPDATE public.colaborador_conta_bancaria
       SET principal = false
     WHERE colaborador_id = NEW.colaborador_id
       AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND principal = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_colab_conta_bancaria_principal_unica ON public.colaborador_conta_bancaria;
CREATE TRIGGER trg_colab_conta_bancaria_principal_unica
  BEFORE INSERT OR UPDATE ON public.colaborador_conta_bancaria
  FOR EACH ROW EXECUTE FUNCTION public.colaborador_conta_bancaria_principal_unica();

-- Seed (inserts individuais para evitar problemas de cast com VALUES)
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('admin'::app_role,'suprimentos','visualizar'::app_acao,'fornecedor.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('admin'::app_role,'suprimentos','incluir'::app_acao,'fornecedor.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('admin'::app_role,'suprimentos','alterar'::app_acao,'fornecedor.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('admin'::app_role,'suprimentos','excluir'::app_acao,'fornecedor.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('diretor_adm'::app_role,'suprimentos','visualizar'::app_acao,'fornecedor.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('diretor_adm'::app_role,'suprimentos','incluir'::app_acao,'fornecedor.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('diretor_adm'::app_role,'suprimentos','alterar'::app_acao,'fornecedor.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('diretor_adm'::app_role,'suprimentos','excluir'::app_acao,'fornecedor.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('controladoria'::app_role,'suprimentos','visualizar'::app_acao,'fornecedor.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('admin'::app_role,'rh','visualizar'::app_acao,'colaborador.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('admin'::app_role,'rh','incluir'::app_acao,'colaborador.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('admin'::app_role,'rh','alterar'::app_acao,'colaborador.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('admin'::app_role,'rh','excluir'::app_acao,'colaborador.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('diretor_adm'::app_role,'rh','visualizar'::app_acao,'colaborador.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('diretor_adm'::app_role,'rh','incluir'::app_acao,'colaborador.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('diretor_adm'::app_role,'rh','alterar'::app_acao,'colaborador.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('diretor_adm'::app_role,'rh','excluir'::app_acao,'colaborador.conta_bancaria') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo) VALUES ('controladoria'::app_role,'rh','visualizar'::app_acao,'colaborador.conta_bancaria') ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "auth select fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth insert fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth update fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth delete fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm select fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm insert fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm update fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm delete fornecedor_conta" ON public.fornecedor_conta_bancaria;
CREATE POLICY "perm select fornecedor_conta" ON public.fornecedor_conta_bancaria FOR SELECT TO authenticated USING (public.has_permissao(auth.uid(),'suprimentos','visualizar','fornecedor.conta_bancaria'));
CREATE POLICY "perm insert fornecedor_conta" ON public.fornecedor_conta_bancaria FOR INSERT TO authenticated WITH CHECK (public.has_permissao(auth.uid(),'suprimentos','incluir','fornecedor.conta_bancaria'));
CREATE POLICY "perm update fornecedor_conta" ON public.fornecedor_conta_bancaria FOR UPDATE TO authenticated USING (public.has_permissao(auth.uid(),'suprimentos','alterar','fornecedor.conta_bancaria')) WITH CHECK (public.has_permissao(auth.uid(),'suprimentos','alterar','fornecedor.conta_bancaria'));
CREATE POLICY "perm delete fornecedor_conta" ON public.fornecedor_conta_bancaria FOR DELETE TO authenticated USING (public.has_permissao(auth.uid(),'suprimentos','excluir','fornecedor.conta_bancaria'));

DROP POLICY IF EXISTS "perm select colab_conta" ON public.colaborador_conta_bancaria;
DROP POLICY IF EXISTS "perm insert colab_conta" ON public.colaborador_conta_bancaria;
DROP POLICY IF EXISTS "perm update colab_conta" ON public.colaborador_conta_bancaria;
DROP POLICY IF EXISTS "perm delete colab_conta" ON public.colaborador_conta_bancaria;
CREATE POLICY "perm select colab_conta" ON public.colaborador_conta_bancaria FOR SELECT TO authenticated USING (public.has_permissao(auth.uid(),'rh','visualizar','colaborador.conta_bancaria'));
CREATE POLICY "perm insert colab_conta" ON public.colaborador_conta_bancaria FOR INSERT TO authenticated WITH CHECK (public.has_permissao(auth.uid(),'rh','incluir','colaborador.conta_bancaria'));
CREATE POLICY "perm update colab_conta" ON public.colaborador_conta_bancaria FOR UPDATE TO authenticated USING (public.has_permissao(auth.uid(),'rh','alterar','colaborador.conta_bancaria')) WITH CHECK (public.has_permissao(auth.uid(),'rh','alterar','colaborador.conta_bancaria'));
CREATE POLICY "perm delete colab_conta" ON public.colaborador_conta_bancaria FOR DELETE TO authenticated USING (public.has_permissao(auth.uid(),'rh','excluir','colaborador.conta_bancaria'));
