# Impacto das 137 tabelas com RLS `get_user_empresa` (single-empresa)

> Como ler: cada tabela hoje filtra linhas usando **a empresa "atual" do usuário** (`get_user_empresa(auth.uid())`). Quem opera em **mais de uma empresa** (Helena/Presidência, Controladoria, Diretoria, Financeiro central) **só vê/age na empresa marcada como ativa**. As demais ficam invisíveis ou geram erro de RLS no INSERT/UPDATE.
>
> A nova função `user_pode_atuar_empresa(uid, empresa_id)` resolveria isso permitindo "todas as empresas que esse usuário tem vínculo em `user_empresa`" — sem ter que trocar a empresa ativa o tempo todo.

---

## 1. Agrupamento das 137 tabelas por domínio

| Grupo | Tabelas (exemplos) | Quem opera multi-empresa? |
|---|---|---|
| **A. Financeiro / Tesouraria** (≈22) | `titulo_pagar`, `titulo_receber`, `titulo_receber_baixa`, `pre_titulo_pagar`, `malote_pagamento`, `malote_titulo`, `financeiro_pagamento_aprovacao`, `financeiro_pagamento_validacao`, `financeiro_pagamento_log`, `conta_bancaria`, `extrato_bancario`, `movimento_bancario`, `conciliacao_match`, `conciliacao_regra(s)`, `remessa_cnab`, `remessa_cnab_titulo`, `retorno_bancario`, `cobranca_*`, `regua_cobranca*`, `fluxo_caixa_projetado` | **Helena (aprovar), Financeiro central (executar/conciliar), Controladoria** |
| **B. Contábil / Fiscal** (≈14) | `lancamento_contabil`, `lancamento_partida`, `conta_contabil`, `dre_linhas`, `apuracao_imposto(_item)`, `nota_fiscal(_item/_evento)`, `nfse`, `nf_entrada(_item/_log)`, `parametro_fiscal`, `empresa_fiscal_config`, `servico_municipal` | **Contabilidade, Controladoria, Diretor Adm** |
| **C. Contratos / Comercial** (≈10) | `contrato`, `contrato_posto`, `contrato_dissidio`, `contrato_comprovacao`, `cronograma_faturamento`, `licitacao`, `base_dissidio_categoria`, `stg_contratos_*`, `stg_licitacoes` | **Comercial corporativo, Presidência, Controladoria** |
| **D. Suprimentos / Almoxarifado** (≈20) | `pedido_compra(_item)`, `requisicao_compra(_item/_log/_status_hist)`, `cotacao(_item/_fornecedor/_proposta/_rc)`, `recebimento_nf(_item/_ocorrencia)`, `estoque_lote/_saldo/_reserva/_movimento`, `almoxarifado`, `produto(_categoria)`, `produto_servico`, `parametro_cotacao`, `sup_aprov_*` (5) | **Comprador corporativo, Diretoria que aprova >1 CNPJ** |
| **E. RH / Pessoal** (≈3) | `colaborador`, `alocacao_colaborador`, `solicitacao_desbloqueio` | **RH corporativo, Diretoria** |
| **F. Controladoria / Orçamento** (≈10) | `centros_custo`, `classificadores`, `classificador_valores`, `dre_linhas`, `obz_periodos/_valores/_versoes`, `orcamento_ciclo/_contrato/_contrato_linha`, `parametro_orcamento`, `realizado_lancamentos/_lotes` | **Controladoria, Planejamento, Diretoria** |
| **G. Integração / Staging** (≈15) | `integration_*` (13), `fcr_*` (5), `stg_*` (já listadas) | **Apenas TI / Admin de integração** |
| **H. Aprovação / Governança** (≈10) | `alcada_aprovacao`, `aprov_etapa`, `aprov_instancia`, `sup_aprov_*` | **Toda a hierarquia de aprovadores** |
| **I. Parâmetros / Config** (≈8) | `banco_layout(*)`, `parametro_geral`, `parametro_integracao_bancaria`, `template_mensagem`, `identidade_visual`, `anexos`, `plano_contas_solicitacao` | **Admin, Controladoria** |
| **J. IA / Auditoria leve** (≈3) | `ia_triagens`, `ia_feedback`, `ocorrencia_operacional` | Variado |

---

## 2. Impacto **por persona** (cenários reais)

### 🟥 Helena (Presidência) — aprovar pagamentos das 6 empresas
- **Hoje:** abre Programação de Pagamentos → vê só títulos da empresa ativa. Para aprovar Nascimento SP, Nascimento RJ, etc., **precisa trocar a empresa no topbar 6 vezes**, repetir filtros e checagens 6 vezes.
- **Risco de governança:** ela pode **aprovar achando que é uma empresa e ser outra** (erro humano por troca de contexto). Sem trilha cruzada.
- **Risco operacional:** se esquecer de aprovar em 1 empresa, o malote daquele CNPJ atrasa pagamento, vira juros/multa de fornecedor.

