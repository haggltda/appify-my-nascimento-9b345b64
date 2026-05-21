# Editor de Orçamentos de Contratos — Plano Visual & Estrutural

> Tela enterprise-grade, alto impacto visual, padrão referência (Notion + Linear + Airtable). Foco: você gerenciar 100% dos contratos e editar orçamentos célula a célula como numa planilha viva.

---

## Arquitetura de Navegação

```text
/app/contratos/orcamentos                  ← Lista mestre (100% contratos)
/app/contratos/:id/orcamento               ← Editor grade (planilha viva)
/app/contratos/:id/orcamento/importar      ← Wizard upload XLSX
/app/contratos/:id/orcamento/historico     ← Audit log + versões
```

Entrada também via: card "Orçamentos" no menu Contratos + atalho na tela DRE Gerencial ("Editar orçamento dos contratos").

---

## Tela 1 — Lista Mestre de Orçamentos

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  ORÇAMENTOS DE CONTRATOS                          [+ Novo]  [↑ Import] │
│  Carteira completa · 247 contratos · Ano-base 2026                     │
├─────────────────────────────────────────────────────────────────────────┤
│  ╔═══════════╗  ╔═══════════╗  ╔═══════════╗  ╔═══════════╗            │
│  ║ COM ORÇ.  ║  ║ SEM ORÇ.  ║  ║ RECEITA   ║  ║ MARGEM    ║            │
│  ║   189     ║  ║    58     ║  ║ R$ 47,2M  ║  ║  12,3%    ║            │
│  ║ ─────●●●  ║  ║ ●─────    ║  ║ ▲ 8% YoY  ║  ║ ▼ 1,2pp   ║            │
│  ╚═══════════╝  ╚═══════════╝  ╚═══════════╝  ╚═══════════╝            │
│                                                                         │
│  [Empresa ▾] [Status ▾] [Ano: 2026 ▾]   🔍 Buscar nº/cliente/objeto    │
│                                                                         │
│  CONTRATO          CLIENTE              VIGÊNCIA      MENSAL    STATUS  │
│  ─────────────────────────────────────────────────────────────────────  │
│  UFFS-041/2021     U. F. Front. Sul     ▮▮▮▮▮▯▯      R$ 612K   ●Aprov │
│  HCPA-088/2024     Hospital Clínicas    ▮▮▮▮▮▮▮      R$ 1,2M   ◐Edit  │
│  PMTO-012/2023     Prefeit. Toledo      ▮▮▮▮▯▯▯      R$ 340K   ○Vazio │
│  ...                                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Status do orçamento (badge color-coded):**
- ● **Aprovado** (verde) — linhas locked
- ◐ **Em edição** (âmbar) — rascunho ativo
- ○ **Vazio** (cinza) — contrato sem orçamento ainda
- ⚠ **Divergente** (vermelho) — mz_50 atualizado mas não promovido

**Barra de vigência** = mini timeline visual do contrato no ano (▮▮▮▮▯▯▯ mostra início/fim).

---

## Tela 2 — Editor Grade (Planilha Viva) — CORAÇÃO DA TELA

Layout densidade controlada, header sticky, tipografia tabular monoespaçada, paleta sóbria com 1 acento (azul-info para edição ativa).

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← UFFS-041/2021 · Univ. Federal Fronteira Sul          [Histórico] [Importar] [Salvar▾] │
│ Vigência 01/02/2025 → 31/03/2026 · Mensal R$ 612.871 · Margem orçada 14,2%               │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  Ano-base [2026 ▾]   Versão [v3 · em edição ▾]   ● Salvando…                            │
│                                                                                          │
│  ┌─ RECEITA ─────────────────────────────────────────────────────────────── R$ 7,35M ─┐ │
│  │ ITEM              CONTA       JAN     FEV     MAR     ABR  …  DEZ    TOTAL        │ │
│  │ Faturamento bruto 03.1.01  612.871 612.871 612.871   ─    …  ─    R$ 1.838.613   │ │
│  │ + Adicionar item                                                                  │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                          │
│  ┌─ CUSTO DIRETO ────────────────────────────────────────────────────── -R$ 5,12M ──┐  │
│  │ Salário Base     04.1.3.02  324.640 324.640 324.640  ─    …  ─    -R$ 973.920   │  │
│  │ EPIs             04.1.3.03   18.420  18.420  18.420  ─    …  ─    -R$  55.260   │  │
│  │ Vale Transporte  04.1.3.02   42.100  42.100  42.100  ─    …  ─    -R$ 126.300   │  │
│  │ + Adicionar item                                              [Subtotal Custo]   │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                          │
│  ┌─ DESPESA ─────────────────────────────────────────────────────────── -R$ 890K ──┐   │
│  │ ...                                                                              │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  ════════════════════════════════════════════════════════════════════════════════════   │
│  RESULTADO LÍQUIDO                  ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▯▯▯▯▯▯ 14,2%      R$ 1.043.221      │
│  ════════════════════════════════════════════════════════════════════════════════════   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Interações da grade
- **Clique na célula** → entra modo edição com máscara R$ + spin numérico.
- **Tab/Enter** navega célula a célula (estilo Excel).
- **Arrastar canto** copia valor para meses seguintes (fill-handle).
- **Negativos automáticos**: linhas de custo/despesa mostram em vermelho.
- **Auto-save** debounce 800ms → indicador "● Salvando…" / "✓ Salvo 14:32".
- **Linhas locked** (após aprovação) ficam em cinza com ícone 🔒, edição bloqueada.
- **Botão "+ Adicionar item"** abre combobox com itens-padrão do plano de contas.
- **Hover na célula** mostra tooltip: "última edição: João Silva, 18/05 14:32, valor anterior R$ 320.000".
- **Atalho `Cmd+K`** abre paleta de comandos (importar, exportar, ver DRE, aprovar, duplicar item).

