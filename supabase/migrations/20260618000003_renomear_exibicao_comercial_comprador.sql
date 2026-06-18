-- Renomeia apenas o nome de exibição dos perfis "comercial" e "comprador".
-- A role (chave usada em permissões/RLS/user_roles) NÃO é alterada.
UPDATE public.perfil_metadata SET nome = 'Licitações' WHERE role = 'comercial';
UPDATE public.perfil_metadata SET nome = 'Suprimentos' WHERE role = 'comprador';
