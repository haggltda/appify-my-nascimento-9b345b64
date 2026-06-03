BEGIN;

-- 1. Auditoria: cria se não existir; valida schema se existir
DO $$
DECLARE
  v_exists boolean;
  v_required text[] := ARRAY[
    'id','executado_em','executado_por','lote','plano_id','empresa_id',
    'responsavel_nome_origem','responsavel_profile_id_antes',
    'responsavel_profile_id_depois','pendencia_responsavel_antes',
    'pendencia_responsavel_depois','tipo_match'
  ];
  v_missing int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='plano_acao_backfill_responsavel_audit'
  ) INTO v_exists;

  IF v_exists THEN
    SELECT count(*) INTO v_missing
    FROM unnest(v_required) r(col)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='plano_acao_backfill_responsavel_audit'
        AND column_name = r.col
    );
    IF v_missing > 0 THEN
      RAISE EXCEPTION 'P2C_ABORTADO_SCHEMA_AUDITORIA_INCOMPATIVEL: % colunas obrigatórias ausentes', v_missing;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.plano_acao_backfill_responsavel_audit (
  id                              bigserial PRIMARY KEY,
  executado_em                    timestamptz NOT NULL DEFAULT now(),
  executado_por                   uuid,
  lote                            text NOT NULL,
  plano_id                        uuid NOT NULL,
  empresa_id                      uuid NOT NULL,
  responsavel_nome_origem         text,
  responsavel_profile_id_antes    uuid,
  responsavel_profile_id_depois   uuid,
  pendencia_responsavel_antes     boolean,
  pendencia_responsavel_depois    boolean,
  tipo_match                      text NOT NULL
);

GRANT SELECT ON public.plano_acao_backfill_responsavel_audit TO authenticated;
GRANT ALL    ON public.plano_acao_backfill_responsavel_audit TO service_role;

ALTER TABLE public.plano_acao_backfill_responsavel_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_admin_read ON public.plano_acao_backfill_responsavel_audit;
CREATE POLICY audit_admin_read
  ON public.plano_acao_backfill_responsavel_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Lista explícita dos 7 pares aprovados
CREATE TEMP TABLE _p2c_aprovados (
  plano_id                  uuid PRIMARY KEY,
  responsavel_nome_origem   text NOT NULL,
  candidato_profile_id      uuid NOT NULL,
  candidato_display_name    text NOT NULL
) ON COMMIT DROP;

INSERT INTO _p2c_aprovados VALUES
  ('e797558a-47f1-4462-89a3-5a9fb7929ca7','Helena Nascimento',  '60e5bb0a-c0ae-4434-950f-9fdaecb01ea7','Helena Nascimento'),
  ('adfa66a1-7a39-480d-af95-20f42b8f5d6b','Senilton Nascimento','6a8ac11c-a1e5-49ab-8de9-6a9c7dc03a98','Senilton Nascimento'),
  ('246d196d-6a5e-4f61-8662-36b1a22996f7','Yuri Rosa',          '3baeb855-5389-4459-93f4-759ee82b288e','Yuri Rosa'),
  ('3c09cbd7-d16f-4afb-bebb-9d43abc95875','Yuri Rosa',          '3baeb855-5389-4459-93f4-759ee82b288e','Yuri Rosa'),
  ('956c5a34-4bc9-46ef-b2ca-df1b9aa33ea7','Yuri Rosa',          '3baeb855-5389-4459-93f4-759ee82b288e','Yuri Rosa'),
  ('c12aea08-5217-4a4b-b7f0-077e44189f5e','Yuri Rosa',          '3baeb855-5389-4459-93f4-759ee82b288e','Yuri Rosa'),
  ('318f8b5c-51b8-4244-b600-fc677ab8993b','Yuri Rosa',          '3baeb855-5389-4459-93f4-759ee82b288e','Yuri Rosa');

-- 3. Validações com RAISE EXCEPTION
DO $$
DECLARE
  v_total int;
  v_falha int;
