
-- ============================================================
-- 1) STG_COLABORADORES_BASE: novas colunas
-- ============================================================
ALTER TABLE public.stg_colaboradores_base
  ADD COLUMN IF NOT EXISTS matricula        text,
  ADD COLUMN IF NOT EXISTS cargo            text,
  ADD COLUMN IF NOT EXISTS salario_base     numeric,
  ADD COLUMN IF NOT EXISTS data_admissao    date,
  ADD COLUMN IF NOT EXISTS data_demissao    date,
  ADD COLUMN IF NOT EXISTS data_nascimento  date,
  ADD COLUMN IF NOT EXISTS genero           text,
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS telefone         text,
  ADD COLUMN IF NOT EXISTS rg               text,
  ADD COLUMN IF NOT EXISTS pis_pasep        text,
  ADD COLUMN IF NOT EXISTS departamento     text,
  ADD COLUMN IF NOT EXISTS jornada          text,
  ADD COLUMN IF NOT EXISTS cbo              text,
  ADD COLUMN IF NOT EXISTS tipo_contrato    text,
  ADD COLUMN IF NOT EXISTS gestor_direto    text,
  ADD COLUMN IF NOT EXISTS endereco_cep     text,
  ADD COLUMN IF NOT EXISTS endereco_rua     text,
  ADD COLUMN IF NOT EXISTS endereco_numero  text,
  ADD COLUMN IF NOT EXISTS endereco_bairro  text,
  ADD COLUMN IF NOT EXISTS endereco_cidade  text,
  ADD COLUMN IF NOT EXISTS endereco_uf      text,
  ADD COLUMN IF NOT EXISTS observacoes      text;

-- ============================================================
-- 2) COLABORADOR: novas colunas extras (compatíveis com cadastro completo)
-- ============================================================
ALTER TABLE public.colaborador
  ADD COLUMN IF NOT EXISTS data_nascimento  date,
  ADD COLUMN IF NOT EXISTS genero           text,
  ADD COLUMN IF NOT EXISTS rg               text,
  ADD COLUMN IF NOT EXISTS pis_pasep        text,
  ADD COLUMN IF NOT EXISTS departamento     text,
  ADD COLUMN IF NOT EXISTS jornada          text,
  ADD COLUMN IF NOT EXISTS cbo              text,
  ADD COLUMN IF NOT EXISTS tipo_contrato    text,
  ADD COLUMN IF NOT EXISTS gestor_direto    text,
  ADD COLUMN IF NOT EXISTS endereco_cep     text,
  ADD COLUMN IF NOT EXISTS endereco_rua     text,
  ADD COLUMN IF NOT EXISTS endereco_numero  text,
  ADD COLUMN IF NOT EXISTS endereco_bairro  text,
  ADD COLUMN IF NOT EXISTS endereco_cidade  text,
  ADD COLUMN IF NOT EXISTS endereco_uf      text,
  ADD COLUMN IF NOT EXISTS foto_path        text;

-- ============================================================
-- 3) STORAGE bucket "colaboradores-fotos"
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('colaboradores-fotos', 'colaboradores-fotos', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "colab fotos público leitura"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'colaboradores-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "colab fotos upload autenticado"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'colaboradores-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "colab fotos update autenticado"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'colaboradores-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "colab fotos delete autenticado"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'colaboradores-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 4) MAPEAMENTOS: repopular integration_layout_columns p/ colaborador_full_v1
-- ============================================================
DELETE FROM public.integration_layout_columns
 WHERE layout_id = '5e665fae-d33b-4136-a9ed-387e49c3e77d';

INSERT INTO public.integration_layout_columns
  (layout_id, nome_origem, nome_destino, aliases, tipo_dado, obrigatorio, ordem)
