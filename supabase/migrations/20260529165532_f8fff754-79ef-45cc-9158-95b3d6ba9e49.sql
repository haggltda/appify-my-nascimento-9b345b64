-- SUB-MACROBLOCO 1.1 — BDI · M1B · DDL + GRANT + RLS + POLICIES

-- ENUMs
CREATE TYPE public.bdi_status AS ENUM
  ('rascunho','em_revisao','aprovado','congelado','substituido','cancelado');

CREATE TYPE public.bdi_item_grupo AS ENUM
  ('posto','encargo','beneficio','insumo','imposto','margem','outro');

CREATE TYPE public.bdi_item_tipo AS ENUM
  ('moeda','percent','numero','texto');

CREATE TYPE public.bdi_aprovacao_acao AS ENUM
  ('submeter','aprovar','reprovar','congelar','cancelar');

-- =========================================================
-- bdi_versao
-- =========================================================
CREATE TABLE public.bdi_versao (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL,
  licitacao_id        uuid NULL REFERENCES public.licitacao(id)     ON DELETE RESTRICT,
  contrato_id         uuid NULL REFERENCES public.contrato(id)      ON DELETE RESTRICT,
  centro_custo_id     uuid NULL REFERENCES public.centros_custo(id) ON DELETE RESTRICT,
  base_versao_id      uuid NULL REFERENCES public.bdi_versao(id)    ON DELETE SET NULL,
  codigo              text NOT NULL,
  descricao           text NULL,
  status              public.bdi_status NOT NULL DEFAULT 'rascunho',
  vigencia_inicio     date NULL,
  vigencia_fim        date NULL,
  margem_pct          numeric(7,4) NOT NULL DEFAULT 0,
  tributos_pct        numeric(7,4) NOT NULL DEFAULT 0,
  custo_indireto_pct  numeric(7,4) NOT NULL DEFAULT 0,
  totais_cache        jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacao          text NULL,
  created_by          uuid NOT NULL DEFAULT auth.uid(),
  approved_by         uuid NULL,
  approved_at         timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bdi_versao_alvo_chk
    CHECK (licitacao_id IS NOT NULL OR contrato_id IS NOT NULL),
  CONSTRAINT bdi_versao_vigencia_chk
    CHECK (vigencia_fim IS NULL OR vigencia_inicio IS NULL OR vigencia_fim >= vigencia_inicio),
  CONSTRAINT bdi_versao_codigo_unq UNIQUE (empresa_id, codigo)
);

COMMENT ON TABLE public.bdi_versao IS
  'Versao de Composicao & BDI (pre-licitatoria ou contratual). Cabecalho com premissas e status. Aprovacao formal usa motor sup_aprov_* / licitacao_etapa; bdi_aprovacao e apenas log interno.';

CREATE INDEX idx_bdi_versao_empresa_status ON public.bdi_versao (empresa_id, status);
CREATE INDEX idx_bdi_versao_licitacao     ON public.bdi_versao (licitacao_id)    WHERE licitacao_id    IS NOT NULL;
CREATE INDEX idx_bdi_versao_contrato      ON public.bdi_versao (contrato_id)     WHERE contrato_id     IS NOT NULL;
CREATE INDEX idx_bdi_versao_centro_custo  ON public.bdi_versao (centro_custo_id) WHERE centro_custo_id IS NOT NULL;
CREATE INDEX idx_bdi_versao_base          ON public.bdi_versao (base_versao_id)  WHERE base_versao_id  IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bdi_versao TO authenticated;
GRANT ALL ON public.bdi_versao TO service_role;

ALTER TABLE public.bdi_versao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bdi_versao_select_empresa"
ON public.bdi_versao FOR SELECT TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao')
);

CREATE POLICY "bdi_versao_insert_empresa"
ON public.bdi_versao FOR INSERT TO authenticated
WITH CHECK (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'incluir', 'composicao')
  AND status = 'rascunho'
  AND created_by = auth.uid()
);

CREATE POLICY "bdi_versao_update_empresa"
ON public.bdi_versao FOR UPDATE TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND status IN ('rascunho','em_revisao')
)
WITH CHECK (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND status IN ('rascunho','em_revisao')
);

CREATE POLICY "bdi_versao_delete_admin_rascunho"
ON public.bdi_versao FOR DELETE TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND status = 'rascunho'
);

