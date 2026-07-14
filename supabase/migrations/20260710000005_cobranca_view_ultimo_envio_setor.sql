-- Último envio de cobrança por setor (financeiro/jurídico) por título — equivalente às
-- colunas "Jurídico:" / "Financeiro:" do sistema de cobranças antigo, aqui de forma nativa.

CREATE OR REPLACE VIEW public.titulo_ultimo_envio_setor
WITH (security_invoker = true) AS
SELECT
  e.titulo_id,
  MAX(e.executado_em) FILTER (WHERE et.setor_remetente = 'financeiro') AS ultimo_financeiro,
  MAX(e.executado_em) FILTER (WHERE et.setor_remetente = 'juridico') AS ultimo_juridico
FROM public.regua_cobranca_execucao e
JOIN public.regua_cobranca_etapa et ON et.id = e.etapa_id
WHERE e.status = 'executada'
GROUP BY e.titulo_id;
