-- =========================================================================
-- F4 R-novo: imutabilidade de pre_titulo_anexo.uploaded_by
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_pre_titulo_anexo_uploaded_by_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.uploaded_by := auth.uid();
    IF NEW.uploaded_by IS NULL THEN
      RAISE EXCEPTION 'uploaded_by requer sessão autenticada'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
      RAISE EXCEPTION 'uploaded_by é imutável (pre_titulo_anexo.id=%)', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pre_titulo_anexo_uploaded_by_guard
  ON public.pre_titulo_anexo;

CREATE TRIGGER trg_pre_titulo_anexo_uploaded_by_guard
BEFORE INSERT OR UPDATE ON public.pre_titulo_anexo
FOR EACH ROW
EXECUTE FUNCTION public.tg_pre_titulo_anexo_uploaded_by_guard();

-- =========================================================================
-- F8: travar search_path das 5 funções legadas
-- =========================================================================
ALTER FUNCTION public.dre_sublinha_dict()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.dre_sublinha_label(text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.resolver_dre_linha(text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.tg_stg_aprovacao_contas_touch()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.tg_touch_updated_at()
  SET search_path = public, pg_temp;