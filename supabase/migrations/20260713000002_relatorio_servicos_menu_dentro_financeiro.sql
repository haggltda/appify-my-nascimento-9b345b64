-- "Relatório de Serviços" — submódulo próprio dentro de Financeiro, independente
-- dos módulos antigos (que ainda têm dado mock/hardcode). Registro-mestre de
-- notas fiscais em aberto, hoje alimentado por importação da planilha oficial;
-- Cobranças consome esses mesmos dados (tabela cobranca_relatorio_nota).

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, 'relatorio-servicos', 'Relatório de Serviços', '/app/financeiro/relatorio-servicos', 26
  FROM public.app_modulo m
 WHERE m.codigo = 'financeiro'
ON CONFLICT (modulo_id, codigo) DO NOTHING;
