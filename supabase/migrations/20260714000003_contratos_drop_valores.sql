-- Valores calculados em tempo real da planilha_custo — não precisam ficar armazenados
alter table public.contratos
  drop column if exists valor_mensal,
  drop column if exists valor_global;
