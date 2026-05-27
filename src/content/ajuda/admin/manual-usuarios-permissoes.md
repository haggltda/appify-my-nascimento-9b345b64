# Central de Governança e Acessos

Guia Oficial de Gestão de Usuários, Perfis e Permissões do ERP

Bem-vindo(a) ao guia de segurança do nosso ERP. Aqui, você aprenderá como administrar de forma fácil, segura e com autonomia quem entra, o que vê e o que pode fazer no sistema.

Todo o controle de acessos está concentrado em um único lugar: no menu **Configurações do ERP** (`/app/administracao`).

---

## Módulo 1 — A Lógica de Segurança do ERP

A nossa arquitetura de segurança foi desenhada para ser simples no dia a dia, mas impenetrável por trás das telas. Para evitar 90% das dúvidas de "não consigo acessar", basta entender que o sistema trabalha com duas perguntas na hora de liberar ou bloquear uma ação:

**1. Qual é o Perfil (Cargo) da pessoa?** A grande maioria da sua equipe (os 90%) se encaixa em Perfis predefinidos (ex: Financeiro, Comercial, Almoxarife). Nós configuramos a regra padrão para aquele cargo: "Todo mundo que é do Financeiro pode ver Contas a Pagar e Inserir dados, mas não pode Excluir".

**2. Essa pessoa tem alguma Exceção Individual?** Para os 10% da equipe que fogem à regra (ex: o João é do Financeiro, mas ele é o Coordenador e precisa aprovar/excluir contas), nós usamos a **Exceção Individual (Override)**. Você não precisa criar um perfil novo chamado "Financeiro Master". Você simplesmente vai na ficha do João e marca: "Deixe ele no perfil Financeiro, mas libere a Exclusão só para ele".

### 🌟 A Regra de Ouro: A Exceção Individual SEMPRE vence o Perfil

Para que não haja nenhuma dúvida de como o ERP pensa, imagine que a segurança funciona como um condomínio empresarial com dois tipos de autorizações:

- **O Perfil (A Regra do Cargo):** É o "crachá padrão" do departamento. Todos os analistas do financeiro usam exatamente o mesmo crachá, que abre as portas básicas do setor.
- **A Exceção Individual (O Passe VIP ou Bloqueio):** É uma ordem direta e nominal. É um comando que diz: "O crachá dessa pessoa é do Financeiro, mas dê a ela acesso extra à sala da Diretoria" OU "O crachá dela é do Financeiro, mas proíba ela de entrar na sala de investimentos".

Quando um funcionário clica em um botão, o ERP realiza uma varredura hierárquica e rígida de cima para baixo:

1. **O usuário tem uma Exceção Individual?**
   - **SIM:** O ERP executa a Exceção (Permitir ou Negar) e ENCERRA a verificação. A regra do perfil é totalmente ignorada.
   - **NÃO:** O ERP vai para o passo 2.
2. **O que diz a Regra Geral do Perfil dele?**
   - O ERP aplica a regra do cargo padrão.

### Exemplos Práticos do Dia a Dia

- **Cenário A (Superpoder Temporário):** O perfil Comercial não pode excluir editais. Carlos é do Comercial, mas foi nomeado líder da semana. Você vai na aba de Exceções Individuais do Carlos e muda a coluna **Excluir** para **Permitir**. Quando Carlos tentar excluir um edital, o ERP lê a exceção dele e libera. Ele nem olha que o perfil Comercial proibia. O resto da equipe continua bloqueada; só Carlos recebeu o "superpoder".
- **Cenário B (Restringir funcionário novo):** O perfil Controladoria pode ver a tela de BDI. Amanda acabou de entrar no setor e está em treinamento, então não deve ver essa tela ainda. Você vai nas Exceções Individuais dela e muda a coluna **Visualizar** para **Negar**. O ERP bloqueia o menu para ela imediatamente, ignorando que o cargo dela dava acesso.
- **Cenário C (Comportamento Padrão):** Se na ficha de exceções do usuário todas as colunas estiverem como **Herdar**, o sistema seguirá 100% o que estiver na regra geral do Perfil.

---

## Módulo 2 — Gestão de Usuários (Quem acessa o sistema?)

A aba **Usuários** é onde a jornada começa. É aqui que você cria logins, define o e-mail, vincula a pessoa à empresa e diz qual é o perfil dela.

### Passo a passo: Criando um Novo Usuário

1. Acesse **Configurações do ERP ➔ aba Usuários**.
2. Clique no botão **+ Novo usuário** (no canto superior direito).
3. Preencha os dados fundamentais:
   - **Nome completo:** Como a pessoa será chamada nas telas e assinaturas.
   - **E-mail:** Será o login de acesso (deve ser único).
   - **Senha temporária:** Crie uma senha simples (ex: `Mudar123`). O ERP forçará a pessoa a criar uma nova senha definitiva no primeiro acesso.
   - **Empresa padrão:** A empresa que o ERP carregará automaticamente para ela.
   - **Acessa todas as empresas:** Se ativado, ela poderá trocar de empresa no menu do topo. Se desativado, ficará restrita à empresa padrão.
   - **Perfil (Role):** Selecione as caixinhas referentes aos cargos dela (pode ser mais de um).
4. Clique em **Salvar**.

