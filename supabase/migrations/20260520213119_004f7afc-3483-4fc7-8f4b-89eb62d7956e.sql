
INSERT INTO public.fornecedor (
  empresa_id, tipo, cnpj_cpf, razao_social, nome_fantasia,
  email, telefone, cep, logradouro, numero, bairro, cidade, uf,
  ativo, is_global
)
SELECT
  c.empresa_id,
  'pf',
  regexp_replace(c.cpf,'\D','','g'),
  c.nome,
  c.nome,
  NULLIF(c.email,''),
  NULLIF(c.telefone,''),
  NULLIF(c.endereco_cep,''),
  NULLIF(c.endereco_rua,''),
  NULLIF(c.endereco_numero,''),
  NULLIF(c.endereco_bairro,''),
  NULLIF(c.endereco_cidade,''),
  NULLIF(c.endereco_uf,''),
  true,
  true
FROM public.colaborador c
WHERE c.cpf IS NOT NULL
  AND length(regexp_replace(c.cpf,'\D','','g')) = 11
  AND c.nome IS NOT NULL
  AND c.empresa_id IS NOT NULL
ON CONFLICT (empresa_id, cnpj_cpf) DO NOTHING;
