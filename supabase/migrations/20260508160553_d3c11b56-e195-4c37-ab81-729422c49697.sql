-- =========================================================================
-- MÓDULO PLANO DE AÇÕES (Gerenciador de Tarefas Nascimento)
-- Parte 1/2: Schema, RLS, funções e RPC de carga
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.plano_acao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  id_importacao text,
  linha_csv int,
  ordem int,
  titulo text,
  comite text,
  area text,
  prioridade_original text,
  prioridade_normalizada text,
  problema text,
  acao text,
  responsavel_profile_id uuid REFERENCES public.profiles(id),
  responsavel_nome_origem text,
  lider_comite_profile_id uuid REFERENCES public.profiles(id),
  lider_comite_nome_origem text,
  lider_setor_profile_id uuid REFERENCES public.profiles(id),
  lider_setor_nome_origem text,
  duracao_original text,
  data_acao date,
  data_acao_original text,
  data_inicio_planejado date,
  data_inicio_planejado_original text,
  data_fim_planejado date,
  data_fim_planejado_original text,
  data_inicio_real date,
  data_inicio_real_original text,
  data_fim_real date,
  data_fim_real_original text,
  status_original text,
  status_normalizado text NOT NULL DEFAULT 'a_definir',
  comentarios text,
  validacao_original text,
  score_inicio_original text,
  score_fim_original text,
  pontuacao_original text,
  score_geral_original text,
  today_original text,
  pendencias_iniciais text[] NOT NULL DEFAULT '{}',
  pendencia_responsavel boolean NOT NULL DEFAULT false,
  pendencia_datas boolean NOT NULL DEFAULT false,
  pendencia_evidencia boolean NOT NULL DEFAULT false,
  custo_previsto numeric NOT NULL DEFAULT 0,
  custo_realizado numeric NOT NULL DEFAULT 0,
  centro_custo_id uuid REFERENCES public.centros_custo(id),
  contrato_id uuid REFERENCES public.contrato(id),
  hash_origem text,
  metadata_origem jsonb,
  origem text NOT NULL DEFAULT 'prompt_csv_inicial',
  arquivo_origem text DEFAULT 'Gerenciamento de Tarefas - Nascimento - Tático - Plano de Ações.csv',
  criado_por uuid REFERENCES public.profiles(id),
  atualizado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS plano_acao_empresa_id_importacao_uk
  ON public.plano_acao(empresa_id, id_importacao) WHERE id_importacao IS NOT NULL;
CREATE INDEX IF NOT EXISTS plano_acao_empresa_status_idx
  ON public.plano_acao(empresa_id, status_normalizado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS plano_acao_empresa_responsavel_idx
  ON public.plano_acao(empresa_id, responsavel_profile_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.plano_acao_comentario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  plano_acao_id uuid NOT NULL REFERENCES public.plano_acao(id) ON DELETE CASCADE,
  comentario text NOT NULL,
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plano_acao_coment_empresa_acao_idx ON public.plano_acao_comentario(empresa_id, plano_acao_id);

CREATE TABLE IF NOT EXISTS public.plano_acao_anexo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  plano_acao_id uuid NOT NULL REFERENCES public.plano_acao(id) ON DELETE CASCADE,
  bucket text NOT NULL DEFAULT 'anexos',
  storage_path text NOT NULL,
  nome_arquivo text NOT NULL,
  tipo_mime text,
  tamanho_bytes bigint,
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plano_acao_anexo_empresa_acao_idx ON public.plano_acao_anexo(empresa_id, plano_acao_id);

CREATE TABLE IF NOT EXISTS public.plano_acao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  plano_acao_id uuid NOT NULL REFERENCES public.plano_acao(id) ON DELETE CASCADE,
  evento text NOT NULL,
  campo text,
  valor_anterior text,
  valor_novo text,
  metadata jsonb,
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plano_acao_hist_empresa_acao_idx ON public.plano_acao_historico(empresa_id, plano_acao_id);

CREATE TABLE IF NOT EXISTS public.plano_acao_import_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  arquivo_nome text,
  total_linhas int NOT NULL DEFAULT 0,
  total_importado int NOT NULL DEFAULT 0,
  total_pendente int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  metadata jsonb,
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plano_acao_import_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  batch_id uuid NOT NULL REFERENCES public.plano_acao_import_batch(id) ON DELETE CASCADE,
  plano_acao_id uuid REFERENCES public.plano_acao(id) ON DELETE SET NULL,
  linha_csv int,
  id_importacao text,
  hash_origem text,
  payload_original jsonb,
  pendencias text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'inserido',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plano_acao_import_item_batch_idx ON public.plano_acao_import_item(batch_id);

CREATE TABLE IF NOT EXISTS public.plano_acao_usuario_permissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pode_visualizar boolean NOT NULL DEFAULT false,
  pode_dashboard boolean NOT NULL DEFAULT false,
  pode_criar boolean NOT NULL DEFAULT false,
  pode_editar boolean NOT NULL DEFAULT false,
  pode_excluir boolean NOT NULL DEFAULT false,
  pode_importar boolean NOT NULL DEFAULT false,
  pode_aprovar boolean NOT NULL DEFAULT false,
  pode_administrar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, profile_id)
);

