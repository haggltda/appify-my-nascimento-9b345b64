-- =====================================================================
-- MIGRATION #1 — FUNDAÇÃO: AUTH, EMPRESAS, PROFILES, ROLES E PERMISSÕES
-- =====================================================================

-- ---------- ENUMs ----------
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'controladoria',
  'comercial',
  'operacional',
  'juridico',
  'sst',
  'diretor_adm',
  'diretor_op',
  'visitante'
);

CREATE TYPE public.app_acao AS ENUM (
  'visualizar',
  'incluir',
  'alterar',
  'excluir',
  'aprovar',
  'exportar',
  'executar_ia',
  'alterar_dre'
);

CREATE TYPE public.regime_tributario AS ENUM (
  'lucro_real',
  'lucro_presumido',
  'simples_nacional'
);

-- ---------- EMPRESAS ----------
CREATE TABLE public.empresas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        TEXT NOT NULL UNIQUE, -- HAGG, SN, NH, CANAA, AGPS, LF
  razao_social  TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj          TEXT NOT NULL UNIQUE,
  regime        public.regime_tributario NOT NULL,
  ativa         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- PROFILES (1:1 com auth.users, FK 1:1 com empresa) ----------
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY, -- = auth.users.id
  empresa_id    UUID REFERENCES public.empresas(id) ON DELETE RESTRICT,
  display_name  TEXT,
  email         TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- USER_ROLES ----------
CREATE TABLE public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ---------- ROLE_PERMISSIONS ----------
CREATE TABLE public.role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role        public.app_role NOT NULL,
  modulo      TEXT NOT NULL, -- '*' = curinga
  acao        public.app_acao NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, modulo, acao)
);

CREATE INDEX idx_role_perm_role_modulo ON public.role_permissions(role, modulo);

-- ---------- AUDIT_LOG (particionada por mês) ----------
CREATE TABLE public.audit_log (
  id          BIGSERIAL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     UUID,
  schema_name TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  op          CHAR(1) NOT NULL CHECK (op IN ('I','U','D')),
  pk          TEXT,
  diff        JSONB,
  PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

CREATE INDEX idx_audit_table_ts ON public.audit_log(table_name, ts DESC);
CREATE INDEX idx_audit_user_ts  ON public.audit_log(user_id, ts DESC);

-- Partições para meses correntes/próximos
CREATE TABLE public.audit_log_2026_04 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE public.audit_log_2026_05 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE public.audit_log_2026_06 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE public.audit_log_default PARTITION OF public.audit_log DEFAULT;

-- =====================================================================
-- FUNÇÕES
-- =====================================================================

-- Atualiza updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

-- has_role (security definer evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- has_permission (verifica matriz role_permissions)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _modulo TEXT, _acao public.app_acao)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.acao = _acao
      AND (rp.modulo = _modulo OR rp.modulo = '*')
  );
$$;

-- Cria profile automático no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  -- Atribui role visitante por padrão
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'visitante');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger genérico de auditoria
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pk TEXT;
  v_diff JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_pk := COALESCE((OLD.id)::TEXT, '');
    v_diff := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    v_pk := COALESCE((NEW.id)::TEXT, '');
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_pk := COALESCE((NEW.id)::TEXT, '');
    v_diff := to_jsonb(NEW);
  END IF;

  INSERT INTO public.audit_log (user_id, schema_name, table_name, op, pk, diff)
  VALUES (auth.uid(), TG_TABLE_SCHEMA, TG_TABLE_NAME, LEFT(TG_OP,1), v_pk, v_diff);

  RETURN COALESCE(NEW, OLD);
END; $$;

-- =====================================================================
-- TRIGGERS
-- =====================================================================
CREATE TRIGGER trg_empresas_upd BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_empresas         AFTER INSERT OR UPDATE OR DELETE ON public.empresas         FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER trg_audit_profiles         AFTER INSERT OR UPDATE OR DELETE ON public.profiles         FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER trg_audit_user_roles       AFTER INSERT OR UPDATE OR DELETE ON public.user_roles       FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER trg_audit_role_permissions AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =====================================================================
-- RLS
-- =====================================================================
ALTER TABLE public.empresas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;

