-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — Líderes por setor
--
-- Quem lidera cada setor NÃO é digitado: sai do cadastro. Em EMPREGADOS a
-- coluna LIDER guarda o NÍVEL HIERÁRQUICO da pessoa (CEO, DIREÇÃO, GERENTE,
-- SUPERVISOR…), não o nome do líder dela. Então:
--
--     Setor_ERP = 'COMPRAS' + LIDER = 'GERENTE'  →  gerente do Compras
--
-- O líder de um setor é a pessoa de MAIOR nível dentro dele. CEO está acima
-- de DIREÇÃO, que está acima de GERENTE, e assim por diante.
--
-- Esta tabela guarda só a EXCEÇÃO: quando a regra não resolve (dois gerentes
-- no mesmo setor, setor sem ninguém com nível, ou o cadastro está errado e
-- não dá para corrigir agora), fixa-se o líder à mão. Setor sem linha aqui =
-- resolvido automaticamente pelo cadastro, e continua acompanhando mudanças
-- de EMPREGADOS sozinho.
--
-- Por isso a chave é o setor: é uma exceção POR SETOR, não por formulário —
-- a estrutura da empresa é a mesma em todos eles.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."CS_LIDERES_SETOR" (
  setor              text PRIMARY KEY,
  empregado_id       bigint NOT NULL,          -- EMPREGADOS."ID" escolhido à mão
  empregado_nome     text,                     -- cópia p/ exibir sem novo join
  observacao         text,                     -- por que foi fixado à mão
  definido_por       uuid DEFAULT auth.uid(),
  definido_por_nome  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.cs_lideres_touch() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS cs_lideres_touch_trg ON public."CS_LIDERES_SETOR";
CREATE TRIGGER cs_lideres_touch_trg BEFORE UPDATE ON public."CS_LIDERES_SETOR"
  FOR EACH ROW EXECUTE FUNCTION public.cs_lideres_touch();

-- ── Permissões ───────────────────────────────────────────────────────────
-- Ler: qualquer um que enxergue o módulo (a tela de feedback precisa resolver
-- o líder). Escrever: só quem vê tudo — é estrutura da empresa, não dado solto.
ALTER TABLE public."CS_LIDERES_SETOR" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CS_LIDERES_SETOR" FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CS_LIDERES_SETOR" TO authenticated;

DROP POLICY IF EXISTS cs_lideres_select ON public."CS_LIDERES_SETOR";
CREATE POLICY cs_lideres_select ON public."CS_LIDERES_SETOR"
  FOR SELECT TO authenticated USING (
    public.cs_form_cap('ver_tudo') OR public.cs_form_cap('ver_proprias'));

DROP POLICY IF EXISTS cs_lideres_ins ON public."CS_LIDERES_SETOR";
CREATE POLICY cs_lideres_ins ON public."CS_LIDERES_SETOR"
  FOR INSERT TO authenticated WITH CHECK (public.cs_form_cap('ver_tudo'));

DROP POLICY IF EXISTS cs_lideres_upd ON public."CS_LIDERES_SETOR";
CREATE POLICY cs_lideres_upd ON public."CS_LIDERES_SETOR"
  FOR UPDATE TO authenticated USING (public.cs_form_cap('ver_tudo'));

DROP POLICY IF EXISTS cs_lideres_del ON public."CS_LIDERES_SETOR";
CREATE POLICY cs_lideres_del ON public."CS_LIDERES_SETOR"
  FOR DELETE TO authenticated USING (public.cs_form_cap('ver_tudo'));

NOTIFY pgrst, 'reload schema';
