-- Pedido do chefe: "Treinamento" vira uma opção de Tipo de reunião. Mantém
-- os valores antigos no CHECK (comunicacao/alinhamento/acompanhamento
-- continuam existindo em reuniões já criadas) — só deixam de aparecer no
-- dropdown de criação (ver TIPO_REUNIAO_OPCOES_CRIACAO no frontend).

ALTER TABLE public.reuniao DROP CONSTRAINT IF EXISTS reuniao_tipo_reuniao_check;
ALTER TABLE public.reuniao ADD CONSTRAINT reuniao_tipo_reuniao_check
  CHECK (tipo_reuniao IN ('comunicacao','alinhamento','operacional','comite','gerencial','diretoria','equipe','acompanhamento','outro','treinamento'));
