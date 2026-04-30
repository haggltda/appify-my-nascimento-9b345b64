-- ============================================================
-- Builder de Layouts Bancários
-- ============================================================

DO $$ BEGIN
  CREATE TYPE banco_layout_tipo AS ENUM (
    'cnab240_remessa_pagamento',
    'cnab240_retorno',
    'cnab400_remessa',
    'cnab400_retorno',
    'api_rest_pagamento',
    'api_rest_consulta',
    'ofx_extrato',
    'csv_extrato'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE banco_layout_versao_status AS ENUM (
    'rascunho','pendente_aprovacao','aprovada','rejeitada','arquivada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Layout (ponteiro p/ versão ativa)
CREATE TABLE IF NOT EXISTS public.banco_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_bancaria_id uuid NOT NULL REFERENCES public.conta_bancaria(id) ON DELETE CASCADE,
  tipo banco_layout_tipo NOT NULL,
  nome text NOT NULL,
  versao_ativa_id uuid,
  template_origem_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_bancaria_id, tipo)
);
CREATE INDEX IF NOT EXISTS idx_banco_layout_empresa ON public.banco_layout(empresa_id);

-- 2) Versão do layout
CREATE TABLE IF NOT EXISTS public.banco_layout_versao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  layout_id uuid NOT NULL REFERENCES public.banco_layout(id) ON DELETE CASCADE,
  numero_versao int NOT NULL,
  status banco_layout_versao_status NOT NULL DEFAULT 'rascunho',
  -- estrutura completa do layout (campos, posições, transformações, endpoints, headers)
  estrutura jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- exemplo de input usado para preview
  amostra_input jsonb,
  -- saída gerada do último preview
  amostra_output text,
  notas text,
  criado_por uuid,
  submetido_por uuid,
  submetido_em timestamptz,
  aprovado_por uuid,
  aprovado_em timestamptz,
  rejeitado_por uuid,
  rejeitado_em timestamptz,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (layout_id, numero_versao)
);
CREATE INDEX IF NOT EXISTS idx_blv_layout ON public.banco_layout_versao(layout_id);
CREATE INDEX IF NOT EXISTS idx_blv_status ON public.banco_layout_versao(status);

-- 3) Templates pré-prontos (compartilhados)
CREATE TABLE IF NOT EXISTS public.banco_layout_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE, -- NULL = global/Lovable
  nome text NOT NULL,
  banco_codigo text,         -- '341','237','033','001','104','756' etc.
  banco_nome text,
  tipo banco_layout_tipo NOT NULL,
  versao_layout text,        -- ex.: 'CNAB 240 v10.7'
  estrutura jsonb NOT NULL DEFAULT '{}'::jsonb,
  descricao text,
  oficial boolean NOT NULL DEFAULT false,  -- true = vem com a Lovable
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blt_banco_tipo ON public.banco_layout_template(banco_codigo, tipo);

-- 4) Log de testes feitos no builder
CREATE TABLE IF NOT EXISTS public.banco_layout_teste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  layout_versao_id uuid NOT NULL REFERENCES public.banco_layout_versao(id) ON DELETE CASCADE,
  tipo_teste text NOT NULL,         -- 'preview' | 'api_sandbox' | 'validacao'
  input_payload jsonb,
  output_gerado text,
  response_banco jsonb,
  http_status int,
  sucesso boolean,
  erro text,
  duracao_ms int,
  executado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blteste_versao ON public.banco_layout_teste(layout_versao_id);

-- FK retroativa
ALTER TABLE public.banco_layout
  DROP CONSTRAINT IF EXISTS banco_layout_versao_ativa_fk;
ALTER TABLE public.banco_layout
  ADD CONSTRAINT banco_layout_versao_ativa_fk FOREIGN KEY (versao_ativa_id)
    REFERENCES public.banco_layout_versao(id) ON DELETE SET NULL;
ALTER TABLE public.banco_layout
  DROP CONSTRAINT IF EXISTS banco_layout_template_origem_fk;
ALTER TABLE public.banco_layout
  ADD CONSTRAINT banco_layout_template_origem_fk FOREIGN KEY (template_origem_id)
    REFERENCES public.banco_layout_template(id) ON DELETE SET NULL;

