
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.comite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  gestor_profile_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.area (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  comite_id uuid NOT NULL REFERENCES public.comite(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  descricao text,
  gestor_profile_id uuid,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.setor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.area(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  descricao text,
  gestor_profile_id uuid,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, area_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_area_comite ON public.area(comite_id);
CREATE INDEX IF NOT EXISTS idx_setor_area ON public.setor(area_id);

ALTER TABLE public.comite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setor  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_estrutura_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role::text IN ('admin','controladoria')
  )
$$;
REVOKE ALL ON FUNCTION public.is_estrutura_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_estrutura_admin(uuid) TO authenticated, service_role;

DO $$ BEGIN CREATE POLICY "comite_select_auth" ON public.comite FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "comite_write_admin" ON public.comite FOR ALL TO authenticated
  USING (public.is_estrutura_admin(auth.uid())) WITH CHECK (public.is_estrutura_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "area_select_auth" ON public.area FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "area_write_admin" ON public.area FOR ALL TO authenticated
  USING (public.is_estrutura_admin(auth.uid())) WITH CHECK (public.is_estrutura_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "setor_select_auth" ON public.setor FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "setor_write_admin" ON public.setor FOR ALL TO authenticated
  USING (public.is_estrutura_admin(auth.uid())) WITH CHECK (public.is_estrutura_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER set_comite_updated BEFORE UPDATE ON public.comite FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_area_updated   BEFORE UPDATE ON public.area   FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_setor_updated  BEFORE UPDATE ON public.setor  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
