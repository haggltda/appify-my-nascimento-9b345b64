# Cadastro de Alçadas

Manual completo para configurar **fluxos de aprovação** (alçadas) do ERP — quem aprova o quê, em que ordem, dentro de qual faixa de valor e em quanto tempo.

> **Quem pode cadastrar:** apenas usuários com o papel **Administrador** (`admin`). Demais perfis veem a tela em modo leitura.

---

## 1. Conceitos antes de começar

Antes de clicar em qualquer botão, alinhe estes 4 conceitos — eles aparecem em toda a tela:

| Conceito | O que é | Exemplo |
|---|---|---|
| **Alvo** | O tipo de documento que o fluxo aprova | Requisição de compra, Pedido de compra, Licitação, Programação de pagamento |
| **Fluxo** | Um conjunto ordenado de etapas, vinculado a uma empresa e a um alvo | "Pedido de compra padrão — Empresa Matriz" |
| **Etapa** | Um nó de aprovação dentro do fluxo (quem decide, em que faixa, em quanto tempo) | "Gerente — até R$ 20.000 — 48h" |
| **Régua de escalonamento** | Quem é notificado e quando, conforme o prazo da etapa avança (50% do prazo, 100%, +24h…) | "Crítica: avisa diretor a 80% do prazo" |

**Hierarquia:** Empresa → Fluxo (por alvo) → Etapas (ordenadas) → cada etapa pode ter uma régua de escalonamento.

---

## 2. Onde encontrar a tela

**Desktop:** menu lateral **Administração** → aba **Alçadas de aprovação** (ícone de ramificação).
**Rota direta:** `/app/administracao` → clicar em "Alçadas de aprovação" no menu da esquerda.

A tela tem 3 abas no topo:

1. **Fluxos** — onde você cria e mantém os fluxos. **É aqui que 90% do trabalho acontece.**
2. **Réguas de escalonamento** — leitura das réguas (CRUD virá em iteração futura).
3. **Legado** — somente leitura. Mostra a tabela antiga `alcada_aprovacao` migrada. Use apenas para conferência/auditoria.

**Antes de qualquer ação:** confira o seletor de **Empresa** no canto superior direito. **Todo fluxo é por empresa** — se você cadastrar na empresa errada, ninguém será notificado nos documentos da empresa correta.

---

## 3. Flag "Auto-aprovação por orçamento do CC"

Logo no topo da aba Fluxos, há um card com um toggle:

- **Ativa:** etapas que tiverem a regra `orcamento_cc` marcada (ver §5) **são aprovadas automaticamente** se o Centro de Custo do documento ainda tiver saldo orçamentário dentro da vigência. Útil para evitar gargalo em despesas já planejadas.
- **Inativa:** mesmo com a regra marcada na etapa, o aprovador humano sempre decide.

**Recomendação:** comece **Inativa**. Ative apenas depois que o orçamento OBZ estiver consolidado e confiável.

---

## 4. Como cadastrar um fluxo (passo a passo)

### 4.1. Criar o fluxo

1. Confirme a **empresa** no seletor superior.
2. Aba **Fluxos** → botão **+ Novo fluxo** (canto direito da seção "Fluxos cadastrados").
3. Diálogo "Novo fluxo de aprovação":
   - **Alvo** — escolha entre os 4 tipos disponíveis. **Só cadastre fluxos para alvos que sua empresa realmente usa.**
   - **Nome do fluxo** — use convenção `<Alvo> <variação> — <empresa>`. Ex.: `Pedido de compra padrão — Matriz`, `Pagamento — Recorrente`, `Licitação obras públicas`.
4. **Salvar.** O fluxo nasce vazio (sem etapas) e **ativo**.

> **Você pode ter mais de um fluxo por alvo** na mesma empresa (ex.: "padrão" e "emergencial"). O sistema usa o primeiro ativo retornado por `sup_aprov_fluxo_padrao`. Se for ter mais de um, planeje qual será o ativo — desative os demais.

### 4.2. Adicionar etapas

Dentro do card do fluxo recém-criado, clique em **+ Etapa** (canto direito do card).

Campos do diálogo:

| Campo | Como preencher | Cuidados |
|---|---|---|
| **Nome da etapa** | Use o **papel**, não a pessoa. Ex.: `Gerente`, `Diretor Administrativo`, `Controladoria`, `Presidência` | Evite "Aprovação João" — se João sair, o nome fica errado |
| **Tipo de parecer** | **Bloqueante** (decide), **Consultivo** (opina, não para o fluxo) ou **Ciência** (só notifica) | A maioria das etapas é **Bloqueante** |
| **Prazo (horas)** | Tempo até estourar SLA. Padrão sugerido: 48h | Define quando a régua de escalonamento dispara |
| **Responsável** | Selecione um usuário **ativo** cadastrado em Usuários | Se a pessoa não aparece, cadastre antes em Administração → Usuários |
| **Valor mínimo (R$)** | Faixa em que **esta** etapa é exigida | Ex.: `0` para etapa que sempre roda |
| **Valor máximo (R$)** | Teto da faixa. **Em branco = sem teto** | Ex.: deixe vazio na etapa mais alta (presidência) |
| **Auto-aprovar se há saldo no CC** | Marque se a etapa pode ser pulada quando o orçamento do CC cobre o valor | Só tem efeito se a flag global do §3 estiver **Ativa** |

A **ordem** da etapa é definida automaticamente (próxima na sequência). O documento percorre as etapas **em ordem crescente**, pulando as que não se aplicam à faixa de valor.

### 4.3. Modelo de referência (Pedido de Compra)

Use como ponto de partida e ajuste à sua governança:

| Ordem | Etapa | Parecer | Faixa | Prazo |
|---|---|---|---|---|
| 1 | Solicitante / Comprador | Bloqueante | 0 → ∞ | 24h |
| 2 | Gerente da área | Bloqueante | 0 → 20.000 | 48h |
| 3 | Diretor Administrativo | Bloqueante | 20.000 → 100.000 | 48h |
| 4 | Controladoria (orçamento) | Consultivo | 0 → ∞ | 24h |
| 5 | Presidência | Bloqueante | 100.000 → ∞ (sem teto) | 72h |

**Regra de ouro das faixas:** as faixas **não devem ter buracos** nem sobreposição inconsistente. Se uma etapa termina em 20.000, a próxima da mesma "trilha" começa em 20.000.

---

## 5. O que conferir antes de salvar (checklist)

Antes de fechar o diálogo de cada etapa:

- [ ] **Empresa correta** selecionada no topo.
- [ ] **Alvo correto** (pedido ≠ pagamento ≠ requisição).
- [ ] **Nome do fluxo** segue a convenção da sua organização.
- [ ] **Responsável existe** e está **ativo** em Usuários.
- [ ] **Faixa de valor** cobre todo o intervalo que a etapa deve ver.
- [ ] **Tipo de parecer** correto — `Bloqueante` é o padrão; só use Consultivo/Ciência se realmente NÃO travar o fluxo.
- [ ] **Prazo** compatível com SLA combinado com a área.
- [ ] **Auto-aprovação CC**: só marque se a flag global está ligada E a despesa é tipicamente orçada.

Depois de salvar todas as etapas:

- [ ] Existe **uma e apenas uma** etapa cobrindo cada faixa de valor (sem buraco entre 20.001 e 99.999, por exemplo).
- [ ] A etapa **mais alta** tem valor máximo **em branco** (sem teto).
- [ ] Há fluxo **ativo** para cada alvo que a empresa opera.

---

## 6. O que esperar depois do cadastro

Assim que o fluxo está salvo e tem ao menos uma etapa:

1. Quando o usuário **submete** um documento (requisição, pedido, licitação, pagamento), o sistema chama `sup_aprov_abrir_instancia`, que:
   - Localiza o fluxo padrão da empresa para aquele alvo.
   - **Copia as etapas-template** que se aplicam à faixa de valor do documento.
   - Cria uma **instância de aprovação** com as etapas a percorrer.
2. O aprovador da primeira etapa recebe a pendência em **Aprovações → Caixa de entrada** (`/app/aprovacoes/inbox`).
3. A timeline da aprovação aparece **dentro do próprio documento** (componente `TimelineAprovacao`), mostrando etapas concluídas, pendentes e SLA.
4. A **régua de escalonamento** (se vinculada) dispara notificações conforme o prazo avança.
5. Quando a última etapa bloqueante é aprovada, o documento muda de status (ex.: pedido vira "Aprovado" → libera emissão).

### Tabela "Réguas de escalonamento"

Hoje é **leitura apenas**. Mostra para cada régua:
- **Ordem** dos degraus
- **% Prazo** em que dispara (ex.: 50%, 100%)
- **Horas extra** após o estouro
- **Destinatários** (papéis/usuários)
- **Canais** (e-mail, in-app)

O vínculo da régua à etapa será habilitado em iteração futura. Por ora, o motor de SLA roda a régua padrão da empresa.

### Tabela "Legado"

Mostra as alçadas antigas da tabela `alcada_aprovacao` que foram migradas automaticamente para o novo motor. **Não edite nada aqui** — serve só para auditoria de migração.

---

## 7. Manutenção e troubleshooting