### 🟥 Financeiro central (Maiara) — executar remessa CNAB e conciliar
- **Hoje:** gera remessa, baixa retorno e concilia **uma empresa por vez**. `remessa_cnab`, `extrato_bancario`, `conciliacao_match` filtram por empresa ativa.
- **Impacto:** se o banco devolveu um arquivo com pagamentos de 3 CNPJs no mesmo lote (caso real de conta-bridge), o sistema **não consegue conciliar tudo de uma vez** — força operação manual ou erro de baixa em empresa errada.

### 🟧 Controladoria — DRE consolidado, conciliação contábil
- **Hoje:** `lancamento_contabil`, `lancamento_partida`, `dre_linhas`, `realizado_lancamentos` filtram por empresa. **DRE consolidado do grupo é impossível pela UI** — só por views materializadas (que hoje não existem para presidência).
- **Impacto p/ gestão:** Diretor Adm/Presidência **não conseguem ver o grupo inteiro** numa tela só. Reporting executivo continua sendo Excel.

### 🟧 Comprador corporativo / Diretoria de Suprimentos
- **Hoje:** aprovação de pedido (`sup_aprov_instancia`, `pedido_compra`) restrita à empresa ativa. Um diretor que aprova pedido de 4 filiais **tem 4 inboxes** desconectadas.
- **Impacto:** SLA de aprovação cai, perde-se visão consolidada de gasto por categoria no grupo.

### 🟩 Operacional de uma única empresa (gestor_cc, almoxarife, fiscal_recebedor)
- **Hoje:** filtro single-empresa **funciona perfeitamente e é o comportamento correto**. Não muda nada com a refatoração — `user_pode_atuar_empresa` retorna `true` só para a empresa dele.
- **Conclusão:** ~70% dos usuários **não sentem diferença**. A mudança só afeta perfis multi-empresa.

---

## 3. Impacto por **dimensão do sistema**

### 🛡️ Governança e auditoria
- **Negativo hoje:** ao aprovar em 6 empresas separadamente, **não há "lote consolidado" auditável** — cada aprovação é um evento isolado. Difícil provar "Helena aprovou o run de pagamento da 3ª semana de maio do grupo".
- **Negativo hoje:** alçada (`alcada_aprovacao`) também filtra por empresa → Helena só está cadastrada como aprovadora em 1 das 6 empresas (vide §11 do inventário). Nas outras 5, **o sistema não a reconhece como alçada válida**, mesmo ela tendo poder formal.
- **Positivo se mudar:** trilha única "ação realizada por Helena sobre empresas X,Y,Z" — auditoria mais simples e mais forte.

### ⚡ Performance
- **Hoje:** RLS executa `get_user_empresa(auth.uid())` **a cada linha avaliada** (função `STABLE`, mas chamada N vezes). Em listas grandes (titulos, lançamentos contábeis com 215k linhas em staging), isso já dói.
- **Com `user_pode_atuar_empresa`:** consulta ao `user_empresa` (38 linhas). Se for marcada `STABLE` + cache por sessão + índice em `(user_id, empresa_id)`, **performance equivalente ou melhor**. O ganho real vem de **eliminar 6 round-trips** que a UI hoje faz para "varrer todas as empresas".
- **Risco se for mal feita:** se a função fizer JOIN pesado sem `STABLE`, RLS pode degradar consultas em 2–5x. **Mitigação:** marcar `STABLE`, criar índice `user_empresa(user_id, empresa_id)`.

### 🔐 Segurança
- **Hoje:** seguro porém **restritivo demais para perfis corporativos** → eles contornam pedindo SQL direto ao TI, **o que é pior** (sem RLS, sem trilha).
- **Com mudança:** continua seguro (cada usuário só vê empresas onde tem vínculo em `user_empresa`), mas **respeita o desenho organizacional real**. Risco zero para operacional; ganho para corporativo.

### 🧑‍💻 UX / produtividade
- **Hoje:** "trocar empresa no topbar" é o gesto mais repetido por usuários corporativos. **5–15 min/dia perdidos** por pessoa em troca de contexto + revalidação visual.
- **Com mudança:** filtros viram **multi-select de empresas** ou "todas as minhas". Telas-chave (Programação de Pagamentos, Aprovações Inbox, Conciliação, DRE) passam a ter **visão de grupo** com coluna "Empresa".

