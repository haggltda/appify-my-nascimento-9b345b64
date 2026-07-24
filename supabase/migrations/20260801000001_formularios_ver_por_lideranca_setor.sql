-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — recorte por LIDERANÇA de setor no Painel Gerencial
--
-- Pedido: quem é "Gerente de <setor>" (CS_LIDERES_SETOR) ou "Diretor de
-- <setor>" (RH_SETOR_DIRETOR) deve ver, no Painel Gerencial, APENAS as
-- respostas do(s) setor(es) que lidera/dirige. Até aqui esses toggles só
-- alimentavam a hierarquia (quem lidera cada setor) — não recortavam os dados.
-- Agora o recorte vale no SERVIDOR (RLS de CS_FORM_RESPOSTAS): os dados de
-- outros setores nem chegam ao cliente, então não dá para burlar pela tela.
--
-- IMPORTANTE — o recorte é ADITIVO: este ramo CONCEDE o setor liderado. Quem
-- ainda tiver o papel 'ver_tudo' continua vendo tudo, por definição. Para o
-- gerente ver só o dele, a conta NÃO pode ter 'ver_tudo' (remova em
-- Administração › Acesso por Usuário). Com 'ver_tudo' fora + "Gerente de
-- <setor>" marcado, o RLS devolve exatamente aquele setor.
--
-- Vínculo login→empregado: EMPREGADOS.auth_user_id = auth.uid(). As duas
-- tabelas guardam EMPREGADOS."ID" (bigint) em empregado_id / diretor_id.
--
-- Depende de cs_form_cap / cs_form_cap_setor / cs_form_cap_form_setor /
-- cs_form_minha_resposta, todos já criados nas migrations anteriores (a policy
-- abaixo só é recriada aqui para anexar o ramo novo).
--
-- Idempotente. Aplicar no banco do app (traz o NOTIFY do PostgREST no fim).
-- =========================================================================

-- Sou gerente/líder OU diretor do setor da resposta?
-- SECURITY DEFINER: lê EMPREGADOS/CS_LIDERES_SETOR/RH_SETOR_DIRETOR por baixo
-- da RLS (a policy roda no contexto de quem lê). Devolve só true/false para a
-- linha que a própria RLS já está avaliando — não expõe nenhuma linha.
CREATE OR REPLACE FUNCTION public.cs_form_lidera_setor(_setor text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _setor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public."EMPREGADOS" e
     WHERE e.auth_user_id = auth.uid()
       AND (
         EXISTS (SELECT 1 FROM public."CS_LIDERES_SETOR" l
                  WHERE l.empregado_id = e."ID"
                    AND upper(btrim(l.setor)) = upper(btrim(_setor)))
      OR EXISTS (SELECT 1 FROM public."RH_SETOR_DIRETOR" d
                  WHERE d.diretor_id = e."ID"
                    AND upper(btrim(d.setor)) = upper(btrim(_setor)))
       ));
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_lidera_setor(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_lidera_setor(text) TO authenticated;

-- Leitura de respostas: mesma UNIÃO de antes + o ramo de liderança de setor.
DROP POLICY IF EXISTS cs_form_resp_select ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_select ON public."CS_FORM_RESPOSTAS"
  FOR SELECT TO authenticated USING (
    public.cs_form_cap('ver_tudo')
    OR (public.cs_form_cap('ver_proprias') AND public.cs_form_minha_resposta(criado_por, respondente_nome))
    OR public.cs_form_cap_setor(setor)                 -- ver_setor (CS_FORM_ACESSOS)
    OR public.cs_form_cap_form_setor(formulario_id)    -- setor-dono do formulário
    OR public.cs_form_lidera_setor(setor));            -- gerente/diretor do setor

NOTIFY pgrst, 'reload schema';
