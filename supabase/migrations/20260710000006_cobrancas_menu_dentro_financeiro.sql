-- Correção: "Cobranças" não é um módulo próprio, é uma tela dentro do módulo
-- Financeiro (mesmo nível de Contas a Pagar / Contas a Receber). Desfaz o
-- módulo criado em 20260710000006 e recadastra como app_menu de 'financeiro'.

DELETE FROM public.app_menu
WHERE modulo_id = (SELECT id FROM public.app_modulo WHERE codigo = 'cobrancas');

DELETE FROM public.app_modulo WHERE codigo = 'cobrancas';

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, 'cobrancas', 'Cobranças', '/app/cobrancas', 25
  FROM public.app_modulo m
 WHERE m.codigo = 'financeiro'
ON CONFLICT (modulo_id, codigo) DO NOTHING;
