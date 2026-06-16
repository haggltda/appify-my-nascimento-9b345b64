# Gestão de Usuário Sistema

**Quem pode acessar:** `admin`, `controladoria` e `presidencia` (poderes plenos).
**Caminho:** Configurações › **Acessos & Permissões** · Rota: `/app/admin/permissoes`.
**Objetivo:** Servir como **dicionário oficial** das permissões — para cada necessidade do dia a dia, indica qual **papel (role)** e qual **ação** (`visualizar | incluir | alterar | excluir | aprovar | exportar | executar_ia | alterar_dre`) devem ser liberados em qual **tela (menu_codigo)**.

> **Regra de ouro:** o acesso é a interseção de **papel × empresa × tela × ação**. Liberar uma tela sem a ação correspondente não habilita o botão; liberar a ação sem a empresa não habilita o dado.

---

## 1. Modelo de permissões (como ler a tabela)

| Conceito | O que é | Onde fica |
|---|---|---|
| **Role** (papel) | Função do usuário (ex.: `financeiro`) | `user_roles` |
| **Empresa** | CNPJ ao qual o usuário tem acesso | `user_empresa` |
| **Menu** | Tela do sistema (ex.: `contas-pagar`) | `app_menu` |
| **Ação** | Operação naquela tela | enum `AppAcao` |
| **Perfil base** | Matriz padrão papel × tela × ação | `screen_permission_profile` |
| **Override por usuário** | Exceção (concede ou nega) | `screen_permission_user` |

**Precedência:** override de usuário > perfil base do role > negado.

**Papéis privilegiados (bypass total nas telas de configuração):** `admin`, `controladoria`, `presidencia`.

---

## 2. Receita rápida — "para liberar X, dê Y"

| Quero permitir que o usuário... | Papel mínimo | Tela (`menu_codigo`) | Ação |
|---|---|---|---|
| **Lançar NF de entrada e gerar pré-título a pagar** | `financeiro` **ou** `fiscal` | `nf-entrada` **e** `contas-pagar` | `incluir` em ambas |
| Apenas **visualizar** NFs lançadas | `fiscal` | `nf-entrada` | `visualizar` |
| **Editar pré-título** já existente (rateio, vencimento) | `financeiro` | `contas-pagar` | `alterar` |
| **Excluir/cancelar** pré-título | `financeiro` + alçada | `contas-pagar` | `excluir` |
| **Montar malote** de pagamento | `financeiro` | `programacao` | `incluir` |
| **Aprovar malote** (1ª/2ª alçada) | `gestor` / `diretor_adm` / `presidencia` | `programacao` | `aprovar` |
| **Enviar pagamento ao banco** (CNAB/API) | `financeiro` | `programacao` | `executar_ia` (envio) |
| **Conciliar movimento bancário** | `financeiro` / `controladoria` | `conciliacao-fluxo` | `alterar` |
| **Ver fluxo de caixa diário** | `financeiro` / `controladoria` / `diretoria` | `fluxo-caixa-diario` | `visualizar` |
| **Exportar fluxo** para Excel/PDF | qualquer com `visualizar` | `fluxo` | `exportar` |
| **Lançar título a receber** | `financeiro` | `contas-receber` | `incluir` |
| **Criar pedido de compra** | `compras` | `pedidos` | `incluir` |
| **Aprovar pedido de compra** | `gestor` / `diretor_adm` | `aprovacoes` (suprimentos) | `aprovar` |
| **Cadastrar fornecedor** | `compras` | `fornecedores` | `incluir` |
| **Lançar partida contábil manual** | `controladoria` | `lancamentos` | `incluir` |
| **Alterar plano de contas** | `controladoria` | `plano-contas` | `alterar` |
| **Editar DRE Gerencial (linhas/fórmulas)** | `controladoria` | `dre-gerencial` | `alterar_dre` |
| **Aprovar contas** (fechamento contábil) | `controladoria` / `diretor_adm` | `aprovacao-contas` | `aprovar` |
| **Cadastrar/editar colaborador** | `rh` | `colaboradores` | `incluir` / `alterar` |
| **Rodar folha** | `rh` | `folha` | `executar_ia` |
| **Usar Copiloto IA do Plano de Ações** | qualquer com acesso ao módulo | `copiloto-ia` | `executar_ia` |
| **Importar lote FCR / Migração Zero** | `admin` | `migracao-zero` | `incluir` |
| **Criar usuário, atribuir papéis** | `admin` | `administracao` (aba Usuários) | `incluir` / `alterar` |
| **Conceder permissão de tela** a outro usuário | `admin` / `controladoria` / `presidencia` | `acessos-permissoes` | `alterar` |
| **Revogar sessão ativa** | `admin` | `administracao` (aba Sessões) | `excluir` |
| **Consultar auditoria de acessos** | `admin` / `controladoria` | `administracao` (aba Auditoria) | `visualizar` |

