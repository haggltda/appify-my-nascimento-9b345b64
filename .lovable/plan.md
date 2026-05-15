## Vínculo D/C nas Regras de Contabilização — Bloco A

Objetivo: deixar as **15 regras-mãe + sub-regras** com **conta de DÉBITO e CRÉDITO vinculadas** nas 6 empresas, **sem mexer em backend, sem alterar schema, sem apagar nada**. Apenas **INSERT** de sub-regras novas e **UPDATE** dos campos `conta_debito_id`, `conta_credito_id`, `ativo`, `prioridade`, `filtro` nas linhas existentes.

---

### §1 Premissas confirmadas (suas respostas)

- **Q1 — EVT-001** dividida em **3 sub-regras por empresa**: Limpeza · EPIs/Uniformes · Peças/Equip. Cada uma com sua conta de estoque específica.
- **Q2 — EVT-004 / EVT-007 / EVT-009 / EVT-010** = conta bancária **dinâmica** (resolvida em runtime pela conta bancária do título/movimento). Na regra fica como “bridge” = conta-pai sintética `01.1.1.02 BANCOS CONTA MOVIMENTO` apenas como referência (sub-conta analítica é definida pelo movimento).
- **Q3 — EVT-006** (impostos s/ faturamento) → **3 filhas + Simples** (4 sub-regras: PIS, COFINS, ISS, Simples). **EVT-007 retenções** → **2 filhas (INSS, ISS) + IRRF NÃO** ativo.
- **Q4** — Aplicar nas **6 empresas**.
- **Q5** — Após Bloco A, seguir Bloco B (Validador “Saúde das Regras”).

---

### §2 Sem mudança estrutural

- Schema `regra_contabilizacao` já tem `conta_debito_id`, `conta_credito_id`, `filtro jsonb`, `prioridade`, `ativo`. **Nada novo.**
- `conta_contabil` é por empresa, ligada por `classificacao` ao `plano_contas_master`. **Lookup por classificação + empresa_id** garante portabilidade entre as 6 empresas.
- Sub-regras adicionais (EVT-001 A/B/C, EVT-006 A/B/C/D, EVT-007 A/B) são **novas linhas** com mesmo `evento` (enum), `codigo_evento` sufixado (ex.: `EVT-001-A`) e `filtro` discriminando.

---

### §3 Mapa final de vínculos (por classificação contábil)

Todas as contas abaixo são analíticas existentes em `plano_contas_master`/`conta_contabil` para cada empresa.

| Código | Sub | Descrição | DÉBITO (classificação) | CRÉDITO (classificação) | Filtro |
|---|---|---|---|---|---|
| EVT-001 | A | NF entrada — Limpeza | 01.1.4.01 Estoques de limpeza | 02.1.1.01 Fornecedores nacionais | `{"categoria":"limpeza"}` |
| EVT-001 | B | NF entrada — EPIs/Uniformes | 01.1.4.02 Estoques de EPIs e uniformes | 02.1.1.01 | `{"categoria":"epi_uniforme"}` |
| EVT-001 | C | NF entrada — Peças/Equip. | 01.1.4.03 Estoques peças/equip. consumo | 02.1.1.01 | `{"categoria":"pecas_equip"}` |
| EVT-002 | — | NF consumo direto p/ contrato | 04.1.3.03.003 Bens não imobilizáveis | 02.1.1.01 | `—` |
| EVT-003 | — | NF serviço administrativo | 04.2.1.03.020 Serviços terceiros PJ adm | 02.1.1.01 | `—` |
| EVT-004 | — | Pagamento fornecedor | 02.1.1.01 Fornecedores nacionais | 01.1.1.02 BANCOS (dinâmica) | `—` |
| EVT-005 | — | NF saída / faturamento contrato | 01.1.2.01 Clientes a Receber | 03.1.1.03.003 Serviços prestados a prazo | `—` |
| EVT-006 | A | Tributos faturamento — PIS | 03.1.2.02.002 PIS s/ vendas | 02.1.3.02 PIS a recolher | `{"tributo":"PIS"}` |
| EVT-006 | B | Tributos faturamento — COFINS | 03.1.2.02.003 COFINS s/ vendas | 02.1.3.03 COFINS a recolher | `{"tributo":"COFINS"}` |
| EVT-006 | C | Tributos faturamento — ISS | 03.1.2.02.007 ISSQN | 02.1.3.01 ISS a recolher | `{"tributo":"ISS"}` |
| EVT-006 | D | Tributos faturamento — Simples (HAGG) | 03.1.2.02.008 Simples | 02.1.3.04 IRRF/CSRF retidos (proxy) | `{"tributo":"SIMPLES"}` `ativo=true só HAGG` |
| EVT-007 | mãe | Recebimento cliente | 01.1.1.02 BANCOS (dinâmica) | 01.1.2.01 Clientes a Receber | `—` |
| EVT-007 | A | Retenção INSS s/ recebimento | 01.1.3.03 INSS retido a compensar | 01.1.2.01 Clientes a Receber | `{"retencao":"INSS"}` |
| EVT-007 | B | Retenção ISS s/ recebimento | 01.1.3.04 ISS retido a compensar | 01.1.2.01 Clientes a Receber | `{"retencao":"ISS"}` |
| EVT-007 | (IRRF) | NÃO criar — desativada | — | — | — |
| EVT-008 | — | Provisão folha operacional | 04.1.3.02.013 Salários operacionais | 02.1.2.01 Salários a pagar | `—` |
| EVT-009 | — | Pagamento folha | 02.1.2.01 Salários a pagar | 01.1.1.02 BANCOS (dinâmica) | `—` |
| EVT-010 | — | Recolhimento FGTS/INSS/tributos folha | 02.1.2.04 FGTS a recolher (default) | 01.1.1.02 BANCOS (dinâmica) | `—` |
| EVT-011 | — | Mútuo intercompany saída | 01.1.2.03 Intercompany a Receber | 01.1.1.02 BANCOS (dinâmica) | `—` |
| EVT-012 | — | Mútuo intercompany entrada | 01.1.1.02 BANCOS (dinâmica) | 02.1.4 Contas a Pagar Intercompany | `—` |
| EVT-013 | — | Rateio admin intercompany | 04.2.1.03.020 Serviços terceiros PJ adm | 02.1.4 Contas a Pagar Intercompany | `—` |
| EVT-014 | — | Ajuste contábil manual | NULL (livre) | NULL (livre) | `ativo=true, exige preenchimento manual` |
| EVT-015 | — | Baixa de estoque p/ contrato | 04.1.3.03.003 Bens não imobilizáveis | 01.1.4.0x estoque (resolvido pelo produto) | `—` |

