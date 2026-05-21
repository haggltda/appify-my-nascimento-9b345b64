# Plano — Correção e Redesenho DRE Gerencial

## Confirmações recebidas
- A) R3+R4 compliance: **sobem agora** antes de B3 ✅
- B) Arquitetura Pedido de Faturamento (1 URL + 3 abas + 3 entidades + workflow): **confirmada** ✅
- C) B3 redefinido: **NÃO está OK** — telas DRE Gerencial não puxam corretamente os dados dos contratos ativos.

## Problemas reportados na tela `/app/co/dre-gerencial` (e equivalente em Contábil)

### Bugs de dados (B3 — crítico)
1. **Meses futuros vazios**: filtro 2026, mas JUN–DEZ aparecem "—" mesmo havendo contratos ativos até o final do ano. A view `mz_60_view_dre_gerencial_competencia` (ou a RPC `dre_gerencial_competencia`) só está retornando meses com *realizado*, não está consumindo `mz_50_fato_orcamento_contratos_competencia` (projetado pelos contratos ativos) para preencher meses futuros.
2. **Orçado zerado**: ao clicar em "Orçado", todos os valores saem R$ 0. A coluna Orçado não está cruzando com `mz_50` (orçamento por competência dos contratos).
3. **Variação incorreta**: como Orçado=0, Variação fica = Realizado (100% acima), o que é falso.

### Ajustes visuais (UI)
4. Remover coluna **"CÓDIGO"** (L01, L02…) da tabela.
5. **Truncar/formatar números** para não desfigurar (usar abreviação tipo `1,3M` / `847K` quando a coluna for estreita, ou aumentar largura + alinhamento monoespaçado tabular).
6. **Valores negativos em vermelho** (já parcialmente feito, garantir em todas as células incluindo TOTAL e linhas de resultado).
7. **Subtotal separado para Despesas Financeiras** (agrupar L10 + L11 com linha "Subtotal Resultado Financeiro").
8. **Layout padrão** conforme print anexo (`ChatGPT_Image_20_de_mai…png`) — preciso inspecionar para extrair o padrão exato.

## Telas afetadas
- `src/pages/controladoria/DREGerencial.tsx` (principal — rota atual)
- `src/pages/contabil/DRE.tsx` e `src/pages/contabil/DREGerencialReal.tsx` (Contábil/Escrituração)
- RPC backend: `dre_gerencial_competencia` + view `mz_60_view_dre_gerencial_competencia`

## Abordagem proposta (2 frentes paralelas)

### Frente 1 — Backend (dados)
- Auditar a RPC `dre_gerencial_competencia` e a view `mz_60`:
  - Garantir que para cada `(linha_dre, mes)` ela retorne **3 colunas**: `realizado`, `orcado`, `projetado`.
  - `realizado` ← `lancamento_partida` por competência.
  - `orcado` ← `mz_50_fato_orcamento_contratos_competencia` (já existem 47.739 linhas, 4 empresas).
  - `projetado` ← `mz_41_fato_fluxo_caixa_projetado` OU `realizado se mes<=hoje senão orcado` (sua definição).
- Criar migration para nova versão da RPC (`dre_gerencial_competencia_v2`) sem quebrar a antiga.

### Frente 2 — Frontend (UI + tela única consolidada)
- Refatorar `DREGerencial.tsx`:
  - Remover coluna Código.
  - Adicionar linha "Subtotal Resultado Financeiro" entre L11 e L12.
  - Negativos sempre em vermelho (incluir total e linhas-resultado).
  - Formatação numérica compacta (`Intl.NumberFormat` com `notation:'compact'` quando coluna < 80px).
  - Aplicar layout do print de referência.
- Unificar `contabil/DRE.tsx` e `contabil/DREGerencialReal.tsx` para consumir a mesma RPC v2 (eliminar duplicação).

## Sequenciamento sugerido
1. **Inspecionar o print anexo + RPC atual** (read-only, 0 risco).
2. **Apresentar mockup do novo layout** (visual_choice ou screenshot) para sua aprovação.
3. **Migration RPC v2** (após aprovar mockup).
4. **Refator frontend** consumindo v2.
5. **QA visual** (screenshot das 3 telas) antes de fechar.

## Perguntas antes de executar

1. **Definição de "Projetado" para meses futuros** na DRE: usar (a) `mz_50` orçado por competência do contrato, OU (b) `mz_41` fluxo de caixa projetado, OU (c) ambos lado a lado (3 colunas: Real/Orçado/Projetado por mês)?
2. **Layout do print anexo**: posso seguir o estilo do print que você acabou de mandar (cards de KPI no topo + tabela embaixo já está nesse formato) — o que falta exatamente? É a **densidade/cores** das linhas-totalizadoras (L03/L06/L13/L14 com fundo azul) ou outra coisa específica?
3. **Unificar as 3 telas** (`/app/co/dre-gerencial`, `/app/contabil/dre`, `/app/contabil/.../dre-gerencial-real`) em **uma única tela** com seletor de visão (Gerencial/Contábil), ou manter as 3 e só corrigir cada uma?
4. **Compact notation** (`1,3M` / `847K`): aplicar **sempre** ou só quando coluna estreita (tooltip mostrando valor cheio no hover)?
