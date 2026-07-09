create table if not exists planilha_posto_localizacao (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null references empresas(id) on delete cascade,
  planilha_custo_id uuid not null references planilha_custo(id) on delete cascade,
  nome text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  municipio text,
  uf text,
  periculosidade boolean not null default false,
  insalubridade boolean not null default false,
  qt_pessoas_orcadas integer not null default 0,
  qt_pessoas_executadas integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table planilha_posto_localizacao enable row level security;

create policy planilha_posto_localizacao_select on planilha_posto_localizacao for select
  using (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));

create policy planilha_posto_localizacao_insert on planilha_posto_localizacao for insert
  with check (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));

create policy planilha_posto_localizacao_update on planilha_posto_localizacao for update
  using (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));

create policy planilha_posto_localizacao_delete on planilha_posto_localizacao for delete
  using (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));
