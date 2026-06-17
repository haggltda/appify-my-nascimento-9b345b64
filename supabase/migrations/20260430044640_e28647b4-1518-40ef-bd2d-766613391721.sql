-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.integ_batch_status AS ENUM (
    'rascunho','aguardando_validacao','validando','com_erros',
    'pronto_para_carga','aprovado','carregando','carregado','rejeitado','reprocessando','arquivado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.integ_validation_severity AS ENUM ('bloqueante','alerta','informativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.integ_alias_status AS ENUM ('pendente','sugerido','aprovado','rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.integ_load_status AS ENUM ('pendente','em_execucao','concluido','falhou','revertido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.integration_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE, nome text NOT NULL, descricao text,
  destino_tabela text NOT NULL, staging_tabela text NOT NULL,
  ativo boolean NOT NULL DEFAULT true, versao int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_layout_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid NOT NULL REFERENCES public.integration_layouts(id) ON DELETE CASCADE,
  nome_origem text NOT NULL, aliases text[] NOT NULL DEFAULT '{}',
  nome_destino text NOT NULL, tipo_dado text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT false, ordem int NOT NULL DEFAULT 0,
  formato text, observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_layout_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid NOT NULL REFERENCES public.integration_layouts(id) ON DELETE CASCADE,
  arquivo_pattern text, sheet_pattern text,
  colunas_obrigatorias text[] NOT NULL DEFAULT '{}',
  peso int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  codigo text NOT NULL, descricao text,
  status public.integ_batch_status NOT NULL DEFAULT 'rascunho',
  layout_id uuid REFERENCES public.integration_layouts(id),
  enviado_por uuid REFERENCES auth.users(id),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  total_linhas int DEFAULT 0, linhas_validas int DEFAULT 0, linhas_invalidas int DEFAULT 0,
  observacoes text, metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE INDEX idx_integ_batches_empresa ON public.integration_batches(empresa_id, status);

CREATE TABLE public.integration_batch_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, nome_original text NOT NULL,
  storage_path text NOT NULL, mime_type text, tamanho_bytes bigint,
  hash_sha256 text NOT NULL, sheet_name text,
  layout_detectado_id uuid REFERENCES public.integration_layouts(id),
  layout_score numeric, metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, hash_sha256)
);
CREATE INDEX idx_integ_files_batch ON public.integration_batch_files(batch_id);

CREATE TABLE public.integration_parse_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_file_id uuid NOT NULL REFERENCES public.integration_batch_files(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  status text NOT NULL DEFAULT 'em_execucao',
  total_linhas int DEFAULT 0, preview_amostra jsonb, perfil_colunas jsonb,
  erro_mensagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_validation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid REFERENCES public.integration_layouts(id) ON DELETE CASCADE,
  codigo text NOT NULL, descricao text NOT NULL,
  severidade public.integ_validation_severity NOT NULL DEFAULT 'alerta',
  campo text, expressao text, ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_integ_valrule_layout_codigo
  ON public.integration_validation_rules (COALESCE(layout_id::text,''), codigo);

CREATE TABLE public.integration_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  rule_codigo text NOT NULL,
  severidade public.integ_validation_severity NOT NULL,
  linha_origem int, campo text, valor_recebido text,
  mensagem text NOT NULL, resolvido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integ_valres_batch ON public.integration_validation_results(batch_id, severidade);

CREATE TABLE public.integration_alias_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alias text NOT NULL, contrato_id uuid REFERENCES public.contrato(id),
  status public.integ_alias_status NOT NULL DEFAULT 'pendente', origem text,
  resolvido_por uuid REFERENCES auth.users(id), resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (empresa_id, alias)
);
CREATE TABLE public.integration_alias_centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alias text NOT NULL, centro_custo_id uuid REFERENCES public.centros_custo(id),
  status public.integ_alias_status NOT NULL DEFAULT 'pendente', origem text,
  resolvido_por uuid REFERENCES auth.users(id), resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (empresa_id, alias)
);
CREATE TABLE public.integration_alias_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alias text NOT NULL, empresa_alvo_id uuid REFERENCES public.empresas(id),
  status public.integ_alias_status NOT NULL DEFAULT 'pendente', origem text,
  resolvido_por uuid REFERENCES auth.users(id), resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (empresa_id, alias)
);
CREATE TABLE public.integration_alias_bancos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alias text NOT NULL, conta_bancaria_id uuid REFERENCES public.conta_bancaria(id),
  status public.integ_alias_status NOT NULL DEFAULT 'pendente', origem text,
  resolvido_por uuid REFERENCES auth.users(id), resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (empresa_id, alias)
);
CREATE TABLE public.integration_alias_formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alias text NOT NULL, forma_pagamento text,
  status public.integ_alias_status NOT NULL DEFAULT 'pendente', origem text,
  resolvido_por uuid REFERENCES auth.users(id), resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (empresa_id, alias)
);