-- Triggers updated_at
DO $$ BEGIN CREATE TRIGGER trg_banco_layout_upd BEFORE UPDATE ON public.banco_layout FOR EACH ROW EXECUTE FUNCTION public.set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_blv_upd BEFORE UPDATE ON public.banco_layout_versao FOR EACH ROW EXECUTE FUNCTION public.set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_blt_upd BEFORE UPDATE ON public.banco_layout_template FOR EACH ROW EXECUTE FUNCTION public.set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS
ALTER TABLE public.banco_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_layout_versao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_layout_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_layout_teste ENABLE ROW LEVEL SECURITY;

-- banco_layout
DROP POLICY IF EXISTS bl_select ON public.banco_layout;
CREATE POLICY bl_select ON public.banco_layout FOR SELECT
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
DROP POLICY IF EXISTS bl_modify ON public.banco_layout;
CREATE POLICY bl_modify ON public.banco_layout FOR ALL
  USING (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())));

-- banco_layout_versao
DROP POLICY IF EXISTS blv_select ON public.banco_layout_versao;
CREATE POLICY blv_select ON public.banco_layout_versao FOR SELECT
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
DROP POLICY IF EXISTS blv_modify ON public.banco_layout_versao;
CREATE POLICY blv_modify ON public.banco_layout_versao FOR ALL
  USING (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())));

-- templates: SELECT é público para autenticados (compartilhados); modify por admin ou da própria empresa
DROP POLICY IF EXISTS blt_select ON public.banco_layout_template;
CREATE POLICY blt_select ON public.banco_layout_template FOR SELECT
  USING (auth.uid() IS NOT NULL AND (empresa_id IS NULL OR has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
DROP POLICY IF EXISTS blt_modify ON public.banco_layout_template;
CREATE POLICY blt_modify ON public.banco_layout_template FOR ALL
  USING (has_role(auth.uid(),'admin')
       OR (empresa_id IS NOT NULL AND empresa_id = get_user_empresa(auth.uid())
           AND (has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))))
  WITH CHECK (has_role(auth.uid(),'admin')
       OR (empresa_id IS NOT NULL AND empresa_id = get_user_empresa(auth.uid())
           AND (has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))));

-- testes
DROP POLICY IF EXISTS blteste_select ON public.banco_layout_teste;
CREATE POLICY blteste_select ON public.banco_layout_teste FOR SELECT
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
DROP POLICY IF EXISTS blteste_modify ON public.banco_layout_teste;
CREATE POLICY blteste_modify ON public.banco_layout_teste FOR ALL
  USING (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())));

