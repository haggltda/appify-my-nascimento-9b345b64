-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — responsável por setor vira PERMISSÃO POR USUÁRIO
--
-- Antes: marcar alguém como "Diretor do setor X" / "Gerente do setor X" na
-- Administração gravava em RH_SETOR_DIRETOR / CS_LIDERES_SETOR pela PESSOA
-- VINCULADA ao login (EMPREGADOS.auth_user_id). Duas consequências ruins:
--   • sem vínculo, o botão nem ligava;
--   • aquelas tabelas são de ATRIBUIÇÃO (quem lidera o setor no cadastro) e
--     não entram na RLS — ou seja, o botão não abria nada no Painel Gerencial.
--
-- Agora: os dois botões são grants POR USUÁRIO em CS_FORM_ACESSOS, irmãos do
-- 'ver_setor' — papel 'diretor_setor' / 'gerente_setor' + setor. Entram na
-- mesma UNIÃO da leitura das respostas (cs_form_cap_setor), então o Painel
-- Gerencial enxerga o setor pelo BOTÃO, por usuário, sem depender do vínculo.
--
-- RH_SETOR_DIRETOR / CS_LIDERES_SETOR continuam existindo para a ATRIBUIÇÃO
-- (quem responde por quem, nos cálculos do painel) — não são mais a régua da
-- visibilidade.
-- =========================================================================

-- ── 1) setor é obrigatório também nos papéis novos ───────────────────────
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_setor_por_papel;
ALTER TABLE public."CS_FORM_ACESSOS" ADD  CONSTRAINT cs_form_acessos_setor_por_papel
  CHECK ((setor IS NOT NULL) = (papel IN ('ver_setor', 'criar_setor', 'diretor_setor', 'gerente_setor')));

-- ── 2) Unicidade ─────────────────────────────────────────────────────────
-- O índice global é 1-linha-por-papel; os papéis parametrizados por setor
-- ficam de fora dele e ganham o seu (usuário, setor).
DROP INDEX IF EXISTS cs_form_acessos_unq_global;
CREATE UNIQUE INDEX cs_form_acessos_unq_global
  ON public."CS_FORM_ACESSOS"(papel, user_id)
  WHERE formulario_id IS NULL
    AND papel NOT IN ('ver_setor', 'criar_setor', 'diretor_setor', 'gerente_setor');

DROP INDEX IF EXISTS cs_form_acessos_unq_diretor_setor;
CREATE UNIQUE INDEX cs_form_acessos_unq_diretor_setor
  ON public."CS_FORM_ACESSOS"(user_id, setor) WHERE papel = 'diretor_setor';

DROP INDEX IF EXISTS cs_form_acessos_unq_gerente_setor;
CREATE UNIQUE INDEX cs_form_acessos_unq_gerente_setor
  ON public."CS_FORM_ACESSOS"(user_id, setor) WHERE papel = 'gerente_setor';

-- ── 3) Os papéis novos veem as respostas do setor ────────────────────────
-- Mesma comparação sem caixa/espaço do ver_setor: o setor da resposta vem de
-- texto livre (EMPREGADOS.Setor_ERP ou a pergunta de setor).
-- A policy cs_form_resp_select já chama esta função — não precisa recriar.
CREATE OR REPLACE FUNCTION public.cs_form_cap_setor(_setor text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _setor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public."CS_FORM_ACESSOS" a
     WHERE a.papel IN ('ver_setor', 'diretor_setor', 'gerente_setor')
       AND a.user_id = auth.uid()
       AND upper(btrim(a.setor)) = upper(btrim(_setor)));
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap_setor(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap_setor(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_cap_setor(text) TO authenticated;

-- ── 4) Backfill: quem já era diretor/gerente E tem login vinculado ───────
-- Uma vez só — o que foi designado no modelo antigo vira permissão do usuário,
-- para ninguém perder acesso na virada. Quem não tem vínculo não entra (não há
-- usuário para receber o grant): esse caso passa a ser marcado direto na tela.
INSERT INTO public."CS_FORM_ACESSOS" (papel, user_id, setor)
SELECT 'diretor_setor', e.auth_user_id, d.setor
  FROM public."RH_SETOR_DIRETOR" d
  JOIN public."EMPREGADOS" e ON e."ID" = d.diretor_id
 WHERE e.auth_user_id IS NOT NULL AND btrim(coalesce(d.setor, '')) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public."CS_FORM_ACESSOS" (papel, user_id, setor)
SELECT 'gerente_setor', e.auth_user_id, l.setor
  FROM public."CS_LIDERES_SETOR" l
  JOIN public."EMPREGADOS" e ON e."ID" = l.empregado_id
 WHERE e.auth_user_id IS NOT NULL AND btrim(coalesce(l.setor, '')) <> ''
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
