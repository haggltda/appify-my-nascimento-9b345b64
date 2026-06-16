
REVOKE ALL ON FUNCTION public.gerar_codigo_cc(uuid, public.cc_tipo, public.cc_origem) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_cc(uuid, public.cc_tipo, public.cc_origem) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.trg_contrato_sync_cc() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trg_contrato_sync_cc() TO authenticated, service_role;
