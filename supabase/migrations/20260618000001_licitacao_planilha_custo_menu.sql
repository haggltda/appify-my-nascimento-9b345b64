-- Garante que o menu Planilha de Custo existe com a rota correta no módulo Licitações.
-- Usa INSERT ... ON CONFLICT para ser idempotente (pode rodar mais de uma vez sem erro).

INSERT INTO public.app_menu (codigo, nome, rota, modulo_id, ativo, ordem)
SELECT
  'planilha-custo',
  'Planilha de Custo',
  '/app/licitacoes/planilha-custo',
  m.id,
  true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.app_menu WHERE modulo_id = m.id)
FROM public.app_modulo m
WHERE m.codigo = 'licitacoes'
LIMIT 1
ON CONFLICT (modulo_id, codigo) DO UPDATE
  SET nome  = EXCLUDED.nome,
      rota  = EXCLUDED.rota,
      ativo = true;

-- Propaga permissões: quem tem acesso ao menu 'pipeline' ganha acesso ao 'planilha-custo'.
INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id)
SELECT spu.user_id, 'planilha-custo', spu.acao, true, spu.empresa_id
FROM public.screen_permission_user spu
WHERE spu.menu_codigo = 'pipeline'
ON CONFLICT DO NOTHING;