VALUES
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Nome','nome',
    ARRAY['nome colaborador','funcionario','funcionário','nome_completo','nome completo','colaborador'],
    'texto', true, 1),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','CPF','cpf',
    ARRAY['cpf_colaborador','documento','cpf/cnpj','cpf cnpj','nro cpf'],
    'texto', true, 2),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Matrícula','matricula',
    ARRAY['matricula','registro','cadastro','chapa','nro matricula','nro registro'],
    'texto', false, 3),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Cargo','cargo',
    ARRAY['função','funcao','cargo atual','descricao cargo','descrição cargo','posto'],
    'texto', false, 4),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Salário Base','salario_base',
    ARRAY['salario','salário','salario base','salário base','remuneracao','remuneração',
          'vencimento','vencimentos','salario_atual','salário atual','sal_base','valor salario'],
    'numero', false, 5),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Data Admissão','data_admissao',
    ARRAY['admissao','admissão','dt admissao','dt admissão','data de admissao',
          'data de admissão','data_admissao','dt_admissao','admitido em'],
    'data', false, 6),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Data Demissão','data_demissao',
    ARRAY['demissao','demissão','dt demissao','data de demissao','data de demissão',
          'desligamento','data desligamento','dt_demissao'],
    'data', false, 7),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Data Nascimento','data_nascimento',
    ARRAY['nascimento','dt nascimento','data de nascimento','dt_nasc','nasc'],
    'data', false, 8),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Gênero','genero',
    ARRAY['genero','sexo'],
    'texto', false, 9),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','E-mail','email',
    ARRAY['email','e-mail pessoal','email pessoal','e-mail','correio'],
    'texto', false, 10),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Telefone','telefone',
    ARRAY['fone','celular','telefone celular','tel','contato'],
    'texto', false, 11),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','RG','rg',
    ARRAY['rg','identidade','nro rg'],
    'texto', false, 12),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','PIS/PASEP','pis_pasep',
    ARRAY['pis','pasep','pis pasep','nis','nit'],
    'texto', false, 13),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Departamento','departamento',
    ARRAY['depto','area','área','setor','lotação','lotacao'],
    'texto', false, 14),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Jornada','jornada',
    ARRAY['jornada de trabalho','carga horaria','carga horária','horário'],
    'texto', false, 15),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','CBO','cbo',
    ARRAY['cbo','codigo cbo','classificação cbo','classificacao cbo'],
    'texto', false, 16),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Tipo de Contrato','tipo_contrato',
    ARRAY['tipo contrato','vinculo','vínculo','regime','clt','contrato'],
    'texto', false, 17),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Gestor Direto','gestor_direto',
    ARRAY['gestor','superior','lider','líder','chefe imediato','responsavel'],
    'texto', false, 18),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','CEP','endereco_cep',
    ARRAY['cep','endereço cep'], 'texto', false, 19),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Rua','endereco_rua',
    ARRAY['rua','endereco','endereço','logradouro'], 'texto', false, 20),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Número','endereco_numero',
    ARRAY['numero','número','nro endereco','nro'], 'texto', false, 21),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Bairro','endereco_bairro',
    ARRAY['bairro'], 'texto', false, 22),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Cidade','endereco_cidade',
    ARRAY['cidade','municipio','município'], 'texto', false, 23),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','UF','endereco_uf',
    ARRAY['uf','estado'], 'texto', false, 24),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Filial','filial',
    ARRAY['filial','unidade','apelido_filial'], 'texto', false, 25),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Empresa','empresa_origem',
    ARRAY['empresa','razao_social','razão social'], 'texto', false, 26),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Situação','situacao',
    ARRAY['situacao','status','descricao_situacao','descrição situação'],
    'texto', false, 27),
  ('5e665fae-d33b-4136-a9ed-387e49c3e77d','Observações','observacoes',
    ARRAY['observacao','observação','obs','observacoes','notas','comentarios'],
    'texto', false, 28);

