create table if not exists public.contratos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,

  nome            text not null,
  cliente         text not null,
  cnpj_cliente    text,

  valor_mensal    numeric(15,2),
  valor_global    numeric(15,2),
  vigencia_meses  integer,

  data_inicio     date,
  status          text not null default 'ativo', -- ativo | encerrado | suspenso

  grade_id        uuid references public.grade(id) on delete set null,
  capa_id         uuid references public.capa_edital(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.contratos enable row level security;

create policy "contratos_select" on public.contratos
  for select to authenticated
  using (empresa_id in (
    select empresa_id from public.user_empresa where user_id = auth.uid()
  ));

create policy "contratos_insert" on public.contratos
  for insert to authenticated
  with check (empresa_id in (
    select empresa_id from public.user_empresa where user_id = auth.uid()
  ));

create policy "contratos_update" on public.contratos
  for update to authenticated
  using (empresa_id in (
    select empresa_id from public.user_empresa where user_id = auth.uid()
  ));

create policy "contratos_delete" on public.contratos
  for delete to authenticated
  using (empresa_id in (
    select empresa_id from public.user_empresa where user_id = auth.uid()
  ));
