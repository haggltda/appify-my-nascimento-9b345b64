## Diagnóstico do CSV recebido

Arquivo: `02_Estrutura_Setores_IA.csv` — **290 linhas**, separador `;`, colunas: `ID_Estrutura; Empresa; Comitê; Área; Setor; Gestor`.

### Hierarquia detectada

- **Empresa:** apenas `Grupo Nascimento` (1 valor) — **não existe** nas `empresas` do banco. Empresa mais provável p/ vincular: **HAGG** (`5a61c769-…-bce8`), que é a única com dados ativos hoje. ⚠️ Confirmar.
- **Comitês (5):** Administrativo (13 áreas), Operacional (9), Controladoria (4), Reunião Extraordinária (4), **Gestor (2)**.
  - ⚠️ "Gestor" tem só 2 áreas (Presidência, Comitê Gestor) e parece ser erro de digitação ou rótulo solto. Sugestão: **descartar** o comitê "Gestor" (já existe "Comitê Gestor" como Área dentro de Administrativo). Confirmar.
- **Áreas:** mesmo nome de área pode aparecer em comitês diferentes (ex.: "Controladoria" em Administrativo, Operacional e Controladoria) — serão **registros separados** por comitê (regra já validada).
- **Setores totais:** ~265 únicos por (comitê,área).

### Gestores

Apenas 3 dos 13 nomes existem em `profiles` da HAGG:

| Nome no CSV | Existe em profiles? |
|---|---|
| Helena Nascimento | ✅ vincula |
| Yuri (Rosa) | ✅ vincula |
| Senilton (Nascimento) | ✅ vincula |
| Alessandra, Caroline, Natália, Milena, Fernanda, Francieli, Daison, Cleidir, Lucas | ❌ não existem |

Para os 10 nomes sem perfil, **não há onde gravar o nome** (a coluna `gestor_profile_id` é uuid). Proposta: deixar `gestor_profile_id` NULL e gravar o nome em `descricao` do comitê/área no formato `Gestor: <nome>` para não perder a informação. Quando o perfil for criado, vinculamos depois.

---

## O que será executado (em UMA migration de dados)

1. **Resolver `empresa_id`** = HAGG (`5a61c769-21d8-4e61-b9bb-506b8db0bce8`).
2. **Descartar** linhas do comitê literal `"Gestor"` (5 linhas) — confirmar.
3. **Inserir 4 comitês** (Administrativo, Operacional, Controladoria, Reunião Extraordinária) com `ativo=true`. Vínculo de gestor:
   - Administrativo → Helena Nascimento
   - Operacional → Senilton
   - Controladoria → Yuri
   - Reunião Extraordinária → Helena Nascimento
   - (inferido a partir de quem aparece como gestor da área "Diretoria/Presidência" em cada comitê)
4. **Inserir áreas** (uma por par único comitê+área, ~30 linhas), vinculando `gestor_profile_id` quando o nome bate com `profiles`. Para os demais, gravar `descricao = 'Gestor: <Nome>'`.
5. **Inserir setores** (~265 linhas), com `area_id` correspondente e `gestor_profile_id` herdando do gestor da área (mesma regra: vincula se existir profile, senão grava em `descricao`).
6. **Idempotência:** antes de inserir cada nível, verifica se já existe (`empresa_id` + `nome` + escopo pai). Não duplica.

### O que **não** será feito

- ❌ Não criar `profiles` para os 10 nomes faltantes (precisa email + senha — fora do escopo).
- ❌ Não tocar em `centro_custo_id` (não veio no CSV).
- ❌ Não modificar `plano_acao` antigo — segue com texto livre original; novos cadastros usarão o oficial.
- ❌ Não alterar schema, só dados.

### Resultado esperado na tela `/app/co/estrutura-organizacional`

- Coluna 1: 4 comitês cadastrados.
- Coluna 2: ao clicar Administrativo → 13 áreas; Operacional → 9; Controladoria → 4; Reunião Extraordinária → 4.
- Coluna 3: ao clicar uma área → seus setores.
- Gestores: 3 vinculados como pessoa, demais visíveis em "descrição" como texto.

---

## Perguntas para aprovar

1. **Empresa = HAGG**, ok?
2. **Descartar o comitê "Gestor"** (5 linhas órfãs), ok?
3. **Gestores sem perfil**: gravar o nome em `descricao` (proposta) **ou** prefere que eu já crie os profiles com email placeholder (`nome@haggltda.com.br`, sem login) para vincular como pessoa?

Aguardando seu OK para executar.