# Manual de Gestão de Usuários e Permissões

Guia oficial e didático para administrar **quem entra**, **o que vê** e **o que pode fazer** dentro do ERP. Toda a governança está concentrada em **Configurações do ERP** (`/app/administracao`).

---

## Módulo 1 — A Lógica de Segurança do ERP

### O que é isso?
A segurança do ERP funciona em **4 camadas independentes e complementares**. Entender cada uma evita 90% dos chamados de "não consigo acessar".

### Para que serve e Por que fazer?
Separar as camadas permite dar acesso **cirúrgico**: liberar uma tela sem liberar o botão de excluir, ou esconder um menu inteiro para um único usuário sem mexer no perfil do cargo.

### As 4 camadas

| # | Camada | Responde à pergunta | Onde se configura |
|---|---|---|---|
| 1 | **Usuários** | Quem é a pessoa? | Aba **Usuários** |
| 2 | **Perfis de Acesso (Roles)** | Qual é o cargo dela? | Aba **Perfis** (só visual) |
| 3 | **Permissões (ações na tela)** | O que ela pode FAZER dentro da tela? | Aba **Permissões — Ações na tela** |
| 4 | **Visibilidade de menu** | Ela VÊ o item no menu lateral? | Aba **Visibilidade de menu** |

**Perfis fixos disponíveis:** Admin, Controladoria, Comercial, Operacional, Jurídico, SST, Diretor Administrativo, Diretor Operacional, Comprador, Almoxarife, Gestor CC, Fiscal Recebedor.

**Ações da matriz CRUD:** Visualizar · Incluir · Alterar · Excluir · Aprovar · Exportar · Executar.

### ⚠️ Exemplo Prático
Maria é **Compradora**. Por perfil, ela vê o módulo *Suprimentos*. Você quer que ela veja a tela de **Pedidos**, mas **não possa excluir** pedidos já aprovados.
- Camada 4 (Visibilidade): mantém o menu *Pedidos* visível para o perfil Comprador.
- Camada 3 (Permissões): desmarca *Excluir* na linha *Pedidos* do perfil Comprador.
- Resultado: Maria abre a tela normalmente, mas o botão *Excluir* fica desabilitado.

---

## Módulo 2 — Aba "Usuários" (Passo a Passo)

### O que é isso?
Tela onde você cadastra as **pessoas físicas** que terão login no ERP.

### Onde clicar?
**Menu rodapé → Configurações do ERP → aba Usuários**.

### Passo a passo — Novo usuário
1. Clique em **+ Novo usuário** (canto superior direito).
2. Preencha:
   - **Nome completo** — como aparecerá na tela e em assinaturas de aprovação.
   - **E-mail** — será o login. Deve ser único.
   - **Senha temporária** — o sistema força troca no primeiro acesso.
   - **Empresa padrão** — empresa que abre automaticamente ao logar.
   - **Switch "Acessa todas as empresas do grupo"** — quando ligado, o usuário pode trocar de empresa no topbar; quando desligado, fica restrito à empresa padrão.
3. Marque os **Perfis (Roles)** aplicáveis nas checkboxes (pode marcar mais de um — ex: *Controladoria* + *Diretor Administrativo*).
4. **Salvar**.

### Passo a passo — Editar usuário
1. Localize na lista (busca por nome/e-mail).
2. Clique em **Editar** na linha.
3. Altere o que precisar. Para **revogar acesso**, desligue todos os Perfis ou marque como inativo.
4. **Salvar**.

### O que esperar?
O usuário recebe a senha temporária. No primeiro login, é forçado a trocá-la. A partir daí, vê apenas os menus e ações liberados pelas camadas 3 e 4.

### ⚠️ Atenção
- Trocar a **Empresa padrão** não afeta dados antigos — só muda o que abre por default.
- Desmarcar **"Acessa todas as empresas"** corta imediatamente a visão multi-empresa, inclusive de relatórios consolidados.

---

## Módulo 3 — Aba "Perfis de Acesso"

### O que é isso?
Tela para editar **apenas o visual** dos cargos fixos: **nome de exibição, ícone e cor de badge**.

### Para que serve?
Padronizar a identidade visual dos cargos na interface (ex: badge vermelho para Diretoria, azul para Controladoria).

### Onde clicar?
**Configurações do ERP → aba Perfis**.

### ⚠️ Atenção — Regra de Ouro
**Aqui NÃO se altera nenhuma regra lógica.** As permissões dos perfis ficam na aba *Permissões — Ações na tela* (Módulo 4). Os perfis em si são fixos no sistema (não podem ser criados nem excluídos), só o rótulo visual é editável.

---

## Módulo 4 — Aba "Permissões (ações na tela)"

### O que é isso?
Matriz **Perfil × Tela × Ação** que define o que cada cargo pode FAZER dentro de cada tela.

### Onde clicar?
**Configurações do ERP → aba Permissões — Ações na tela**.

### Passo a passo
1. No dropdown **Perfil ativo**, selecione o cargo a configurar (ex: *Controladoria*).
2. Expanda o **Módulo** desejado (ex: *Financeiro*).
3. Para cada **tela** listada, marque/desmarque as caixas das ações: *Visualizar · Incluir · Alterar · Excluir · Aprovar · Exportar · Executar*.
4. As alterações são salvas automaticamente (auto-save com confirmação no rodapé).

### O que esperar?
Mudanças entram em vigor **no próximo refresh** da tela do usuário afetado. Botões e menus se reabilitam/desabilitam de acordo.

