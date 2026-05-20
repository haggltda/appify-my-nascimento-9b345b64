# Smoke Test — Motor de Aprovações (novo)

Roteiro guiado para validar ponta-a-ponta o motor `sup_aprov_*` nas 6 empresas
após a reatribuição de gestores e a migração 2026-05-20.

**Quem executa:** Helena (admin) com apoio do gestor de cada empresa.
**Tempo estimado:** ~45 min (≈ 7 min por empresa).
**Pré-requisitos:**
- Cada empresa precisa ter pelo menos 1 CC com gestor cadastrado
  (Administração → Alçadas → Gestores de CC).
- Permissão especial "alterar_empresa_cc" concedida (Administração → Alçadas → Saúde)
  apenas se for testar troca de empresa.

## Para cada uma das 6 empresas

| # | Ação | Onde | Resultado esperado |
|---|------|------|--------------------|
| 1 | Criar **Requisição de Compra** com 1 item de baixo valor | Suprimentos → Requisições → Nova | Sininho do gestor do CC recebe "Aprovação pendente: Requisição de compra". Item aparece em /app/aprovacoes |
| 2 | Gestor abre a Inbox e clica em **Aprovar** | /app/aprovacoes | Status muda para `aprovado`, RC fica pronta para virar Pedido |
| 3 | Criar **Pedido de Compra** a partir da RC aprovada | Suprimentos → Pedidos | Sininho do próximo aprovador (faixa de valor) recebe notificação |
| 4 | Aprovar o Pedido | /app/aprovacoes | Status `aprovado`, libera para NF Entrada |
| 5 | Criar **Programação de Pagamento** com 1 título | Financeiro → Programação | Sininho do aprovador financeiro recebe notificação |
| 6 | Aprovar a programação | /app/aprovacoes | Status `aprovado` |
| 7 | Criar **Etapa de Licitação** (Comercial) | Comercial → Licitações → Etapa | Lucas recebe notificação (Aprovação Comercial, 48h, bloqueante) |
| 8 | Lucas aprova | /app/aprovacoes | Status `aprovado` |

## Checklist após executar nas 6 empresas

- [ ] Sininho disparou em **todas** as transições (8 × 6 = 48 notificações esperadas).
- [ ] Nenhuma RC travou por falta de gestor (caso travar, voltar e cadastrar gestor do CC).
- [ ] Inbox mostra os itens com o **SlaChip** correto (verde / âmbar / vermelho).
- [ ] Timeline da aprovação (botão "Ver") exibe **TipoParecerBadge** corretamente
      (bloqueante = vermelho, consultivo = azul, ciência = cinza).
- [ ] Painel **Saúde de Alçadas** (Administração → Alçadas → Saúde) mostra zero
      CCs sem gestor e zero fluxos sem etapa após o teste.

## Em caso de falha

- Sininho **não disparou** → checar logs da função `sup_aprov_avancar` no Supabase.
- Item **não apareceu na Inbox** do gestor → verificar se `sup_aprov_pendentes_do_usuario`
  retorna a linha; checar `responsavel_user_id` / `delegado_para_user_id` da etapa.
- **Erro "CC sem gestor"** ao abrir RC → cadastrar gestor em Alçadas → Gestores de CC.

> Após concluir, marcar item 1 do `inventario-pendencias-final.md` como ✅.
