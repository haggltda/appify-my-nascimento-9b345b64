-- Adiciona FK de planilha_custo → contratos
alter table public.planilha_custo
  add column if not exists contrato_id uuid references public.contratos(id) on delete set null;

-- Popula pelo nome do contrato (case-insensitive)
update public.planilha_custo pc
set contrato_id = c.id
from public.contratos c
where lower(trim(pc.contrato)) = lower(trim(c.nome))
  and pc.empresa_id = c.empresa_id
  and pc.contrato_id is null;

-- Índice para JOINs rápidos
create index if not exists idx_planilha_custo_contrato_id
  on public.planilha_custo(contrato_id);