### ⚠️ Regra de Ouro
> Se o usuário tem **visibilidade de menu ativa** (camada 4), mas a ação *Alterar* está **desmarcada aqui** (camada 3), ele **vê a tela**, mas o **botão Salvar fica bloqueado**. Isso é intencional: dá leitura sem dar edição.

### Exemplo Prático
*Comercial* deve consultar a Contabilidade mas nunca editar:
- Marque *Visualizar* nas telas de Contábil.
- Desmarque *Incluir / Alterar / Excluir / Executar*.
- Resultado: lê o DRE, mas não consegue lançar partidas.

---

## Módulo 5 — Aba "Visibilidade de Menu"

### O que é isso?
Controla **se o item aparece no menu lateral** — independente da permissão de ação. Tem duas sub-abas.

### Onde clicar?
**Configurações do ERP → aba Visibilidade de menu**.

### Sub-aba "Por Perfil"
- Liste o perfil (ex: *Almoxarife*) e use os **toggles** para ligar/desligar módulos inteiros ou itens individuais.
- Afeta **todos** os usuários que possuem aquele perfil.

### Sub-aba "Overrides por Pessoa"
- Use quando precisar **abrir uma exceção para 1 pessoa específica** sem mexer no perfil do cargo.
- Localize o usuário pelo nome/e-mail.
- Use os toggles para **forçar visível** ou **forçar oculto** itens de menu.
- **Precedência:** *Override de usuário* **sempre vence** o perfil.

### O que esperar?
O Sidebar do usuário se atualiza no próximo carregamento. Itens desligados somem completamente — não ficam acinzentados.

### ⚠️ Exemplo Prático
João é *Comprador*, mas vai cobrir férias do Financeiro por 15 dias. Em vez de criar perfil novo:
- Vá em **Overrides por Pessoa** → busque *João* → ligue os toggles do módulo *Financeiro*.
- Em 15 dias, desligue de volta.

---

## Módulo 6 — Aba "Plano de Ações (ACL)"

### O que é isso?
**ACL ultra-específica por USUÁRIO** (não por perfil) exclusiva para o módulo **Plano de Ações**. Existe porque esse módulo tem regras de governança muito particulares (ex: só o dono cria, só o comitê aprova).

### Onde clicar?
**Configurações do ERP → aba Plano de Ações (ACL)**.

### Colunas de permissão especial
| Coluna | O que libera |
|---|---|
| **Visualizar** | Ver planos de ação dentro do escopo permitido |
| **Dashboard** | Acessar o painel consolidado |
| **Criar** | Abrir um novo plano |
| **Editar** | Alterar planos existentes |
| **Excluir** | Remover planos (uso restrito) |
| **Importar** | Carga em lote via planilha |
| **Aprovar** | Aprovar marcos e encerramentos |

### Passo a passo
1. Busque o usuário pelo nome.
2. Marque/desmarque as colunas necessárias.
3. Salve.

### ⚠️ Atenção
Estas regras **convivem** com Permissões e Visibilidade — porém, no módulo *Plano de Ações*, a ACL específica é quem decide. Se o usuário tem visibilidade do menu mas a ACL não libera *Criar*, o botão *Novo Plano* não aparece.

---

## Módulo 7 — FAQ & Troubleshooting

### "O usuário diz que o menu Financeiro sumiu. O que fazer?"
1. Vá em **Configurações do ERP → Visibilidade de menu**.
2. Verifique primeiro em **Overrides por Pessoa** se há um override desligando *Financeiro* para esse usuário.
3. Se não houver override, vá em **Por Perfil** e confirme que o perfil do usuário tem o módulo *Financeiro* ligado.
4. Peça ao usuário para fazer logout/login.

### "O usuário entra na tela de Licitações mas o botão Excluir não funciona. O que arrumar?"
1. Vá em **Configurações do ERP → Permissões — Ações na tela**.
2. Selecione o perfil do usuário.
3. Expanda *Licitações* → confirme a marca em *Excluir* na tela específica.

### "Preciso dar acesso temporário/extra para apenas UM usuário sem mudar o perfil do cargo."
- Para **mostrar/esconder menu**: use **Visibilidade de menu → Overrides por Pessoa**.
- Para **liberar ação no Plano de Ações**: use a aba **Plano de Ações (ACL)**.
- Para outras ações pontuais (CRUD em telas): hoje só é possível via Perfil — neste caso, considere criar override no menu e combinar com perfil mais permissivo, ou avalie redesenhar a divisão de cargos.

### "Mudei a permissão e o usuário continua sem acesso. Por quê?"
- Peça **F5 / logout-login**. O ERP cacheia permissões por sessão.
- Verifique se há **override por pessoa** sobrescrevendo o perfil.
- Confirme que o usuário tem o perfil correto marcado na aba *Usuários*.

### "Onde fica o histórico de quem mudou o quê?"
Em **Configurações do ERP → aba Auditoria** (mostra alterações em perfis, permissões, overrides e usuários com data, autor e valor antigo/novo).

---

**Resumo de precedência (do mais forte para o mais fraco):**
1. **Override por Pessoa** (Visibilidade de menu)
2. **ACL Plano de Ações** (somente nesse módulo)
3. **Permissões por Perfil** (ações CRUD)
4. **Visibilidade por Perfil** (menu lateral)

Quando algo "não funciona", percorra essa lista de cima para baixo.
