-- ============================================================
-- Módulo Licitação — Grade, Capa de Edital, Implantação
-- Rodar no SQL Editor do Supabase (uma vez)
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE grade_fase AS ENUM (
  'À Iniciar',
  'Em Andamento',
  'Finalizada',
  'Não Participado',
  'Suspenso/Revogado'
);

CREATE TYPE capa_status AS ENUM (
  'Em andamento',
  'Ganhamos',
  'Perdemos'
);

CREATE TYPE implantacao_status AS ENUM (
  'ativo',
  'encerrado'
);

-- ── Ordem de criação (sem FKs circulares) ───────────────────
-- 1. grade          (sem capa_id FK ainda)
-- 2. implantacao_contrato (sem capa_id FK ainda)
-- 3. capa_edital    (referencia grade + implantacao_contrato)
-- 4. ALTER TABLE grade        → adiciona FK capa_id → capa_edital
-- 5. ALTER TABLE implantacao_contrato → adiciona FK capa_id → capa_edital
-- 6. checklist_items
-- 7. respostas

-- ── Tabela 1: grade ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.grade (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  edital          text,
  fase            grade_fase NOT NULL DEFAULT 'À Iniciar',
  responsavel     text,

  cidade          text,
  uf              char(2),
  data            date,
  horario         text,

  objeto          text,
  qtd_pessoas     integer,
  valor_global    text,
  posicao         integer,
  status_obs      text,

  -- FK adicionada após capa_edital existir (ver ALTER TABLE abaixo)
  capa_id         uuid,

  historico       jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Tabela 2: implantacao_contrato ────────────────────────────

CREATE TABLE IF NOT EXISTS public.implantacao_contrato (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  nome            text NOT NULL,

  -- FK adicionada após capa_edital existir (ver ALTER TABLE abaixo)
  capa_id         uuid,

  status          implantacao_status NOT NULL DEFAULT 'ativo',

  data_inicio         date,
  abertura            text,
  reuniao_alinhamento date,
  data_homologacao    text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Tabela 3: capa_edital ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.capa_edital (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  grade_id        uuid REFERENCES public.grade(id) ON DELETE SET NULL,
  licitacao_id    uuid REFERENCES public.licitacao(id) ON DELETE SET NULL,

  cidade          text,
  objeto          text,
  modalidade      text,
  local           text,
  forma_julgamento        text,
  atestado_cap_tecnica    text,
  escritorio              text,

  abertura                text,
  prazo_impugnacao        text,
  prazo_recurso           text,
  validade_proposta       text,
  prazo_contrato          text,
  visita_tecnica          text,
  data_inicio             date,

  qtd_postos      integer,
  carga_horaria   text,

  valor_estimado          text,
  issqn                   text,
  vale_transporte_valor   text,
  garantia                text,
  material                text,
  material_tipo           text,
  reajuste                text[],

  diluir_verbas               text,
  conta_vinculada             text,
  conta_vinculada_quem_abre   text,
  ponto_eletronico            text[],
  trabalho_escolar            text,

  observacoes     text,

  status              capa_status NOT NULL DEFAULT 'Em andamento',
  data_homologacao    timestamptz,
  reuniao_alinhamento date,

  contrato_id     uuid REFERENCES public.implantacao_contrato(id) ON DELETE SET NULL,

  historico       jsonb NOT NULL DEFAULT '[]'::jsonb,
  preenchido_em   date,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── FKs circulares (agora que capa_edital existe) ─────────────

ALTER TABLE public.grade
  ADD CONSTRAINT grade_capa_id_fkey
  FOREIGN KEY (capa_id) REFERENCES public.capa_edital(id) ON DELETE SET NULL;

ALTER TABLE public.implantacao_contrato
  ADD CONSTRAINT implantacao_contrato_capa_id_fkey
  FOREIGN KEY (capa_id) REFERENCES public.capa_edital(id) ON DELETE SET NULL;

-- ── Tabela 4: checklist_items ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checklist_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  setor           text NOT NULL,
  momento         text,
  item            text NOT NULL,
  tipo_resposta   text NOT NULL DEFAULT 'simnao',

  plano_acao      text,
  responsavel_acao text,
  onde            text,
  prazo_limite    text,

  ordem           integer NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Tabela 5: respostas ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.respostas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id         uuid NOT NULL REFERENCES public.implantacao_contrato(id) ON DELETE CASCADE,
  checklist_item_id   uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,

  resposta            text,
  obs                 text,

  respondido_por      uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (contrato_id, checklist_item_id)
);

-- ── Índices ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_grade_empresa       ON public.grade(empresa_id);
CREATE INDEX IF NOT EXISTS idx_grade_fase          ON public.grade(fase);
CREATE INDEX IF NOT EXISTS idx_grade_data          ON public.grade(data);

CREATE INDEX IF NOT EXISTS idx_capa_empresa        ON public.capa_edital(empresa_id);
CREATE INDEX IF NOT EXISTS idx_capa_status         ON public.capa_edital(status);
CREATE INDEX IF NOT EXISTS idx_capa_grade          ON public.capa_edital(grade_id);
CREATE INDEX IF NOT EXISTS idx_capa_licitacao      ON public.capa_edital(licitacao_id);

CREATE INDEX IF NOT EXISTS idx_implantacao_empresa ON public.implantacao_contrato(empresa_id);
CREATE INDEX IF NOT EXISTS idx_implantacao_capa    ON public.implantacao_contrato(capa_id);

CREATE INDEX IF NOT EXISTS idx_checklist_setor     ON public.checklist_items(setor);
CREATE INDEX IF NOT EXISTS idx_checklist_momento   ON public.checklist_items(momento);
CREATE INDEX IF NOT EXISTS idx_checklist_ordem     ON public.checklist_items(ordem);

CREATE INDEX IF NOT EXISTS idx_respostas_contrato  ON public.respostas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_respostas_item      ON public.respostas(checklist_item_id);

-- ── updated_at automático ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grade_updated_at
  BEFORE UPDATE ON public.grade
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_capa_updated_at
  BEFORE UPDATE ON public.capa_edital
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_implantacao_updated_at
  BEFORE UPDATE ON public.implantacao_contrato
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_respostas_updated_at
  BEFORE UPDATE ON public.respostas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE public.grade                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capa_edital           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implantacao_contrato  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas             ENABLE ROW LEVEL SECURITY;

-- grade
CREATE POLICY "grade_select" ON public.grade FOR SELECT TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
CREATE POLICY "grade_insert" ON public.grade FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
CREATE POLICY "grade_update" ON public.grade FOR UPDATE TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
CREATE POLICY "grade_delete" ON public.grade FOR DELETE TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));

