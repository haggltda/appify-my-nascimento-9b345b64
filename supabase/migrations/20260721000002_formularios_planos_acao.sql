-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — Planos de ação definidos nos feedbacks
--
-- O plano de ação JÁ EXISTE dentro do formulário: são as perguntas
-- "Ação definida (treinamento ou acompanhamento)" e "Prazo para Ação".
-- Cada resposta preenchida nessas duas perguntas É um plano de ação —
-- hoje já são ~80 deles. Nada disso precisa ser redigitado.
--
-- O que a resposta NÃO tem é o acompanhamento: ninguém volta no formulário
-- para dizer "concluí", "cancelei", "isto é prioridade alta". É só isso que
-- esta tabela guarda — uma CAMADA sobre a resposta, ligada por resposta_id.
--
-- Decisões:
--   • `resposta_id` é UNIQUE: uma resposta tem no máximo um acompanhamento.
--   • `acao` e `prazo` são NULL no caso normal — a fonte é a resposta. Só se
--     preenchem quando alguém corrige o texto/prazo pela tela (override) ou
--     quando o plano é avulso, sem resposta de origem.
--   • Um registro precisa OU apontar para uma resposta OU se bastar sozinho
--     (ação + prazo próprios) — é o que o CHECK abaixo garante.
--   • A SITUAÇÃO (no prazo / atrasado / vencido) NÃO é coluna: é derivada de
--     status + prazo + concluido_em. Gravar situação daria dado velho no dia
--     seguinte — um plano "em andamento" vira "vencido" sozinho quando o
--     prazo passa, sem ninguém tocar no registro.
--
-- Permissões: mesma capacidade que já governa as respostas (cs_form_cap).
-- Quem enxerga as respostas enxerga os planos; quem só vê as próprias, idem.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."CS_FORM_PLANOS_ACAO" (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id  uuid NOT NULL REFERENCES public."CS_FORMULARIOS"(id) ON DELETE CASCADE,
  resposta_id    uuid UNIQUE REFERENCES public."CS_FORM_RESPOSTAS"(id) ON DELETE CASCADE,

  -- Normalmente NULL: a ação e o prazo vêm das perguntas 14 e 15 da resposta.
  -- Preenchidos só em override manual ou plano avulso.
  acao           text,
  prazo          date,
  detalhe        text,                       -- observações do acompanhamento

  -- Idem: colaborador/setor/liderança vêm da resposta; aqui só se sobrescreve.
  colaborador       text,
  colaborador_id    bigint,                  -- EMPREGADOS."ID" quando resolvido
  lideranca         text,
  setor             text,
  empresa           text,

  origem         text NOT NULL DEFAULT 'Outro',
  prioridade     text NOT NULL DEFAULT 'Média',
  status         text NOT NULL DEFAULT 'Em andamento',
  concluido_em   date,                       -- preenchido ao concluir

  criado_por     uuid DEFAULT auth.uid(),
  criado_por_nome text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,

  CONSTRAINT cs_plano_origem_chk     CHECK (origem     IN ('Desenvolvimento', 'Liderança', 'Alinhamento e Entrega', 'Outro')),
  CONSTRAINT cs_plano_prioridade_chk CHECK (prioridade IN ('Alta', 'Média', 'Baixa')),
  CONSTRAINT cs_plano_status_chk     CHECK (status     IN ('Em andamento', 'Concluído', 'Cancelado')),
  -- Concluído sem data de conclusão deixaria "no prazo × com atraso" indecidível.
  CONSTRAINT cs_plano_concluido_chk  CHECK (status <> 'Concluído' OR concluido_em IS NOT NULL),
  -- Ou é acompanhamento de uma resposta, ou é um plano que se basta sozinho.
  CONSTRAINT cs_plano_fonte_chk      CHECK (resposta_id IS NOT NULL OR (acao IS NOT NULL AND prazo IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS cs_planos_form_idx     ON public."CS_FORM_PLANOS_ACAO"(formulario_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cs_planos_status_idx   ON public."CS_FORM_PLANOS_ACAO"(status) WHERE deleted_at IS NULL;

-- updated_at sempre que a linha muda
CREATE OR REPLACE FUNCTION public.cs_planos_touch() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS cs_planos_touch_trg ON public."CS_FORM_PLANOS_ACAO";
CREATE TRIGGER cs_planos_touch_trg BEFORE UPDATE ON public."CS_FORM_PLANOS_ACAO"
  FOR EACH ROW EXECUTE FUNCTION public.cs_planos_touch();

-- ── Permissões ───────────────────────────────────────────────────────────
ALTER TABLE public."CS_FORM_PLANOS_ACAO" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CS_FORM_PLANOS_ACAO" FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CS_FORM_PLANOS_ACAO" TO authenticated;

DROP POLICY IF EXISTS cs_planos_select ON public."CS_FORM_PLANOS_ACAO";
CREATE POLICY cs_planos_select ON public."CS_FORM_PLANOS_ACAO"
  FOR SELECT TO authenticated USING (
    public.cs_form_cap('ver_tudo')
    OR (public.cs_form_cap('ver_proprias') AND criado_por = auth.uid()));

DROP POLICY IF EXISTS cs_planos_insert ON public."CS_FORM_PLANOS_ACAO";
CREATE POLICY cs_planos_insert ON public."CS_FORM_PLANOS_ACAO"
  FOR INSERT TO authenticated WITH CHECK (
    public.cs_form_cap('ver_tudo') OR public.cs_form_cap('ver_proprias'));

DROP POLICY IF EXISTS cs_planos_update ON public."CS_FORM_PLANOS_ACAO";
CREATE POLICY cs_planos_update ON public."CS_FORM_PLANOS_ACAO"
  FOR UPDATE TO authenticated USING (
    public.cs_form_cap('ver_tudo')
    OR (public.cs_form_cap('ver_proprias') AND criado_por = auth.uid()));

-- Exclusão é soft (UPDATE deleted_at); DELETE fica só para quem vê tudo.
DROP POLICY IF EXISTS cs_planos_delete ON public."CS_FORM_PLANOS_ACAO";
CREATE POLICY cs_planos_delete ON public."CS_FORM_PLANOS_ACAO"
  FOR DELETE TO authenticated USING (public.cs_form_cap('ver_tudo'));

NOTIFY pgrst, 'reload schema';