CREATE TABLE public.integration_map_classificacao_contabil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  classificacao_origem text NOT NULL,
  tipo_origem text, centro_custo_origem text,
  conta_contabil_id uuid REFERENCES public.conta_contabil(id),
  tipo_gasto text, fixo_variavel text, direto_indireto text,
  status public.integ_alias_status NOT NULL DEFAULT 'pendente',
  sugestao_motivo text,
  aprovado_por uuid REFERENCES auth.users(id), aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_integ_map_class
  ON public.integration_map_classificacao_contabil
  (empresa_id, classificacao_origem, COALESCE(tipo_origem,''), COALESCE(centro_custo_origem,''));

CREATE TABLE public.integration_load_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  layout_id uuid REFERENCES public.integration_layouts(id),
  status public.integ_load_status NOT NULL DEFAULT 'pendente',
  iniciado_em timestamptz, finalizado_em timestamptz,
  total_inseridos int DEFAULT 0, total_atualizados int DEFAULT 0,
  total_ignorados int DEFAULT 0, total_erros int DEFAULT 0,
  executado_por uuid REFERENCES auth.users(id), observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_load_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_run_id uuid NOT NULL REFERENCES public.integration_load_runs(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  staging_id uuid, destino_tabela text NOT NULL, destino_id uuid,
  acao text NOT NULL, erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integ_loaditems_run ON public.integration_load_run_items(load_run_id);

CREATE TABLE public.integration_reprocess_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, motivo text NOT NULL,
  solicitado_por uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pendente',
  novo_batch_id uuid REFERENCES public.integration_batches(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stg_licitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, linha_origem int,
  data_sessao date, edital text, horario text, cidade text, uf text,
  objeto text, fase text, status_obs text, empresa_obs text,
  valido boolean DEFAULT true, erro_msg text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stg_fluxo_caixa_realizado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, linha_origem int,
  id_origem text, data_lancamento date, tipo text, classificacao text,
  historico text, empresa_origem text, centro_custo_origem text,
  banco_origem text, forma_pagamento_origem text, valor numeric(18,2),
  recorrencia_tipo text, numero_parcela int,
  observacao_categoria_original text, flag_categoria_ambigua boolean DEFAULT false,
  contrato_resolvido_id uuid, centro_custo_resolvido_id uuid,
  conta_bancaria_resolvida_id uuid, conta_contabil_resolvida_id uuid,
  pendente_conta_contabil boolean DEFAULT true,
  valido boolean DEFAULT true, erro_msg text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stg_fluxo_real_batch ON public.stg_fluxo_caixa_realizado(batch_id);

CREATE TABLE public.stg_colaboradores_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, linha_origem int,
  filial text, nome text, cpf text, empresa_origem text,
  cadastro text, situacao text,
  valido boolean DEFAULT true, erro_msg text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stg_colaboradores_ativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, linha_origem int,
  nome text, cpf text, cadastro text, situacao text,
  centro_custo_codigo text, centro_custo_descricao text, filial_apelido text,
  centro_custo_resolvido_id uuid, contrato_resolvido_id uuid,
  valido boolean DEFAULT true, erro_msg text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stg_clientes_cnpj (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, linha_origem int,
  empresa_origem text, filial text, contrato_origem text,
  cnpj text, data_inicio date, data_fim date,
  contrato_resolvido_id uuid,
  valido boolean DEFAULT true, erro_msg text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stg_contratos_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, linha_origem int,
  contrato_nome text, responsavel text, cidade text,
  data_inicio date, numero_edital text, quant_funcionarios int,
  valor_mensal numeric(18,2),
  contrato_resolvido_id uuid,
  valido boolean DEFAULT true, erro_msg text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stg_contratos_custos_wide (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, linha_origem int,
  empresa_origem text, cliente text, contrato text, posto text,
  servico text, quantidade numeric, vigencia text, status text, cenario text,
  valores jsonb, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stg_contratos_custos_long (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, linha_origem int,
  contrato_origem text, posto_origem text, servico_origem text,
  componente_custo text, cenario text, valor numeric(18,2),
  contrato_resolvido_id uuid, posto_resolvido_id uuid,
  valido boolean DEFAULT true, erro_msg text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stg_custo_long_batch ON public.stg_contratos_custos_long(batch_id);
CREATE TABLE public.stg_fluxo_caixa_projetado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.integration_batches(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL, linha_origem int,
  id_origem text, data_prevista date, tipo text, classificacao text,
  valor numeric(18,2), valor_orcado numeric(18,2), cenario text,
  contrato_resolvido_id uuid, centro_custo_resolvido_id uuid,
  valido boolean DEFAULT true, erro_msg text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.licitacao
  ADD COLUMN IF NOT EXISTS origem_carga text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.integration_batches(id) ON DELETE SET NULL;
ALTER TABLE public.colaborador
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.integration_batches(id) ON DELETE SET NULL;
ALTER TABLE public.realizado_lancamentos
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.integration_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pendente_conta_contabil boolean NOT NULL DEFAULT false;
ALTER TABLE public.contrato
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.integration_batches(id) ON DELETE SET NULL;
ALTER TABLE public.fluxo_caixa_projetado
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.integration_batches(id) ON DELETE SET NULL;

CREATE TRIGGER trg_integ_layouts_upd BEFORE UPDATE ON public.integration_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_integ_batches_upd BEFORE UPDATE ON public.integration_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.integration_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_layout_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_layout_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_batch_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_parse_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_alias_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_alias_centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_alias_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_alias_bancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_alias_formas_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_map_classificacao_contabil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_load_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_load_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_reprocess_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_licitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_fluxo_caixa_realizado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_colaboradores_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_colaboradores_ativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_clientes_cnpj ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_contratos_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_contratos_custos_wide ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_contratos_custos_long ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_fluxo_caixa_projetado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "layouts_read" ON public.integration_layouts FOR SELECT TO authenticated USING (true);
CREATE POLICY "layouts_admin" ON public.integration_layouts FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "layoutcols_read" ON public.integration_layout_columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "layoutcols_admin" ON public.integration_layout_columns FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "layoutfp_read" ON public.integration_layout_fingerprints FOR SELECT TO authenticated USING (true);
CREATE POLICY "layoutfp_admin" ON public.integration_layout_fingerprints FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "valrules_read" ON public.integration_validation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "valrules_admin" ON public.integration_validation_rules FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DO $outer$
DECLARE
  t text;
  tables text[] := ARRAY[
    'integration_batches','integration_batch_files','integration_parse_runs',
    'integration_validation_results','integration_alias_contratos','integration_alias_centros_custo',
    'integration_alias_empresas','integration_alias_bancos','integration_alias_formas_pagamento',
    'integration_map_classificacao_contabil','integration_load_runs','integration_load_run_items',
    'integration_reprocess_requests',
    'stg_licitacoes','stg_fluxo_caixa_realizado','stg_colaboradores_base','stg_colaboradores_ativos',
    'stg_clientes_cnpj','stg_contratos_master','stg_contratos_custos_wide','stg_contratos_custos_long',
    'stg_fluxo_caixa_projetado'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE 'CREATE POLICY "' || t || '_read" ON public.' || quote_ident(t) ||
      ' FOR SELECT TO authenticated USING (has_role(auth.uid(),''admin'') OR empresa_id = get_user_empresa(auth.uid()))';
    EXECUTE 'CREATE POLICY "' || t || '_insert" ON public.' || quote_ident(t) ||
      ' FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),''admin'') OR empresa_id = get_user_empresa(auth.uid()))';
    EXECUTE 'CREATE POLICY "' || t || '_update" ON public.' || quote_ident(t) ||
      ' FOR UPDATE TO authenticated USING (has_role(auth.uid(),''admin'') OR empresa_id = get_user_empresa(auth.uid()))' ||
      ' WITH CHECK (has_role(auth.uid(),''admin'') OR empresa_id = get_user_empresa(auth.uid()))';
    EXECUTE 'CREATE POLICY "' || t || '_delete" ON public.' || quote_ident(t) ||
      ' FOR DELETE TO authenticated USING (has_role(auth.uid(),''admin''))';
  END LOOP;
END $outer$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'integration-uploads', 'integration-uploads', false, 10485760,
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel','text/csv','application/csv','text/plain'
  ]
) ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;

CREATE POLICY "integ_uploads_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='integration-uploads' AND (has_role(auth.uid(),'admin') OR storage_path_empresa(name) = get_user_empresa(auth.uid())));
CREATE POLICY "integ_uploads_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='integration-uploads' AND (has_role(auth.uid(),'admin') OR storage_path_empresa(name) = get_user_empresa(auth.uid())));
CREATE POLICY "integ_uploads_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='integration-uploads' AND has_role(auth.uid(),'admin'));

INSERT INTO public.integration_layouts (codigo, nome, descricao, destino_tabela, staging_tabela) VALUES
  ('licitacoes_v1','Licitações v1','Base de licitações operacional','licitacao','stg_licitacoes'),
  ('fluxo_realizado_v1','Fluxo de Caixa Realizado v1','Lançamentos financeiros realizados','realizado_lancamentos','stg_fluxo_caixa_realizado'),
  ('colaborador_full_v1','Colaboradores - Base Completa v1','Cadastro mestre de colaboradores','colaborador','stg_colaboradores_base'),
  ('colaborador_ativo_v1','Colaboradores Ativos v1','Alocação atual','alocacao_colaborador','stg_colaboradores_ativos'),
  ('cliente_cnpj_v1','Clientes / CNPJ v1','CNPJ por contrato','contrato','stg_clientes_cnpj'),
  ('contrato_master_v1','Contratos Master v1','Cadastro mestre de contratos','contrato','stg_contratos_master'),
  ('contrato_custo_wide_v1','Custos por Contrato (wide) v1','Orçamento por componente de custo','orcamento_contrato_linha','stg_contratos_custos_wide'),
  ('fluxo_projetado_v1','Fluxo de Caixa Projetado v1','Projeções por horizonte','fluxo_caixa_projetado','stg_fluxo_caixa_projetado')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.integration_layout_fingerprints (layout_id, sheet_pattern, colunas_obrigatorias, peso)
SELECT id, NULL,
  CASE codigo
    WHEN 'licitacoes_v1' THEN ARRAY['DATA','EDITAL','HORÁRIO','Cidade','Objeto','UF','FASE']
    WHEN 'fluxo_realizado_v1' THEN ARRAY['ID','Data','Tipo','Classificação','Histórico','Empresas','Centro de custo','Banco','Forma de Pag.','Valor']
    WHEN 'colaborador_full_v1' THEN ARRAY['Filial','Nome','CPF','Empresa','Cadastro','Descrição (Situação)']
    WHEN 'colaborador_ativo_v1' THEN ARRAY['Nome','CPF','Cadastro','Descrição (Situação)','C.Custo','Descrição (C.Custo)','Apelido (Filial)']
    WHEN 'cliente_cnpj_v1' THEN ARRAY['EMPRESA','FILIAL','CONTRATO','CNPJ','DATA INÍCIO','DATA FIM']
    WHEN 'contrato_master_v1' THEN ARRAY['Contratos','Responsável','CIDADE','Data Início','Nº EDITAL','QUANT. FUNC.','Valor mensal 2025']
    WHEN 'contrato_custo_wide_v1' THEN ARRAY['Empresa','Cliente','Contrato','Posto','Serviço','Quantidade','Vigência','Status']
    WHEN 'fluxo_projetado_v1' THEN ARRAY['ID','Data','Tipo','Classificação','Valor','Valor Orç','R OU O']
  END, 10
FROM public.integration_layouts;

INSERT INTO public.integration_validation_rules (layout_id, codigo, descricao, severidade, campo) VALUES
  (NULL,'HASH_DUPLICADO','Arquivo já importado anteriormente (hash duplicado)','bloqueante',NULL),
  (NULL,'CABECALHO_AUSENTE','Colunas obrigatórias ausentes no cabeçalho','bloqueante',NULL),
  (NULL,'LAYOUT_NAO_RECONHECIDO','Layout não reconhecido — selecione manualmente','bloqueante',NULL),
  (NULL,'DATA_INVALIDA','Data em formato inválido','bloqueante','data'),
  (NULL,'VALOR_INVALIDO','Valor monetário inválido','bloqueante','valor'),
  (NULL,'ALIAS_NAO_RESOLVIDO','Alias não resolvido (contrato/centro de custo/empresa/banco)','alerta',NULL),
  (NULL,'CLASSIFICACAO_SEM_CONTA_CONTABIL','Classificação sem conta contábil mapeada','alerta','classificacao'),
  (NULL,'CONTRATO_OBRIGATORIO_CUSTO_DIRETO','Custo direto sem contrato vinculado','bloqueante','contrato'),
  (NULL,'CPF_INVALIDO','CPF inválido','alerta','cpf'),
  (NULL,'CPF_DUPLICADO','CPF duplicado no arquivo','alerta','cpf'),
  (NULL,'CONTRATO_SEM_CLIENTE','Contrato sem cliente associado','alerta',NULL),
  (NULL,'CONTRATO_SEM_CNPJ','Contrato sem CNPJ associado','alerta',NULL),
  (NULL,'HORIZONTE_EXCEDIDO','Horizonte de projeção excede o configurado','alerta','data_prevista');