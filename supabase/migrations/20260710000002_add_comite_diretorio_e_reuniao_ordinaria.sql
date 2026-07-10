-- Adiciona dois novos comitês selecionáveis no Plano de Ações:
--   "Comitê Diretório"   → líder automático: Helena Nascimento (gestor_profile_id já usado
--                          em outros comitês da mesma empresa, ex: Administrativo).
--   "Reunião Ordinária"  → sem gestor_profile_id/descricao — líder fica em branco,
--                          para digitação manual (mesmo padrão de "sem líder" já
--                          suportado por useComitesMap / Detalhe.tsx).
--
-- Nenhuma mudança de frontend é necessária: o dropdown "Comitê" e o auto-preenchimento
-- de "Líder do Comitê" já são inteiramente orientados a dados (tabela public.comite).

INSERT INTO public.comite (empresa_id, nome, gestor_profile_id, descricao, ativo)
VALUES
  ('5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid, 'Comitê Diretório',  '60e5bb0a-c0ae-4434-950f-9fdaecb01ea7'::uuid, NULL, true),
  ('5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid, 'Reunião Ordinária', NULL,                                          NULL, true)
ON CONFLICT (empresa_id, nome) DO UPDATE SET
  gestor_profile_id = EXCLUDED.gestor_profile_id,
  ativo = true;
