-- =========================================================================
-- JURÍDICO — Gestão de Advertências (solicitação → aprovação → jurídico)
--
-- Fluxo (espelha o de vagas do Recrutamento):
--   Encarregado cria  → status 'Aguardando Aprovação'
--   Analista do contrato aprova/reprova → 'Aguardando Jurídico' | 'Reprovada'
--   Jurídico conclui → 'Concluída'
--
-- O aprovador é o ANALISTA do contrato do colaborador: CONTRATOS.analista
-- guarda o "ID" do analista (de EMPREGADOS); o usuário logado é amarrado ao
-- seu EMPREGADOS por auth_user_id. A trava de quem aprova/conclui é na UI
-- (igual ao Recrutamento). Colaborador é OBRIGATÓRIO (vem de EMPREGADOS).
--
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."SISTEMA_SOLICITACOES_ADVERTENCIA" (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  status_changed_at   timestamptz NOT NULL DEFAULT now(),

  -- solicitante (encarregado)
  solicitante_nome    text,
  solicitante_email   text,

  -- colaborador advertido (de EMPREGADOS) — obrigatório
  colaborador_id      bigint,
  colaborador_nome    text NOT NULL,
  colaborador_cpf     text,
  colaborador_cargo   text,
  colaborador_filial  text,

  -- contrato do colaborador (para achar o analista que aprova)
  contrato            text,
  contrato_id         bigint,

  -- dados da advertência
  tipo_advertencia        text,     -- Verbal | Escrita | Suspensão
  grau                    text,     -- Baixo | Médio | Alto
  descricao_ocorrido      text,
  data_ocorrido           date,
  ja_advertencia_anterior boolean NOT NULL DEFAULT false,  -- (legado; o histórico vem da própria tabela)
  detalhe_anterior        text,
  advertencia_verbal_dada boolean NOT NULL DEFAULT false,
  data_advertencia_verbal date,

  -- fluxo / decisão
  status              text NOT NULL DEFAULT 'Aguardando Aprovação',
  aprovado_por_nome   text,
  motivo_reprovacao   text,
  parecer_juridico    text,
  resultado           text,         -- Advertência aplicada | Arquivada | ...
  concluido_por_nome  text
);

CREATE INDEX IF NOT EXISTS adv_status_idx     ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"(status);
CREATE INDEX IF NOT EXISTS adv_contrato_idx   ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"(contrato_id);
CREATE INDEX IF NOT EXISTS adv_solicitante_idx ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"(solicitante_email);
CREATE INDEX IF NOT EXISTS adv_criado_idx     ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"(created_at DESC);

-- Carimba status_changed_at/updated_at quando o status muda (p/ "tempo no status").
CREATE OR REPLACE FUNCTION public.adv_track_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_adv_track_status ON public."SISTEMA_SOLICITACOES_ADVERTENCIA";
CREATE TRIGGER trg_adv_track_status
  BEFORE UPDATE ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"
  FOR EACH ROW EXECUTE FUNCTION public.adv_track_status_change();

ALTER TABLE public."SISTEMA_SOLICITACOES_ADVERTENCIA" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_SOLICITACOES_ADVERTENCIA" TO authenticated;
DROP POLICY IF EXISTS "SISTEMA_SOLICITACOES_ADVERTENCIA_all_auth" ON public."SISTEMA_SOLICITACOES_ADVERTENCIA";
CREATE POLICY "SISTEMA_SOLICITACOES_ADVERTENCIA_all_auth" ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