Total final: **15 mães originais** + **6 novas sub-regras** (3 EVT-001 + 3 EVT-006 + 2 EVT-007 − 2 que viram filhas e a mãe EVT-001/EVT-006 ficam como “agrupador inativo”) = **~21 linhas por empresa × 6 = 126 linhas**.

---

### §4 Estratégia técnica (sem alterar backend)

Tudo fica em **DML idempotente** executada via tool de inserção/update do banco:

1. **CTE de lookup** por empresa: monta um mapa `{classificacao → conta_contabil.id}` filtrando `WHERE empresa_id = X`.
2. **UPDATE** das 15 linhas existentes preenchendo `conta_debito_id`, `conta_credito_id`, `prioridade=10`, `ativo=true` (exceto EVT-006-D Simples = ativo só na empresa HAGG; EVT-014 manual fica `ativo=true` mas com contas NULL).
3. **INSERT … ON CONFLICT DO NOTHING** das 6 sub-regras novas por empresa (EVT-001-A/B/C, EVT-006-A/B/C/D, EVT-007-A/B). Como não há unique constraint em `(empresa_id, codigo_evento)`, usamos `WHERE NOT EXISTS` para garantir idempotência.
4. Marcar EVT-001 mãe e EVT-006 mãe como **agrupadores** (`prioridade=99`, `ativo=false`, `observacao='Substituída por sub-regras'`) — sem deletar.

Tudo cabe em **uma migration de DML** (na verdade `data-only`) = **0 alteração de schema, 0 alteração de função, 0 alteração de RLS, 0 alteração de edge function**.

---

### §5 Frontend (mínimo necessário — só leitura adicional)

A tela `src/pages/contabil/RegrasContabilizacao.tsx` **já lê** `conta_debito_id` e `conta_credito_id` (linhas 62–75). Após o UPDATE, as colunas DÉBITO e CRÉDITO param de mostrar “não vinculada” automaticamente. Ajustes pequenos opcionais:

- Mostrar `filtro.categoria` / `filtro.tributo` / `filtro.retencao` como badge ao lado do código do evento, para diferenciar sub-regras visualmente.
- Agrupar visualmente sub-regras sob a regra-mãe (EVT-001 A/B/C aninhadas).

Se preferir 100% sem mexer em frontend, isso fica para o Bloco B.

---

### §6 O que NÃO será feito neste bloco

- Sem `ALTER TABLE`, sem novo enum, sem novo trigger, sem nova função, sem nova edge function.
- Sem mexer em `pacote02-load` nem em qualquer arquivo de seed.
- Sem deletar linha alguma; só `UPDATE`/`INSERT` idempotentes.
- Sem tocar em `conta_contabil`, `plano_contas_master`, `empresas`, RLS, auth.

---

### §7 Validação pós-execução

Query única (read-only) que mostra, por empresa:
```
SELECT empresa_id, codigo_evento, descricao,
       (conta_debito_id IS NOT NULL) AS d_ok,
       (conta_credito_id IS NOT NULL) AS c_ok,
       ativo
FROM regra_contabilizacao
ORDER BY empresa_id, codigo_evento;
```
Esperado: todas as linhas (exceto EVT-014 manual e EVT-006-D fora da HAGG) com `d_ok = c_ok = true` e `ativo = true`.

---

### §8 Próximo passo (Bloco B, depois deste)

Tela “Saúde das Regras”: matriz Evento × Empresa mostrando ✅/❌ de vínculo e ativação, com link direto p/ corrigir. Pure frontend, sem nova tabela.

---

### §9 Confirmação para implantar

Aguardando seu **OK** para gerar a migration **data-only** (UPDATE + INSERT idempotentes). Nada será executado antes da sua aprovação.