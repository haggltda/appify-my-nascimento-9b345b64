CREATE OR REPLACE FUNCTION public.trg_mz40_marcar_saldo_anterior()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.classificacao_original = 'SALDO ANTERIOR' AND NEW.excluir_do_fluxo = false THEN
    NEW.excluir_do_fluxo := true;
    NEW.motivo_exclusao_fluxo := 'SALDO ANTERIOR (abertura de extrato) — saldo oficial vive em saldos_iniciais_caixa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mz40_saldo_anterior ON public.mz_40_fato_fluxo_caixa_realizado;
CREATE TRIGGER trg_mz40_saldo_anterior
  BEFORE INSERT ON public.mz_40_fato_fluxo_caixa_realizado
  FOR EACH ROW EXECUTE FUNCTION public.trg_mz40_marcar_saldo_anterior();