### 🧾 Conformidade fiscal/contábil
- **Hoje:** `nota_fiscal`, `apuracao_imposto`, `lancamento_contabil` por empresa **é correto e exigido pela legislação** (cada CNPJ tem livro próprio).
- **A mudança NÃO mistura dados** — apenas permite que o **mesmo usuário consulte os 6 livros** numa lista filtravél. A segregação por CNPJ continua intacta nos relatórios oficiais (SPED, ECD, ECF) que sempre filtram por empresa explicitamente.

---

## 4. **Tabelas onde NÃO compensa mexer** (manter single-empresa)

Estas funcionam bem no modelo atual e mexer agrega risco sem benefício:

- **`integration_*` (13), `fcr_*` (5), `stg_*` (8)** → só TI usa, sempre opera empresa por empresa em carga de dados. **Manter.**
- **`banco_layout*` (4)** → layout de banco é por empresa (cada CNPJ tem contrato próprio com o banco). Operação multi-empresa não faz sentido. **Manter.**
- **`identidade_visual`, `parametro_geral`** → config local. **Manter.**
- **`anexos`** → segurança extra é desejável (cada empresa só vê seus anexos). **Manter.**

**Resultado:** dos 137, **~30 tabelas podem ficar como estão**. O escopo real da refatoração cai para **~107 tabelas críticas**.

---

## 5. **Tabelas onde a mudança é IMPRESCINDÍVEL** (sem isso, fluxos V3 não fecham)

| Tabela | Fluxo V3 que destrava | Quem ganha |
|---|---|---|
| `pre_titulo_pagar`, `titulo_pagar`, `malote_pagamento`, `malote_titulo`, `financeiro_pagamento_aprovacao` | **Fluxo 13** — Helena aprovar 6 empresas numa tela | Helena, Financeiro |
| `remessa_cnab`, `remessa_cnab_titulo`, `retorno_bancario`, `extrato_bancario`, `conciliacao_match`, `movimento_bancario` | **Fluxo 14** — Financeiro central faz remessa+conciliação de grupo | Maiara/Financeiro |
| `titulo_receber`, `titulo_receber_baixa`, `cobranca_*`, `regua_cobranca*` | **Fluxo 12** — Contas a receber consolidado | Financeiro, Comercial |
| `lancamento_contabil`, `lancamento_partida`, `dre_linhas`, `realizado_lancamentos` | **Fluxos 7–10** — Contábil/DRE de grupo | Controladoria, Presidência |
| `aprov_etapa`, `aprov_instancia`, `alcada_aprovacao`, `sup_aprov_instancia` | **Fluxo 5** — Inbox único de aprovações | Toda alçada |
| `contrato`, `cronograma_faturamento`, `licitacao` | **Fluxos 1–3** — Painel comercial Presidência | Presidência, Comercial |

**Total imprescindível: ~25 tabelas** (subset das 107).

---

## 6. **Tabelas "nice to have"** (~80)

Centros de custo, classificadores, OBZ, produtos, almoxarifado, RH, etc. — refatoração trazer ganho real mas pode ser **fase 2**, depois das 25 críticas. Sem elas a operação não trava, só fica "mais chata" para corporativo.

---

## 7. Recomendação de **ondas de execução**

| Onda | Escopo | Tabelas | Esforço estimado |
|---|---|---|---|
| **Onda 1 — Crítica** | Fluxos 13+14+12+5 (Helena/Financeiro/Aprovações) | 25 | 1 migration grande + revisar 4 telas |
| **Onda 2 — Contábil/Comercial** | Fluxos 7–10 + 1–3 | 25 | 1 migration + 6 telas |
| **Onda 3 — Suprimentos/Controladoria** | Inbox compras, OBZ, DRE gerencial | 30 | 1 migration + 8 telas |
| **Onda 4 — Operacional secundário** | RH, produtos, almoxarifado | 20 | 1 migration + revisão UI |
| **Não mexer** | Integração, staging, layouts, parametros locais | ~30 | — |

---

## 8. Decisão que você precisa tomar

1. **Manter como está?** → fluxos V3 13/14/12/5 **não vão funcionar** para Helena nem para Financeiro central. Continua "1 empresa por vez".
2. **Fazer só Onda 1 (25 tabelas)?** → destrava Helena/Financeiro **já**. Resto fica para depois sem prejudicar operacional.
3. **Fazer ondas 1+2 (50 tabelas)?** → destrava também DRE de grupo e painel comercial Presidência.
4. **Fazer tudo (107 tabelas)?** → caro e arriscado de uma vez; só recomendo após validar Onda 1 em produção.

**Minha recomendação:** **Onda 1 isolada primeiro** — risco baixo, ganho enorme para os 3 perfis mais sêniores do sistema, e valida a função `user_pode_atuar_empresa` antes de espalhar.
