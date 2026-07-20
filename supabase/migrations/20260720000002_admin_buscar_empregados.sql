-- =========================================================================
-- ADMIN — Busca de colaboradores para o "Vincular colaborador"
--
-- A tela fazia SELECT direto na EMPREGADOS com .or("Nome".ilike / "CPF".ilike),
-- que (a) depende de RLS na tabela e (b) não ignora acento, não quebra em
-- palavras e não casa CPF por dígitos. Resultado: buscas corretas não achavam
-- ninguém ("Nenhum colaborador ativo encontrado.").
--
-- Esta RPC SECURITY DEFINER (padrão dos outros fluxos de vínculo) faz a busca
-- no servidor:
--   * só admin;
--   * ignora acentuação e caixa (unaccent_safe + lower);
--   * por NOME: cada palavra digitada precisa aparecer no nome, em qualquer
--     ordem ("silva joao" acha "JOAO DA SILVA");
--   * por CPF: casa pelos DÍGITOS (05566199003 acha 055.661.990-03);
--   * exclui desligados (DEMITIDO/RESCISÃO/DESLIGADO) no próprio SQL.
--
-- Retorna os já-vinculados também (a tela mostra "já vinculado" e desabilita).
-- Idempotente.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_buscar_empregados(p_termo text)
RETURNS TABLE (
  "ID"               bigint,
  "Nome"             text,
  "CPF"              text,
  "Título do Cargo"  text,
  "Setor_ERP"        text,
  "Situação"         text,
  auth_user_id       uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q      text   := btrim(coalesce(p_termo, ''));
  v_digits text   := regexp_replace(v_q, '\D', '', 'g');
  v_tokens text[];
  v_bloq   text[] := ARRAY['DEMITIDO','DEMITIDA','RESCISÃO','DESLIGADO','DESLIGADA'];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN;  -- sem permissão → sem resultados
  END IF;
  IF length(v_q) < 2 THEN
    RETURN;
  END IF;

  -- Palavras da busca, normalizadas (sem acento, minúsculas, só alfanumérico).
  v_tokens := ARRAY(
    SELECT regexp_replace(lower(unaccent_safe(w)), '[^a-z0-9]+', '', 'g')
    FROM regexp_split_to_table(v_q, '\s+') AS w
  );

  RETURN QUERY
  SELECT e."ID", e."Nome", e."CPF", e."Título do Cargo", e."Setor_ERP", e."Situação", e.auth_user_id
  FROM public."EMPREGADOS" e
  WHERE upper(coalesce(e."Situação", '')) <> ALL (v_bloq)
    AND (
      -- Casa por NOME: existe token não-vazio e NENHUM token falta no nome.
      ( EXISTS (SELECT 1 FROM unnest(v_tokens) t WHERE t <> '')
        AND NOT EXISTS (
          SELECT 1 FROM unnest(v_tokens) t
          WHERE t <> ''
            AND regexp_replace(lower(unaccent_safe(coalesce(e."Nome", ''))), '[^a-z0-9]+', '', 'g')
                NOT LIKE '%' || t || '%'
        )
      )
      OR
      -- Casa por CPF pelos dígitos (mín. 3 para não trazer todo mundo).
      ( length(v_digits) >= 3
        AND regexp_replace(coalesce(e."CPF", ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      )
    )
  ORDER BY e."Nome"
  LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_buscar_empregados(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_buscar_empregados(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
