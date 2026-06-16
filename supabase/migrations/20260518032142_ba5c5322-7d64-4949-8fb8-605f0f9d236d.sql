-- PR-1 REV 4 · SCHEMA-ONLY · Carga Profissional FCR
-- Cria 4 tabelas auxiliares vazias (fcr_batch, fcr_raw_excel,
-- fcr_sugestoes_pendencias, fcr_reconciliacao_lote) + índices + triggers + RLS.
-- Nenhum DML. Nenhuma alteração em mz_40, realizado_lancamentos,
-- stg_fluxo_caixa_realizado, saldos_iniciais_caixa, RPCs fluxo_caixa_diario*,
-- views runtime, frontend, CSV/PDF ou Edge Functions.

-- =====================================================================
-- 1) fcr_batch
-- =====================================================================
CREATE TABLE public.fcr_batch (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                  uuid NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  escopo_carga                text NOT NULL CHECK (escopo_carga IN ('empresa','consolidado')),
  arquivo_origem              text NOT NULL,
  storage_path                text NOT NULL,
  modo                        text NOT NULL CHECK (modo IN ('dry_run','promovido')),
  status                      text NOT NULL DEFAULT 'criado'
    CHECK (status IN ('criado','parseando','dry_run_ok','dry_run_erro',
                      'aguardando_aprovacao','promovendo','promovido',
                      'revertido','erro')),
  criado_por                  uuid NOT NULL,
  aprovado_por                uuid NULL,
  aprovado_em                 timestamptz NULL,
  revertido_por               uuid NULL,
  revertido_em                timestamptz NULL,
  totais_excel                jsonb,
  totais_promovidos           jsonb,
  saldos_finais_reconciliacao jsonb,
  observacao                  text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fcr_batch_empresa_x_escopo CHECK (
    (escopo_carga='empresa'     AND empresa_id IS NOT NULL) OR
    (escopo_carga='consolidado' AND empresa_id IS NULL)
  )
);
CREATE INDEX ix_fcr_batch_empresa_status ON public.fcr_batch(empresa_id, status, created_at DESC);
CREATE INDEX ix_fcr_batch_escopo         ON public.fcr_batch(escopo_carga, status);
CREATE INDEX ix_fcr_batch_modo           ON public.fcr_batch(modo, status);

CREATE TRIGGER trg_fcr_batch_updated
  BEFORE UPDATE ON public.fcr_batch
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2) fcr_raw_excel
-- =====================================================================
CREATE TABLE public.fcr_raw_excel (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                     uuid NOT NULL REFERENCES public.fcr_batch(id) ON DELETE CASCADE,
  empresa_id_origem_celula     text NULL,
  empresa_id_resolvida         uuid NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  status_resolucao_empresa     text NOT NULL DEFAULT 'pendente'
    CHECK (status_resolucao_empresa IN ('pendente','resolvida','ambigua','nao_aplicavel')),
  banco_origem_texto           text,
  conta_origem_texto           text,
  arquivo_origem               text NOT NULL,
  aba_origem                   text NOT NULL,
  linha_origem                 int  NOT NULL,
  coluna_origem                int  NOT NULL,
  endereco_celula              text NOT NULL,
  cabecalho_coluna             text,
  data_caixa_derivada          date,
  classificacao_excel_original text,
  historico_original           text,
  valor_celula_texto           text,
  valor_numerico               numeric(18,2),
  tipo_linha                   text NOT NULL DEFAULT 'movimento'
    CHECK (tipo_linha IN ('movimento','saldo_inicial','saldo_final','subtotal','calculada','cabecalho','vazia')),
  bloco_funcional              text NOT NULL DEFAULT 'operacional'
    CHECK (bloco_funcional IN (
      'operacional','nao_operacional','resultado_financeiro','socios',
      'intercompany_mutuo','transferencia_interna','aplicacao_resgate',
      'credito_cheque_especial','a_conciliar','saldo','subtotal'
    )),
  par_transferencia_id         uuid NULL,
  raw_json                     jsonb,
  hash_idempotencia            text NOT NULL,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_fcr_raw_hash      ON public.fcr_raw_excel(hash_idempotencia);
CREATE UNIQUE INDEX ux_fcr_raw_cell      ON public.fcr_raw_excel(batch_id, aba_origem, linha_origem, coluna_origem);
CREATE INDEX ix_fcr_raw_dia              ON public.fcr_raw_excel(batch_id, empresa_id_resolvida, data_caixa_derivada);
CREATE INDEX ix_fcr_raw_tipo             ON public.fcr_raw_excel(batch_id, tipo_linha);
CREATE INDEX ix_fcr_raw_bloco            ON public.fcr_raw_excel(batch_id, bloco_funcional);
CREATE INDEX ix_fcr_raw_status_emp       ON public.fcr_raw_excel(batch_id, status_resolucao_empresa);
CREATE INDEX ix_fcr_raw_par_transf       ON public.fcr_raw_excel(par_transferencia_id) WHERE par_transferencia_id IS NOT NULL;
CREATE INDEX ix_fcr_raw_empresa_data     ON public.fcr_raw_excel(empresa_id_resolvida, data_caixa_derivada) WHERE empresa_id_resolvida IS NOT NULL;

CREATE TRIGGER trg_fcr_raw_updated
  BEFORE UPDATE ON public.fcr_raw_excel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 3) fcr_sugestoes_pendencias
