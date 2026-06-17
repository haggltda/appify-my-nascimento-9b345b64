-- B2: cadastrar /app/contratos/:id em app_menu para que RouteGuard deny-by-default
-- consiga resolver a rota dinâmica via longest-prefix match.
-- Reaproveita modulo_id do registro "ativos" (Contratos).
INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem, ativo)
SELECT modulo_id, 'contrato-detalhe', 'Detalhe de Contrato', '/app/contratos/:id', 99, true
FROM public.app_menu
WHERE codigo = 'ativos'
ON CONFLICT DO NOTHING;