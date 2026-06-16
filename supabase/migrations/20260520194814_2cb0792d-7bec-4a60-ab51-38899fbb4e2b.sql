-- =====================================================================
-- BLOCO 1 (CONSERVADOR) — v2: corrige preservação de qualificador (ex.: c.empresa_id)
-- =====================================================================

DO $$
DECLARE
  r RECORD;
  new_qual TEXT;
  new_check TEXT;
  cmd_txt TEXT;
  roles_txt TEXT;
  using_clause TEXT;
  check_clause TEXT;
  permissive_txt TEXT;
  total INT := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual ILIKE '%get_user_empresa%'
        OR with_check ILIKE '%get_user_empresa%'
      )
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;

    -- Caso 1: qualificado, ex.: c.empresa_id = get_user_empresa(auth.uid())
    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(
        new_qual,
        '([A-Za-z_][A-Za-z0-9_]*)\.empresa_id\s*=\s*get_user_empresa\(\s*auth\.uid\(\)\s*\)',
        'user_pode_atuar_empresa(auth.uid(), \1.empresa_id)',
        'g'
      );
      -- Caso 2: sem qualificador
      new_qual := regexp_replace(
        new_qual,
        '(?<![A-Za-z0-9_.])empresa_id\s*=\s*get_user_empresa\(\s*auth\.uid\(\)\s*\)',
        'user_pode_atuar_empresa(auth.uid(), empresa_id)',
        'g'
      );
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(
        new_check,
        '([A-Za-z_][A-Za-z0-9_]*)\.empresa_id\s*=\s*get_user_empresa\(\s*auth\.uid\(\)\s*\)',
        'user_pode_atuar_empresa(auth.uid(), \1.empresa_id)',
        'g'
      );
      new_check := regexp_replace(
        new_check,
        '(?<![A-Za-z0-9_.])empresa_id\s*=\s*get_user_empresa\(\s*auth\.uid\(\)\s*\)',
        'user_pode_atuar_empresa(auth.uid(), empresa_id)',
        'g'
      );
    END IF;

    -- Sanity check: se ainda restou get_user_empresa, aborta (policy atípica)
    IF (new_qual IS NOT NULL AND new_qual ILIKE '%get_user_empresa%')
       OR (new_check IS NOT NULL AND new_check ILIKE '%get_user_empresa%')
    THEN
      RAISE NOTICE 'PULADA (atípica) %.% / %', r.schemaname, r.tablename, r.policyname;
      CONTINUE;
    END IF;

    cmd_txt := CASE r.cmd WHEN 'ALL' THEN 'ALL' ELSE r.cmd END;
    permissive_txt := CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;
    roles_txt := array_to_string(r.roles, ', ');
    using_clause := CASE WHEN new_qual  IS NOT NULL THEN format(' USING (%s)', new_qual)  ELSE '' END;
    check_clause := CASE WHEN new_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_check) ELSE '' END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      r.policyname, r.schemaname, r.tablename,
      permissive_txt, cmd_txt, roles_txt,
      using_clause, check_clause
    );

    total := total + 1;
  END LOOP;

  RAISE NOTICE 'Policies atualizadas: %', total;
END $$;