-- capa_edital
CREATE POLICY "capa_select" ON public.capa_edital FOR SELECT TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
CREATE POLICY "capa_insert" ON public.capa_edital FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
CREATE POLICY "capa_update" ON public.capa_edital FOR UPDATE TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
CREATE POLICY "capa_delete" ON public.capa_edital FOR DELETE TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));

-- implantacao_contrato
CREATE POLICY "implantacao_select" ON public.implantacao_contrato FOR SELECT TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
CREATE POLICY "implantacao_insert" ON public.implantacao_contrato FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
CREATE POLICY "implantacao_update" ON public.implantacao_contrato FOR UPDATE TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));

-- checklist_items: somente leitura (tabela estática)
CREATE POLICY "checklist_select" ON public.checklist_items FOR SELECT TO authenticated
  USING (true);

-- respostas
CREATE POLICY "respostas_select" ON public.respostas FOR SELECT TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
CREATE POLICY "respostas_insert" ON public.respostas FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
CREATE POLICY "respostas_update" ON public.respostas FOR UPDATE TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));

-- ── Comentários ───────────────────────────────────────────────

COMMENT ON TABLE public.grade IS
  'Grade de Licitações — registro inicial de editais antes da análise completa.';
COMMENT ON TABLE public.capa_edital IS
  'Capa de Edital — detalhamento completo da licitação, controla o fluxo até a homologação.';
COMMENT ON TABLE public.implantacao_contrato IS
  'Contratos criados a partir de licitações ganhas, usados no checklist de implantação.';
COMMENT ON TABLE public.checklist_items IS
  'Itens estáticos do checklist de implantação (migrados do Excel). Não sofrem edição frequente.';
COMMENT ON TABLE public.respostas IS
  'Respostas do checklist por contrato e por usuário/setor.';
