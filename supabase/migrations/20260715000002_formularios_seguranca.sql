-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — segurança POR FORMULÁRIO (quem pode responder)
--
-- Antes: qualquer um com o slug lia QUALQUER formulário publicado (policy
-- cs_forms_public_read = "status publicado") e conseguia responder. O filtro
-- por setor existia só como `if` no React (FormularioPublico) — decorativo.
-- Aqui a regra passa a valer no BANCO.
--
-- Modelo (CS_FORMULARIOS.seguranca):
--   'liberado' — URL pública, sem login. anon lê e responde.
--   'restrito' — exige login. Quem responde é a UNIÃO de:
--                  • setores_acesso (text[], casa com EMPREGADOS.Setor_ERP)
--                  • CS_FORM_ALVO_USUARIOS (usuários do ERP escolhidos a dedo)
--                Restrito sem setor e sem pessoa = qualquer usuário logado.
--   exige_senha  — camada extra dentro de 'restrito': login + senha.
--
-- Senha: o hash (bcrypt) mora em CS_FORM_SENHAS, tabela SEM privilégio p/
-- anon/authenticated — nunca trafega pro client. Conferir/definir só pelas
-- RPCs SECURITY DEFINER abaixo. Acertar a senha grava um passe de 6h em
-- CS_FORM_SENHA_OK, e é ELE que a policy de INSERT exige — então a senha
-- vale no banco também, não só na tela.
--
-- LIMITE CONHECIDO: ler o formulário logado. cs_forms_select (gestão) já
-- libera SELECT p/ todo authenticated quando visibilidade='todos' — então um
-- usuário logado FORA do público-alvo ainda consegue ler as perguntas via
-- API. O que ele NÃO consegue é ENVIAR resposta (policies abaixo). Fechar
-- isso exigiria separar "ler p/ gerir" de "ler p/ responder" no modelo de
-- visibilidade — fora do escopo desta migration.
-- Idempotente.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1) Colunas de segurança no formulário ────────────────────────────────
ALTER TABLE public."CS_FORMULARIOS"
  ADD COLUMN IF NOT EXISTS seguranca      text    NOT NULL DEFAULT 'liberado',
  ADD COLUMN IF NOT EXISTS exige_senha    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS setores_acesso text[];

ALTER TABLE public."CS_FORMULARIOS" DROP CONSTRAINT IF EXISTS cs_forms_seguranca_check;
ALTER TABLE public."CS_FORMULARIOS" ADD  CONSTRAINT cs_forms_seguranca_check
  CHECK (seguranca IN ('liberado', 'restrito'));

-- Quem já tinha restrição por setor (regra antiga, só no React) vira restrito
-- de verdade — senão a migration afrouxaria o que hoje é filtrado na tela.
UPDATE public."CS_FORMULARIOS"
   SET seguranca = 'restrito'
 WHERE seguranca = 'liberado' AND COALESCE(array_length(setores_acesso, 1), 0) > 0;

-- ── 2) Pessoas específicas (usuários do ERP) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public."CS_FORM_ALVO_USUARIOS" (
  formulario_id uuid NOT NULL REFERENCES public."CS_FORMULARIOS"(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  criado_por    uuid DEFAULT auth.uid(),
  PRIMARY KEY (formulario_id, user_id)
);
ALTER TABLE public."CS_FORM_ALVO_USUARIOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public."CS_FORM_ALVO_USUARIOS" TO authenticated;

-- ── 3) Senha: hash isolado + passe temporário ────────────────────────────
CREATE TABLE IF NOT EXISTS public."CS_FORM_SENHAS" (
  formulario_id uuid PRIMARY KEY REFERENCES public."CS_FORMULARIOS"(id) ON DELETE CASCADE,
  senha_hash    text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  criado_por    uuid DEFAULT auth.uid()
);
ALTER TABLE public."CS_FORM_SENHAS" ENABLE ROW LEVEL SECURITY;
-- Sem policy e sem GRANT: nem anon nem authenticated tocam. Só as RPCs.
REVOKE ALL ON public."CS_FORM_SENHAS" FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public."CS_FORM_SENHA_OK" (
  formulario_id uuid NOT NULL REFERENCES public."CS_FORMULARIOS"(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  expira_em     timestamptz NOT NULL DEFAULT now() + interval '6 hours',
  PRIMARY KEY (formulario_id, user_id)
);
ALTER TABLE public."CS_FORM_SENHA_OK" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CS_FORM_SENHA_OK" FROM anon, authenticated;

-- ── 4) Helpers (SECURITY DEFINER: leem tabelas fechadas ao client) ───────

