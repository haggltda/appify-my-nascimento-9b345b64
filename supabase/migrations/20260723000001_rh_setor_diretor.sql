-- =========================================================================
-- RH — DIRETOR RESPONSÁVEL POR SETOR
--
-- Diretores (nível DIREÇÃO/DIRETOR) ficam ACIMA dos setores, e cada um cuida
-- de um conjunto de setores — mas QUAIS setores não está no cadastro; é uma
-- decisão de gestão. Esta tabela guarda isso: para cada setor, qual diretor
-- responde por ele.
--
-- Vira a base da visibilidade:
--   • Diretor vê os setores onde ele é o diretor_id aqui.
--   • Líder vê o próprio Setor_ERP (já resolvido em CS_LIDERES_SETOR / cadastro).
--   • CEO vê tudo.
--
-- Chave = setor (um diretor por setor). Atribuir um setor a outro diretor
-- simplesmente troca a linha.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."RH_SETOR_DIRETOR" (
  setor          text PRIMARY KEY,
  diretor_id     bigint NOT NULL,           -- EMPREGADOS."ID" do diretor
  diretor_nome   text,
  definido_por   uuid DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.rh_setor_diretor_touch() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS rh_setor_diretor_touch_trg ON public."RH_SETOR_DIRETOR";
CREATE TRIGGER rh_setor_diretor_touch_trg BEFORE UPDATE ON public."RH_SETOR_DIRETOR"
  FOR EACH ROW EXECUTE FUNCTION public.rh_setor_diretor_touch();

-- Acesso ao RH é gated pelo menu; aqui basta autenticado. anon nunca toca.
ALTER TABLE public."RH_SETOR_DIRETOR" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."RH_SETOR_DIRETOR" FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RH_SETOR_DIRETOR" TO authenticated;

DROP POLICY IF EXISTS rh_setor_diretor_all ON public."RH_SETOR_DIRETOR";
CREATE POLICY rh_setor_diretor_all ON public."RH_SETOR_DIRETOR"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
