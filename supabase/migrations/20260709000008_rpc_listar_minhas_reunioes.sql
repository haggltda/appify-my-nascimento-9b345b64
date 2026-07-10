-- RPC pra tela Início: reuniões em que o usuário logado está envolvido
-- (criador, organizador ou convidado), excluindo as que ele mesmo já
-- ocultou da própria tela inicial (reuniao_home_ocultada). SECURITY
-- DEFINER porque precisa checar reuniao_convidado de qualquer reunião,
-- não só as que a RLS normal deixaria o chamador enxergar sozinho.

CREATE OR REPLACE FUNCTION public.listar_minhas_reunioes()
RETURNS SETOF public.reuniao
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT r.*
    FROM public.reuniao r
   WHERE public.tem_acesso_menu('central_servicos_reunioes')
     AND (
       r.criado_por = auth.uid()
       OR r.responsavel_preenchimento_user_id = auth.uid()
       OR EXISTS (
         SELECT 1 FROM public.reuniao_convidado c
          WHERE c.reuniao_id = r.id AND c.user_id = auth.uid()
       )
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.reuniao_home_ocultada h
        WHERE h.reuniao_id = r.id AND h.user_id = auth.uid()
     )
   ORDER BY r.data_hora DESC;
$$;

REVOKE ALL ON FUNCTION public.listar_minhas_reunioes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_minhas_reunioes() TO authenticated;
