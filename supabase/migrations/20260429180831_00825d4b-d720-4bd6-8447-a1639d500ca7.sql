-- =====================================================
-- MIGRATION #2 — CATÁLOGOS FINANCEIROS
-- =====================================================

-- Adiciona FK profiles.empresa_id -> empresas.id
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_empresa_fk
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;

-- Função auxiliar: empresa do usuário (evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.get_user_empresa(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = _user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_empresa(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_empresa(uuid) TO authenticated;

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.cc_tipo AS ENUM ('adm', 'operacional');
CREATE TYPE public.dre_natureza AS ENUM ('receita', 'deducao', 'custo', 'despesa', 'resultado', 'tributo', 'financeiro');

-- =====================================================
-- CENTROS DE CUSTO
-- =====================================================
CREATE TABLE public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  tipo cc_tipo NOT NULL DEFAULT 'adm',
  responsavel text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE INDEX idx_cc_empresa ON public.centros_custo(empresa_id);
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_select ON public.centros_custo FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY cc_insert ON public.centros_custo FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE POLICY cc_update ON public.centros_custo FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE POLICY cc_delete ON public.centros_custo FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE TRIGGER trg_cc_upd BEFORE UPDATE ON public.centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cc_audit AFTER INSERT OR UPDATE OR DELETE ON public.centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =====================================================
-- DRE LINHAS
-- =====================================================
CREATE TABLE public.dre_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  descricao text NOT NULL,
  natureza dre_natureza NOT NULL,
  nivel int NOT NULL DEFAULT 1,
  ordem int NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES public.dre_linhas(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE INDEX idx_dre_empresa ON public.dre_linhas(empresa_id);
CREATE INDEX idx_dre_parent ON public.dre_linhas(parent_id);
ALTER TABLE public.dre_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY dre_select ON public.dre_linhas FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY dre_insert ON public.dre_linhas FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );
CREATE POLICY dre_update ON public.dre_linhas FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );
CREATE POLICY dre_delete ON public.dre_linhas FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE TRIGGER trg_dre_upd BEFORE UPDATE ON public.dre_linhas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_dre_audit AFTER INSERT OR UPDATE OR DELETE ON public.dre_linhas
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =====================================================
-- CLASSIFICADORES
-- =====================================================
CREATE TABLE public.classificadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE INDEX idx_clas_empresa ON public.classificadores(empresa_id);
ALTER TABLE public.classificadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY clas_select ON public.classificadores FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY clas_insert ON public.classificadores FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );
CREATE POLICY clas_update ON public.classificadores FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );
CREATE POLICY clas_delete ON public.classificadores FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND (public.has_role(auth.uid(),'admin') OR empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE TRIGGER trg_clas_upd BEFORE UPDATE ON public.classificadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clas_audit AFTER INSERT OR UPDATE OR DELETE ON public.classificadores
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =====================================================
-- CLASSIFICADOR VALORES
-- =====================================================
CREATE TABLE public.classificador_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classificador_id uuid NOT NULL REFERENCES public.classificadores(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classificador_id, codigo)
);
CREATE INDEX idx_clasval_clas ON public.classificador_valores(classificador_id);
ALTER TABLE public.classificador_valores ENABLE ROW LEVEL SECURITY;

CREATE POLICY clasval_select ON public.classificador_valores FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classificadores c
    WHERE c.id = classificador_id
      AND (c.empresa_id = public.get_user_empresa(auth.uid()) OR public.has_role(auth.uid(),'admin'))
  ));
CREATE POLICY clasval_insert ON public.classificador_valores FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND EXISTS (
      SELECT 1 FROM public.classificadores c
      WHERE c.id = classificador_id
        AND (public.has_role(auth.uid(),'admin') OR c.empresa_id = public.get_user_empresa(auth.uid()))
    )
  );
CREATE POLICY clasval_update ON public.classificador_valores FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND EXISTS (
      SELECT 1 FROM public.classificadores c
      WHERE c.id = classificador_id
        AND (public.has_role(auth.uid(),'admin') OR c.empresa_id = public.get_user_empresa(auth.uid()))
    )
  );
CREATE POLICY clasval_delete ON public.classificador_valores FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'))
    AND EXISTS (
      SELECT 1 FROM public.classificadores c
      WHERE c.id = classificador_id
        AND (public.has_role(auth.uid(),'admin') OR c.empresa_id = public.get_user_empresa(auth.uid()))
    )
  );

CREATE TRIGGER trg_clasval_upd BEFORE UPDATE ON public.classificador_valores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clasval_audit AFTER INSERT OR UPDATE OR DELETE ON public.classificador_valores
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();