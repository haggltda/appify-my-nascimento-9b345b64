-- RPC pro calendário de "Agenda de Reunião": mostra TODAS as reuniões de
-- quem tem acesso ao menu (não só as do usuário logado, diferente de
-- listar_minhas_reunioes), mas só um recorte mínimo de colunas — sem
-- objetivo/motivo_cancelamento, sem nada de pauta/anexo/comentário. Quem
-- não tem interação (não é criador/responsável/convidado) continua sem
-- conseguir abrir o card — isso é garantido pela RLS normal de "reuniao" em
-- ReuniaoDetalhe.tsx, que não muda aqui.

CREATE OR REPLACE FUNCTION public.listar_reunioes_calendario()
RETURNS TABLE (
  id                                 uuid,
  titulo                             text,
  data_hora                          timestamptz,
  duracao_minutos                    int,
  tipo_local                         text,
  local_ou_link                      text,
  etapa                              text,
  criado_por                         uuid,
  responsavel_preenchimento_user_id  uuid,
  convidados                         uuid[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.titulo, r.data_hora, r.duracao_minutos, r.tipo_local, r.local_ou_link, r.etapa,
         r.criado_por, r.responsavel_preenchimento_user_id,
         COALESCE(array_agg(c.user_id) FILTER (WHERE c.user_id IS NOT NULL), '{}')
    FROM public.reuniao r
    LEFT JOIN public.reuniao_convidado c ON c.reuniao_id = r.id
   WHERE public.tem_acesso_menu('central_servicos_reunioes')
   GROUP BY r.id
   ORDER BY r.data_hora;
$$;

REVOKE ALL ON FUNCTION public.listar_reunioes_calendario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_reunioes_calendario() TO authenticated;
