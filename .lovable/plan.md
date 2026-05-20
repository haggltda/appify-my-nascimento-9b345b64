
# Plano refinado — respostas às 4 perguntas + escopo do Bloco 1

## Respostas às suas perguntas

**P1 — Acesso somente-leitura ao banco para B1/B2:** confirmado. Vou usar apenas `supabase--read_query` em `pg_policies`, `information_schema`, `pg_class`, `storage.buckets`, `pg_proc`, mais `supabase--linter`. Zero `INSERT/UPDATE/DELETE/ALTER`. Nenhuma migration nesta fase.

**P2 — Sequenciamento B1 → B3 → B4 → B5… (B2 ao final). Existe risco?**
- **Risco baixo, mas existe.** Mover compliance/RLS para o fim significa que durante B5–B22 (modelagem, telas, fluxo de Pedido de Faturamento, anexos, IA, dashboards) eu estarei **planejando** sobre uma base cujo modelo de acesso ainda não foi auditado. Como tudo é PLAN MODE (não escrevo nada), o risco se materializa só na hora de implementar.
- **Mitigação proposta:** em B1 eu já entrego um *flag de alerta de compliance* por bloco — se identificar qualquer tabela com RLS frágil que será tocada por aquele bloco, registro o aviso. Quando chegar a hora de implementar cada bloco, validamos o ponto antes do código.
- **Conclusão:** seguir B1 → B3 → B4 → B5 … → B22 → **B2 ao final** é seguro **desde que** nenhum bloco posterior chegue a gravar dados sem antes passar pela revisão B2. Vou marcar isso explicitamente no plano de cada bloco.

**P3 — Repriorização:** aceito. Nova ordem: **B1, B3, B4, B5, B6, B7, B8, B9, B10, B11, B12, B13, B14, B15, B16, B17, B18, B19, B20, B21, B22, B23, B2 (compliance/RLS final)**.

**P4 — Parsing das planilhas (B5) já em B1 como anexo?**
- **Recomendação técnica: SIM, fazer agora, junto com B1.** Motivos:
  1. As planilhas (Veranópolis e Bento Gonçalves) são a **fonte mandatória** da modelagem do Pedido de Faturamento (§6–§9 do Prompt Mestre). Sem o mapa célula→campo, B1 entrega uma fotografia incompleta da realidade.
  2. Adiantar o parse permite que o inventário B1 já cruze "campos exigidos pela planilha" × "campos existentes no ERP" — gera o gap real, não estimado.
  3. Custo é baixo (parsing puro Python, já validado nos turnos anteriores).
- **Risco de não fazer agora:** B5 vira novamente um bloco "descoberta", e B3/B4 perdem a chance de já alinhar campos não-promovidos contra a planilha.
- **Decisão sugerida:** anexar parse célula a célula ao entregável de B1.

**Observação sobre repositório de documentos (anexos no aprovador financeiro):**
Anotado como **requisito crítico**. O bucket `anexos` (privado) já existe. Em B1 entrego diagnóstico do bucket + RLS + tabela `anexos` (4 policies já ativas). Em B8/B20/B21 esse fluxo vira plano formal (upload no aprovador → checklist documental → consulta posterior). Sem isso, aprovação financeira fica bloqueada — vou marcar como dependência dura.

---

## Escopo do Bloco 1 — Diagnóstico e Inventário Técnico

**100% read-only.** Entregável: documento `.lovable/B1-diagnostico.md`.

### Snapshot inicial já coletado (amostra)
- **234 tabelas** em `public`, todas com `rls_enabled=true`. Contagem de policies por tabela já levantada (varia de 1 a 8).
- **>120 funções `SECURITY DEFINER`** (faturamento, contabilização, conciliação, cotação, malotes, layout, integração, etc.) — todas precisam ser auditadas no B2 final.
- **10 buckets de storage:** `anexos`, `avatars`, `colaboradores-fotos`, `copiloto-audios`, `fcr-uploads`, `identidade-visual`, `integration-uploads`, `migracao-zero`, `nfe-xml`, `pre-titulos-fiscal`. Públicos: `avatars`, `colaboradores-fotos`. Demais privados.

### Entregáveis B1 (formato fixo, sem implementação)

