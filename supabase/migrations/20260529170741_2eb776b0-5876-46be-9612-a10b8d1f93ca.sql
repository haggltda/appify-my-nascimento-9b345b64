-- M1B-fix-grants: ajuste cirúrgico de GRANTs nas tabelas bdi_*
-- Não altera RLS, policies, estrutura, default privileges globais ou qualquer objeto fora de public.bdi_*

REVOKE ALL ON public.bdi_versao,
              public.bdi_posto,
              public.bdi_verba_folha,
              public.bdi_item,
              public.bdi_aprovacao,
              public.bdi_snapshot
FROM anon;

REVOKE INSERT, UPDATE, DELETE ON public.bdi_aprovacao,
                                 public.bdi_snapshot
FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bdi_versao,
                                        public.bdi_posto,
                                        public.bdi_verba_folha,
                                        public.bdi_item
TO authenticated;

GRANT SELECT ON public.bdi_aprovacao,
                public.bdi_snapshot
TO authenticated;

GRANT ALL ON public.bdi_versao,
             public.bdi_posto,
             public.bdi_verba_folha,
             public.bdi_item,
             public.bdi_aprovacao,
             public.bdi_snapshot
TO service_role;