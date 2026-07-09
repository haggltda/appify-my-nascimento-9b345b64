create table if not exists doc_tipos (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  descricao text,
  periodicidade text check (periodicidade in ('mensal','trimestral','semestral','implantação','implantação + recorrência')),
  obrigatorio boolean not null default true,
  created_at timestamptz not null default now()
);

alter table doc_tipos enable row level security;

create policy doc_tipos_select on doc_tipos for select
  using (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));
create policy doc_tipos_insert on doc_tipos for insert
  with check (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));
create policy doc_tipos_update on doc_tipos for update
  using (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));
create policy doc_tipos_delete on doc_tipos for delete
  using (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists contrato_docs_config (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null references empresas(id) on delete cascade,
  contrato text not null,
  doc_tipo_id uuid not null references doc_tipos(id) on delete cascade,
  observacoes text,
  created_at timestamptz not null default now(),
  unique (empresa_id, contrato, doc_tipo_id)
);

alter table contrato_docs_config enable row level security;

create policy contrato_docs_select on contrato_docs_config for select
  using (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));
create policy contrato_docs_insert on contrato_docs_config for insert
  with check (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));
create policy contrato_docs_update on contrato_docs_config for update
  using (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));
create policy contrato_docs_delete on contrato_docs_config for delete
  using (empresa_id in (select empresa_id from user_empresa where user_id = auth.uid()));
