
# Copiloto IA — Plano de Ações

Assistente conversacional (voz + texto) dentro do módulo **Plano de Ações**, exclusivo para os perfis **`admin`** e **`presidencia`**, capaz de criar, consultar e atualizar ações por linguagem natural, com confirmação humana antes de gravar.

## 1. Escopo e restrições

- **Acesso**: somente `admin` e `presidencia` (enum `app_role` já existente). Para qualquer outro perfil:
  - O item de menu **não aparece**;
  - A rota é bloqueada por `RoleGate`;
  - A edge function valida o role no servidor (defesa em profundidade).
- **Funcionalidade exclusiva**: criar ações por conversa. Consultas/dashboards continuam onde já estão — o chat só **cria** (mantendo o pedido do usuário).
- **Nada mais será alterado** fora deste escopo.

## 2. Nome e navegação

- Novo menu dentro do módulo `plano_acoes`:
  - **Código**: `copiloto_ia`
  - **Nome exibido**: **Copiloto IA**
  - **Rota**: `/app/plano-acoes/copiloto`
  - **Ícone**: `Sparkles`
  - **Ordem**: 15 (logo após "Lista")
- Sidebar e `PermissoesTab` exibem o menu apenas para os dois perfis permitidos.

## 3. Experiência (UI/UX)

Tela cheia, alto impacto visual, 100% via tokens semânticos da paleta atual:

- **Layout**: split em desktop (histórico de conversa à esquerda, painel "Ação em rascunho" à direita) / stack no mobile.
- **Entrada**:
  - Campo de texto com envio por Enter;
  - Botão grande de **microfone** (push-to-talk + toggle), com waveform animado enquanto grava;
  - Indicador "transcrevendo…" / "pensando…".
- **Mensagens**: bolhas com markdown, timestamps, badge "IA" / "Você".
- **Painel de rascunho**: mostra os campos extraídos (título, problema, ação, responsável, datas, prioridade, comitê, área, custo previsto). Cada campo editável inline.
- **Confirmação humana obrigatória**: botões **Confirmar e criar**, **Ajustar por voz**, **Descartar**. Nada é gravado sem clique de confirmação.
- **Feedback**: toast de sucesso com link para a ação criada; histórico da conversa persistido.

## 4. Fluxo conversacional

```text
Usuário (áudio) ──► STT ──► texto ──► LLM (system prompt + contexto)
                                          │
                          ┌───────────────┼────────────────┐
                          ▼               ▼                ▼
                    intent: criar   intent: ajustar    intent: cancelar
                          │
                          ▼
                  tool_call: draft_acao(...)
                          │
                          ▼
                  Painel de rascunho preenchido
                          │
                          ▼
                  IA pergunta o que falta (1 campo por vez)
                          │
                          ▼
                  Usuário confirma ──► tool_call: criar_acao ──► insert em plano_acao
```

- **Estratégia anti-alucinação**: a IA **nunca** grava direto; só preenche o rascunho via tool calling. O `INSERT` real acontece apenas após confirmação explícita do usuário no botão.
- **Campos obrigatórios mínimos** para criar: `titulo`, `acao`, `data_fim_planejado`, `prioridade_normalizada`. Os demais a IA pergunta ou deixa nulos.
- **Normalização**: prioridade e status passam pelos enums já em `src/types/planoAcao.ts`; datas em PT-BR ("até sexta", "30/05") resolvidas no servidor.

## 5. Stack de IA

- **LLM**: Lovable AI Gateway, modelo padrão `google/gemini-3-flash-preview` (rápido e barato; trocável por env futuro).
- **Tool calling** para extrair estrutura (sem pedir JSON no prompt). Tools expostas:
  - `propor_rascunho_acao(campos)` — preenche/atualiza painel;
  - `listar_responsaveis(query)` — busca em `profiles` para sugerir;
  - `confirmar_criacao()` — só sinaliza pronto; o INSERT é feito pelo backend após o clique do usuário.
- **STT (áudio → texto)**: usa **Lovable AI Gateway** com modelo de transcrição já disponível (mesma chave `LOVABLE_API_KEY`, sem novo segredo). Áudio é gravado como WebM/Opus no browser e enviado em base64 para a edge function.
- **TTS**: **fora do escopo** nesta primeira versão (a usuária fala; a IA responde por texto). Pode ser adicionado depois.

## 6. Backend (edge functions)

Três funções novas, todas com CORS, validação Zod e checagem de role no servidor:

1. **`copiloto-acoes-chat`** (streaming SSE)
   - Entrada: `{ conversation_id, messages, draft }`.
   - Valida `has_role(uid, 'admin' | 'presidencia')`.
   - Carrega contexto leve (nomes de comitês/áreas existentes na empresa, lista resumida de responsáveis) para grounding.
   - Chama Lovable AI Gateway com tools.
   - Faz stream da resposta para a UI.