-- Publicado, dentro da janela e abaixo do limite de respostas.
CREATE OR REPLACE FUNCTION public.cs_form_aberto(_form_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."CS_FORMULARIOS" f
     WHERE f.id = _form_id
       AND f.status = 'publicado'
       AND (f.inicia_em  IS NULL OR now() >= f.inicia_em)
       AND (f.encerra_em IS NULL OR now() <= f.encerra_em)
       AND (f.max_respostas IS NULL OR
            (SELECT count(*) FROM public."CS_FORM_RESPOSTAS" r WHERE r.formulario_id = f.id) < f.max_respostas));
$$;

-- O usuário atual está no público-alvo? (liberado = todo mundo, inclusive anon)
CREATE OR REPLACE FUNCTION public.cs_form_alvo(_form_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."CS_FORMULARIOS" f
     WHERE f.id = _form_id
       AND (
         f.seguranca = 'liberado'
         OR (auth.uid() IS NOT NULL AND (
           -- restrito sem filtro nenhum = qualquer usuário logado do ERP
           (COALESCE(array_length(f.setores_acesso, 1), 0) = 0
            AND NOT EXISTS (SELECT 1 FROM public."CS_FORM_ALVO_USUARIOS" u WHERE u.formulario_id = f.id))
           -- união: do setor liberado OU escolhido a dedo
           OR EXISTS (SELECT 1 FROM public."EMPREGADOS" e
                       WHERE e.auth_user_id = auth.uid()
                         AND e."Setor_ERP" = ANY (f.setores_acesso))
           OR EXISTS (SELECT 1 FROM public."CS_FORM_ALVO_USUARIOS" u
                       WHERE u.formulario_id = f.id AND u.user_id = auth.uid())
         ))
       ));
$$;

-- Formulário não pede senha, ou o usuário já acertou (passe válido).
CREATE OR REPLACE FUNCTION public.cs_form_senha_ok(_form_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f WHERE f.id = _form_id AND f.exige_senha)
      OR EXISTS (SELECT 1 FROM public."CS_FORM_SENHA_OK" t
                  WHERE t.formulario_id = _form_id AND t.user_id = auth.uid() AND t.expira_em > now());
$$;

REVOKE EXECUTE ON FUNCTION public.cs_form_aberto(uuid), public.cs_form_alvo(uuid), public.cs_form_senha_ok(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cs_form_aberto(uuid), public.cs_form_alvo(uuid), public.cs_form_senha_ok(uuid) TO anon, authenticated;

-- "Portaria" da URL pública: anon NÃO lê mais um formulário restrito (policy
-- abaixo), então sem isto a página mostraria "não encontrado" em vez de mandar
-- pro login. Devolve só o mínimo p/ decidir a porta — nunca título/perguntas.
CREATE OR REPLACE FUNCTION public.cs_form_porta(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
              'existe', true,
              'seguranca', f.seguranca,
              'exige_senha', f.exige_senha,
              'publicado', f.status = 'publicado')
       FROM public."CS_FORMULARIOS" f WHERE f.slug = _slug),
    jsonb_build_object('existe', false));
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_porta(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cs_form_porta(text) TO anon, authenticated;

-- ── 5) RPCs de senha ─────────────────────────────────────────────────────

