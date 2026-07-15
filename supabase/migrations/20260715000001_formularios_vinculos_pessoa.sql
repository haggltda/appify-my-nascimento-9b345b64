-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — vínculo manual "nome citado" ⇄ EMPREGADOS
--
-- As respostas guardam o nome como TEXTO LIVRE ("João Peretti"), então quem
-- tem o nome completo diferente no cadastro ("João Pedro Peretti") nunca casa
-- e fica sem ficha. Esta tabela guarda o de-para feito à mão na tela de
-- Respostas: nome_norm (normalizado) → registro de EMPREGADOS.
--
-- nome_norm é gerado no client (mesma regra do normNome do front: sem acento,
-- espaços colapsados, MAIÚSCULAS) — por isso não há unaccent aqui.
-- empregado_nome é snapshot só p/ exibir; a verdade é empregado_id.
--
-- Sem FK para EMPREGADOS: a tabela é legado importado e "ID" não tem PK
-- declarada. Vínculo órfão (empregado apagado) simplesmente não resolve.
--
-- RLS no padrão do módulo: gating na UI + policy permissiva p/ authenticated
-- (a própria EMPREGADOS já é update-livre p/ authenticated — ver
-- 20260622000025_empregados_rh_update.sql).
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."CS_FORM_VINCULOS" (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome_norm      text        NOT NULL,   -- texto da resposta, normalizado
  nome_texto     text        NOT NULL,   -- como apareceu na resposta
  empregado_id   bigint      NOT NULL,
  empregado_nome text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  criado_por     uuid        DEFAULT auth.uid()
);

-- Um texto só aponta p/ um empregado (upsert por nome_norm na UI).
CREATE UNIQUE INDEX IF NOT EXISTS cs_form_vinculos_nome_norm_uidx
  ON public."CS_FORM_VINCULOS"(nome_norm);
-- Caminho inverso: todos os apelidos de um empregado (usado p/ cruzar
-- participação em formulários).
CREATE INDEX IF NOT EXISTS cs_form_vinculos_emp_idx
  ON public."CS_FORM_VINCULOS"(empregado_id);

DROP TRIGGER IF EXISTS trg_cs_form_vinculos_updated ON public."CS_FORM_VINCULOS";
CREATE TRIGGER trg_cs_form_vinculos_updated BEFORE UPDATE ON public."CS_FORM_VINCULOS"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public."CS_FORM_VINCULOS" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cs_form_vinculos_select ON public."CS_FORM_VINCULOS";
CREATE POLICY cs_form_vinculos_select ON public."CS_FORM_VINCULOS"
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cs_form_vinculos_write ON public."CS_FORM_VINCULOS";
CREATE POLICY cs_form_vinculos_write ON public."CS_FORM_VINCULOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