BEGIN
  SELECT count(*) INTO v_total FROM _p2c_aprovados;
  IF v_total <> 7 THEN
    RAISE EXCEPTION 'P2C_ABORTADO: lista deve ter 7 pares, encontrou %', v_total;
  END IF;

  -- 3.1 plano existe e não deletado
  SELECT count(*) INTO v_falha
  FROM _p2c_aprovados a
  LEFT JOIN public.plano_acao pa
    ON pa.id = a.plano_id AND pa.deleted_at IS NULL
  WHERE pa.id IS NULL;
  IF v_falha > 0 THEN
    RAISE EXCEPTION 'TRAVADO_POR_DIVERGENCIA_P2C_BACKFILL: % plano(s) inexistente(s) ou deletado(s)', v_falha;
  END IF;

  -- 3.2 responsavel_nome_origem ainda bate (normalizado)
  SELECT count(*) INTO v_falha
  FROM _p2c_aprovados a
  JOIN public.plano_acao pa ON pa.id = a.plano_id
  WHERE lower(trim(regexp_replace(coalesce(pa.responsavel_nome_origem,''),'\s+',' ','g')))
     <> lower(trim(regexp_replace(coalesce(a.responsavel_nome_origem,''),'\s+',' ','g')));
  IF v_falha > 0 THEN
    RAISE EXCEPTION 'TRAVADO_POR_DIVERGENCIA_P2C_BACKFILL: % plano(s) com responsavel_nome_origem divergente', v_falha;
  END IF;

  -- 3.3 plano ainda sem responsavel_profile_id
  SELECT count(*) INTO v_falha
  FROM _p2c_aprovados a
  JOIN public.plano_acao pa ON pa.id = a.plano_id
  WHERE pa.responsavel_profile_id IS NOT NULL;
  IF v_falha > 0 THEN
    RAISE EXCEPTION 'TRAVADO_POR_DIVERGENCIA_P2C_BACKFILL: % plano(s) já vinculado(s)', v_falha;
  END IF;

  -- 3.4 profile existe, ativo, display_name bate normalizado
  SELECT count(*) INTO v_falha
  FROM _p2c_aprovados a
  LEFT JOIN public.profiles p
    ON p.id = a.candidato_profile_id
   AND p.ativo = true
   AND lower(trim(regexp_replace(coalesce(p.display_name,''),'\s+',' ','g')))
     = lower(trim(regexp_replace(coalesce(a.candidato_display_name,''),'\s+',' ','g')))
  WHERE p.id IS NULL;
  IF v_falha > 0 THEN
    RAISE EXCEPTION 'TRAVADO_POR_DIVERGENCIA_P2C_BACKFILL: % profile(s) inválido(s)/inativo(s)/divergente(s)', v_falha;
  END IF;

  -- 3.5 profile pode atuar na empresa do plano
  SELECT count(*) INTO v_falha
  FROM _p2c_aprovados a
  JOIN public.plano_acao pa ON pa.id = a.plano_id
  WHERE NOT public.user_pode_atuar_empresa(a.candidato_profile_id, pa.empresa_id);
  IF v_falha > 0 THEN
    RAISE EXCEPTION 'TRAVADO_POR_DIVERGENCIA_P2C_BACKFILL: % vínculo(s) fora da empresa elegível', v_falha;
  END IF;

  -- 3.6 unicidade: nenhum outro profile ativo com mesmo nome elegível na empresa
  SELECT count(*) INTO v_falha
  FROM _p2c_aprovados a
  JOIN public.plano_acao pa ON pa.id = a.plano_id
  JOIN public.profiles p2
    ON p2.ativo = true
   AND p2.id <> a.candidato_profile_id
   AND lower(trim(regexp_replace(coalesce(p2.display_name,''),'\s+',' ','g')))
     = lower(trim(regexp_replace(coalesce(a.candidato_display_name,''),'\s+',' ','g')))
   AND public.user_pode_atuar_empresa(p2.id, pa.empresa_id);
  IF v_falha > 0 THEN
    RAISE EXCEPTION 'TRAVADO_POR_DIVERGENCIA_P2C_BACKFILL: % plano(s) com candidato múltiplo detectado', v_falha;
  END IF;
END $$;

-- 4. Auditoria antes/depois (7 linhas)
INSERT INTO public.plano_acao_backfill_responsavel_audit
  (executado_por, lote, plano_id, empresa_id, responsavel_nome_origem,
   responsavel_profile_id_antes, responsavel_profile_id_depois,
   pendencia_responsavel_antes,  pendencia_responsavel_depois, tipo_match)
SELECT
  auth.uid(),
  'p2c-2026-06-03-exato-unico',
  pa.id,
  pa.empresa_id,
  pa.responsavel_nome_origem,
  pa.responsavel_profile_id,
  a.candidato_profile_id,
  pa.pendencia_responsavel,
  false,
  'match_exato_unico'
FROM _p2c_aprovados a
JOIN public.plano_acao pa ON pa.id = a.plano_id;

-- 5. UPDATE final restrito aos 7 (aborta se afetar quantidade diferente)
DO $$
DECLARE v_upd int;
BEGIN
  WITH upd AS (
    UPDATE public.plano_acao pa
    SET responsavel_profile_id = a.candidato_profile_id,
        pendencia_responsavel  = false,
        updated_at             = now()
    FROM _p2c_aprovados a
    WHERE pa.id = a.plano_id
      AND pa.deleted_at IS NULL
      AND pa.responsavel_profile_id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_upd FROM upd;
  IF v_upd <> 7 THEN
    RAISE EXCEPTION 'TRAVADO_POR_DIVERGENCIA_P2C_BACKFILL: UPDATE afetou % linhas, esperado 7', v_upd;
  END IF;
END $$;

COMMIT;