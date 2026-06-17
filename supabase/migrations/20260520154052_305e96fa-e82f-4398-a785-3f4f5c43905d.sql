
-- G2: Gestores nos CCs operacionais (contratos reais)
UPDATE public.centros_custo
SET gestor_user_id = '6a8ac11c-a1e5-49ab-8de9-6a9c7dc03a98', updated_at = now()
WHERE codigo ~ '-OP-CT-' AND ativo = true;

-- Soft-disable do conjunto legado CTR.* (492 órfãos, 0 referências)
UPDATE public.centros_custo
SET ativo = false, updated_at = now()
WHERE codigo LIKE 'CTR.%' AND ativo = true;

-- G2 Administrativo (todas as 6 empresas, por código)
UPDATE public.centros_custo SET gestor_user_id='60e5bb0a-c0ae-4434-950f-9fdaecb01ea7', updated_at=now()
  WHERE codigo IN ('ADM.012','ADM.013','ADM.014','ADM.015','ADM.016');
UPDATE public.centros_custo SET gestor_user_id='3baeb855-5389-4459-93f4-759ee82b288e', updated_at=now()
  WHERE codigo='ADM.003';
UPDATE public.centros_custo SET gestor_user_id='d1dbc8d4-bf9b-4125-a6b1-11b6195155a4', updated_at=now()
  WHERE codigo='ADM.010';
UPDATE public.centros_custo SET gestor_user_id='1116752d-09b2-49c1-951d-753b72c70276', updated_at=now()
  WHERE codigo='ADM.008';
UPDATE public.centros_custo SET gestor_user_id='a240e3b5-3cda-4913-bebb-edcfa1035c7a', updated_at=now()
  WHERE codigo='ADM.005';
-- Fernanda como default para os demais ADM.*
UPDATE public.centros_custo SET gestor_user_id='24441177-a9e2-4f0e-b2ae-7d4fabe37044', updated_at=now()
  WHERE codigo LIKE 'ADM.%' AND gestor_user_id IS NULL;

-- G1: Seed do fluxo Licitação (Aprovação Comercial Lucas) para as 6 empresas
INSERT INTO public.sup_aprov_fluxo (id, empresa_id, alvo, nome, ativo, observacao)
SELECT gen_random_uuid(), e.id, 'licitacao_etapa'::sup_aprov_alvo,
       'Aprovação Comercial - Licitação', true,
       'Seed inicial G1 — etapa única bloqueante Comercial'
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.sup_aprov_fluxo f
  WHERE f.empresa_id = e.id AND f.alvo='licitacao_etapa'::sup_aprov_alvo
);

INSERT INTO public.sup_aprov_etapa
  (id, fluxo_id, ordem, nome, tipo_parecer, responsavel_user_id, valor_min, valor_max, criticidade, prazo_horas, ativo)
SELECT gen_random_uuid(), f.id, 1, 'Aprovação Comercial',
       'bloqueante'::sup_aprov_tipo_parecer,
       '1116752d-09b2-49c1-951d-753b72c70276', 0, NULL,
       'normal'::sup_aprov_criticidade, 48, true
FROM public.sup_aprov_fluxo f
WHERE f.alvo='licitacao_etapa'::sup_aprov_alvo
  AND NOT EXISTS (SELECT 1 FROM public.sup_aprov_etapa et WHERE et.fluxo_id=f.id);
