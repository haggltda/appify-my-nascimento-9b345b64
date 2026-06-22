-- Solicitações ERP: comentários no card (feed estilo Trello).
-- Aberto a qualquer um que acessa a tela (sistemas_solicitacoes_erp) — mesma
-- regra já aplicada aos anexos, comentário não muda o fluxo do card.

CREATE TABLE IF NOT EXISTS public.sistema_solicitacao_comentario (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.sistema_solicitacao(id) ON DELETE CASCADE,
  autor_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  texto          text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sistema_solicitacao_comentario_solicitacao ON public.sistema_solicitacao_comentario(solicitacao_id);

ALTER TABLE public.sistema_solicitacao_comentario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sistema_solicitacao_comentario_select ON public.sistema_solicitacao_comentario;
CREATE POLICY sistema_solicitacao_comentario_select ON public.sistema_solicitacao_comentario
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('sistemas_solicitacoes_erp'));

DROP POLICY IF EXISTS sistema_solicitacao_comentario_insert ON public.sistema_solicitacao_comentario;
CREATE POLICY sistema_solicitacao_comentario_insert ON public.sistema_solicitacao_comentario
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('sistemas_solicitacoes_erp'));
