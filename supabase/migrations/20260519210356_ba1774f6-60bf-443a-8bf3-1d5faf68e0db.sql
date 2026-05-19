
-- 1) Nova coluna na profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acessa_todas_empresas boolean NOT NULL DEFAULT false;

-- 2) Constraint unique para user_empresa (necessária para ON CONFLICT futuro)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_empresa'::regclass
      AND conname = 'user_empresa_user_empresa_unique'
  ) THEN
    ALTER TABLE public.user_empresa
      ADD CONSTRAINT user_empresa_user_empresa_unique UNIQUE (user_id, empresa_id);
  END IF;
END $$;

-- 3) Função: usuário pode atuar nesta empresa?
CREATE OR REPLACE FUNCTION public.user_pode_atuar_empresa(_user uuid, _empresa uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _empresa IS NOT NULL
    AND (
      public.has_role(_user, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user
          AND p.acessa_todas_empresas = true
          AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = _empresa AND e.ativa = true)
      )
      OR EXISTS (
        SELECT 1 FROM public.user_empresa ue
        WHERE ue.user_id = _user AND ue.empresa_id = _empresa
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user AND p.empresa_id = _empresa
      )
    );
$$;

-- 4) Trigger: validar troca de empresa ativa
CREATE OR REPLACE FUNCTION public.profiles_validate_empresa_atual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_atual_id IS NOT NULL
     AND NEW.empresa_atual_id IS DISTINCT FROM OLD.empresa_atual_id
     AND NOT public.user_pode_atuar_empresa(NEW.id, NEW.empresa_atual_id) THEN
    RAISE EXCEPTION 'Usuário sem vínculo com a empresa selecionada'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_valida_empresa_atual ON public.profiles;
CREATE TRIGGER trg_profiles_valida_empresa_atual
BEFORE UPDATE OF empresa_atual_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_validate_empresa_atual();

-- 5) Índices
CREATE INDEX IF NOT EXISTS idx_user_empresa_user_empresa
  ON public.user_empresa(user_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_profiles_empresa_atual
  ON public.profiles(empresa_atual_id);

-- 6) Backfill: admins existentes ganham a flag (preserva acesso atual)
UPDATE public.profiles p
SET acessa_todas_empresas = true
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.id AND ur.role = 'admin'::app_role
);

-- 7) Garantir empresa_atual_id preenchida
UPDATE public.profiles
SET empresa_atual_id = empresa_id
WHERE empresa_atual_id IS NULL AND empresa_id IS NOT NULL;