-- =========================================================
-- bdi_posto
-- =========================================================
CREATE TABLE public.bdi_posto (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL,
  bdi_versao_id      uuid NOT NULL REFERENCES public.bdi_versao(id) ON DELETE CASCADE,
  cargo              text NOT NULL,
  qtd                integer NOT NULL DEFAULT 0 CHECK (qtd >= 0),
  local              text NULL,
  salario_base       numeric(14,2) NOT NULL DEFAULT 0 CHECK (salario_base >= 0),
  va                 numeric(14,2) NOT NULL DEFAULT 0 CHECK (va >= 0),
  vt                 numeric(14,2) NOT NULL DEFAULT 0 CHECK (vt >= 0),
  uniformes          numeric(14,2) NOT NULL DEFAULT 0 CHECK (uniformes >= 0),
  epis               numeric(14,2) NOT NULL DEFAULT 0 CHECK (epis  >= 0),
  insalubridade_pct  numeric(7,4)  NOT NULL DEFAULT 0,
  periculosidade_pct numeric(7,4)  NOT NULL DEFAULT 0,
  ordem              integer NOT NULL DEFAULT 0,
  observacao         text NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bdi_posto_versao  ON public.bdi_posto (bdi_versao_id, ordem);
CREATE INDEX idx_bdi_posto_empresa ON public.bdi_posto (empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bdi_posto TO authenticated;
GRANT ALL ON public.bdi_posto TO service_role;

ALTER TABLE public.bdi_posto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bdi_posto_select_empresa"
ON public.bdi_posto FOR SELECT TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao')
);

CREATE POLICY "bdi_posto_insert_empresa"
ON public.bdi_posto FOR INSERT TO authenticated
WITH CHECK (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'incluir', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_posto.bdi_versao_id
                AND v.empresa_id = bdi_posto.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
);

CREATE POLICY "bdi_posto_update_empresa"
ON public.bdi_posto FOR UPDATE TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_posto.bdi_versao_id
                AND v.empresa_id = bdi_posto.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
)
WITH CHECK (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_posto.bdi_versao_id
                AND v.empresa_id = bdi_posto.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
);

CREATE POLICY "bdi_posto_delete_empresa"
ON public.bdi_posto FOR DELETE TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_posto.bdi_versao_id
                AND v.empresa_id = bdi_posto.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
);

-- =========================================================
-- bdi_verba_folha
-- =========================================================
CREATE TABLE public.bdi_verba_folha (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL,
  bdi_versao_id  uuid NOT NULL REFERENCES public.bdi_versao(id) ON DELETE CASCADE,
  rubrica        text NOT NULL,
  percentual     numeric(7,4) NOT NULL DEFAULT 0,
  ordem          integer NOT NULL DEFAULT 0,
  observacao     text NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bdi_verba_folha_unq UNIQUE (bdi_versao_id, rubrica)
);

CREATE INDEX idx_bdi_verba_folha_versao  ON public.bdi_verba_folha (bdi_versao_id, ordem);
CREATE INDEX idx_bdi_verba_folha_empresa ON public.bdi_verba_folha (empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bdi_verba_folha TO authenticated;
GRANT ALL ON public.bdi_verba_folha TO service_role;

ALTER TABLE public.bdi_verba_folha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bdi_verba_folha_select_empresa"
ON public.bdi_verba_folha FOR SELECT TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao')
);

CREATE POLICY "bdi_verba_folha_insert_empresa"
ON public.bdi_verba_folha FOR INSERT TO authenticated
WITH CHECK (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'incluir', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_verba_folha.bdi_versao_id
                AND v.empresa_id = bdi_verba_folha.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
);

CREATE POLICY "bdi_verba_folha_update_empresa"
ON public.bdi_verba_folha FOR UPDATE TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_verba_folha.bdi_versao_id
                AND v.empresa_id = bdi_verba_folha.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
)
WITH CHECK (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_verba_folha.bdi_versao_id
                AND v.empresa_id = bdi_verba_folha.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
);

CREATE POLICY "bdi_verba_folha_delete_empresa"
ON public.bdi_verba_folha FOR DELETE TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_verba_folha.bdi_versao_id
                AND v.empresa_id = bdi_verba_folha.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
);

-- =========================================================
-- bdi_item (composicao/ESTIMATIVA — NAO e item de compra)
-- =========================================================
CREATE TABLE public.bdi_item (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL,
  bdi_versao_id           uuid NOT NULL REFERENCES public.bdi_versao(id) ON DELETE CASCADE,
  grupo                   public.bdi_item_grupo NOT NULL,
  campo_key               text NOT NULL,
  label                   text NOT NULL,
  tipo                    public.bdi_item_tipo NOT NULL DEFAULT 'moeda',
  valor                   numeric(18,6) NOT NULL DEFAULT 0,
  produto_servico_id      uuid NULL REFERENCES public.produto_servico(id) ON DELETE RESTRICT,
  unidade                 text NULL,
  quantidade              numeric(18,6) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  valor_unitario_estimado numeric(18,6) NOT NULL DEFAULT 0 CHECK (valor_unitario_estimado >= 0),
  valor_total_estimado    numeric(18,6) GENERATED ALWAYS AS (quantidade * valor_unitario_estimado) STORED,
  ordem                   integer NOT NULL DEFAULT 0,
  observacao              text NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bdi_item_unq UNIQUE (bdi_versao_id, grupo, campo_key)
);

