

## Plano: Desconectar backend e reiniciar do zero

Você quer limpar qualquer conexão de backend (Supabase / Lovable Cloud) e recomeçar a criação do app neste mesmo chat.

### O que vou fazer (assim que você aprovar)

1. **Listar conexões ativas no workspace**
   - Verificar se há alguma conexão Supabase / Lovable Cloud vinculada a este projeto.

2. **Desconectar do projeto**
   - Se houver conexão vinculada, removê-la deste projeto (a conexão continua existindo no seu workspace, só deixa de estar ligada a este app).

3. **Confirmar estado limpo**
   - Confirmar que o projeto não tem mais backend vinculado.
   - Confirmar que o código atual já está em estado placeholder (sem cliente Supabase, sem auth, sem páginas de negócio) — então não há limpeza de código a fazer.

4. **Reiniciar o fluxo de criação**
   - Te perguntar de novo, do zero, qual backend você quer usar:
     - **Lovable Cloud** (recomendado, sem precisar de conta externa, eu provisiono na hora)
     - **Supabase externo** (conectar de novo o `erp-nascimento-dev` ou outro projeto)
   - E qual tipo de app você quer construir.

### O que NÃO será feito

- Não vou apagar nada no Supabase em si (tabelas, dados, projeto `erp-nascimento-dev` continuam intactos na sua conta Supabase).
- Não vou desconectar a organização Supabase do seu workspace Lovable, só remover o vínculo deste projeto específico (se existir).
- Não vou alterar arquivos de código agora — o projeto já está praticamente em branco.

### Detalhe técnico

- Uso `standard_connectors--list_connections` para descobrir o que está vinculado.
- Se houver vínculo, uso `standard_connectors--disconnect` no `connection_id` correspondente.
- Lovable Cloud, quando ativo, aparece como uma conexão própria e também pode ser desvinculada por aqui.
- Depois disso, o projeto volta ao estado “sem backend”, pronto para um novo fluxo de setup.

### Próximo passo após aprovação

Aprovando este plano, eu saio do modo Plan, executo a desconexão e te mostro um menu novo de opções para começar o app do zero.