-- ============================================================
-- 5) MATERIALIZE STAGING — versão com depuração
--    Reporta colunas desconhecidas como 'informativo' p/ depuração
--    Também tenta normalizar datas (formatos comuns dd/mm/aaaa, aaaa-mm-dd)
-- ============================================================
CREATE OR REPLACE FUNCTION public.integration_materialize_staging(p_batch_file_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_file       record;
  v_layout     record;
  v_empresa    uuid;
  v_caller_emp uuid;
  v_is_admin   boolean;
  v_col        record;
  v_alias_map  jsonb := '{}'::jsonb;
  v_required   text[] := '{}';
  v_optional   text[] := '{}';
  v_numeric    text[] := '{}';
  v_dates      text[] := '{}';
  v_known_cols text[] := '{}';
  v_row        jsonb;
  v_idx        int := 0;
  v_inserted   int := 0;
  v_errors     int := 0;
  v_keys       text[];
  v_vals       text[];
  v_sql        text;
  v_missing    text[];
  v_alias      text;
  v_payload    jsonb;
  v_unknown    jsonb := '{}'::jsonb;  -- colunas desconhecidas (depuração)
BEGIN
  SELECT bf.*, b.empresa_id AS batch_empresa
    INTO v_file
    FROM public.integration_batch_files bf
    JOIN public.integration_batches b ON b.id = bf.batch_id
   WHERE bf.id = p_batch_file_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch_file não encontrado'; END IF;
  IF v_file.layout_detectado_id IS NULL THEN RAISE EXCEPTION 'arquivo sem layout detectado'; END IF;

  v_empresa := v_file.empresa_id;
  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  SELECT empresa_id INTO v_caller_emp FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_admin AND (v_caller_emp IS NULL OR v_caller_emp <> v_empresa) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_layout FROM public.integration_layouts WHERE id = v_file.layout_detectado_id;

  FOR v_col IN
    SELECT nome_destino, nome_origem, aliases, obrigatorio, tipo_dado
      FROM public.integration_layout_columns
     WHERE layout_id = v_layout.id
  LOOP
    v_known_cols := array_append(v_known_cols, v_col.nome_destino);
    v_alias_map := v_alias_map || jsonb_build_object(
      regexp_replace(lower(unaccent_safe(v_col.nome_origem)), '[^a-z0-9]+', '_', 'g'),
      v_col.nome_destino
    );
    IF v_col.aliases IS NOT NULL THEN
      FOREACH v_alias IN ARRAY v_col.aliases LOOP
        v_alias_map := v_alias_map || jsonb_build_object(
          regexp_replace(lower(unaccent_safe(v_alias)), '[^a-z0-9]+', '_', 'g'),
          v_col.nome_destino
        );
      END LOOP;
    END IF;
    v_alias_map := v_alias_map || jsonb_build_object(
      regexp_replace(lower(v_col.nome_destino), '[^a-z0-9]+', '_', 'g'),
      v_col.nome_destino
    );
    IF v_col.obrigatorio THEN v_required := array_append(v_required, v_col.nome_destino);
    ELSE v_optional := array_append(v_optional, v_col.nome_destino); END IF;
    IF v_col.tipo_dado IN ('numero','numeric','decimal') THEN
      v_numeric := array_append(v_numeric, v_col.nome_destino);
    END IF;
    IF v_col.tipo_dado = 'data' THEN
      v_dates := array_append(v_dates, v_col.nome_destino);
    END IF;
  END LOOP;

  DELETE FROM public.integration_validation_results
   WHERE batch_id = v_file.batch_id;

  EXECUTE format('DELETE FROM public.%I WHERE batch_id = %L', v_layout.staging_tabela, v_file.batch_id);

  UPDATE public.integration_batches
     SET status = 'processando'::integ_batch_status, updated_at = now(),
         total_linhas = 0, linhas_validas = 0, linhas_invalidas = 0
   WHERE id = v_file.batch_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;
    v_payload := '{}'::jsonb;

    DECLARE
      k text; val jsonb; dest text; norm text;
    BEGIN
      FOR k, val IN SELECT * FROM jsonb_each(v_row) LOOP
        norm := regexp_replace(lower(unaccent_safe(k)), '[^a-z0-9]+', '_', 'g');
        dest := v_alias_map->>norm;
        IF dest IS NOT NULL THEN
          v_payload := v_payload || jsonb_build_object(dest, val);
        ELSE
          -- registra coluna desconhecida (somente uma vez por planilha)
          IF (v_unknown ? k) IS NOT TRUE THEN
            v_unknown := v_unknown || jsonb_build_object(k, true);
          END IF;
        END IF;
      END LOOP;
    END;

    -- Normalização básica de datas (dd/mm/aaaa -> aaaa-mm-dd)
    DECLARE dcol text; dval text; mtch text[];
    BEGIN
      FOREACH dcol IN ARRAY v_dates LOOP
        dval := v_payload->>dcol;
        IF dval IS NOT NULL AND dval <> '' THEN
          mtch := regexp_match(dval, '^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$');
          IF mtch IS NOT NULL THEN
            v_payload := v_payload || jsonb_build_object(
              dcol,
              to_jsonb(
                CASE WHEN length(mtch[3])=2 THEN '20'||mtch[3] ELSE mtch[3] END
                || '-' || lpad(mtch[2],2,'0') || '-' || lpad(mtch[1],2,'0')
              )
            );
          END IF;
        END IF;
      END LOOP;
    END;

    v_missing := ARRAY(
      SELECT r FROM unnest(v_required) r
       WHERE v_payload->>r IS NULL OR v_payload->>r = ''
    );
    IF array_length(v_missing,1) > 0 THEN
      INSERT INTO public.integration_validation_results
        (batch_id, empresa_id, rule_codigo, severidade, linha_origem, campo, mensagem, valor_recebido)
      SELECT v_file.batch_id, v_empresa, 'OBRIGATORIO', 'bloqueante'::integ_validation_severity,
             v_idx, m, 'Campo obrigatório ausente: ' || m, NULL
        FROM unnest(v_missing) m;
      v_errors := v_errors + array_length(v_missing,1);
      CONTINUE;
    END IF;

    DECLARE n text; bad boolean := false; col text;
    BEGIN
      FOREACH col IN ARRAY v_numeric LOOP
        n := v_payload->>col;
        IF n IS NOT NULL AND n <> '' THEN
          BEGIN
            PERFORM (regexp_replace(replace(n,',','.'), '[^0-9eE+\-.]', '', 'g'))::numeric;
            -- normaliza valor numérico no payload
            v_payload := v_payload || jsonb_build_object(
              col, to_jsonb((regexp_replace(replace(n,',','.'), '[^0-9eE+\-.]', '', 'g'))::numeric)
            );
          EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.integration_validation_results
              (batch_id, empresa_id, rule_codigo, severidade, linha_origem, campo, mensagem, valor_recebido)
            VALUES (v_file.batch_id, v_empresa, 'NUMERICO_INVALIDO',
                    'bloqueante'::integ_validation_severity, v_idx, col,
                    'Valor numérico inválido: ' || n, n);
            v_errors := v_errors + 1;
            bad := true;
          END;
        END IF;
      END LOOP;
      IF bad THEN CONTINUE; END IF;
    END;

    SELECT array_agg(quote_ident(key)),
           array_agg(quote_nullable(value))
      INTO v_keys, v_vals
      FROM (
        SELECT key, value
          FROM jsonb_each_text(v_payload)
         WHERE key = ANY(v_known_cols)
      ) t;

    v_keys := array_append(v_keys, 'batch_id');
    v_vals := array_append(v_vals, quote_literal(v_file.batch_id::text) || '::uuid');
    v_keys := array_append(v_keys, 'empresa_id');
    v_vals := array_append(v_vals, quote_literal(v_empresa::text) || '::uuid');
    v_keys := array_append(v_keys, 'linha_origem');
    v_vals := array_append(v_vals, v_idx::text);
    v_keys := array_append(v_keys, 'raw');
    v_vals := array_append(v_vals, quote_literal(v_payload::text) || '::jsonb');

    BEGIN
      v_sql := format('INSERT INTO public.%I (%s) VALUES (%s)',
                      v_layout.staging_tabela,
                      array_to_string(v_keys, ','),
                      array_to_string(v_vals, ','));
      EXECUTE v_sql;
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.integration_validation_results
        (batch_id, empresa_id, rule_codigo, severidade, linha_origem, campo, mensagem, valor_recebido)
      VALUES (v_file.batch_id, v_empresa, 'INSERT_FALHOU',
              'bloqueante'::integ_validation_severity, v_idx, NULL,
              'Falha ao inserir em staging: ' || SQLERRM, v_payload::text);
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Reporta colunas desconhecidas (1 aviso por coluna)
  IF jsonb_typeof(v_unknown) = 'object' THEN
    INSERT INTO public.integration_validation_results
      (batch_id, empresa_id, rule_codigo, severidade, linha_origem, campo, mensagem, valor_recebido)
    SELECT v_file.batch_id, v_empresa, 'COLUNA_DESCONHECIDA',
           'informativo'::integ_validation_severity, NULL, k,
           'Coluna da planilha não mapeada (ignorada): ' || k, NULL
      FROM jsonb_object_keys(v_unknown) k;
  END IF;

  -- Reporta campos opcionais ausentes em ao menos uma linha (informativo, 1 por campo)
  IF v_inserted > 0 THEN
    DECLARE oc text;
    BEGIN
      FOREACH oc IN ARRAY v_optional LOOP
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_rows) r
           WHERE EXISTS (
             SELECT 1 FROM jsonb_each_text(r) e
              WHERE regexp_replace(lower(unaccent_safe(e.key)), '[^a-z0-9]+','_','g')
                    = ANY (
                      SELECT k FROM jsonb_object_keys(v_alias_map) k
                       WHERE v_alias_map->>k = oc
                    )
                AND e.value IS NOT NULL AND e.value <> ''
           )
        ) THEN
          INSERT INTO public.integration_validation_results
            (batch_id, empresa_id, rule_codigo, severidade, linha_origem, campo, mensagem, valor_recebido)
          VALUES (v_file.batch_id, v_empresa, 'OPCIONAL_AUSENTE',
                  'informativo'::integ_validation_severity, NULL, oc,
                  'Campo opcional não fornecido pela planilha: ' || oc, NULL);
        END IF;
      END LOOP;
    END;
  END IF;

  UPDATE public.integration_batch_files
     SET linhas_inseridas = v_inserted,
         materializado_em = now()
   WHERE id = p_batch_file_id;

  UPDATE public.integration_batches
     SET total_linhas = COALESCE(total_linhas,0) + v_idx,
         linhas_validas = COALESCE(linhas_validas,0) + v_inserted,
         linhas_invalidas = COALESCE(linhas_invalidas,0) + v_errors,
         status = CASE WHEN v_errors > 0
                       THEN 'validado_com_erros'::integ_batch_status
                       ELSE 'validado_ok'::integ_batch_status END,
         updated_at = now()
   WHERE id = v_file.batch_id;

  RETURN jsonb_build_object('inserted', v_inserted, 'errors', v_errors, 'total_processed', v_idx);