-- Define (ou remove, com _senha NULL/vazia) a senha do formulário. O texto
-- puro só existe dentro desta chamada: sai daqui como hash bcrypt.
CREATE OR REPLACE FUNCTION public.cs_form_definir_senha(_form_id uuid, _senha text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
                  WHERE f.id = _form_id
                    AND (f.criado_por = auth.uid() OR public.cs_form_cap('editar_criar'))) THEN
    RAISE EXCEPTION 'Sem permissão para alterar a senha deste formulário.';
  END IF;

  IF _senha IS NULL OR btrim(_senha) = '' THEN
    DELETE FROM public."CS_FORM_SENHAS" WHERE formulario_id = _form_id;
    DELETE FROM public."CS_FORM_SENHA_OK" WHERE formulario_id = _form_id;
    UPDATE public."CS_FORMULARIOS" SET exige_senha = false WHERE id = _form_id;
  ELSE
    INSERT INTO public."CS_FORM_SENHAS" (formulario_id, senha_hash)
    VALUES (_form_id, crypt(_senha, gen_salt('bf')))
    ON CONFLICT (formulario_id) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, updated_at = now();
    -- Trocou a senha: derruba os passes antigos.
    DELETE FROM public."CS_FORM_SENHA_OK" WHERE formulario_id = _form_id;
    UPDATE public."CS_FORMULARIOS" SET exige_senha = true WHERE id = _form_id;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.cs_form_definir_senha(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_definir_senha(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_definir_senha(uuid, text) TO authenticated;

-- Confere a senha e, acertando, grava o passe de 6h que libera o INSERT.
-- Só p/ quem está logado E no público-alvo (senha é sempre dentro de restrito).
CREATE OR REPLACE FUNCTION public.cs_form_conferir_senha(_slug text, _senha text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _id uuid; _hash text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT f.id INTO _id FROM public."CS_FORMULARIOS" f WHERE f.slug = _slug;
  IF _id IS NULL OR NOT public.cs_form_alvo(_id) THEN RETURN false; END IF;

  SELECT s.senha_hash INTO _hash FROM public."CS_FORM_SENHAS" s WHERE s.formulario_id = _id;
  IF _hash IS NULL OR crypt(_senha, _hash) <> _hash THEN RETURN false; END IF;

  INSERT INTO public."CS_FORM_SENHA_OK" (formulario_id, user_id)
  VALUES (_id, auth.uid())
  ON CONFLICT (formulario_id, user_id) DO UPDATE SET expira_em = now() + interval '6 hours';
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.cs_form_conferir_senha(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_conferir_senha(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_conferir_senha(text, text) TO authenticated;

-- ── 6) RLS: leitura do formulário ────────────────────────────────────────
-- anon só enxerga formulário LIBERADO (antes: qualquer um publicado).
DROP POLICY IF EXISTS cs_forms_public_read ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_public_read ON public."CS_FORMULARIOS"
  FOR SELECT TO anon USING (status = 'publicado' AND seguranca = 'liberado');

-- Perguntas legadas (tabela some depois do 3_tabelas; guarda p/ idempotência).
DO $$ BEGIN
  IF to_regclass('public."CS_FORM_PERGUNTAS"') IS NOT NULL THEN
    DROP POLICY IF EXISTS cs_form_perg_public_read ON public."CS_FORM_PERGUNTAS";
    CREATE POLICY cs_form_perg_public_read ON public."CS_FORM_PERGUNTAS"
      FOR SELECT TO anon USING (EXISTS (
        SELECT 1 FROM public."CS_FORMULARIOS" f
         WHERE f.id = formulario_id AND f.status = 'publicado' AND f.seguranca = 'liberado'));
  END IF;
END $$;

-- ── 7) RLS: envio de resposta (a trava que vale) ─────────────────────────
-- Anônimo: só formulário liberado, aberto.
DROP POLICY IF EXISTS cs_form_resp_public_insert ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_public_insert ON public."CS_FORM_RESPOSTAS"
  FOR INSERT TO anon WITH CHECK (
    public.cs_form_aberto(formulario_id)
    AND EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
                 WHERE f.id = formulario_id AND f.seguranca = 'liberado'));

-- Logado: aberto + no público-alvo + senha conferida.
-- (Não usa mais cs_form_cap('responder'): ela é TRUE p/ todo mundo por
--  definição e anularia o público-alvo. 'editar_criar' fica p/ importar.)
DROP POLICY IF EXISTS cs_form_resp_ins_auth ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_ins_auth ON public."CS_FORM_RESPOSTAS"
  FOR INSERT TO authenticated WITH CHECK (
    public.cs_form_cap('editar_criar')
    OR (public.cs_form_aberto(formulario_id)
        AND public.cs_form_alvo(formulario_id)
        AND public.cs_form_senha_ok(formulario_id)));

-- ── 8) RLS: quem edita o formulário mexe no público-alvo ─────────────────
DROP POLICY IF EXISTS cs_form_alvo_select ON public."CS_FORM_ALVO_USUARIOS";
CREATE POLICY cs_form_alvo_select ON public."CS_FORM_ALVO_USUARIOS"
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cs_form_alvo_write ON public."CS_FORM_ALVO_USUARIOS";
CREATE POLICY cs_form_alvo_write ON public."CS_FORM_ALVO_USUARIOS"
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
                  WHERE f.id = formulario_id
                    AND (f.criado_por = auth.uid() OR public.cs_form_cap('editar_criar'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public."CS_FORMULARIOS" f
                       WHERE f.id = formulario_id
                         AND (f.criado_por = auth.uid() OR public.cs_form_cap('editar_criar'))));

NOTIFY pgrst, 'reload schema';