| Sintoma | Causa provável | Correção |
|---|---|---|
| Documento submetido e ninguém recebeu | Não há fluxo ativo para aquele alvo **naquela empresa** | Crie/ative o fluxo na empresa correta |
| Aprovador errado recebeu | Usuário trocou de função e ficou no `responsavel_user_id` da etapa | Edite a etapa e troque o responsável |
| Pedido de R$ 50 mil pulou etapa | Faixa de valor da etapa não cobre 50.000 | Ajuste `valor_min`/`valor_max` |
| Documento de altíssimo valor não tem aprovador | Etapa mais alta tem `valor_max` preenchido em vez de vazio | Deixe vazio na última etapa |
| Tudo é auto-aprovado | Flag global de orçamento está **Ativa** e todas as etapas marcaram `regra_auto` | Reveja se realmente quer auto-aprovação ou desmarque por etapa |
| Etapa "Consultivo" travou o fluxo | Tipo de parecer foi salvo errado | Exclua e recadastre como Consultivo/Ciência |

### Excluir um fluxo

Botão **lixeira** ao lado de **+ Etapa** no cabeçalho do card. **Excluir um fluxo o desativa** (`ativo = false`) — **instâncias em andamento não são afetadas**, terminam seu ciclo normalmente. Documentos novos passam a usar o próximo fluxo ativo.

### Excluir uma etapa

Lixeira no final de cada linha da tabela. Cuidado: a exclusão é **definitiva** (delete físico) e **não recalcula instâncias em andamento**. Se um documento já está naquela etapa, ele continua esperando — você terá que decidir caso a caso.

---

## 8. Boas práticas

1. **Comece simples.** Cadastre o fluxo mínimo viável (2-3 etapas) e evolua com a operação.
2. **Use papéis nos nomes**, nunca nomes de pessoas.
3. **Documente as faixas** num spread/wiki interno — quando alguém perguntar "por que R$ 20k?", você quer ter a resposta.
4. **Teste antes de comunicar.** Crie um documento de teste de cada valor de fronteira (R$ 19.999, R$ 20.000, R$ 20.001) e veja se a etapa correta dispara.
5. **Revise trimestralmente.** Saídas/promoções mudam quem deve aprovar.
6. **Para cada empresa** do grupo, replique a estrutura — fluxos **não** são herdados entre empresas.
7. **Bloqueante é o padrão.** Use Consultivo/Ciência com parcimônia, ou ninguém presta atenção.

---

## 9. Glossário rápido

- **Instância de aprovação** — uma "rodada" concreta de aprovação de um documento (cópia das etapas-template).
- **Etapa-template** — definição que fica no fluxo. É **copiada** para a instância no momento da submissão.
- **SLA** — prazo (em horas) da etapa. Quando estoura, a régua de escalonamento entra em ação.
- **Bloqueante** — sem essa aprovação, o documento não avança.
- **Consultivo** — etapa opina (parecer registrado), mas o fluxo segue mesmo sem ela.
- **Ciência** — apenas notificação; não exige ação.

---

**Dúvida sobre uma etapa específica?** Consulte os artigos:
- "Como aprovo um pedido de compra?" (Suprimentos)
- "Como aprovo um pagamento?" (Financeiro)
- "Gestão de Usuário Sistema" (Administração) — dicionário de papéis e permissões.

---

## 10. Flag "Vincular orçamento?" — herança em 3 níveis

A flag controla se uma **Requisição que estoura o orçamento do CC** exige uma **2ª etapa bloqueante** ("Aprovação por ultrapassar orçamento") além da aprovação de retirada normal.

A resolução é em cascata, do mais específico para o mais geral:

1. **Etapa (mais específico)** — `sup_aprov_etapa.regra_auto.vincular_orcamento` (`true` / `false`). Aplica-se a fluxos com etapas-template (não-Requisição).
2. **Centro de Custo** — `centros_custo.vincular_orcamento` (`true` / `false` / `null`). `null` = herda da empresa.
3. **Empresa (padrão)** — `empresas.vincular_orcamento_padrao` (`true` / `false`). Default `true`.

**Onde configurar:**
- **Empresa:** Administração → Alçadas → painel "Vincular orçamento (padrão da empresa)", OU Controladoria → Empresas → edição da empresa.
- **CC:** Controladoria → Centros de Custo → coluna "Vincular orçamento" (Herda / Sim / Não).
- **Etapa:** edição direta do JSON `regra_auto` na etapa-template (UI dedicada em backlog).

**Efeito prático:**
- `true` resolvido → comportamento atual (2 etapas quando estoura).
- `false` resolvido → apenas a etapa de retirada, sem bloqueio adicional pelo orçamento.

> Default seguro: empresas e CCs existentes herdam `true` automaticamente após a migration — nenhum fluxo muda sem decisão explícita.
