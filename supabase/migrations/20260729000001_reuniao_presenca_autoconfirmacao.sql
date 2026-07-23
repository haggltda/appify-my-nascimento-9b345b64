-- Autoconfirmação de presença: cada convidado passa a poder marcar a
-- própria presença (não só criador/organizador/responsável, que já
-- podiam desde 20260728000001_reuniao_convidado_marcar_presenca.sql).
-- Coluna nova registra quando a confirmação aconteceu (data e hora),
-- pra aparecer junto do nome na tela e no histórico da reunião.

ALTER TABLE public.reuniao_convidado
  ADD COLUMN IF NOT EXISTS presente_marcado_em timestamptz;

DROP POLICY IF EXISTS reuniao_convidado_update ON public.reuniao_convidado;
CREATE POLICY reuniao_convidado_update ON public.reuniao_convidado
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id)
    )
  );