-- ============================================================
-- RPC: Submeter versão para aprovação
-- ============================================================
CREATE OR REPLACE FUNCTION public.layout_submeter_aprovacao(_versao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v RECORD;
BEGIN
  SELECT * INTO v FROM banco_layout_versao WHERE id = _versao_id;
  IF v IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;
  IF NOT (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND v.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF v.status NOT IN ('rascunho','rejeitada') THEN
    RAISE EXCEPTION 'Versão não pode ser submetida (status: %)', v.status;
  END IF;
  UPDATE banco_layout_versao
     SET status='pendente_aprovacao', submetido_por=auth.uid(), submetido_em=now()
   WHERE id=_versao_id;
  RETURN jsonb_build_object('versao_id',_versao_id,'status','pendente_aprovacao');
END $$;

-- ============================================================
-- RPC: Aprovar versão (vira ativa)
-- ============================================================
CREATE OR REPLACE FUNCTION public.layout_aprovar_versao(_versao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v RECORD; v_anterior uuid;
BEGIN
  SELECT * INTO v FROM banco_layout_versao WHERE id = _versao_id;
  IF v IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;
  IF NOT (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'diretor_adm') AND v.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Apenas admin ou diretor administrativo pode aprovar';
  END IF;
  IF v.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'Versão não está pendente (status: %)', v.status;
  END IF;
  IF v.criado_por = auth.uid() AND NOT has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Não é permitido aprovar a própria versão';
  END IF;

  -- Arquiva a anterior
  SELECT versao_ativa_id INTO v_anterior FROM banco_layout WHERE id = v.layout_id;
  IF v_anterior IS NOT NULL AND v_anterior <> _versao_id THEN
    UPDATE banco_layout_versao SET status='arquivada' WHERE id = v_anterior;
  END IF;

  UPDATE banco_layout_versao
     SET status='aprovada', aprovado_por=auth.uid(), aprovado_em=now()
   WHERE id=_versao_id;

  UPDATE banco_layout SET versao_ativa_id=_versao_id WHERE id=v.layout_id;

  RETURN jsonb_build_object('versao_id',_versao_id,'layout_id',v.layout_id,'status','aprovada');
END $$;

-- ============================================================
-- RPC: Rejeitar versão
-- ============================================================
CREATE OR REPLACE FUNCTION public.layout_rejeitar_versao(_versao_id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v RECORD;
BEGIN
  SELECT * INTO v FROM banco_layout_versao WHERE id = _versao_id;
  IF v IS NULL THEN RAISE EXCEPTION 'Versão não encontrada'; END IF;
  IF NOT (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'diretor_adm') AND v.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Apenas admin ou diretor administrativo pode rejeitar';
  END IF;
  IF v.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'Versão não está pendente';
  END IF;
  IF _motivo IS NULL OR length(_motivo) < 5 THEN
    RAISE EXCEPTION 'Informe motivo da rejeição (mín 5 caracteres)';
  END IF;
  UPDATE banco_layout_versao
     SET status='rejeitada', rejeitado_por=auth.uid(), rejeitado_em=now(), motivo_rejeicao=_motivo
   WHERE id=_versao_id;
  RETURN jsonb_build_object('versao_id',_versao_id,'status','rejeitada');
END $$;

-- ============================================================
-- RPC: Criar nova versão (clone da última ou em branco)
-- ============================================================
CREATE OR REPLACE FUNCTION public.layout_nova_versao(_layout_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_layout RECORD;
  v_ultima RECORD;
  v_nova_id uuid;
  v_proximo int;
BEGIN
  SELECT * INTO v_layout FROM banco_layout WHERE id = _layout_id;
  IF v_layout IS NULL THEN RAISE EXCEPTION 'Layout não encontrado'; END IF;
  IF NOT (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND v_layout.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT COALESCE(MAX(numero_versao),0)+1 INTO v_proximo
    FROM banco_layout_versao WHERE layout_id = _layout_id;

  SELECT * INTO v_ultima FROM banco_layout_versao
   WHERE layout_id = _layout_id ORDER BY numero_versao DESC LIMIT 1;

  INSERT INTO banco_layout_versao (empresa_id, layout_id, numero_versao, status, estrutura, criado_por)
  VALUES (v_layout.empresa_id, _layout_id, v_proximo, 'rascunho',
          COALESCE(v_ultima.estrutura, '{}'::jsonb), auth.uid())
  RETURNING id INTO v_nova_id;

  RETURN jsonb_build_object('versao_id', v_nova_id, 'numero_versao', v_proximo);
END $$;

-- ============================================================
-- Seed: Templates oficiais (6 maiores bancos) — CNAB 240 Remessa Pagamento
-- Estrutura simplificada FEBRABAN; cada template contém ajustes do banco.
-- ============================================================
INSERT INTO public.banco_layout_template (nome, banco_codigo, banco_nome, tipo, versao_layout, oficial, descricao, estrutura) VALUES
('FEBRABAN 240 — Genérico', NULL, NULL, 'cnab240_remessa_pagamento', 'FEBRABAN v10.7', true,
 'Layout base FEBRABAN 240 — pagamento a fornecedores. Use como ponto de partida quando não há banco específico.',
 jsonb_build_object(
   'tipo','cnab240',
   'tamanho_registro',240,
   'segmentos', jsonb_build_array(
     jsonb_build_object('codigo','header_arquivo','descricao','Header de arquivo','campos', jsonb_build_array(
       jsonb_build_object('nome','codigo_banco','pos_ini',1,'pos_fim',3,'tamanho',3,'tipo','num','padding','zeros','origem','conta.codigo_banco'),
       jsonb_build_object('nome','codigo_lote','pos_ini',4,'pos_fim',7,'tamanho',4,'tipo','num','padding','zeros','origem','literal:0000'),
       jsonb_build_object('nome','tipo_registro','pos_ini',8,'pos_fim',8,'tamanho',1,'tipo','num','padding','zeros','origem','literal:0'),
       jsonb_build_object('nome','filler','pos_ini',9,'pos_fim',17,'tamanho',9,'tipo','alfa','padding','espacos','origem','literal: '),
       jsonb_build_object('nome','tipo_inscricao','pos_ini',18,'pos_fim',18,'tamanho',1,'tipo','num','padding','zeros','origem','literal:2'),
       jsonb_build_object('nome','cnpj_empresa','pos_ini',19,'pos_fim',32,'tamanho',14,'tipo','num','padding','zeros','origem','empresa.cnpj','transformacoes', jsonb_build_array('removerPontuacao','padLeftZeros'))
     ))
   )
 )),

('Itaú 341 — CNAB 240 Pagamento', '341', 'Itaú Unibanco', 'cnab240_remessa_pagamento', 'Itaú v10.7', true,
 'Layout oficial Itaú para pagamento a fornecedores via CNAB 240. Service Type 20.',
 jsonb_build_object(
   'tipo','cnab240','tamanho_registro',240,'banco_codigo','341',
   'segmentos', jsonb_build_array(
     jsonb_build_object('codigo','header_arquivo','descricao','Header arquivo (Itaú)','campos', jsonb_build_array(
       jsonb_build_object('nome','codigo_banco','pos_ini',1,'pos_fim',3,'tamanho',3,'tipo','num','padding','zeros','origem','literal:341'),
       jsonb_build_object('nome','codigo_lote','pos_ini',4,'pos_fim',7,'tamanho',4,'tipo','num','padding','zeros','origem','literal:0000'),
       jsonb_build_object('nome','tipo_registro','pos_ini',8,'pos_fim',8,'tamanho',1,'tipo','num','padding','zeros','origem','literal:0')
     )),
     jsonb_build_object('codigo','segmento_a','descricao','Segmento A — TED/DOC/Crédito','campos', jsonb_build_array(
       jsonb_build_object('nome','favorecido_nome','pos_ini',44,'pos_fim',73,'tamanho',30,'tipo','alfa','padding','espacos','origem','fornecedor.nome_razao'),
       jsonb_build_object('nome','data_pagamento','pos_ini',94,'pos_fim',101,'tamanho',8,'tipo','num','padding','zeros','origem','titulo.data_pagamento','transformacoes',jsonb_build_array('formatDate:DDMMYYYY')),
       jsonb_build_object('nome','valor_pagamento','pos_ini',120,'pos_fim',134,'tamanho',15,'tipo','num','padding','zeros','origem','titulo.valor','transformacoes',jsonb_build_array('multiplicar:100','padLeftZeros'))
     ))
   )
 )),

('Bradesco 237 — CNAB 240 Pagamento', '237', 'Bradesco', 'cnab240_remessa_pagamento', 'Bradesco v6', true,
 'Layout oficial Bradesco CNAB 240 pagamento a fornecedores.',
 jsonb_build_object(
   'tipo','cnab240','tamanho_registro',240,'banco_codigo','237',
   'segmentos', jsonb_build_array(
     jsonb_build_object('codigo','header_arquivo','campos', jsonb_build_array(
       jsonb_build_object('nome','codigo_banco','pos_ini',1,'pos_fim',3,'tamanho',3,'tipo','num','padding','zeros','origem','literal:237')
     )),
     jsonb_build_object('codigo','segmento_a','descricao','Bradesco Segmento A','campos', jsonb_build_array(
       jsonb_build_object('nome','favorecido_nome','pos_ini',44,'pos_fim',73,'tamanho',30,'tipo','alfa','padding','espacos','origem','fornecedor.nome_razao'),
       jsonb_build_object('nome','valor_pagamento','pos_ini',120,'pos_fim',134,'tamanho',15,'tipo','num','padding','zeros','origem','titulo.valor','transformacoes',jsonb_build_array('multiplicar:100','padLeftZeros'))
     ))
   )
 )),

('Santander 033 — CNAB 240 Pagamento', '033', 'Santander', 'cnab240_remessa_pagamento', 'Santander v3', true,
 'Layout Santander CNAB 240 pagamento.',
 jsonb_build_object('tipo','cnab240','tamanho_registro',240,'banco_codigo','033',
   'segmentos', jsonb_build_array(
     jsonb_build_object('codigo','header_arquivo','campos', jsonb_build_array(
       jsonb_build_object('nome','codigo_banco','pos_ini',1,'pos_fim',3,'tamanho',3,'tipo','num','padding','zeros','origem','literal:033')
     ))
   )
 )),

('Banco do Brasil 001 — CNAB 240 Pagamento', '001', 'Banco do Brasil', 'cnab240_remessa_pagamento', 'BB v8', true,
 'Layout oficial BB CNAB 240 pagamento a fornecedores. Convênio obrigatório.',
 jsonb_build_object('tipo','cnab240','tamanho_registro',240,'banco_codigo','001',
   'segmentos', jsonb_build_array(
     jsonb_build_object('codigo','header_arquivo','campos', jsonb_build_array(
       jsonb_build_object('nome','codigo_banco','pos_ini',1,'pos_fim',3,'tamanho',3,'tipo','num','padding','zeros','origem','literal:001'),
       jsonb_build_object('nome','convenio','pos_ini',33,'pos_fim',52,'tamanho',20,'tipo','alfa','padding','espacos','origem','conta.cnab_convenio')
     ))
   )
 )),

('Caixa 104 — CNAB 240 Pagamento', '104', 'Caixa Econômica', 'cnab240_remessa_pagamento', 'Caixa v5', true,
 'Layout Caixa SIGCB CNAB 240 pagamento.',
 jsonb_build_object('tipo','cnab240','tamanho_registro',240,'banco_codigo','104',
   'segmentos', jsonb_build_array(
     jsonb_build_object('codigo','header_arquivo','campos', jsonb_build_array(
       jsonb_build_object('nome','codigo_banco','pos_ini',1,'pos_fim',3,'tamanho',3,'tipo','num','padding','zeros','origem','literal:104')
     ))
   )
 )),

('Sicoob 756 — CNAB 240 Pagamento', '756', 'Sicoob', 'cnab240_remessa_pagamento', 'Sicoob v2', true,
 'Layout Sicoob CNAB 240 pagamento.',
 jsonb_build_object('tipo','cnab240','tamanho_registro',240,'banco_codigo','756',
   'segmentos', jsonb_build_array(
     jsonb_build_object('codigo','header_arquivo','campos', jsonb_build_array(
       jsonb_build_object('nome','codigo_banco','pos_ini',1,'pos_fim',3,'tamanho',3,'tipo','num','padding','zeros','origem','literal:756')
     ))
   )
 )),

-- API REST genérica (Open Banking-like)
('API REST — Pagamento PIX/TED genérico', NULL, NULL, 'api_rest_pagamento', 'REST v1', true,
 'Modelo de mapeamento JSON para APIs REST de pagamento (PIX/TED). Configure endpoint, headers e mapeamento campo a campo.',
 jsonb_build_object(
   'tipo','api_rest',
   'metodo','POST',
   'endpoint','/v1/pagamentos',
   'headers', jsonb_build_object(
     'Content-Type','application/json',
     'Authorization','Bearer {{token}}',
     'X-Idempotency-Key','{{titulo.id}}'
   ),
   'body_template', jsonb_build_object(
     'valor', jsonb_build_object('origem','titulo.valor','tipo','number'),
     'data_pagamento', jsonb_build_object('origem','titulo.data_pagamento','transformacoes',jsonb_build_array('formatDate:YYYY-MM-DD')),
     'favorecido', jsonb_build_object(
       'nome', jsonb_build_object('origem','fornecedor.nome_razao'),
       'documento', jsonb_build_object('origem','fornecedor.documento','transformacoes',jsonb_build_array('removerPontuacao')),
       'banco', jsonb_build_object('origem','fornecedor.banco_codigo'),
       'agencia', jsonb_build_object('origem','fornecedor.agencia'),
       'conta', jsonb_build_object('origem','fornecedor.conta')
     )
   ),
   'response_mapping', jsonb_build_object(
     'id_banco', '$.id',
     'status', '$.status',
     'protocolo', '$.protocolo'
   )
 ))
ON CONFLICT DO NOTHING;