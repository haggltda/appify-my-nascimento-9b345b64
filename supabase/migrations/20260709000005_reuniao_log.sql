-- Log de auditoria da reunião — aba "Histórico". Gravado pela aplicação
-- (não por trigger de banco): cada mutação já sabe o valor antigo/novo e o
-- nome de quem fez, então monta uma descrição legível direto — reconstruir
-- isso de um trigger genérico ficaria bem mais complicado pra pouco ganho,
-- já que aqui só logamos ações "grandes" (não cada campo alterado).

CREATE TABLE IF NOT EXISTS public.reuniao_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id uuid NOT NULL REFERENCES public.reuniao(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  acao       text NOT NULL,
  detalhe    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reuniao_log_reuniao ON public.reuniao_log(reuniao_id, created_at DESC);

ALTER TABLE public.reuniao_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_log_select ON public.reuniao_log;
CREATE POLICY reuniao_log_select ON public.reuniao_log
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

-- Mesma regra de comentários/anexos: qualquer um com acesso à tela pode
-- gravar um log (a ação em si já passou pela RLS da tabela que mudou —
-- isso aqui é só o registro descritivo).
DROP POLICY IF EXISTS reuniao_log_insert ON public.reuniao_log;
CREATE POLICY reuniao_log_insert ON public.reuniao_log
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes'));
