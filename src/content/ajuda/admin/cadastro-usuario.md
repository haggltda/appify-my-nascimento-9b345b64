# Como cadastro um usuário?

**Quem pode acessar:** **Apenas administradores** do sistema.
**Caminho no menu:** Administração › aba **Usuários**.
**Rota:** `/app/administracao`.
**Tempo médio:** 2 a 4 minutos por usuário.

> **Regra de ouro:** apenas perfis com papel **admin** podem criar, editar perfis ou alterar papéis de qualquer usuário (inclusive os próprios). Usuários comuns **não** podem editar o próprio perfil/role.

---

## 1. Antes de começar

- Você precisa estar logado com um usuário **admin**.
- **Empresa(s)** que o novo usuário terá acesso já devem estar cadastradas.
- **Papéis (roles)** disponíveis: admin, gestor, financeiro, compras, fiscal, rh, controladoria, diretoria, presidência, solicitante.
- Tenha em mãos: **nome completo**, **e-mail corporativo**, **empresa(s)** e **papéis** a atribuir.

---

## 2. Como abrir a tela

1. Menu lateral → **Administração**.
2. Vá para a aba **Usuários** (primeira aba).
3. A lista mostra todos os usuários ativos e inativos do sistema.

---

## 3. Como criar um novo usuário

1. Clique em **Novo usuário** no canto superior direito.
2. Abre o diálogo **"Criar usuário"**.
3. Preencha:

| Campo | Obrigatório | Observação |
|---|---|---|
| **Nome completo** | Sim | Aparece no topo do sistema |
| **E-mail** | Sim | Será o login. Deve ser único |
| **Empresa(s)** | Sim | Pode marcar várias |
| **Papéis (roles)** | Sim | Pode marcar vários — define o que o usuário vê |
| **Senha inicial** | Conforme parametrização | O sistema pode gerar e enviar por e-mail |
| **Forçar troca no 1º acesso** | Sim (recomendado) | Boa prática de segurança |

4. Clique em **Salvar**.
5. O sistema:
   - Cria a conta no provedor de autenticação.
   - Insere o registro na tabela de usuários e papéis.
   - Envia e-mail com credenciais (se parametrizado).
   - Toast verde: *"Usuário criado"*.

---

## 4. Como editar um usuário existente

1. Localize o usuário na lista (use busca por nome ou e-mail).
2. Clique no ícone de **lápis** ou na linha do usuário.
3. Altere os campos necessários.
4. Para **papéis (roles)**:
   - Marque/desmarque os papéis desejados.
   - O sistema aplica apenas a **diferença** (só adiciona o que foi marcado novo e remove o que foi desmarcado) — evita regredir o perfil acidentalmente.
5. Clique em **Salvar**.

> **Importante:** edição de papéis é **auditada**. Toda alteração fica registrada com quem fez, quando e o que mudou.

---

## 5. Como inativar/reativar

- **Inativar**: na lista, clique no toggle **Ativo** → confirma. O usuário não consegue mais logar, mas o histórico fica preservado.
- **Reativar**: mesmo toggle, ligando de novo.

> Nunca exclua usuário com histórico — sempre inative.

---

## 6. Checklist ANTES de salvar

- [ ] E-mail correto e único?
- [ ] Empresa(s) certas?
- [ ] Papéis mínimos necessários (princípio do menor privilégio)?
- [ ] "Forçar troca de senha" ligado?
- [ ] Combinou com o usuário que ele receberá e-mail?

---

## 7. O que acontece depois

| Etapa | Onde | Quem |
|---|---|---|
| 1. E-mail de boas-vindas | Caixa do usuário | Sistema |
| 2. 1º login | Tela de login | Usuário |
| 3. Troca obrigatória de senha | `/trocar-senha` | Usuário |
| 4. Acesso liberado conforme papéis | Menus filtrados | Sistema |

---

## 8. Erros comuns + solução

| Erro | Causa | Solução |
|---|---|---|
| "E-mail já existe" | Usuário cadastrado em outra empresa | **Vincular** à nova empresa em vez de criar |
| "Perfil regrediu sozinho" | Bug antigo, já corrigido | Edição agora aplica só a diferença — abrir chamado se ocorrer de novo |
| Usuário não recebe e-mail | Domínio não validado, caixa cheia | Validar com TI; reenviar senha manualmente |
| Não vejo o botão "Novo usuário" | Seu perfil não é admin | Solicitar a um admin |
| Usuário loga mas não vê menus | Sem papéis atribuídos | Editar e atribuir pelo menos um papel |

---

## 9. FAQ

- **Usuário comum pode editar o próprio papel?** **Não.** Apenas admin altera papéis — próprios ou de terceiros.
- **Usuário comum pode editar o próprio nome/foto?** **Não.** Após cadastrado, qualquer alteração de perfil é feita pelo admin.
- **Posso ter mais de um admin?** Sim e é recomendado (mínimo 2).
- **Como reseto a senha de alguém?** Botão **Resetar senha** na linha do usuário → e-mail automático com link.
- **Como revogo uma sessão ativa?** Administração › aba **Sessões** → botão **Revogar** na sessão.
- **Onde vejo o histórico de alterações?** Administração › aba **Auditoria**.