-- =====================================================================
CREATE TABLE public.fcr_sugestoes_pendencias (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                      uuid NOT NULL REFERENCES public.fcr_batch(id) ON DELETE CASCADE,
  empresa_id                    uuid NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  raw_id                        uuid NOT NULL REFERENCES public.fcr_raw_excel(id) ON DELETE CASCADE,
  classificacao_excel_original  text,
  historico_original            text,
  data_caixa                    date,
  valor_original                numeric(18,2),
  tipo_pendencia                text NOT NULL CHECK (tipo_pendencia IN (
    'sem_de_para','de_para_ambiguo','classificacao_nova',
    'banco_nao_reconhecido','linha_calculada_ambigua','a_conciliar',
    'empresa_nao_resolvida'
  )),
  destino_proposto              text CHECK (destino_proposto IN (
    'realizado_lancamentos','saldos_iniciais_caixa','ignorar','a_conciliar'
  )),
  sugestao_conta_contabil_id    uuid REFERENCES public.conta_contabil(id) ON DELETE SET NULL,
  sugestao_dre_linha_id         uuid REFERENCES public.dre_linhas(id)     ON DELETE SET NULL,
  status                        text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovada','rejeitada','aplicada')),
  resolvido_por                 uuid,
  resolvido_em                  timestamptz,
  motivo                        text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_fcr_pend_raw       ON public.fcr_sugestoes_pendencias(batch_id, raw_id);
CREATE INDEX ix_fcr_pend_status           ON public.fcr_sugestoes_pendencias(empresa_id, status, tipo_pendencia);
CREATE INDEX ix_fcr_pend_batch_status     ON public.fcr_sugestoes_pendencias(batch_id, status);
CREATE INDEX ix_fcr_pend_tipo             ON public.fcr_sugestoes_pendencias(batch_id, tipo_pendencia);

CREATE TRIGGER trg_fcr_pend_updated
  BEFORE UPDATE ON public.fcr_sugestoes_pendencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 4) fcr_reconciliacao_lote
-- =====================================================================
CREATE TABLE public.fcr_reconciliacao_lote (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            uuid NOT NULL REFERENCES public.fcr_batch(id) ON DELETE CASCADE,
  empresa_id          uuid NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  escopo              text NOT NULL CHECK (escopo IN (
    'dia','classificacao_original','dre_linha','banco','empresa',
    'bloco_especial','total','consolidado'
  )),
  chave               text NOT NULL,
  valor_excel         numeric(18,2) NOT NULL DEFAULT 0,
  valor_sistema       numeric(18,2) NOT NULL DEFAULT 0,
  diferenca           numeric(18,2) GENERATED ALWAYS AS (valor_excel - valor_sistema) STORED,
  qtd_linhas_excel    int NOT NULL DEFAULT 0,
  qtd_linhas_sistema  int NOT NULL DEFAULT 0,
  qtd_pendencias      int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fcr_recon_empresa_x_escopo CHECK (
    empresa_id IS NOT NULL OR escopo IN ('total','consolidado','bloco_especial')
  )
);
CREATE UNIQUE INDEX ux_fcr_recon ON public.fcr_reconciliacao_lote(
  batch_id,
  COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid),
  escopo, chave
);
CREATE INDEX ix_fcr_recon_escopo  ON public.fcr_reconciliacao_lote(batch_id, escopo);
CREATE INDEX ix_fcr_recon_empresa ON public.fcr_reconciliacao_lote(empresa_id, escopo);

