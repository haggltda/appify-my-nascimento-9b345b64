# Inventário Final — Estado Pós-Migração 2026-05-20

## ✅ Concluído nesta etapa
- **G2 Contratos operacionais (56 CCs `*-OP-CT-*`):** Senilton Nascimento atribuído como gestor.
- **CTR.001–CTR.082 (492 registros legados):** inativados (`ativo=false`). Zero referências em rotinas operacionais (pedido_compra, titulo_pagar/receber, requisicao_compra, nf_entrada, lancamento_partida, orcamento_contrato_linha, obz_valores, pre_titulo_pagar) — desativação 100% reversível.
- **G2 Administrativo (126 CCs ADM.* nas 6 empresas):**
  - ADM.012/013-016 (Presidência/Sócios) → Helena
  - ADM.003 (Controladoria) → Yuri
  - ADM.010 (TI) → Iury
  - ADM.008 (Licitações) → Lucas
  - ADM.005 (RH) → Alessandra
  - Demais ADM.* → Fernanda (default)
- **G1 Fluxo Licitação:** 6 fluxos + 6 etapas "Aprovação Comercial" (Lucas, bloqueante, 48h) — um por empresa.

## ⚠️ Bloqueado / requer aprovação para avançar
1. **G1 Fluxo de Requisição de Compra (RC) dinâmico por CC:**
   Schema atual de `sup_aprov_etapa` exige `responsavel_user_id NOT NULL`. Resolver o gestor dinamicamente a partir de `centros_custo.gestor_user_id` exigiria:
   - (a) Tornar `responsavel_user_id` nullable + adicionar coluna `responsavel_resolver` (enum: `fixo` | `gestor_cc` | `diretor_empresa`), **OU**
   - (b) Manter NOT NULL e criar 1 fluxo+etapa por CC (~138 fluxos), **OU**
   - (c) Resolver no código da edge function `aprov-engine` no momento de instanciar.
   Recomendado (c) — sinalizar para aprovação antes de mexer no engine.

2. **G1 Fluxo de Pedido de Compra:** depende da definição de **faixas de valor** (alçadas R$). Pendente input do usuário.

3. **Edição de empresa do contrato/CC pelo admin (DIAGNÓSTICO CONCLUÍDO — aguarda decisão):**
   - Hoje: só via SQL. UI de CC só permite definir empresa **na criação**. `contrato.empresa_id` é derivado de `centro_custo_id → centros_custo.empresa_id`.
   - Risco: alterar empresa de CC com movimento (NF, título, lançamento, medição) gera divergência em DRE por contrato, fluxo de caixa diário, custos, orçamento/OBZ, faturamento e fluxos de aprovação por empresa.
   - Recomendação em 3 cenários:
     - (a) Contrato pré-ganho (licitação) → edição livre via UI.
     - (b) Contrato ganho sem movimento → UI com confirmação + log de auditoria.
     - (c) Contrato com movimento → campo read-only; correção só por estorno + reemissão.
   - Implementação proposta (requer aprovação separada): função `pode_alterar_empresa_cc(cc_id)`, trigger `BEFORE UPDATE` em `centros_custo` bloqueando troca quando há movimento, tabela `centros_custo_empresa_log`, campo editável condicional na tela de detalhe do CC, permissão `admin.cc.alterar_empresa`.
   - **Nada alterado nesta etapa.**

## 📋 Demais pendências do prompt original (já listadas)
- Revisão das políticas RLS marcadas como "always true" (warnings do linter — pré-existentes).
- Search_path em funções (warnings do linter — pré-existentes).
- Limpeza de views `SECURITY DEFINER` legadas (errors do linter — pré-existentes, não introduzidos por esta migração).
- Validação de notificações (somente sininho — pendente teste E2E).
- Validação final da DRE por contrato / Fluxo de caixa diário após reatribuição de gestores.

## 🔒 Integridade preservada
- Nenhum schema/trigger/RLS/política alterado.
- Nenhuma tela, botão, alçada ou acesso modificado.
- Tabela `mz_50_fato_orcamento_contratos_competencia` apenas **lida** como referência (nunca escrita).