1. **Inventário de frentes funcionais (§29 matriz 1)** — para cada uma das 19 frentes (Editais, Triagem IA, Licitações, Contratos, Mobilização, Orçamento, DRE/FCR, Requisições, Pedidos, Estoque, NF Entrada, Pré-Títulos, Programação Pagto, Pós-Pagto, Conciliação, Pedido de Faturamento, NF Saída, Contas a Receber, Dashboards, Permissões), listar: rota frontend, página `.tsx`, hooks principais, tabelas/views/RPCs envolvidas, edge functions, estado (`existe` / `parcial` / `não identificado` / `visual sem governança` / `gravação sem validação` / `técnico-desalinhado` — terminologia §3).

2. **Matriz ponta-a-ponta inicial (§29 matriz 2)** — fluxo Edital → Contrato → Mobilização → Orçamento → RC → Pedido → NF Entrada → Pré-Título → Pagamento → Conciliação → DRE; e Contrato → Cronograma → Pedido de Faturamento → NF Saída → CR → Cobrança → Baixa. Marca onde há "buraco".

3. **Parse célula a célula das planilhas anexas** (Veranópolis 33 abas + Bento 7 abas) gerando dicionário de campos da Lista de NFs (35 colunas A:AI), NFs individuais (S88) e Base de dados (M93). Cada campo recebe: tipo inferido, exemplo, candidato de mapeamento no ERP, gap.

4. **Cruzamento Planilha × ERP** — para cada campo da planilha, qual coluna do ERP cobre (em `pedido_compra`, `nota_fiscal`, `contrato`, `cronograma_faturamento`, `titulo_receber`, etc.) e o que falta.

5. **Flags de risco por bloco futuro** — para B3, B4, B5, B6, B8, B9, B10, B12, B14, B20, B21, marcar tabelas com policies suspeitas (qtd_policies=1 em tabelas transacionais, ex.: `cotacao_fornecedor`, `cobranca_boleto`, `folha_evento`) para revisão obrigatória no B2 final.

6. **Inventário de funções `SECURITY DEFINER`** (lista completa) — só lista e classifica por domínio, não audita lógica (fica para B2).

7. **Inventário de storage** — buckets, visibilidade, políticas associadas, tamanho aproximado.

8. **Lista de divergências planilha vs. Prompt Mestre** já detectadas (33 abas vs ~31, `Base de dados` M93 vs C49, coluna extra em `'NF 1 Limpeza Saúde'`).

9. **Riscos críticos antecipados** (sem ação) e **perguntas humanas** para destravar B3.

### Ferramentas utilizadas (somente leitura)
- `supabase--read_query` (pg_policies, information_schema, pg_class, pg_proc, storage.buckets)
- `supabase--linter`
- `code--view`, `code--list_dir`, `rg`
- `code--exec` com `python/openpyxl` para parsing das planilhas (escreve só em `/tmp/` e `.lovable/`)

### O que **NÃO** será feito em B1
- Nenhuma migration, nenhuma alteração de RLS/policy/trigger/função.
- Nenhuma edição em `src/`.
- Nenhuma decisão de modelagem (fica para B5+).
- Nenhuma criação de bucket ou ajuste de storage.
- Nenhuma auditoria de lógica de função SECURITY DEFINER (B2 final).

### Tempo/custo estimado
1 execução de B1 entrega o `.lovable/B1-diagnostico.md` completo (estimo 800–1500 linhas) + anexo de parsing das planilhas em JSON dentro de `.lovable/`.

---

## Nova sequência consolidada

```
B1  Diagnóstico + parsing planilhas (anexo)   ← próximo
B3  DRE projetada zerada
B4  Campos não promovidos
B5  Pedido Faturamento — modelagem
B6  Pedido Faturamento — tela horizontal
B7  Pedido Faturamento — consulta
B8  Documentos exigidos por contrato (anexos no aprovador ✱)
B9  NF saída / CR
B10 OS / Empenho / Documento autorizador
B11 Mobilização / kickoff
B12 Triagem IA
B13 Administração IA
B14 Orçamento / DRE / FCR por contrato
B15 Consulta RC / Pedidos
B16 Despesas parceladas
B17 Materiais / serviços
B18 Centro de custos
B19 Menu Helena
B20 Workflow de Aprovações (inclui upload de docs ✱)
B21 Storage / anexos (consolida ✱)
B22 Dashboards
B23 Testes Given/When/Then
B2  Compliance / RLS / SECURITY DEFINER  ← último
```

✱ pontos onde o requisito "anexar documentos na aprovação financeira" é validado.

---

## Confirmação necessária antes de executar B1

Posso executar o Bloco 1 conforme descrito acima (read-only + parsing das planilhas como anexo)?