-- =====================================================================
-- 5) RLS
-- =====================================================================
ALTER TABLE public.fcr_batch                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcr_raw_excel            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcr_sugestoes_pendencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcr_reconciliacao_lote   ENABLE ROW LEVEL SECURITY;

-- ----- fcr_batch -----
CREATE POLICY fcr_batch_select ON public.fcr_batch FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'presidencia'::app_role)
  OR has_role(auth.uid(),'diretor_adm'::app_role)
  OR (
    (has_role(auth.uid(),'controladoria'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
    AND escopo_carga = 'empresa'
    AND empresa_id   = public.get_user_empresa(auth.uid())
  )
);
CREATE POLICY fcr_batch_insert ON public.fcr_batch FOR INSERT TO authenticated
WITH CHECK (
  criado_por = auth.uid()
  AND (
    has_role(auth.uid(),'admin'::app_role)
    OR (
      (has_role(auth.uid(),'presidencia'::app_role) OR has_role(auth.uid(),'diretor_adm'::app_role))
      AND escopo_carga = 'consolidado'
    )
    OR (
      (has_role(auth.uid(),'controladoria'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
      AND escopo_carga = 'empresa'
      AND empresa_id   = public.get_user_empresa(auth.uid())
    )
  )
);
CREATE POLICY fcr_batch_update ON public.fcr_batch FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (
    escopo_carga = 'consolidado'
    AND (has_role(auth.uid(),'presidencia'::app_role) OR has_role(auth.uid(),'diretor_adm'::app_role))
  )
  OR (
    escopo_carga = 'empresa'
    AND (has_role(auth.uid(),'controladoria'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
    AND empresa_id = public.get_user_empresa(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR (
    escopo_carga = 'consolidado'
    AND (has_role(auth.uid(),'presidencia'::app_role) OR has_role(auth.uid(),'diretor_adm'::app_role))
  )
  OR (
    escopo_carga = 'empresa'
    AND (has_role(auth.uid(),'controladoria'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
    AND empresa_id = public.get_user_empresa(auth.uid())
  )
);
CREATE POLICY fcr_batch_delete ON public.fcr_batch FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role));

-- ----- fcr_raw_excel -----
CREATE POLICY fcr_raw_select ON public.fcr_raw_excel FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'presidencia'::app_role)
  OR has_role(auth.uid(),'diretor_adm'::app_role)
  OR (
    (has_role(auth.uid(),'controladoria'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
    AND empresa_id_resolvida = public.get_user_empresa(auth.uid())
  )
);
-- Sem policies de INSERT/UPDATE/DELETE para authenticated. Writes só via service_role em PRs futuros.

-- ----- fcr_sugestoes_pendencias -----
CREATE POLICY fcr_pend_select ON public.fcr_sugestoes_pendencias FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'presidencia'::app_role)
  OR has_role(auth.uid(),'diretor_adm'::app_role)
  OR (
    (has_role(auth.uid(),'controladoria'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
    AND empresa_id IS NOT NULL
    AND empresa_id = public.get_user_empresa(auth.uid())
  )
);
CREATE POLICY fcr_pend_update ON public.fcr_sugestoes_pendencias FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (
    empresa_id IS NULL
    AND (has_role(auth.uid(),'presidencia'::app_role) OR has_role(auth.uid(),'diretor_adm'::app_role))
  )
  OR (
    (has_role(auth.uid(),'controladoria'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
    AND empresa_id IS NOT NULL
    AND empresa_id = public.get_user_empresa(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR (
    empresa_id IS NULL
    AND (has_role(auth.uid(),'presidencia'::app_role) OR has_role(auth.uid(),'diretor_adm'::app_role))
  )
  OR (
    (has_role(auth.uid(),'controladoria'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
    AND empresa_id IS NOT NULL
    AND empresa_id = public.get_user_empresa(auth.uid())
  )
);
CREATE POLICY fcr_pend_delete ON public.fcr_sugestoes_pendencias FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role));
-- Sem INSERT: writes só via service_role.

-- ----- fcr_reconciliacao_lote -----
CREATE POLICY fcr_recon_select ON public.fcr_reconciliacao_lote FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'presidencia'::app_role)
  OR has_role(auth.uid(),'diretor_adm'::app_role)
  OR (
    (has_role(auth.uid(),'controladoria'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
    AND empresa_id IS NOT NULL
    AND empresa_id = public.get_user_empresa(auth.uid())
  )
);
-- Sem INSERT/UPDATE/DELETE: writes só via service_role.
