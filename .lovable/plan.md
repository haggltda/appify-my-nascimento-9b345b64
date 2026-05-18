# PR-FIN-UX-2 — Correção de conta contábil + ampliação horizontal do modal Novo Pré-título

Escopo pequeno, frontend-only. **Nenhuma** alteração em banco, RLS ou Edge Functions.

---

## 1. Diagnóstico

### 1.1 Por que a conta contábil não aparece (bug real)
A query do modal pede colunas que **não existem** na tabela `conta_contabil`:

```ts
.from("conta_contabil")
.select("id, codigo, nome, tipo")   // ❌ não existe codigo nem nome
.eq("tipo", "analitica")
.order("codigo");                    // ❌ falha
```

Schema real da tabela:
- `classificacao` (ex.: `3.1.01.001`) — equivalente ao "código"
- `descricao` — equivalente ao "nome"
- `natureza`, `grupo_dre`, `ativo`, `empresa_id`

Resultado: a query devolve erro/array vazio e o `<Select>` fica sem itens. Por isso "não aparecem contas para amarrar".

O mesmo problema afeta:
- O select **Conta contábil (default)** no bloco 1.
- O select **Conta / verba** em cada linha de rateio.
- A listagem principal de pré-títulos (`select("...conta_contabil(codigo, nome)...")`).

### 1.2 Resposta à dúvida funcional
> "O centro de custo se escolhe na parte do rateio? Mesmo sendo um único CC?"

**Sim, sempre na seção Rateio**, mesmo quando é só um CC. O bloco 1 só guarda a **conta contábil default** (regra contábil), e o bloco 2 (Rateio) é onde se decide **para qual centro de custo** vai a despesa. Se houver só 1 CC, basta 1 linha de rateio com 100%.

Para não confundir o usuário, vamos:
- Renomear o cabeçalho do bloco 2 para **"Rateio por centro de custo (obrigatório)"**.
- Quando o usuário abrir o modal, **criar automaticamente 1 linha de rateio vazia em 100%** (caso comum). Ele só preenche o CC.
- Trocar o texto do estado vazio: deixar claro "Adicione pelo menos 1 centro de custo".
- Atualizar o artigo de ajuda `novo-pre-titulo.md` reforçando esse fluxo.

### 1.3 Layout muito vertical / estreito
O modal já está em `max-w-6xl w-[95vw]`, mas no print o conteúdo está renderizando em ~1 coluna porque o grid usa breakpoint `md:` (768px) e o painel do chat/devtools rouba largura. Vamos:
- Subir para `max-w-[1400px] w-[97vw]`.
- Reorganizar o bloco "Dados do documento" usando grid `lg:grid-cols-12` com colunas mais compactas (Empresa 4 / Fornecedor 4 / Nº doc 2 / Valor 2 — Descrição 8 / Emissão 2 / Vencimento 2 — etc).
- Diminuir paddings internos das `<section>` de `p-4` para `p-3`.
- Usar `Label` em fonte menor (`text-xs`) para ganhar altura útil.
- Tabela de rateio: usar `overflow-x-auto` (já tem) + colunas com `min-w` para evitar quebra feia.

---

## 2. Mudanças (apenas 2 arquivos)

### 2.1 `src/pages/financeiro/pagar/PreTitulosTab.tsx`
**Correção de dados:**
- Trocar a query `contas` para:
  ```ts
  .from("conta_contabil")
  .select("id, classificacao, descricao, natureza, grupo_dre, empresa_id")
  .eq("tipo", "analitica")
  .eq("ativo", true)
  .order("classificacao")
  ```
- Filtrar opcionalmente por `empresa_id === empresaId` no client (assim só mostra contas da empresa selecionada; se vazio, mostra todas).
- Filtrar para **contas de resultado** (despesa) por default, usando `grupo_dre` (mostrar primeiro os grupos de despesa/custo, depois "ver todas"). Versão mínima: só ordenar pelas de despesa primeiro.
- Renderizar `{c.classificacao} — {c.descricao}` nos `<SelectItem>` (3 ocorrências: default, rateio, e DetalheDialog/listagem).
- Ajustar `.select(..., conta_contabil(codigo, nome) ...)` → `conta_contabil(classificacao, descricao)` em **2 lugares** (lista principal + DetalheDialog) e usar esses campos no render.

**UX / rateio:**
- Inicializar `rateios` com 1 linha vazia (em vez de `[]`).
- Texto do bloco 2 atualizado.
- Bloqueio: se `rateios.length === 0 || qualquer linha sem CC` → desabilitar Salvar com tooltip.

**Layout horizontal:**
- `DialogContent`: `max-w-[1400px] w-[97vw] max-h-[92vh]`.
- Bloco 1: grid `lg:grid-cols-12` com a distribuição descrita acima.
- Labels `text-xs font-medium`.
- Reduzir `space-y-4` → `space-y-3` e `p-4` → `p-3` nas seções.

### 2.2 `src/content/ajuda/financeiro/novo-pre-titulo.md`
- Adicionar nota no bloco 2: "Mesmo que haja apenas 1 centro de custo, ele **deve** ser informado aqui — o sistema já cria 1 linha vazia para você."
- Esclarecer diferença entre "Conta contábil default" (bloco 1) e "Conta/verba" da linha de rateio.

---

## 3. Fora de escopo (não fazer agora)
- Multi-seleção / busca tipo combobox nas contas (volume é grande, mas resolver depois se necessário).
- Filtro por empresa server-side (RLS já cuida).
- Migração de banco.
- Alterar fluxo de aprovação / promoção.

---

## 4. Risco e validação
- **Risco baixo** — só ajusta nomes de coluna e layout.
- Pós-implementação: abrir modal, conferir que a lista de contas aparece com `3.x.xx.xxx — Descrição`, criar 1 pré-título de teste com 1 linha de rateio, conferir listagem.

---

## 5. Créditos estimados
| Etapa | Créditos |
|---|---|
| Correção das 3 queries + render | ~baixo |
| Reorganização do grid (1 bloco) | ~baixo |
| Atualizar artigo de ajuda | ~baixo |
| **Total estimado** | **1 PR pequeno (~1 chamada de implementação)** |

Sem varredura ampla, sem abrir outros módulos, sem mexer em banco. Aguardando aprovação para executar.
