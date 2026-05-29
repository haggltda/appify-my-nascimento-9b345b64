-- K/O-1A — Remover policies abertas legadas que anulam as restritivas via OR PERMISSIVE.
-- Pré-flight reconfirmado: 4 policies abertas presentes (qual=true / with_check=true nas ALL),
-- 8 policies restritivas pretit_*_* íntegras com EXISTS pre_titulo_pagar + user_pode_atuar_empresa.
-- Fail-fast por design: sem IF EXISTS.
-- Nenhuma alteração em: pre_titulo_pagar, storage, dados, grants, triggers, types, edge functions.

DROP POLICY "auth read pretit_anexo"  ON public.pre_titulo_anexo;
DROP POLICY "auth write pretit_anexo" ON public.pre_titulo_anexo;

DROP POLICY "auth read pretit_rateio"  ON public.pre_titulo_rateio;
DROP POLICY "auth write pretit_rateio" ON public.pre_titulo_rateio;