-- Torna a exclusão de usuário (admin-delete-user) sempre possível: toda FK
-- bloqueante (sem ON DELETE, ou RESTRICT explícito) apontando pra
-- public.profiles(id) ou auth.users(id) vira ON DELETE SET NULL — o
-- registro que referenciava o usuário continua existindo, só perde a
-- referência (fica sem responsável/autor). Decisão do gestor: inclui de
-- propósito as tabelas de aprovação/voto de Suprimentos
-- (sup_aprov_etapa.responsavel_user_id, sup_aprov_voto.usuario_id), que
-- antes bloqueavam a exclusão intencionalmente pra preservar o rastro de
-- quem aprovou/votou — passam a permitir exclusão também.
--
-- Não mexe em quem já é CASCADE ou SET NULL (já não bloqueia). Não mexe em
-- FK composta (nenhuma encontrada hoje) nem em coluna que seja a própria
-- chave primária da tabela (não dá pra setar NULL numa PK — nenhum caso
-- conhecido hoje, mas o loop pula defensivamente se aparecer).

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT
      con.conname,
      con.conrelid,
      con.confrelid,
      nsp.nspname AS table_schema,
      cls.relname AS table_name,
      att.attname AS column_name,
      att.attnum AS column_attnum,
      att.attnotnull AS is_not_null
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND array_length(con.conkey, 1) = 1
      AND con.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
      AND con.confdeltype NOT IN ('n', 'c') -- pula quem já é SET NULL ('n') ou CASCADE ('c')
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint pk
       WHERE pk.conrelid = rec.conrelid
         AND pk.contype = 'p'
         AND rec.column_attnum = ANY(pk.conkey)
    ) THEN
      RAISE NOTICE 'Pulando %.% (coluna é chave primária, não dá pra setar NULL)', rec.table_name, rec.column_name;
      CONTINUE;
    END IF;

    IF rec.is_not_null THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL', rec.table_schema, rec.table_name, rec.column_name);
    END IF;

    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', rec.table_schema, rec.table_name, rec.conname);
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s ON DELETE SET NULL',
      rec.table_schema, rec.table_name, rec.conname, rec.column_name, rec.confrelid::regclass::text
    );

    RAISE NOTICE 'Ajustado: %.% -> ON DELETE SET NULL', rec.table_name, rec.column_name;
  END LOOP;
END $$;
