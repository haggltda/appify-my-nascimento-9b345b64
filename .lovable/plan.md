# Plano de Execução — Prompt Mestre ERP Grupo Nascimento

**Modo:** PLAN MODE obrigatório. Nada será implementado sem autorização explícita.
**Prompt Mandatório:** `Engenharia_Final_de_Prompt_-_Star_Lovable.txt` (33 seções, 2.409 linhas).

---

## ✅ Anexos recebidos e validados (somente-leitura)

| Anexo | Status | Estrutura confirmada |
|---|---|---|
| Imagem `Tela_de_Pedido_-_Referência_de_Faturamento` | ✅ Recebida | Layout horizontal, cards executivos topo, abas (Dados gerais / Itens / Documentação / Tributos / Observações), drawer lateral "Resumo do pedido", checklist documental. Servirá **apenas como padrão visual/UX**. Dados da imagem são fictícios — **proibido copiar como reais**. |
| `VERANÓPOLIS 01.2021.xlsm` | ✅ Parseada | 33 abas: `Lista NFs Jan 24` (A1:AI41, 35 cols) + 31 abas individuais de NF (A1:S88) + `Base de dados` (A1:M93). |
| `Bento Gonçalves 002.2021.xlsm` | ✅ Parseada | 7 abas: `Lista NFs` (A1:AI42, 35 cols) + `NF Item 1..5` (A1:S88) + `Base de dados` (A1:M93). |

**Divergências vs. Prompt Mestre (a registrar no diagnóstico):**
- Veranópolis tem **33 abas individuais** (o prompt listou ~31 nominais). Diferenças de espaço/acentuação em nomes (`'NF 7 Limpeza Educação '`, `'NF  1 Limpeza Saúde'`, `'NF 1  Turismo'`). Tratar como ruído de naming, não como divergência funcional.
- Aba `Base de dados` vai até **M93** (não C49 como descrito no prompt). Há mais colunas/linhas — confirmar com controladoria se há campos adicionais relevantes.
- Aba `'NF  1 Limpeza Saúde'` tem 1 coluna a mais (max_col=20 vs. 19). Possível campo extra — auditar.

---

## Plano sequencial por blocos (B1 → B23)

Cada bloco entrega: **diagnóstico → evidências → riscos → recomendações → perguntas**. Implementação só após "OK" explícito.

| # | Bloco | Tipo |
|---|-------|------|
| **B1** | Diagnóstico e inventário técnico | Read-only |
| B2 | Compliance e acesso de lançamentos (seção 12) | Read-only |
| B3 | DRE projetada zerada (seção 14) | Read-only |
| B4 | Campos não promovidos (seção 15) | Read-only |
| B5 | Pedido de Faturamento — mapa planilha→ERP (seções 6–9) | Read-only |
| B6 | Pedido de Faturamento — tela horizontal (seção 10) | Plano |
| B7 | Pedido de Faturamento — consulta (seção 11) | Plano |
| B8 | Documentos exigidos por contrato (9.4–9.5) | Plano |
| B9 | NF saída / contas a receber | Diag.+Plano |
| B10 | OS / Empenho / Documento autorizador (seção 17) | Diag.+Plano |
| B11 | Mobilização / kickoff / checklist (17–18) | Plano |
| B12 | Triagem IA (19) | Diag.+Plano |
| B13 | Administração da IA (20) | Plano |
| B14 | Orçamento / DRE / FCR por contrato (16) | Diag.+Plano |
| B15 | Consulta RC/Pedidos (21) | Plano |
| B16 | Despesas parceladas (22) | Plano |
| B17 | Materiais/serviços (23) | Diag.+Plano |
| B18 | Centro de custos (24) | Diag.+Plano |
| B19 | Menu Helena (26) | Diag.+Plano |
| B20 | Workflow de Aprovações (27) | Diag.+Plano |
| B21 | Storage / anexos (28) | Diag.+Plano |
| B22 | Dashboards | Plano |
| B23 | Testes Given/When/Then (31) | Plano |

---

## Bloco 1 — Diagnóstico e Inventário Técnico (próxima ação proposta)

**100% somente-leitura.** Entrega:

1. **Inventário de frentes** (telas, rotas, hooks, tabelas/views/RPCs) cobrindo: Editais, Triagem IA, Licitações, Contratos, Mobilização, Orçamento, DRE/FCR, Requisições/Pedidos, Estoque, NF Entrada, Pré-Títulos, Programação de Pagamento, Pós-Pagamento, Conciliação, Pedido de Faturamento, NF Saída, Contas a Receber, Dashboards, Usuários/Permissões.
2. **Evidências** via `code--view`, `rg`, `supabase--read_query` em `pg_policies` / `information_schema`, `supabase--linter`. Zero escrita.
3. **Classificação por item** usando exatamente a terminologia do Prompt Mestre (§3): existe / parcial / não identificado / visual sem governança / gravação sem validação / técnico-desalinhado.
4. **Matrizes obrigatórias §29** (inventário técnico + ponta a ponta inicial).
5. **Riscos críticos** (compliance multiempresa, RLS por usuário, anexos expostos).
6. **Perguntas de validação humana.**

**Ferramentas read-only que usarei:** `code--view`, `code--list_dir`, `code--exec` (rg, parse xlsx), `supabase--read_query`, `supabase--linter`.
**NÃO usarei:** `supabase--migration`, `code--write` em arquivos do projeto (apenas `.lovable/plan.md`), `code--line_replace`, deploy de edge functions.

---

## Perguntas antes de iniciar B1

1. **Confirma** acesso somente-leitura ao banco (consultas em `pg_policies`, `information_schema`, contagens sem PII) para B1 e B2?
2. **Confirma** o sequenciamento B1 → B2 → B3 → B4 antes de qualquer bloco de modelagem/tela (B5+)?
3. Há **repriorização**? (Ex.: B2 compliance ou B3 DRE zerada antes de B1?)
4. Para o parsing célula a célula das planilhas (necessário em B5), posso fazer já em B1 como anexo do inventário, ou prefere isolá-lo em B5?

---

**Posso iniciar o Bloco 1 — diagnóstico e inventário técnico, sem implementar alterações?**
