-- Ocultar reunião da lista "Minhas Reuniões" na tela Início — é por
-- usuário: se eu ocultar, some só da minha tela, continua aparecendo pra
-- quem mais estiver envolvido na mesma reunião.

CREATE TABLE IF NOT EXISTS public.reuniao_home_ocultada (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id uuid NOT NULL REFERENCES public.reuniao(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reuniao_id, user_id)
);

ALTER TABLE public.reuniao_home_ocultada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_home_ocultada_select ON public.reuniao_home_ocultada;
CREATE POLICY reuniao_home_ocultada_select ON public.reuniao_home_ocultada
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS reuniao_home_ocultada_insert ON public.reuniao_home_ocultada;
CREATE POLICY reuniao_home_ocultada_insert ON public.reuniao_home_ocultada
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS reuniao_home_ocultada_delete ON public.reuniao_home_ocultada;
CREATE POLICY reuniao_home_ocultada_delete ON public.reuniao_home_ocultada
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
