-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — "criar formulários por setor" (setor-dono)
--
-- Novo formato de grant POR USUÁRIO, parametrizado por setor, IRMÃO do
-- 'ver_setor' (20260715000003) mas com semântica de DONO do formulário:
--
--   papel 'criar_setor' + setor = 'COMPRAS'  → o usuário
--     • só CRIA formulários carimbados com setor = 'COMPRAS' (e edita as
--       perguntas deles — é o criado_por);
--     • VÊ todas as respostas dos formulários cujo setor = 'COMPRAS',
--       de qualquer respondente.
--
-- Diferença p/ 'ver_setor': ver_setor classifica pelo SETOR DO RESPONDENTE
-- (CS_FORM_RESPOSTAS.setor); criar_setor classifica pelo SETOR DONO DO
-- FORMULÁRIO (CS_FORMULARIOS.setor). Os dois convivem na UNIÃO da RLS.
--
-- A trava de "só cria pro setor X" é sobretudo guardrail de UI (a tela só
-- oferece os setores do usuário e carimba CS_FORMULARIOS.setor). O limite
-- forte de segurança é a LEITURA das respostas, reforçada aqui na RLS.
-- Idempotente.
-- =========================================================================

-- ── 1) Coluna dona do formulário ─────────────────────────────────────────
ALTER TABLE public."CS_FORMULARIOS" ADD COLUMN IF NOT EXISTS setor text;
CREATE INDEX IF NOT EXISTS cs_forms_setor_idx ON public."CS_FORMULARIOS"(setor);

-- ── 2) papel 'criar_setor' entra no conjunto; setor vale p/ ver_setor OU criar_setor
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_papel_check;
ALTER TABLE public."CS_FORM_ACESSOS" ADD  CONSTRAINT cs_form_acessos_papel_check CHECK (papel IN (
  'editar_criar', 'responder', 'encerrar_excluir', 'ver_tudo', 'ver_proprias',
  'ver_setor', 'criar_setor', 'dashboard'));

ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_setor_por_papel;
ALTER TABLE public."CS_FORM_ACESSOS" ADD  CONSTRAINT cs_form_acessos_setor_por_papel
  CHECK ((setor IS NOT NULL) = (papel IN ('ver_setor', 'criar_setor')));

-- ── 3) Unicidade: 1 linha por (usuário, setor) também no criar_setor ─────
-- O índice global exclui os dois papéis parametrizados por setor.
DROP INDEX IF EXISTS cs_form_acessos_unq_global;
CREATE UNIQUE INDEX cs_form_acessos_unq_global
  ON public."CS_FORM_ACESSOS"(papel, user_id)
  WHERE formulario_id IS NULL AND papel NOT IN ('ver_setor', 'criar_setor');

DROP INDEX IF EXISTS cs_form_acessos_unq_criar_setor;
CREATE UNIQUE INDEX cs_form_acessos_unq_criar_setor
  ON public."CS_FORM_ACESSOS"(user_id, setor)
  WHERE papel = 'criar_setor';

-- ── 4) Helpers ───────────────────────────────────────────────────────────
-- O usuário pode CRIAR/gerir formulários deste setor?
CREATE OR REPLACE FUNCTION public.cs_form_pode_criar_setor(_setor text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _setor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public."CS_FORM_ACESSOS" a
     WHERE a.papel = 'criar_setor'
       AND a.user_id = auth.uid()
       AND upper(btrim(a.setor)) = upper(btrim(_setor)));
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_pode_criar_setor(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_pode_criar_setor(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_pode_criar_setor(text) TO authenticated;

-- O usuário pode ver respostas por causa do setor-dono do formulário?
CREATE OR REPLACE FUNCTION public.cs_form_cap_form_setor(_form_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."CS_FORMULARIOS" f
      JOIN public."CS_FORM_ACESSOS" a
        ON a.papel = 'criar_setor' AND a.user_id = auth.uid()
       AND upper(btrim(a.setor)) = upper(btrim(f.setor))
     WHERE f.id = _form_id AND f.setor IS NOT NULL);
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap_form_setor(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap_form_setor(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_cap_form_setor(uuid) TO authenticated;

-- ── 5) RLS: insert de formulário aceita o criador do setor ───────────────
DROP POLICY IF EXISTS cs_forms_insert ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_insert ON public."CS_FORMULARIOS"
  FOR INSERT TO authenticated WITH CHECK (
    public.cs_form_pode_criar()
    OR (setor IS NOT NULL AND public.cs_form_pode_criar_setor(setor)));

-- ── 6) RLS: leitura de respostas em UNIÃO (+ setor-dono do formulário) ────
DROP POLICY IF EXISTS cs_form_resp_select ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_select ON public."CS_FORM_RESPOSTAS"
  FOR SELECT TO authenticated USING (
    public.cs_form_cap('ver_tudo')
    OR (public.cs_form_cap('ver_proprias') AND criado_por = auth.uid())
    OR public.cs_form_cap_setor(setor)                 -- setor do respondente (toggle antigo)
    OR public.cs_form_cap_form_setor(formulario_id));  -- setor-dono do formulário (novo)

NOTIFY pgrst, 'reload schema';
