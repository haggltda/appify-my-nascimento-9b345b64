alter table public.checklist_respostas
  add column if not exists historico jsonb not null default '[]'::jsonb,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