---

## 3. Matriz de papéis (visão por persona)

| Papel | Para que serve | Telas-chave de trabalho |
|---|---|---|
| **admin** | Gestão técnica do ERP (usuários, parâmetros, integrações) | Administração, Acessos & Permissões, Integração, Migração Zero |
| **presidencia** | Visão executiva total + governança | Painel Executivo, Presidência, BI, Configurações |
| **diretoria** / **diretor_adm** | Aprovações de alçada alta, DREs | Aprovações, DRE Gerencial, Fluxo |
| **controladoria** | Plano de contas, DRE, fechamento, regras contábeis | Contábil completo, OBZ, Classificadores |
| **financeiro** | Contas a pagar/receber, programação, conciliação | Financeiro completo |
| **fiscal** | NFs, apuração, parâmetros fiscais | NF Entrada, Fiscal |
| **compras** | Requisições, cotações, pedidos, fornecedores | Suprimentos |
| **gestor** | Aprovações de 1ª alçada | Aprovações (todas) |
| **rh** | Colaboradores, alocações, folha | RH |
| **solicitante** | Cria requisições, acompanha pendências | Requisições, Minhas Pendências |

---

## 4. Dicionário completo de ações (`AppAcao`)

| Ação | Significado | Exemplos |
|---|---|---|
| `visualizar` | Abrir a tela e ler dados | Listar títulos, ver dashboard |
| `incluir` | Criar registro novo | Lançar pré-título, criar pedido |
| `alterar` | Editar registro existente | Alterar vencimento, mudar conta contábil |
| `excluir` | Cancelar / apagar | Cancelar malote, excluir título |
| `aprovar` | Decidir em fluxo de alçada | Aprovar malote, aprovar pedido |
| `exportar` | Gerar CSV/PDF/Excel | Exportar fluxo, exportar razão |
| `executar_ia` | Disparar processo pesado / IA / envio externo | Copiloto IA, envio CNAB/API banco, folha |
| `alterar_dre` | Editar estrutura do DRE Gerencial | Mudar fórmula, reordenar linha |

---

## 5. Dinâmica de liberação de perfis (fluxo completo)

1. **Admin cria o usuário** em Administração › Usuários (e-mail, empresa(s), papéis iniciais).
2. **Sistema aplica o perfil base** de cada papel (matriz `screen_permission_profile`).
3. Se o usuário precisar de **exceção** (ex.: financeiro que também aprova até R$ 10k):
   - Vá em **Configurações › Acessos & Permissões**.
   - Filtre o usuário → marque/desmarque a ação na tela.
   - Isso grava em `screen_permission_user` (override).
4. **Alçadas de aprovação** são parametrizadas em Administração › **Alçadas** (limite por valor, papel e empresa).
5. **Auditoria**: toda mudança fica registrada em `access_audit_log` (quem, quando, antes/depois).
6. **Revogação imediata**: Administração › **Sessões** → botão *Revogar* invalida o token na hora.

---

## 6. Boas práticas

- **Menor privilégio:** comece com o perfil base; só conceda override quando indispensável.
- **Nunca exclua usuário com histórico** — inative.
- **Mínimo 2 admins** ativos para não ficar sem acesso.
- **Revise trimestralmente** a aba *Auditoria* e a matriz de permissões.
- **Force troca de senha no 1º acesso** sempre que criar/resetar.
- Em caso de dúvida sobre qual papel atribuir, consulte a **Receita rápida** (seção 2).

---

## 7. FAQ — perguntas frequentes do dia a dia

- **"Liberei o menu mas o botão Salvar está cinza."** Falta a ação `incluir`/`alterar` daquele menu para o papel.
- **"O usuário vê dados de outra empresa."** Confira `user_empresa` — empresa indevida vinculada.
- **"Não aparece a tela de Acessos & Permissões."** Só `admin`, `controladoria` e `presidencia` enxergam.
- **"Preciso liberar só um botão de aprovar."** Use override em `screen_permission_user` apenas com `acao=aprovar`.
- **"Como descubro o `menu_codigo` de uma tela?"** Configurações › Acessos & Permissões → coluna *Tela* mostra código e rota.
