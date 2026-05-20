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

## ✅ Concluído em 2026-05-20 (leva 2)
- **Item 2 (Sininho para sup_aprov):** `sup_aprov_avancar` agora insere em `notificacoes` (tipo `sup_aprov_pendente`) sempre que uma etapa pendente é atribuída a um responsável. E-mail / WhatsApp ficam para rodada futura.
- **Item 3 (Componentes compartilhados):** criados `src/components/aprovacoes/SlaChip.tsx` e `TipoParecerBadge.tsx`. `TimelineAprovacao` e `Inbox` passam a usá-los — fim da duplicação.
- **Item 5 (Banner de depreciação):** adicionado na tela `Suprimentos → Aprovações de Compras` (motor legado). Aba "Legado" em Administração → Alçadas já tinha banner.
- **Item 6 (Saúde de Alçadas):** nova aba `/app/administracao` → Alçadas → **Saúde**, restrita a admin/presidência/controladoria. KPIs: CCs sem gestor, fluxos sem etapa, instâncias > 48h paradas. Inclui painel de gestão da permissão especial `alterar_empresa_cc`.
- **Item 7 (Alçada para trocar empresa de CC):** criada tabela `permissoes_especiais` (RLS admin only) + função `tem_permissao_especial`. RPC `admin_alterar_empresa_cc` exige a permissão. `TrocarEmpresaCCDialog` mostra aviso e bloqueia o botão quando não há permissão.
- **Item 1 (Smoke test):** roteiro guiado em `.lovable/smoke-test-aprovacoes.md` — pendente apenas a execução manual pela Helena.

## 🟡 Próximas rodadas (pausadas com OK do usuário)
- **Item 4:** Onda 2 de RLS multiempresa (~80 tabelas estoque/RH/fiscal). Requer plano por bloco.
- **Item 8:** Promoção `mz_*` → tabelas oficiais do FCR (afeta DRE Gerencial e Fluxo de Caixa). Requer plano dedicado.

## 📋 Demais pendências (já listadas, sem alteração)
- Revisão das policies "always true" (warnings pré-existentes do linter).
- Search_path em funções (warnings pré-existentes).
- Limpeza de views `SECURITY DEFINER` legadas (errors pré-existentes).
- Validação final da DRE por contrato / Fluxo de caixa diário após reatribuição de gestores.

## 🔒 Integridade preservada
- Schemas existentes intactos (apenas **adição** de tabela `permissoes_especiais` e atualização das funções `sup_aprov_avancar` e `admin_alterar_empresa_cc`).
- Nenhuma tela, botão, alçada ou acesso existente removido.
- Tabela `mz_50_fato_orcamento_contratos_competencia` segue **somente leitura** como referência.
