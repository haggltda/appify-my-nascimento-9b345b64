UPDATE public.empresas
SET diretor_user_id = '60e5bb0a-c0ae-4434-950f-9fdaecb01ea7'
WHERE diretor_user_id IS NULL AND ativa = true;

WITH novos AS (
  INSERT INTO public.sup_aprov_fluxo (empresa_id, alvo, nome, ativo)
  SELECT e.id, 'programacao_pagamento'::public.sup_aprov_alvo, 'Aprovação Presidência (migrado)', true
  FROM public.empresas e
  WHERE e.ativa = true
    AND NOT EXISTS (
      SELECT 1 FROM public.sup_aprov_fluxo f
      WHERE f.empresa_id = e.id AND f.alvo = 'programacao_pagamento'
    )
  RETURNING id
)
INSERT INTO public.sup_aprov_etapa
  (fluxo_id, ordem, nome, tipo_parecer, responsavel_user_id, prazo_horas, criticidade, ativo)
SELECT id, 1, 'Presidência',
       'bloqueante'::public.sup_aprov_tipo_parecer,
       '60e5bb0a-c0ae-4434-950f-9fdaecb01ea7', 48,
       'normal'::public.sup_aprov_criticidade, true
FROM novos;