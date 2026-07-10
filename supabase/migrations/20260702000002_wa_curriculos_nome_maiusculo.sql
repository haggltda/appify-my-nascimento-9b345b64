-- =========================================================================
-- WA_CURRICULOS — nome do candidato SEMPRE em maiúsculo
--
-- O nome digitado no portal público (e o que vier do bot do WhatsApp) é
-- normalizado para maiúsculo no banco, via trigger — assim vale para
-- qualquer origem, não só o formulário do site. Também corrige os
-- registros já existentes. Idempotente.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.wa_curriculos_nome_upper()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.nome IS NOT NULL THEN NEW.nome := upper(btrim(NEW.nome)); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wa_curriculos_nome_upper ON public."WA_CURRICULOS";
CREATE TRIGGER trg_wa_curriculos_nome_upper
  BEFORE INSERT OR UPDATE OF nome ON public."WA_CURRICULOS"
  FOR EACH ROW EXECUTE FUNCTION public.wa_curriculos_nome_upper();

-- Corrige os registros já gravados.
UPDATE public."WA_CURRICULOS"
SET nome = upper(btrim(nome))
WHERE nome IS NOT NULL AND nome <> upper(btrim(nome));

NOTIFY pgrst, 'reload schema';
