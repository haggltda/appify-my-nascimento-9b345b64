## Diagnóstico

Cenário: Notas de despesas das áreas (honorários, FGTS, rescisões), fora do fluxo de requisição/PC. O modal **Novo lançamento de NF / pré-título** já está aberto.

### Problemas identificados em `src/pages/financeiro/pagar/PreTitulosTab.tsx`

1. **Centro de custo não filtra por empresa**
   - Query (linha 320): `from("centros_custo").select("id, codigo, nome").order("codigo")` — traz **todos os CC de todas as empresas**.
   - Banco confirma duplicidade: `ADM.001 — ADMINISTRATIVO GERAL` existe em 6 empresas (mesmo `codigo`, `empresa_id` diferente). Daí a tela mostrar a lista repetida (print 1).
   - Resultado: usuário não consegue distinguir qual CC pertence à empresa selecionada.

2. **Conta contábil não filtra "contas de resultado"**
   - Query (linha 293-297) traz **todas** as `analitica`, incluindo Ativo/Passivo/Caixa/Bancos (print 2 mostra "01 — ATIVO", "CAIXA", "BANCOS"…).
   - O correto para despesa é **conta de resultado** = `grupo_dre = 'dre'` (banco confirma: 1.014 analíticas, 2 grupos: `dre` e `balanco/balanco_gerencial`).
   - Hoje só filtra por `empresa_id` (e ainda aceita contas sem empresa).

3. **Sem auto-preenchimento por CC**
   - Usuário precisa escolher CC **e** conta contábil manualmente em cada linha de rateio.
   - O banco já tem o vínculo: `conta_contabil.centro_custo_padrao` (texto com código do CC) — preenchido em 432 das 1.014 analíticas.
   - Não há nenhuma lógica que, ao escolher CC no rateio, sugira a conta de resultado vinculada.

4. **Conta contábil default (bloco 1) está deslocada do propósito**
   - O label diz "usada quando a linha de rateio não tiver conta". Para despesas de área, a conta deveria vir do CC, não default da empresa. Mantém-se opcional, mas com filtro correto.

## Solução proposta (apenas frontend, sem backend/migrations)

### A) Filtrar CC por empresa selecionada
- Mudar query para receber `empresaId` e filtrar:
  ```ts
  .from("centros_custo").select("id, codigo, nome, empresa_id")
  .eq("empresa_id", empresaId).eq("ativo", true).order("codigo")
  ```
- `enabled: !!empresaId`. Limpar rateios/CC ao trocar empresa.

### B) Filtrar conta contábil para "contas de resultado" da empresa
- Mudar query:
  ```ts
  .from("conta_contabil")
  .select("id, classificacao, descricao, natureza, grupo_dre, centro_custo_padrao, empresa_id, ativo, tipo")
  .eq("tipo", "analitica").eq("ativo", true).eq("grupo_dre", "dre")
  .eq("empresa_id", empresaId)
  .order("classificacao")
  ```
- `enabled: !!empresaId`. Aplicar tanto no bloco 1 (default) quanto no select da linha de rateio.

### C) Auto-sugerir conta contábil pelo CC escolhido no rateio
- Construir mapa `ccCodigoToConta` a partir de `conta_contabil` (where `centro_custo_padrao` = `cc.codigo`).
- Em `updateRateio`, ao mudar `centro_custo_id`, se `conta_contabil_id` ainda estiver vazio:
  - Buscar CC selecionado → pegar `codigo` → procurar conta com `centro_custo_padrao === cc.codigo` → preencher.
- Comportamento não destrutivo: nunca sobrescreve uma conta já escolhida pelo usuário.

### D) Pequenos ajustes de UX
- Selects de CC e conta ficam desabilitados (placeholder "Selecione a empresa primeiro") enquanto `empresaId` vazio.
- Ao trocar de empresa, resetar `contaContabilId` default e `rateios[].centro_custo_id` / `conta_contabil_id`.
- Atualizar texto da ajuda em `src/content/ajuda/financeiro/novo-pre-titulo.md` explicando o vínculo automático CC → conta de resultado.

## Arquivos a alterar
- `src/pages/financeiro/pagar/PreTitulosTab.tsx` — 3 queries, `useMemo` de filtros, handler `updateRateio`, reset ao trocar empresa, estados disabled dos selects.
- `src/content/ajuda/financeiro/novo-pre-titulo.md` — nota sobre auto-sugestão.

## Fora de escopo
- Migration/coluna nova (usa `centro_custo_padrao` que já existe).
- Mudança em RPCs (`pre_titulo_*`).
- Cadastro de regra CC→conta via UI (continua editável no Plano de Contas).

## Riscos
- CCs sem `centro_custo_padrao` mapeado: auto-sugestão silenciosamente não preenche — usuário escolhe manual (sem erro).
- Empresas sem contas DRE cadastradas: lista vazia com mensagem "Nenhuma conta de resultado para esta empresa".

## Créditos estimados
1 PR pequeno (~80 linhas alteradas em 1 arquivo + 1 .md). Risco baixo, só presentation/data-fetching no cliente.
