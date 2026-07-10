-- =========================================================================
-- CENTRAL DE SERVIÇOS — Denúncias: config da integração via Supabase Vault
--
-- A conta que administra este projeto no CLI não tem privilégio de org para
-- gravar secrets de edge function, então as credenciais da Contato Seguro
-- vivem no Vault (criptografadas). Esta função é a ÚNICA porta de leitura e
-- só o service_role (edge function) pode executá-la.
--
-- Os VALORES não ficam no repositório: são criados direto no banco com
--   SELECT vault.create_secret('<valor>', 'cs_api_key',  'API Key Contato Seguro');
--   SELECT vault.create_secret('<valor>', 'cs_api_secret','Secret Contato Seguro');
--   SELECT vault.create_secret('<url>',   'cs_base_url',  'Base URL Contato Seguro');
--   SELECT vault.create_secret('<rota>',  'cs_complaints_path', 'Rota de denúncias');
-- (para trocar TST→PROD, atualizar com vault.update_secret)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.cs_denuncias_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $fn$
  SELECT COALESCE(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
    FROM vault.decrypted_secrets
   WHERE name IN ('cs_api_key','cs_api_secret','cs_base_url','cs_complaints_path');
$fn$;

REVOKE ALL ON FUNCTION public.cs_denuncias_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cs_denuncias_config() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cs_denuncias_config() TO service_role;
