-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — "ver respostas de setor X" por usuário
--
-- REVERTE (de propósito) parte de 20260714100000_formularios_permissoes_
-- somente_usuario, que dropou a coluna `setor` de CS_FORM_ACESSOS p/ deixar o
-- modelo "só por usuário". O pedido agora é outro formato: continua sendo um
-- grant POR USUÁRIO, mas parametrizado por setor —
--   "o Fulano pode visualizar as respostas de Jurídico e de Compras".
--
-- papel 'ver_setor' + setor = 'JURIDICO'  → uma linha por setor liberado.
-- Combina em UNIÃO com o que já existe:
--   ver_tudo      → todas as respostas
--   ver_proprias  → as que a própria pessoa enviou
--   ver_setor     → as respostas carimbadas com aquele setor
--
-- O setor da resposta é CS_FORM_RESPOSTAS.setor (vem do cadastro do
-- respondente ou da pergunta indicada em pergunta_setor_id).
-- Idempotente.
-- =========================================================================

-- ── 1) Coluna setor volta ────────────────────────────────────────────────
ALTER TABLE public."CS_FORM_ACESSOS"
  ADD COLUMN IF NOT EXISTS setor text;

-- 'ver_setor' entra no conjunto de papéis.
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_papel_check;
ALTER TABLE public."CS_FORM_ACESSOS" ADD  CONSTRAINT cs_form_acessos_papel_check CHECK (papel IN (
  'editar_criar', 'responder', 'encerrar_excluir', 'ver_tudo', 'ver_proprias', 'ver_setor', 'dashboard'));

-- setor só existe (e é obrigatório) no papel 'ver_setor'.
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_setor_por_papel;
ALTER TABLE public."CS_FORM_ACESSOS" ADD  CONSTRAINT cs_form_acessos_setor_por_papel
  CHECK ((setor IS NOT NULL) = (papel = 'ver_setor'));

-- Herança do modelo antigo: exigia formulario_id NÃO nulo p/ papel 'visualiza',
-- que não existe mais no check acima — a constraint só atrapalha.
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_form_por_papel;

-- ── 2) Unicidade: 1 linha por (usuário, setor) no ver_setor ──────────────
-- O índice global antigo é (papel, user_id) — travaria o 2º setor do mesmo
-- usuário. Recria excluindo ver_setor e cria o específico.
DROP INDEX IF EXISTS cs_form_acessos_unq_global;
CREATE UNIQUE INDEX cs_form_acessos_unq_global
  ON public."CS_FORM_ACESSOS"(papel, user_id)
  WHERE formulario_id IS NULL AND papel <> 'ver_setor';

DROP INDEX IF EXISTS cs_form_acessos_unq_setor;
CREATE UNIQUE INDEX cs_form_acessos_unq_setor
  ON public."CS_FORM_ACESSOS"(user_id, setor)
  WHERE papel = 'ver_setor';

-- ── 3) Helper: o usuário pode ver respostas deste setor? ─────────────────
-- Compara sem caixa/espaço: o setor da resposta vem de texto livre
-- (EMPREGADOS.Setor_ERP ou o valor da pergunta de setor).
CREATE OR REPLACE FUNCTION public.cs_form_cap_setor(_setor text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _setor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public."CS_FORM_ACESSOS" a
     WHERE a.papel = 'ver_setor'
       AND a.user_id = auth.uid()
       AND upper(btrim(a.setor)) = upper(btrim(_setor)));
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap_setor(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap_setor(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_cap_setor(text) TO authenticated;

-- ── 4) RLS: leitura de respostas em UNIÃO ────────────────────────────────
DROP POLICY IF EXISTS cs_form_resp_select ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_select ON public."CS_FORM_RESPOSTAS"
  FOR SELECT TO authenticated USING (
    public.cs_form_cap('ver_tudo')
    OR (public.cs_form_cap('ver_proprias') AND criado_por = auth.uid())
    OR public.cs_form_cap_setor(setor));

NOTIFY pgrst, 'reload schema';