-- empresas
CREATE POLICY "empresas_select_auth" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "empresas_admin_ins"   ON public.empresas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "empresas_admin_upd"   ON public.empresas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "empresas_admin_del"   ON public.empresas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- profiles
CREATE POLICY "profiles_self_select"  ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_self_update"  ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR id = auth.uid());

-- user_roles
CREATE POLICY "user_roles_self_or_admin_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_ins" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_upd" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_del" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- role_permissions
CREATE POLICY "rp_select_auth" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rp_admin_ins"   ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rp_admin_upd"   ON public.role_permissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rp_admin_del"   ON public.role_permissions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- audit_log
CREATE POLICY "audit_admin_ctrl_select" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));

-- =====================================================================
-- SEED — Empresas do Grupo Nascimento
-- =====================================================================
INSERT INTO public.empresas (codigo, razao_social, nome_fantasia, cnpj, regime) VALUES
  ('HAGG',  'HAGG Servicos LTDA',                    'HAGG',          '00.000.000/0001-01', 'lucro_real'),
  ('SN',    'SN Servicos LTDA',                      'SN',            '00.000.000/0001-02', 'lucro_real'),
  ('NH',    'NH Empreendimentos LTDA',               'NH',            '00.000.000/0001-03', 'lucro_presumido'),
  ('CANAA', 'Canaa Servicos LTDA',                   'Canaa',         '00.000.000/0001-04', 'lucro_presumido'),
  ('AGPS',  'AGPS Patrimonial LTDA',                 'AGPS',          '00.000.000/0001-05', 'lucro_presumido'),
  ('LF',    'LF Holding LTDA',                       'LF',            '00.000.000/0001-06', 'simples_nacional');

-- =====================================================================
-- SEED — Matriz de permissões
-- =====================================================================
-- admin: tudo
INSERT INTO public.role_permissions (role, modulo, acao)
SELECT 'admin', '*', a FROM unnest(ARRAY['visualizar','incluir','alterar','excluir','aprovar','exportar','executar_ia','alterar_dre']::public.app_acao[]) a;

-- controladoria
INSERT INTO public.role_permissions (role, modulo, acao) VALUES
  ('controladoria','*','visualizar'),
  ('controladoria','*','exportar'),
  ('controladoria','empresas','alterar'),
  ('controladoria','centros_custo','incluir'),
  ('controladoria','centros_custo','alterar'),
  ('controladoria','centros_custo','excluir'),
  ('controladoria','obz','incluir'),
  ('controladoria','obz','alterar'),
  ('controladoria','obz','aprovar'),
  ('controladoria','dre','alterar_dre');

-- comercial
INSERT INTO public.role_permissions (role, modulo, acao) VALUES
  ('comercial','*','visualizar'),
  ('comercial','editais','incluir'),
  ('comercial','editais','alterar'),
  ('comercial','editais','exportar'),
  ('comercial','triagem','executar_ia');

-- operacional
INSERT INTO public.role_permissions (role, modulo, acao) VALUES
  ('operacional','*','visualizar'),
  ('operacional','contratos','alterar');

-- juridico
INSERT INTO public.role_permissions (role, modulo, acao) VALUES
  ('juridico','*','visualizar'),
  ('juridico','pareceres','incluir'),
  ('juridico','pareceres','alterar');

-- sst
INSERT INTO public.role_permissions (role, modulo, acao) VALUES
  ('sst','*','visualizar'),
  ('sst','pareceres','incluir'),
  ('sst','pareceres','alterar');

-- diretor_adm
INSERT INTO public.role_permissions (role, modulo, acao) VALUES
  ('diretor_adm','*','visualizar'),
  ('diretor_adm','*','aprovar'),
  ('diretor_adm','*','exportar');

-- diretor_op
INSERT INTO public.role_permissions (role, modulo, acao) VALUES
  ('diretor_op','*','visualizar'),
  ('diretor_op','*','aprovar'),
  ('diretor_op','*','exportar');

-- visitante
INSERT INTO public.role_permissions (role, modulo, acao) VALUES
  ('visitante','*','visualizar');