COMMENT ON TABLE public.bdi_item IS
  'Item de composicao/ESTIMATIVA do BDI. NAO e item de compra formal — ver public.requisicao_compra_item e public.cotacao_item para o fluxo real de Suprimentos. produto_servico_id e vinculo opcional ao catalogo, sem efeito em estoque/compras.';

CREATE INDEX idx_bdi_item_versao_grupo ON public.bdi_item (bdi_versao_id, grupo, ordem);
CREATE INDEX idx_bdi_item_empresa      ON public.bdi_item (empresa_id);
CREATE INDEX idx_bdi_item_produto      ON public.bdi_item (produto_servico_id) WHERE produto_servico_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bdi_item TO authenticated;
GRANT ALL ON public.bdi_item TO service_role;

ALTER TABLE public.bdi_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bdi_item_select_empresa"
ON public.bdi_item FOR SELECT TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao')
);

CREATE POLICY "bdi_item_insert_empresa"
ON public.bdi_item FOR INSERT TO authenticated
WITH CHECK (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'incluir', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_item.bdi_versao_id
                AND v.empresa_id = bdi_item.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
);

CREATE POLICY "bdi_item_update_empresa"
ON public.bdi_item FOR UPDATE TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_item.bdi_versao_id
                AND v.empresa_id = bdi_item.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
)
WITH CHECK (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_item.bdi_versao_id
                AND v.empresa_id = bdi_item.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
);

CREATE POLICY "bdi_item_delete_empresa"
ON public.bdi_item FOR DELETE TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
  AND EXISTS (SELECT 1 FROM public.bdi_versao v
              WHERE v.id = bdi_item.bdi_versao_id
                AND v.empresa_id = bdi_item.empresa_id
                AND v.status IN ('rascunho','em_revisao'))
);

-- =========================================================
-- bdi_aprovacao (LOG INTERNO — SELECT only para authenticated)
-- =========================================================
CREATE TABLE public.bdi_aprovacao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL,
  bdi_versao_id  uuid NOT NULL REFERENCES public.bdi_versao(id) ON DELETE CASCADE,
  acao           public.bdi_aprovacao_acao NOT NULL,
  de_status      public.bdi_status NULL,
  para_status    public.bdi_status NOT NULL,
  ator_id        uuid NOT NULL,
  justificativa  text NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bdi_aprovacao IS
  'Log interno de transicoes da versao BDI. NAO e motor de aprovacao — alcadas formais usam sup_aprov_* / licitacao_etapa. Escrita exclusiva por RPCs SECURITY DEFINER (M3).';

CREATE INDEX idx_bdi_aprovacao_versao  ON public.bdi_aprovacao (bdi_versao_id, created_at DESC);
CREATE INDEX idx_bdi_aprovacao_empresa ON public.bdi_aprovacao (empresa_id);

GRANT SELECT ON public.bdi_aprovacao TO authenticated;
GRANT ALL    ON public.bdi_aprovacao TO service_role;

ALTER TABLE public.bdi_aprovacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bdi_aprovacao_select_empresa"
ON public.bdi_aprovacao FOR SELECT TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao')
);

-- =========================================================
-- bdi_snapshot (SELECT only para authenticated)
-- =========================================================
CREATE TABLE public.bdi_snapshot (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL,
  bdi_versao_id  uuid NOT NULL REFERENCES public.bdi_versao(id) ON DELETE CASCADE,
  payload        jsonb NOT NULL,
  totais         jsonb NOT NULL DEFAULT '{}'::jsonb,
  gerado_por     uuid NOT NULL,
  gerado_em      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bdi_snapshot IS
  'Snapshot imutavel do BDI em pontos relevantes do ciclo. Escrita exclusiva por RPCs SECURITY DEFINER (M3).';

CREATE INDEX idx_bdi_snapshot_versao  ON public.bdi_snapshot (bdi_versao_id, gerado_em DESC);
CREATE INDEX idx_bdi_snapshot_empresa ON public.bdi_snapshot (empresa_id);

GRANT SELECT ON public.bdi_snapshot TO authenticated;
GRANT ALL    ON public.bdi_snapshot TO service_role;

ALTER TABLE public.bdi_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bdi_snapshot_select_empresa"
ON public.bdi_snapshot FOR SELECT TO authenticated
USING (
  public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  AND public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao')
);