-- Triggers de timestamp
CREATE OR REPLACE FUNCTION public.plano_acao_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $f$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$f$;

DROP TRIGGER IF EXISTS plano_acao_updated_at ON public.plano_acao;
CREATE TRIGGER plano_acao_updated_at BEFORE UPDATE ON public.plano_acao
FOR EACH ROW EXECUTE FUNCTION public.plano_acao_set_updated_at();

DROP TRIGGER IF EXISTS plano_acao_perm_updated_at ON public.plano_acao_usuario_permissao;
CREATE TRIGGER plano_acao_perm_updated_at BEFORE UPDATE ON public.plano_acao_usuario_permissao
FOR EACH ROW EXECUTE FUNCTION public.plano_acao_set_updated_at();

-- Função de acesso (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.plano_acao_can_access(
  p_user_id uuid, p_empresa_id uuid, p_permission text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_flag boolean; v_user_emp uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  IF public.has_role(p_user_id, 'admin'::app_role) THEN RETURN true; END IF;
  v_user_emp := public.get_user_empresa(p_user_id);
  IF v_user_emp IS DISTINCT FROM p_empresa_id THEN RETURN false; END IF;
  EXECUTE format(
    'SELECT %I FROM public.plano_acao_usuario_permissao WHERE empresa_id = $1 AND profile_id = $2',
    'pode_' || p_permission
  ) INTO v_flag USING p_empresa_id, p_user_id;
  RETURN COALESCE(v_flag, false);
EXCEPTION WHEN undefined_column THEN RETURN false;
END;
$f$;

-- RLS
ALTER TABLE public.plano_acao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_acao_comentario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_acao_anexo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_acao_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_acao_import_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_acao_import_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_acao_usuario_permissao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_select ON public.plano_acao;
CREATE POLICY pa_select ON public.plano_acao FOR SELECT TO authenticated
  USING (public.plano_acao_can_access(auth.uid(), empresa_id, 'visualizar'));
DROP POLICY IF EXISTS pa_insert ON public.plano_acao;
CREATE POLICY pa_insert ON public.plano_acao FOR INSERT TO authenticated
  WITH CHECK (public.plano_acao_can_access(auth.uid(), empresa_id, 'criar'));
DROP POLICY IF EXISTS pa_update ON public.plano_acao;
CREATE POLICY pa_update ON public.plano_acao FOR UPDATE TO authenticated
  USING (public.plano_acao_can_access(auth.uid(), empresa_id, 'editar'))
  WITH CHECK (public.plano_acao_can_access(auth.uid(), empresa_id, 'editar'));
DROP POLICY IF EXISTS pa_delete ON public.plano_acao;
CREATE POLICY pa_delete ON public.plano_acao FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS pac_select ON public.plano_acao_comentario;
CREATE POLICY pac_select ON public.plano_acao_comentario FOR SELECT TO authenticated
  USING (public.plano_acao_can_access(auth.uid(), empresa_id, 'visualizar'));
DROP POLICY IF EXISTS pac_insert ON public.plano_acao_comentario;
CREATE POLICY pac_insert ON public.plano_acao_comentario FOR INSERT TO authenticated
  WITH CHECK (public.plano_acao_can_access(auth.uid(), empresa_id, 'visualizar'));
DROP POLICY IF EXISTS pac_update ON public.plano_acao_comentario;
CREATE POLICY pac_update ON public.plano_acao_comentario FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS pac_delete ON public.plano_acao_comentario;
CREATE POLICY pac_delete ON public.plano_acao_comentario FOR DELETE TO authenticated
  USING (criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS paa_select ON public.plano_acao_anexo;
CREATE POLICY paa_select ON public.plano_acao_anexo FOR SELECT TO authenticated
  USING (public.plano_acao_can_access(auth.uid(), empresa_id, 'visualizar'));
DROP POLICY IF EXISTS paa_insert ON public.plano_acao_anexo;
CREATE POLICY paa_insert ON public.plano_acao_anexo FOR INSERT TO authenticated
  WITH CHECK (public.plano_acao_can_access(auth.uid(), empresa_id, 'editar'));
DROP POLICY IF EXISTS paa_delete ON public.plano_acao_anexo;
CREATE POLICY paa_delete ON public.plano_acao_anexo FOR DELETE TO authenticated
  USING (public.plano_acao_can_access(auth.uid(), empresa_id, 'editar'));

DROP POLICY IF EXISTS pah_select ON public.plano_acao_historico;
CREATE POLICY pah_select ON public.plano_acao_historico FOR SELECT TO authenticated
  USING (public.plano_acao_can_access(auth.uid(), empresa_id, 'visualizar'));
DROP POLICY IF EXISTS pah_insert ON public.plano_acao_historico;
CREATE POLICY pah_insert ON public.plano_acao_historico FOR INSERT TO authenticated
  WITH CHECK (public.plano_acao_can_access(auth.uid(), empresa_id, 'visualizar'));

DROP POLICY IF EXISTS paib_select ON public.plano_acao_import_batch;
CREATE POLICY paib_select ON public.plano_acao_import_batch FOR SELECT TO authenticated
  USING (public.plano_acao_can_access(auth.uid(), empresa_id, 'visualizar'));
DROP POLICY IF EXISTS paib_insert ON public.plano_acao_import_batch;
CREATE POLICY paib_insert ON public.plano_acao_import_batch FOR INSERT TO authenticated
  WITH CHECK (public.plano_acao_can_access(auth.uid(), empresa_id, 'importar'));

DROP POLICY IF EXISTS paii_select ON public.plano_acao_import_item;
CREATE POLICY paii_select ON public.plano_acao_import_item FOR SELECT TO authenticated
  USING (public.plano_acao_can_access(auth.uid(), empresa_id, 'visualizar'));
DROP POLICY IF EXISTS paii_insert ON public.plano_acao_import_item;
CREATE POLICY paii_insert ON public.plano_acao_import_item FOR INSERT TO authenticated
  WITH CHECK (public.plano_acao_can_access(auth.uid(), empresa_id, 'importar'));

DROP POLICY IF EXISTS pap_select ON public.plano_acao_usuario_permissao;
CREATE POLICY pap_select ON public.plano_acao_usuario_permissao FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.plano_acao_can_access(auth.uid(), empresa_id, 'administrar')
  );
DROP POLICY IF EXISTS pap_insert ON public.plano_acao_usuario_permissao;
CREATE POLICY pap_insert ON public.plano_acao_usuario_permissao FOR INSERT TO authenticated
  WITH CHECK (public.plano_acao_can_access(auth.uid(), empresa_id, 'administrar'));
DROP POLICY IF EXISTS pap_update ON public.plano_acao_usuario_permissao;
CREATE POLICY pap_update ON public.plano_acao_usuario_permissao FOR UPDATE TO authenticated
  USING (public.plano_acao_can_access(auth.uid(), empresa_id, 'administrar'))
  WITH CHECK (public.plano_acao_can_access(auth.uid(), empresa_id, 'administrar'));
DROP POLICY IF EXISTS pap_delete ON public.plano_acao_usuario_permissao;
CREATE POLICY pap_delete ON public.plano_acao_usuario_permissao FOR DELETE TO authenticated
  USING (public.plano_acao_can_access(auth.uid(), empresa_id, 'administrar'));

-- Triggers de negócio
CREATE OR REPLACE FUNCTION public.plano_acao_log_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status_normalizado IS DISTINCT FROM OLD.status_normalizado THEN
      INSERT INTO public.plano_acao_historico(empresa_id, plano_acao_id, evento, campo, valor_anterior, valor_novo, criado_por)
      VALUES (NEW.empresa_id, NEW.id, 'status_alterado', 'status_normalizado', OLD.status_normalizado, NEW.status_normalizado, NEW.atualizado_por);
    END IF;
    IF NEW.responsavel_profile_id IS DISTINCT FROM OLD.responsavel_profile_id THEN
      INSERT INTO public.plano_acao_historico(empresa_id, plano_acao_id, evento, campo, valor_anterior, valor_novo, criado_por)
      VALUES (NEW.empresa_id, NEW.id, 'responsavel_alterado', 'responsavel_profile_id', OLD.responsavel_profile_id::text, NEW.responsavel_profile_id::text, NEW.atualizado_por);
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.plano_acao_historico(empresa_id, plano_acao_id, evento, campo, valor_anterior, valor_novo, criado_por)
      VALUES (NEW.empresa_id, NEW.id, 'excluida_logicamente', 'deleted_at', NULL, NEW.deleted_at::text, NEW.atualizado_por);
    END IF;
  END IF;
  RETURN NEW;
END;
$f$;

DROP TRIGGER IF EXISTS plano_acao_history_trg ON public.plano_acao;
CREATE TRIGGER plano_acao_history_trg AFTER UPDATE ON public.plano_acao
FOR EACH ROW EXECUTE FUNCTION public.plano_acao_log_history();

CREATE OR REPLACE FUNCTION public.plano_acao_validar_conclusao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_anexos int;
BEGIN
  IF NEW.status_normalizado = 'concluida_validada' THEN
    SELECT count(*) INTO v_anexos FROM public.plano_acao_anexo WHERE plano_acao_id = NEW.id;
    IF v_anexos = 0 THEN
      RAISE EXCEPTION 'Ação só pode ser validada com pelo menos um anexo de evidência.';
    END IF;
    IF NEW.custo_realizado > 0 AND NEW.centro_custo_id IS NULL AND NEW.contrato_id IS NULL THEN
      RAISE EXCEPTION 'Custo realizado > 0 exige centro de custo ou contrato vinculado para validar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$f$;

DROP TRIGGER IF EXISTS plano_acao_validar_trg ON public.plano_acao;
CREATE TRIGGER plano_acao_validar_trg BEFORE INSERT OR UPDATE ON public.plano_acao
FOR EACH ROW EXECUTE FUNCTION public.plano_acao_validar_conclusao();

-- RPC de seed/importação idempotente
CREATE OR REPLACE FUNCTION public.plano_acao_seed_inicial(_empresa uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_batch_id uuid;
  v_item jsonb;
  v_total int := 0;
  v_inseridas int := 0;
  v_atualizadas int := 0;
  v_pendentes int := 0;
  v_id uuid;
  v_was_insert boolean;
  v_resp uuid; v_lc uuid; v_ls uuid;
  v_pendencias text[];
  v_pend_resp boolean;
  v_pend_dat boolean;
  v_pend_ev boolean;
  v_status text;
BEGIN
  INSERT INTO public.plano_acao_import_batch(empresa_id, arquivo_nome, total_linhas, status, metadata)
  VALUES (_empresa,
          'Gerenciamento de Tarefas - Nascimento - Tático - Plano de Ações.csv',
          jsonb_array_length(_payload),
          'em_processamento',
          jsonb_build_object('origem','prompt_csv_inicial'))
  RETURNING id INTO v_batch_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_payload) LOOP
    v_total := v_total + 1;
    v_resp := NULL; v_lc := NULL; v_ls := NULL;

    IF v_item ? 'responsavel_nome_origem' AND COALESCE(v_item->>'responsavel_nome_origem','') <> '' THEN
      SELECT id INTO v_resp FROM public.profiles
       WHERE empresa_id = _empresa
         AND lower(coalesce(display_name,'')) ILIKE '%' || lower((v_item->>'responsavel_nome_origem')) || '%'
       ORDER BY display_name LIMIT 1;
    END IF;
    IF v_item ? 'lider_comite_nome_origem' AND COALESCE(v_item->>'lider_comite_nome_origem','') <> '' THEN
      SELECT id INTO v_lc FROM public.profiles
       WHERE empresa_id = _empresa
         AND lower(coalesce(display_name,'')) ILIKE '%' || lower((v_item->>'lider_comite_nome_origem')) || '%'
       ORDER BY display_name LIMIT 1;
    END IF;
    IF v_item ? 'lider_setor_nome_origem' AND COALESCE(v_item->>'lider_setor_nome_origem','') <> '' THEN
      SELECT id INTO v_ls FROM public.profiles
       WHERE empresa_id = _empresa
         AND lower(coalesce(display_name,'')) ILIKE '%' || lower((v_item->>'lider_setor_nome_origem')) || '%'
       ORDER BY display_name LIMIT 1;
    END IF;

    v_pendencias := COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(v_item->'pendencias_iniciais')),
      ARRAY[]::text[]
    );
    IF v_resp IS NULL AND COALESCE(v_item->>'responsavel_nome_origem','') <> '' THEN
      v_pendencias := array_append(v_pendencias, 'PENDENTE_RESPONSAVEL_ORIGEM_NAO_CASOU');
    END IF;

    v_pend_resp := v_resp IS NULL;
    v_pend_dat  := 'PENDENTE_DATAS_PLANEJADAS' = ANY(v_pendencias);
    v_pend_ev   := 'PENDENTE_EVIDENCIA_CONCLUSAO_LEGADA' = ANY(v_pendencias);
    v_status := COALESCE(v_item->>'status_normalizado','a_definir');

    INSERT INTO public.plano_acao(
      empresa_id, id_importacao, linha_csv, ordem, titulo, comite, area,
      prioridade_original, prioridade_normalizada, problema, acao,
      responsavel_profile_id, responsavel_nome_origem,
      lider_comite_profile_id, lider_comite_nome_origem,
      lider_setor_profile_id, lider_setor_nome_origem,
      duracao_original,
      data_acao_original, data_inicio_planejado_original, data_fim_planejado_original,
      data_inicio_real_original, data_fim_real_original,
      status_original, status_normalizado, comentarios, validacao_original,
      score_inicio_original, score_fim_original, pontuacao_original, score_geral_original,
      today_original, pendencias_iniciais,
      pendencia_responsavel, pendencia_datas, pendencia_evidencia,
      hash_origem, metadata_origem, origem
    ) VALUES (
      _empresa, v_item->>'id_importacao',
      NULLIF(v_item->>'linha_csv','')::int, NULLIF(v_item->>'ordem','')::int,
      v_item->>'titulo_sugerido', v_item->>'comite', v_item->>'area',
      v_item->>'prioridade_original', v_item->>'prioridade_normalizada',
      v_item->>'problema', v_item->>'acao',
      v_resp, v_item->>'responsavel_nome_origem',
      v_lc, v_item->>'lider_comite_nome_origem',
      v_ls, v_item->>'lider_setor_nome_origem',
      v_item->>'duracao_original',
      v_item->>'data_acao_original',
      v_item->>'data_inicio_planejado_original',
      v_item->>'data_fim_planejado_original',
      v_item->>'data_inicio_real_original',
      v_item->>'data_fim_real_original',
      v_item->>'status_original', v_status,
      v_item->>'comentarios', v_item->>'validacao_original',
      v_item->>'score_inicio_original', v_item->>'score_fim_original',
      v_item->>'pontuacao_original', v_item->>'score_geral_original',
      v_item->>'today_original', v_pendencias,
      v_pend_resp, v_pend_dat, v_pend_ev,
      v_item->>'hash_origem', v_item, 'prompt_csv_inicial'
    )
    ON CONFLICT (empresa_id, id_importacao) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      comite = EXCLUDED.comite,
      area = EXCLUDED.area,
      prioridade_original = EXCLUDED.prioridade_original,
      prioridade_normalizada = EXCLUDED.prioridade_normalizada,
      problema = EXCLUDED.problema,
      acao = EXCLUDED.acao,
      responsavel_profile_id = EXCLUDED.responsavel_profile_id,
      responsavel_nome_origem = EXCLUDED.responsavel_nome_origem,
      lider_comite_profile_id = EXCLUDED.lider_comite_profile_id,
      lider_comite_nome_origem = EXCLUDED.lider_comite_nome_origem,
      lider_setor_profile_id = EXCLUDED.lider_setor_profile_id,
      lider_setor_nome_origem = EXCLUDED.lider_setor_nome_origem,
      status_original = EXCLUDED.status_original,
      status_normalizado = CASE
        WHEN public.plano_acao.status_normalizado IN ('aguardando_validacao','concluida_validada','cancelada')
          THEN public.plano_acao.status_normalizado
        ELSE EXCLUDED.status_normalizado
      END,
      comentarios = EXCLUDED.comentarios,
      pendencias_iniciais = EXCLUDED.pendencias_iniciais,
      pendencia_responsavel = EXCLUDED.pendencia_responsavel,
      pendencia_datas = EXCLUDED.pendencia_datas,
      pendencia_evidencia = EXCLUDED.pendencia_evidencia,
      hash_origem = EXCLUDED.hash_origem,
      metadata_origem = EXCLUDED.metadata_origem,
      updated_at = now()
    RETURNING id, (xmax = 0) INTO v_id, v_was_insert;

    IF v_was_insert THEN v_inseridas := v_inseridas + 1;
    ELSE v_atualizadas := v_atualizadas + 1;
    END IF;
    IF array_length(v_pendencias,1) IS NOT NULL THEN v_pendentes := v_pendentes + 1; END IF;

    INSERT INTO public.plano_acao_import_item(
      empresa_id, batch_id, plano_acao_id, linha_csv, id_importacao,
      hash_origem, payload_original, pendencias, status
    ) VALUES (
      _empresa, v_batch_id, v_id,
      NULLIF(v_item->>'linha_csv','')::int,
      v_item->>'id_importacao',
      v_item->>'hash_origem',
      v_item, v_pendencias,
      CASE WHEN v_was_insert THEN 'inserido' ELSE 'atualizado' END
    );
  END LOOP;

  UPDATE public.plano_acao_import_batch
     SET total_importado = v_inseridas + v_atualizadas,
         total_pendente = v_pendentes,
         status = 'concluido'
   WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'recebidas', jsonb_array_length(_payload),
    'processadas', v_total,
    'inseridas', v_inseridas,
    'atualizadas', v_atualizadas,
    'pendentes', v_pendentes
  );
END;
$f$;

-- ACL inicial: Erica, Yuri, Helena (todas as flags = true)
INSERT INTO public.plano_acao_usuario_permissao(
  empresa_id, profile_id,
  pode_visualizar, pode_dashboard, pode_criar, pode_editar,
  pode_excluir, pode_importar, pode_aprovar, pode_administrar
)
SELECT '5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid, p.id, true, true, true, true, true, true, true, true
  FROM public.profiles p
 WHERE p.id IN (
   'ab761a12-197b-403b-809f-0f53a36a16e2'::uuid,
   '3baeb855-5389-4459-93f4-759ee82b288e'::uuid,
   '60e5bb0a-c0ae-4434-950f-9fdaecb01ea7'::uuid
 )
ON CONFLICT (empresa_id, profile_id) DO UPDATE SET
  pode_visualizar = true, pode_dashboard = true, pode_criar = true,
  pode_editar = true, pode_excluir = true, pode_importar = true,
  pode_aprovar = true, pode_administrar = true,
  updated_at = now();