2. **`copiloto-acoes-transcrever`**
   - Entrada: `{ audio_base64, mime }`.
   - Chama endpoint de STT do Lovable AI Gateway.
   - Retorna `{ texto }`.

3. **`copiloto-acoes-criar`**
   - Entrada: `{ draft, conversation_id }`.
   - Revalida role + revalida campos com Zod.
   - Faz o `INSERT` em `plano_acao` usando `service_role` (RLS-safe), com `criado_por = auth.uid()`, `origem = 'copiloto_ia'`.
   - Registra em `plano_acao_historico`.
   - Retorna `{ id }`.

Tratamento explícito de `429` e `402` do Gateway, com toasts amigáveis.

## 7. Banco de dados

Migrações mínimas:

- **`copiloto_conversa`**
  - `id`, `empresa_id`, `user_id`, `titulo`, `created_at`, `updated_at`.
- **`copiloto_mensagem`**
  - `id`, `conversa_id` (FK), `role` (`user` | `assistant` | `tool`), `content` (text), `audio_url` (nullable), `metadata` (jsonb), `created_at`.
- **RLS** em ambas: `SELECT/INSERT/UPDATE/DELETE` apenas se `user_id = auth.uid()` **e** `has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'presidencia')`.
- **Storage**: bucket privado `copiloto-audios` para guardar os áudios enviados (signed URLs, retenção 30 dias). Política: usuário só lê/grava sua própria pasta.
- **Sem mudanças destrutivas** em `plano_acao`. Apenas usamos `origem = 'copiloto_ia'` (campo já existe).
- **`app_modulo` / `app_menu`**: insere o menu `copiloto_ia` em `plano_acoes`.

## 8. Frontend

Novos arquivos (apenas UI/integração, sem mexer em outras telas):

- `src/pages/plano-acoes/CopilotoIA.tsx` — tela principal.
- `src/components/plano-acoes/copiloto/ChatPane.tsx`
- `src/components/plano-acoes/copiloto/MicRecorder.tsx` (MediaRecorder + waveform)
- `src/components/plano-acoes/copiloto/RascunhoAcaoPanel.tsx`
- `src/hooks/useCopilotoChat.ts` (gerencia stream SSE + estado de rascunho)
- `src/hooks/useCopilotoStt.ts`

Roteamento: adicionar rota em `src/App.tsx` envolvida em `RoleGate acao="visualizar" modulo="plano_acoes" menu="copiloto_ia"` + checagem extra `roles.includes('admin') || roles.includes('presidencia')`.

Sidebar (`Sidebar.tsx`): novo item visível apenas se o role permitir.

## 9. Análise de impacto

**Estrutura**
- 2 tabelas novas + 1 bucket + 3 edge functions + 1 tela + 1 item de menu.
- Zero alteração em tabelas existentes (apenas `INSERT` em `app_modulo`/`app_menu` e em `plano_acao` via fluxo normal).
- `PermissoesContext` já suporta `menu_codigo`, então a permissão granular do novo menu funciona out-of-the-box.

**Performance**
- Chat é stream SSE → baixo TTFB; sem polling.
- Contexto enviado ao LLM é resumido (nomes/áreas), não a base inteira → tokens controlados.
- Áudios em Opus (~16 kbps) → payloads pequenos.
- `copiloto_mensagem` cresce só para 2 usuários (admin + presidência); índice por `conversa_id, created_at`.
- Nenhuma query nova é disparada nas telas existentes do Plano de Ações → impacto **zero** em quem não usa o copiloto.

**Segurança**
- Role checada em 3 camadas: sidebar, `RoleGate` na rota e dentro de **cada** edge function.
- RLS bloqueia leitura cruzada de conversas mesmo em caso de bug no client.
- Áudios em bucket privado com signed URL curto.
- Validação Zod no servidor antes do `INSERT`.

**Custos**
- Gemini 3 Flash + STT do Gateway → baixo custo por interação. Limite de uso natural: apenas 2 perfis com acesso.
- Possível swap futuro para outra IA exposto via env, sem refactor.

**Riscos / mitigação**
- *Alucinação de responsáveis ou datas* → tool `listar_responsaveis` + confirmação humana obrigatória.
- *Rate limit (429) / créditos (402)* → tratado e exibido como toast.
- *Gravação de áudio em iOS Safari* → usar `MediaRecorder` com fallback para `audio/mp4` quando `audio/webm` indisponível.

## 10. Entregáveis (ordem de execução após aprovação)

1. Migração SQL (tabelas, RLS, bucket, menu).
2. Edge functions (`chat`, `transcrever`, `criar`).
3. Frontend (tela + componentes + hooks + rota + sidebar).
4. Smoke test manual com a conta de presidência.

---

**Nada será implementado até sua aprovação.** Se quiser ajustar algum ponto (nome do menu, incluir TTS, permitir também consultas além de criação, trocar modelo, etc.), me diga antes de prosseguir.
