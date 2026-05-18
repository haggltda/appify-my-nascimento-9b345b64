
-- Policies de INSERT/UPDATE/DELETE no bucket fcr-uploads
-- (já existiam apenas policies de SELECT; faltavam as de escrita, por isso o 403)

drop policy if exists fcr_uploads_insert on storage.objects;
create policy fcr_uploads_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'fcr-uploads'
  and (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'presidencia'::app_role)
    or has_role(auth.uid(), 'diretor_adm'::app_role)
    or has_role(auth.uid(), 'controladoria'::app_role)
    or has_role(auth.uid(), 'financeiro'::app_role)
  )
);

drop policy if exists fcr_uploads_update on storage.objects;
create policy fcr_uploads_update on storage.objects
for update to authenticated
using (
  bucket_id = 'fcr-uploads'
  and (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'presidencia'::app_role)
    or has_role(auth.uid(), 'diretor_adm'::app_role)
    or has_role(auth.uid(), 'controladoria'::app_role)
    or has_role(auth.uid(), 'financeiro'::app_role)
  )
);

drop policy if exists fcr_uploads_delete on storage.objects;
create policy fcr_uploads_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'fcr-uploads'
  and (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'presidencia'::app_role)
    or has_role(auth.uid(), 'diretor_adm'::app_role)
  )
);