### Header rico
- KPIs ao vivo: Receita total, Custo total, Margem %, Variação vs mz_50 original.
- Mini-gráfico sparkline mostrando a margem mês a mês.
- Botão "Salvar▾" com submenu: Salvar rascunho / Salvar e aprovar / Salvar como nova versão.

---

## Tela 3 — Wizard de Importação XLSX

Steps visuais:
```text
①  Upload          →  ②  Mapeamento        →  ③  Preview diff       →  ④  Confirmar
   Arraste .xlsx       Confirma colunas        Linhas novas (verde)     Aplicar
   ou clique           da planilha             Alteradas (âmbar)
                                               Removidas (vermelho)
```

- Botão "Baixar template" no topo (gera xlsx vazio no exato formato do mz_50).
- Preview diff mostra tabela com cor-código antes de gravar.
- Modal de confirmação: "Vai gravar 142 alterações em UFFS-041/2021. Continuar?"

---

## Tela 4 — Histórico & Versões

Timeline vertical (estilo GitHub commits):
```text
●  v3 · em edição           hoje 14:32  · você      [Diff] [Restaurar]
│   42 células alteradas, margem +1,2pp
●  v2 · aprovada            12/05/2026  · Ana Costa [Diff]
│   Reajuste sindical aplicado
●  v1 · importada do mz_50  08/05/2026  · sistema   [Diff]
    Carga inicial da planilha
```

---

## Identidade Visual (alto impacto, padrão web premium)

- **Tipografia**: cabeçalhos em font display do projeto, números em fonte tabular (`tabular-nums`) para alinhamento perfeito vertical.
- **Paleta**: usa tokens semânticos do `index.css` — `primary`, `success` (verde receita), `destructive` (vermelho negativo), `warning` (âmbar edição), `muted` (linhas zeradas). Sem cores hard-coded.
- **Densidade**: grade compacta tipo Linear/Notion (44px de altura por linha, padding lateral 12px).
- **Hierarquia**: blocos com border-radius generoso, sombra sutil `shadow-elegant`, header sticky com `backdrop-blur`.
- **Microinterações**: framer-motion no auto-save indicator (pulse), na expansão de blocos receita/custo/despesa (collapse animado), no diff de import (fade-in linha a linha).
- **Modo escuro**: contraste pleno garantido nos dois temas.
- **Acessibilidade**: navegação 100% por teclado, ARIA labels nas células editáveis, foco visível.

---

## Backend (migration única)

1. Tabela `orcamento_contrato_linha_audit` (audit trail).
2. Trigger auditoria em `orcamento_contrato_linha` (insert/update/delete).
3. RPC `promover_mz50_orcamento(_empresa_id, _ano)` — one-shot que copia mz_50 (47k linhas) para `orcamento_contrato_linha` e marca `destino_id`.
4. **Atualizar RPC `dre_gerencial_mensal`** para Orçado vir de `orcamento_contrato_linha` (não mais `obz_valores`). → resolve direto o bug da DRE zerada.
5. RLS por empresa em todas as novas estruturas.

---

## Sequenciamento de entrega

1. Migration backend (promover mz_50 + RPC DRE atualizada + audit).
2. Tela lista `/app/contratos/orcamentos`.
3. Editor grade célula a célula (auto-save, fill, lock, hover audit).
4. Wizard de import XLSX com diff preview.
5. Histórico + versões.
6. Refator UI da DRE Gerencial (remover coluna código, subtotal financeiro, negativos vermelhos).
7. QA visual em todas as telas.

---

## Perguntas finais antes de codar

1. **Granularidade**: edita por **item** (Salário Base, EPI, VT) como mostrado acima OU consolidado por **linha da DRE** (L04, L05) sem ver itens?
2. **Promoção mz_50**: rodo **automática** já na migration (popula tudo de uma vez) ou prefere botão manual?
3. **Conflito no import**: planilha (a) sobrescreve tudo, (b) merge com confirmação, (c) só cria novos?
4. **Versionamento**: cada save cria nova versão OU edição direta com audit log?
5. **Permissão de edição**: Financeiro+Controladoria+Diretoria apenas, ou também Operação?
