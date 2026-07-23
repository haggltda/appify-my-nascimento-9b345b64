-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — "só as próprias respostas" casa pela IDENTIDADE
--
-- Bug: com o papel 'ver_proprias' o usuário via ZERO respostas. A régua era só
-- `criado_por = auth.uid()`; só que as respostas chegam pelo LINK PÚBLICO, onde
-- quem responde não está logado — auth.uid() é nulo e criado_por fica nulo. Ou
-- seja, a condição nunca batia e a leitura devolvia vazio.
--
-- Correção: "minha resposta" passa a valer quando EU sou o dono da linha
-- (criado_por, para quem enviou logado) OU quando EU sou o respondente
-- identificado, casando o nome gravado na resposta com o Nome do meu cadastro
-- (EMPREGADOS.auth_user_id = auth.uid()).
--
-- Idempotente. Aplicar no banco do app (traz o NOTIFY do PostgREST no fim).
-- =========================================================================

-- Helper: a resposta (criado_por, respondente_nome) é do usuário logado?
-- SECURITY DEFINER: precisa ler EMPREGADOS por baixo da RLS (a política de
-- respostas roda no contexto de quem está lendo). Não expõe nada — devolve só
-- true/false para a linha que a própria RLS já está avaliando.
--
-- criado_por é UUID (CS_FORM_RESPOSTAS.criado_por uuid DEFAULT auth.uid()), então
-- o 1º parâmetro é uuid: a policy passa a coluna direto e o Postgres precisa
-- casar a assinatura exata (uuid, text). Remove a versão (text, text) que uma
-- tentativa anterior pode ter deixado no banco.
DROP FUNCTION IF EXISTS public.cs_form_minha_resposta(text, text);
CREATE OR REPLACE FUNCTION public.cs_form_minha_resposta(_criado_por uuid, _respondente_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (_criado_por IS NOT NULL AND _criado_por = auth.uid())
      OR (btrim(coalesce(_respondente_nome, '')) <> '' AND EXISTS (
            SELECT 1 FROM public."EMPREGADOS" e
             WHERE e.auth_user_id = auth.uid()
               AND upper(btrim(e."Nome")) = upper(btrim(_respondente_nome))));
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_minha_resposta(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_minha_resposta(uuid, text) TO authenticated;

-- Releitura de respostas: mesma UNIÃO de antes, só o ramo ver_proprias muda.
-- ver_setor continua recortando pelo Setor_ERP carimbado na resposta
-- (cs_form_cap_setor) — é ele que faz "ver por setor = RH" mostrar só o RH.
DROP POLICY IF EXISTS cs_form_resp_select ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_select ON public."CS_FORM_RESPOSTAS"
  FOR SELECT TO authenticated USING (
    public.cs_form_cap('ver_tudo')
    OR (public.cs_form_cap('ver_proprias') AND public.cs_form_minha_resposta(criado_por, respondente_nome))
    OR public.cs_form_cap_setor(setor)                 -- setor de quem respondeu
    OR public.cs_form_cap_form_setor(formulario_id));  -- setor-dono do formulário

NOTIFY pgrst, 'reload schema';
