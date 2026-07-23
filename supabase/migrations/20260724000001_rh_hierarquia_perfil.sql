-- =========================================================================
-- RH — Perfil_ERP na leitura da hierarquia
--
-- A Visão Executiva precisa saber QUEM É ESPERADO responder ao feedback, e a
-- régua é o cadastro: Perfil_ERP = 'ADMINISTRATIVO' e Situação = 'Trabalhando'.
-- A RPC rh_hierarquia_dados devolvia tudo menos o perfil, então a tela não
-- tinha como separar quem entra do quadro esperado de quem não entra.
--
-- DROP + CREATE (e não CREATE OR REPLACE): o Postgres não deixa trocar o
-- RETURNS TABLE de uma função existente. Enquanto a migration roda, as telas
-- que leem a hierarquia falham por alguns milissegundos — recarregar resolve.
-- =========================================================================

DROP FUNCTION IF EXISTS public.rh_hierarquia_dados();

CREATE FUNCTION public.rh_hierarquia_dados()
RETURNS TABLE (id bigint, nome text, setor text, nivel text, cargo text, local_desc text, situacao text, perfil text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    e."ID"::bigint,
    btrim(coalesce(e."Nome", '')),
    btrim(coalesce(e."Setor_ERP", '')),
    btrim(coalesce(e."LIDER", '')),
    coalesce(nullif(btrim(coalesce(e."Título do Cargo", '')), ''),
             nullif(btrim(coalesce(e."Nome do Cargo", '')), ''), ''),
    btrim(coalesce(e."Descrição do Local", '')),
    btrim(coalesce(e."Situação", '')),
    btrim(coalesce(e."Perfil_ERP", ''))
  FROM public."EMPREGADOS" e;
END $$;

REVOKE ALL ON FUNCTION public.rh_hierarquia_dados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_hierarquia_dados() TO authenticated;

NOTIFY pgrst, 'reload schema';