END;
$function$;

-- ============================================================
-- 6) PROMOTE BATCH — colaborador_full_v1 com TODOS os campos
-- ============================================================
CREATE OR REPLACE FUNCTION public.integration_promote_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_batch    record;
  v_layout   record;
  v_empresa  uuid;
  v_promoted int := 0;
  v_skipped  int := 0;
  v_msg      text := '';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_batch FROM public.integration_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'lote não encontrado'; END IF;
  IF v_batch.status <> 'aprovado' THEN
    RAISE EXCEPTION 'lote precisa estar aprovado (status atual: %)', v_batch.status;
  END IF;

  v_empresa := v_batch.empresa_id;

  FOR v_layout IN
    SELECT DISTINCT l.codigo, l.staging_tabela, l.destino_tabela
      FROM public.integration_batch_files bf
      JOIN public.integration_layouts l ON l.id = bf.layout_detectado_id
     WHERE bf.batch_id = p_batch_id
       AND bf.layout_detectado_id IS NOT NULL
  LOOP
    IF v_layout.codigo = 'licitacoes_v1' THEN
      INSERT INTO public.licitacao
        (empresa_id, numero, objeto, orgao, modalidade, abertura, observacoes,
         status, batch_id, origem_carga)
      SELECT v_empresa,
             COALESCE(NULLIF(s.edital,''), 'LIC-' || s.linha_origem),
             s.objeto, NULL, s.fase, s.data_sessao,
             trim(both ' ' from concat_ws(' | ', s.cidade, s.uf, s.status_obs, s.empresa_obs)),
             'em_andamento'::licitacao_status, p_batch_id, 'integracao'
        FROM public.stg_licitacoes s
       WHERE s.batch_id = p_batch_id;
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('licitacoes_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'contrato_master_v1' THEN
      INSERT INTO public.contrato
        (empresa_id, numero, objeto, vigencia_inicio, faturamento_mensal,
         observacoes, status, batch_id)
      SELECT v_empresa,
             COALESCE(NULLIF(s.numero_edital,''), 'CT-' || s.linha_origem),
             COALESCE(s.contrato_nome, 'Contrato sem nome'),
             COALESCE(s.data_inicio, CURRENT_DATE),
             COALESCE(s.valor_mensal, 0),
             concat_ws(' | ', 'Resp: ' || COALESCE(s.responsavel,''),
                              'Cidade: ' || COALESCE(s.cidade,''),
                              'Func: ' || COALESCE(s.quant_funcionarios::text,'')),
             'ativo'::contrato_status, p_batch_id
        FROM public.stg_contratos_master s
       WHERE s.batch_id = p_batch_id
         AND s.contrato_resolvido_id IS NULL;
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('contrato_master_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'fluxo_realizado_v1' THEN
      INSERT INTO public.realizado_lancamentos
        (empresa_id, data_lancamento, valor, descricao, contraparte,
         classificadores, hash_dedup, batch_id, pendente_conta_contabil)
      SELECT v_empresa,
             COALESCE(s.data_lancamento, CURRENT_DATE),
             COALESCE(s.valor, 0),
             COALESCE(s.historico, s.classificacao),
             s.empresa_origem,
             jsonb_build_object(
               'classificacao', s.classificacao,
               'tipo', s.tipo,
               'centro_custo', s.centro_custo_origem,
               'banco', s.banco_origem,
               'forma_pagamento', s.forma_pagamento_origem
             ),
             encode(digest(
               coalesce(s.id_origem,'') || '|' ||
               coalesce(s.data_lancamento::text,'') || '|' ||
               coalesce(s.valor::text,'') || '|' ||
               coalesce(s.historico,''), 'sha256'), 'hex'),
             p_batch_id,
             (s.conta_contabil_resolvida_id IS NULL)
        FROM public.stg_fluxo_caixa_realizado s
       WHERE s.batch_id = p_batch_id
       ON CONFLICT (hash_dedup) DO NOTHING;
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('fluxo_realizado_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'colaborador_full_v1' THEN
      WITH src AS (
        SELECT
          v_empresa AS empresa_id,
          NULLIF(regexp_replace(coalesce(s.cpf,''), '[^0-9]', '', 'g'), '') AS cpf_norm,
          NULLIF(trim(s.nome), '') AS nome,
          s.linha_origem,
          NULLIF(trim(s.matricula), '') AS matricula,
          NULLIF(trim(s.cargo), '') AS cargo,
          s.salario_base,
          s.data_admissao, s.data_demissao, s.data_nascimento,
          NULLIF(trim(s.genero),'') AS genero,
          NULLIF(trim(s.email),'') AS email,
          NULLIF(trim(s.telefone),'') AS telefone,
          NULLIF(trim(s.rg),'') AS rg,
          NULLIF(trim(s.pis_pasep),'') AS pis_pasep,
          NULLIF(trim(s.departamento),'') AS departamento,
          NULLIF(trim(s.jornada),'') AS jornada,
          NULLIF(trim(s.cbo),'') AS cbo,
          NULLIF(trim(s.tipo_contrato),'') AS tipo_contrato,
          NULLIF(trim(s.gestor_direto),'') AS gestor_direto,
          NULLIF(trim(s.endereco_cep),'') AS endereco_cep,
          NULLIF(trim(s.endereco_rua),'') AS endereco_rua,
          NULLIF(trim(s.endereco_numero),'') AS endereco_numero,
          NULLIF(trim(s.endereco_bairro),'') AS endereco_bairro,
          NULLIF(trim(s.endereco_cidade),'') AS endereco_cidade,
          NULLIF(trim(s.endereco_uf),'') AS endereco_uf,
          NULLIF(trim(s.observacoes),'') AS observacoes,
          NULLIF(trim(s.filial), '') AS filial,
          NULLIF(trim(s.situacao), '') AS situacao
        FROM public.stg_colaboradores_base s
        WHERE s.batch_id = p_batch_id
          AND coalesce(s.valido, true) = true
      ), src_clean AS (
        SELECT * FROM src
         WHERE cpf_norm IS NOT NULL AND nome IS NOT NULL
      ), src_dedup AS (
        SELECT DISTINCT ON (empresa_id, cpf_norm) *
          FROM src_clean
         ORDER BY empresa_id, cpf_norm, linha_origem
      )
      INSERT INTO public.colaborador
        (empresa_id, cpf, nome, matricula, cargo, salario_base,
         data_admissao, data_demissao, data_nascimento, genero,
         email, telefone, rg, pis_pasep, departamento, jornada,
         cbo, tipo_contrato, gestor_direto,
         endereco_cep, endereco_rua, endereco_numero,
         endereco_bairro, endereco_cidade, endereco_uf,
         status, observacoes, batch_id)
      SELECT
        d.empresa_id, d.cpf_norm, d.nome, d.matricula, d.cargo,
        COALESCE(d.salario_base, 0),
        COALESCE(d.data_admissao, CURRENT_DATE),
        d.data_demissao, d.data_nascimento, d.genero,
        d.email, d.telefone, d.rg, d.pis_pasep, d.departamento, d.jornada,
        d.cbo, d.tipo_contrato, d.gestor_direto,
        d.endereco_cep, d.endereco_rua, d.endereco_numero,
        d.endereco_bairro, d.endereco_cidade, d.endereco_uf,
        CASE
          WHEN lower(coalesce(d.situacao,'')) LIKE '%demit%' THEN 'demitido'::colab_status
          WHEN lower(coalesce(d.situacao,'')) LIKE '%afast%' THEN 'afastado'::colab_status
          WHEN lower(coalesce(d.situacao,'')) LIKE '%feria%' THEN 'ferias'::colab_status
          WHEN d.data_demissao IS NOT NULL THEN 'demitido'::colab_status
          ELSE 'ativo'::colab_status
        END,
        NULLIF(concat_ws(' | ',
          NULLIF('Filial: ' || coalesce(d.filial,''), 'Filial: '),
          NULLIF('Situação: ' || coalesce(d.situacao,''), 'Situação: '),
          d.observacoes
        ), ''),
        p_batch_id
      FROM src_dedup d
      ON CONFLICT (empresa_id, cpf) DO UPDATE SET
        nome           = EXCLUDED.nome,
        matricula      = COALESCE(EXCLUDED.matricula, public.colaborador.matricula),
        cargo          = COALESCE(EXCLUDED.cargo, public.colaborador.cargo),
        salario_base   = CASE WHEN EXCLUDED.salario_base > 0 THEN EXCLUDED.salario_base ELSE public.colaborador.salario_base END,
        data_admissao  = COALESCE(EXCLUDED.data_admissao, public.colaborador.data_admissao),
        data_demissao  = COALESCE(EXCLUDED.data_demissao, public.colaborador.data_demissao),
        data_nascimento= COALESCE(EXCLUDED.data_nascimento, public.colaborador.data_nascimento),
        genero         = COALESCE(EXCLUDED.genero, public.colaborador.genero),
        email          = COALESCE(EXCLUDED.email, public.colaborador.email),
        telefone       = COALESCE(EXCLUDED.telefone, public.colaborador.telefone),
        rg             = COALESCE(EXCLUDED.rg, public.colaborador.rg),
        pis_pasep      = COALESCE(EXCLUDED.pis_pasep, public.colaborador.pis_pasep),
        departamento   = COALESCE(EXCLUDED.departamento, public.colaborador.departamento),
        jornada        = COALESCE(EXCLUDED.jornada, public.colaborador.jornada),
        cbo            = COALESCE(EXCLUDED.cbo, public.colaborador.cbo),
        tipo_contrato  = COALESCE(EXCLUDED.tipo_contrato, public.colaborador.tipo_contrato),
        gestor_direto  = COALESCE(EXCLUDED.gestor_direto, public.colaborador.gestor_direto),
        endereco_cep   = COALESCE(EXCLUDED.endereco_cep, public.colaborador.endereco_cep),
        endereco_rua   = COALESCE(EXCLUDED.endereco_rua, public.colaborador.endereco_rua),
        endereco_numero= COALESCE(EXCLUDED.endereco_numero, public.colaborador.endereco_numero),
        endereco_bairro= COALESCE(EXCLUDED.endereco_bairro, public.colaborador.endereco_bairro),
        endereco_cidade= COALESCE(EXCLUDED.endereco_cidade, public.colaborador.endereco_cidade),
        endereco_uf    = COALESCE(EXCLUDED.endereco_uf, public.colaborador.endereco_uf),
        status         = EXCLUDED.status,
        observacoes    = COALESCE(EXCLUDED.observacoes, public.colaborador.observacoes),
        batch_id       = EXCLUDED.batch_id,
        updated_at     = now();
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('colaborador_full_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'colaborador_ativo_v1' THEN
      v_skipped := v_skipped + 1;
      v_msg := v_msg || 'colaborador_ativo_v1: requer resolução de contrato/posto (não promovido automaticamente); ';

    ELSE
      v_skipped := v_skipped + 1;
      v_msg := v_msg || format('%s: promoção não implementada; ', v_layout.codigo);
    END IF;
  END LOOP;

  UPDATE public.integration_batches
     SET status = 'carregado'::integ_batch_status,
         observacoes = COALESCE(observacoes,'') || E'\n[CARREGADO] ' || v_msg,
         updated_at = now()
   WHERE id = p_batch_id;

  RETURN jsonb_build_object('layouts_skipped', v_skipped, 'detalhe', v_msg);
END;
$function$;

-- ============================================================
-- 7) RESET do batch atual para permitir nova materialização completa
-- ============================================================
DELETE FROM public.stg_colaboradores_base
 WHERE batch_id IN (
   SELECT id FROM public.integration_batches WHERE codigo = 'BATCH-2026-04-30-QU2C'
 );

DELETE FROM public.integration_validation_results
 WHERE batch_id IN (
   SELECT id FROM public.integration_batches WHERE codigo = 'BATCH-2026-04-30-QU2C'
 );

UPDATE public.integration_batch_files
   SET linhas_inseridas = NULL,
       materializado_em = NULL
 WHERE batch_id IN (
   SELECT id FROM public.integration_batches WHERE codigo = 'BATCH-2026-04-30-QU2C'
 );

UPDATE public.integration_batches
   SET status = 'rascunho'::integ_batch_status,
       total_linhas = 0,
       linhas_validas = 0,
       linhas_invalidas = 0,
       observacoes = COALESCE(observacoes,'') || E'\n[RESET] ' || now()::text || ' — re-materialize com mapeamento ampliado.',
       updated_at = now()
 WHERE codigo = 'BATCH-2026-04-30-QU2C';
