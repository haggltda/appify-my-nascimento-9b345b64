-- 1) Add 'usuario' to enum app_role (idempotent)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'usuario';
