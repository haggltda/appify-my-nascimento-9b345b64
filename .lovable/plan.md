
# Etapa 0 — Inventário técnico base (read-only)

**Teto acordado:** 3 créditos. **Modo:** somente leitura — sem migrations, sem RLS, sem código, sem edge functions.

## Objetivo
Produzir um único documento `.lovable/inventario-etapa0.md` consolidando o estado real de Supabase + App + repositório, para servir de base aos 21 fluxos do V3.

## Escopo coberto (ordem de execução)

1. **Supabase — schema `public`**
   - Tabelas: nome, nº de linhas, RLS on/off, owner.
   - Policies por tabela (resumo: quantas, para quais ações).
   - Functions / RPCs (nome, security definer sim/não).
   - Triggers ativos.
   - Enums e seus valores.
   - Views.
   - Buckets de storage + policies.
2. **App Lovable (leitura de arquivos já em contexto, sem reabrir tudo)**
   - Mapa de rotas em `src/App.tsx`.
   - Inventário de páginas por módulo (admin, financeiro, contábil, contratos, suprimentos, rh, controladoria, integração, pareceres, plano-acoes).
   - Gates de autenticação/empresa/role em uso (`ProtectedRoute`, `RouteGuard`, `RoleGate`, `ScreenGate`, `EmpresaAtivaContext`, `PermissoesContext`).
3. **Repositório / migrations**
   - Lista de migrations em `supabase/migrations/` (apenas nomes + data).
   - Edge functions presentes em `supabase/functions/`.
4. **Reaproveitamento**
   - Releitura cruzada com `.lovable/auditoria-v2.md` e `.lovable/plan.md` para marcar o que já está documentado vs. o que é novo.

## Entregável único
Arquivo `.lovable/inventario-etapa0.md` com seções:
- Resumo executivo (5–10 linhas).
- Tabela de volumetria atualizada.
- Tabela de RLS por tabela (com flag de risco).
- Lista de RPCs/funções reaproveitáveis.
- Gaps vs. os 21 fluxos do V3 (matriz fluxo × pronto/parcial/ausente).
- Bloqueadores conhecidos (ex.: `contrato` ainda vazio, origem de receita).

## Como o teto de 3 créditos é respeitado
- Tudo é leitura (`supabase--read_query`, `code--view`, `code--list_dir`) + 1 escrita final do markdown.
- Consultas batched em paralelo sempre que independentes.
- Se eu perceber, no meio do trabalho, que vou estourar o teto, **eu paro imediatamente**, salvo o que já levantei como `inventario-etapa0-parcial.md` e te informo:
  - O que foi coberto.
  - O que ficou pendente.
  - Sugestão de teto adicional para concluir (sem cravar número exato — apenas "pequeno/médio/grande" relativo ao que já gastou).

## Compromisso de fechamento
Ao final da etapa, eu te respondo explicitamente com **uma das duas frases**:
- ✅ "Entreguei tudo o que estava no escopo da Etapa 0 dentro do teto."
- ⚠️ "Não entreguei tudo. Faltou: [lista]. Motivo: [teto atingido / bloqueio técnico X]."

Sem ambiguidade, sem "praticamente tudo", sem "quase completo".

## O que NÃO está nesta etapa (para evitar escopo escondido)
- Nenhuma migration.
- Nenhuma mudança de RLS.
- Nenhuma alteração de UI ou edge function.
- Nenhum dos 21 fluxos do V3 é executado aqui — apenas mapeados.
- Sem implementação do ajuste Helena/Maiara.

Aprova para eu executar?