### Passo a passo: Editar ou Bloquear um Usuário

1. Na lista, busque a pessoa pelo nome ou e-mail.
2. Clique em **Editar** na linha correspondente.
3. Altere o que precisar.
4. Para **bloquear/revogar** o acesso: Mude o "Status" para inativo ou desmarque todos os Perfis. Clique em **Salvar**.

---

## Módulo 3 — Matriz Unificada de Permissões (O coração do sistema)

Graças à nossa **Gestão Unificada**, você não precisa ir em uma tela para liberar o menu e em outra tela para liberar os botões. Tudo é feito em um único painel de controle.

Acesse **Configurações do ERP ➔ aba Permissões Unificadas**.

Você verá uma tabela com as telas do sistema e 7 colunas de ações: **Visualizar · Incluir · Alterar · Excluir · Aprovar · Exportar · Executar IA**.

**O Botão Mágico (Visualizar):** A coluna **Visualizar** é a chave principal. Se ela estiver marcada, o menu lateral aparece para o usuário. Se estiver desmarcada, o menu some. As outras colunas (Incluir, Alterar, etc.) dizem o que ele pode fazer depois de entrar na tela. Por exemplo: você pode marcar Visualizar e desmarcar Alterar; o usuário conseguirá ler tudo, mas o botão "Salvar" ficará bloqueado.

### Sub-aba: Permissões por Perfil (A Regra Geral)

1. Selecione o **Perfil** desejado no topo (ex: Comercial).
2. Expanda o módulo que deseja configurar (ex: Financeiro).
3. Marque ou desmarque as caixinhas de ação de acordo com o que esse cargo deve fazer.
4. Clique em **Salvar matriz** no rodapé.

### Sub-aba: Exceções Individuais (Para pessoas específicas)

1. Selecione o **usuário** (ex: Carlos).
2. A tabela mostrará o que ele já possui de acesso (estará escrito "Herança").
3. Vá até a tela e ação que deseja mudar. Clique no seletor e mude de "Herdar" para **Permitir** (conceder superpoder) ou **Negar** (bloquear acesso).
4. Clique em **Salvar exceções**.

---

## Módulo 4 — Plano de Ações (A ACL Especial)

O módulo "Plano de Ações" possui uma governança própria e muito rigorosa (ex: comitês, donos de planos). Devido a isso, suas permissões finas ficam em uma aba separada.

1. Acesse **Configurações do ERP ➔ aba Plano de Ações (ACL)**.
2. Busque o usuário pelo nome.
3. Marque/desmarque as colunas necessárias (**Dashboard, Criar, Editar, Excluir, Importar, Aprovar**).

**Atenção:** Se o usuário não tiver a permissão de **Visualizar** o Plano de Ações na Matriz Unificada (Módulo 3), ele nem verá o menu, independentemente do que estiver configurado aqui. Essa aba apenas refina o que ele faz lá dentro.

---

## Módulo 5 — Personalizando o Visual dos Perfis

Quer deixar o ERP com a cara da sua empresa? Você pode mudar a cor ou o ícone que representa um cargo no sistema (ex: colocar uma maleta azul para a Diretoria e um escudo vermelho para a Auditoria).

1. Acesse **Configurações do ERP ➔ aba Perfis de Acesso**.
2. Clique em **Editar** no cartão desejado e mude o rótulo, ícone ou cor.

**Aviso de Segurança:** Isso é puramente estético. Mudar o nome ou a cor de um perfil aqui **não altera nenhuma regra de acesso**. A segurança mora exclusivamente na Matriz Unificada (Módulo 3).

---

## Módulo 6 — FAQ & Solução Rápida de Problemas

**1. "O usuário diz que a tela do Financeiro sumiu do menu. O que fazer?"**

- Primeiro, vá na aba **Permissões Unificadas ➔ Exceções individuais**. Busque pelo usuário e veja se não há um "Negar" bloqueando a coluna **Visualizar** apenas para ele.
- Se estiver limpo, vá em **Permissões Unificadas ➔ Permissões por perfil**, selecione o cargo dele e veja se a coluna **Visualizar** do Financeiro está marcada.
- Tudo certo? Peça para ele fazer **Logout e Login** (ou F5). O ERP carrega os acessos novos no momento do login.

**2. "O usuário entra na tela de Licitações, mas o botão Excluir não funciona."**

- Siga o mesmo caminho: verifique as **Exceções individuais** (se há um "Negar" na coluna Excluir). Depois verifique as **Permissões por perfil** (se a coluna Excluir está marcada). Ajuste, salve e peça para ele recarregar a página.

**3. "Preciso dar acesso ao João de um módulo que não é dele, só por 15 dias (cobertura de férias)."**

- Não suje o sistema criando um perfil novo! Vá em **Permissões Unificadas ➔ Exceções individuais**, selecione o João e mude de "Herdar" para "Permitir" na coluna **Visualizar** do módulo das férias. Quando ele voltar, mude para "Herdar" novamente.

**4. "Onde eu vejo quem alterou as permissões do sistema?"**

- O ERP é blindado e rastreável. Toda mudança de segurança (quem deu acesso para quem, dia, hora, e o que mudou) fica guardada na aba **Auditoria sensível**. Você pode consultar esse histórico sempre que precisar.
