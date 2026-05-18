# Como cadastro um usuário?

**Quem pode acessar:** Administrador do sistema.
**Caminho no menu:** Administração > aba **Usuários**.
**Rota:** `/app/administracao`.

## Pré-requisitos
- Ser usuário com perfil **admin**.
- Empresa(s) já cadastrada(s).

## Passo a passo
1. Acesse **Administração**.
2. Vá para a aba **Usuários**.
3. Clique em **Novo usuário**.
4. Informe nome, e-mail, empresa(s) e perfis (roles).
5. Salve. O sistema cria o acesso e envia as credenciais conforme parametrização.

## Editar perfil/permissões
- Apenas administradores podem editar perfis e papéis de outros usuários.
- Alterações em papéis são auditadas e seguem regra de "somente diferença": só inclui/remove o que foi efetivamente alterado.

## Erros comuns
- **E-mail já existe**: o usuário já está cadastrado em outra empresa; vincule em vez de criar.
- **Perfil regrediu sozinho**: corrigido — a edição agora aplica apenas as diferenças entre seleção atual e anterior.

## FAQ
- *Usuário comum pode editar o próprio papel?* Não. Apenas admin pode alterar papéis (próprios ou de terceiros).
