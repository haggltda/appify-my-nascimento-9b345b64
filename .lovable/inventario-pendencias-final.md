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

3. ~~Edição de empresa do contrato/CC pelo admin~~ ✅ **IMPLEMENTADO (2026-05-20)**
   - Função `pode_alterar_empresa_cc(cc_id)` → `livre` / `confirmacao` / `bloqueado`.
   - Função `diagnostico_alterar_empresa_cc(cc_id)` → JSON com contagens por tabela.
   - RPC `admin_alterar_empresa_cc(cc_id, nova_empresa_id, motivo)` — admin only, motivo ≥5 chars.
   - Trigger `trg_centros_custo_troca_empresa` BEFORE UPDATE OF empresa_id: bloqueia se houver movimento, exige admin, registra log e propaga para `contrato.empresa_id`.
   - Tabela `centros_custo_empresa_log` (RLS admin only).
   - UI: botão "Trocar empresa" por linha em `/app/controladoria/centros-custo` → `TrocarEmpresaCCDialog` mostra cenário (a/b/c), diagnóstico de vínculos e exige motivo.
   - Cobertura de 14 rotinas verificadas: titulo_pagar, titulo_receber, pre_titulo_pagar, nf_entrada, pedido_compra, requisicao_compra, lancamento_partida, realizado_lancamentos, estoque_movimento, folha_evento, obz_valores, orcamento_contrato_linha, plano_acao, sup_aprov_instancia.

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
