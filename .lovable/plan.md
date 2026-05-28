# Gerar guia Excel: criação de usuário de teste

## Objetivo
Produzir uma planilha `.xlsx` documentando a sequência correta para um usuário júnior criar um usuário de teste no ERP **no estado atual** (sem aplicar a correção do `admin-create-user`).

## Escopo (o que NÃO será feito)
- Nenhuma alteração em código front-end, edge functions, migrations, banco Supabase, triggers ou GitHub
- Nenhum comando que altere estrutura do projeto
- Apenas geração de arquivo de documentação em `/mnt/documents/`

## Entregável
Arquivo: `/mnt/documents/guia-criacao-usuario-teste.xlsx`

## Estrutura da planilha
Aba única "Guia criação usuário", com cabeçalho azul/branco, células com `wrap_text`, bordas finas, larguras ajustadas.

**Colunas (conforme solicitado):**
1. Etapa (nº)
2. Rota no front-end
3. O que fazer / onde clicar / o que esperar
4. Por que essa etapa é necessária
5. O que acontece ao executar
6. Próxima etapa

## Sequência das 10 etapas
1. Login como admin → `/login`
2. Acessar Administração → `/app/administracao`
3. Abrir aba "Usuários" → `/app/administracao` (UsuariosReal)
4. Criar usuário **sem empresa** (workaround do bug atual do trigger) — e-mail, senha, display name
5. Vincular empresa HAGG via aba/tela `user_empresa` → Permissões Unificadas / Usuários
6. Atribuir perfil em `user_roles` (ex.: `usuario`, `gestor`)
7. Configurar permissões por perfil em "Permissões Unificadas → Por perfil" → `/app/administracao` (PermissoesUnificadasTab)
8. (Opcional) Exceções individuais em "Por pessoa"
9. Logout admin → login com o novo usuário → trocar senha obrigatória (`/trocar-senha`)
10. Smoke test: trocar empresa ativa e navegar pelos menus liberados

## Processo de geração
1. Script Python em `/tmp/gen_guia.py` usando `openpyxl`
2. Salvar `.xlsx` em `/mnt/documents/`
3. QA visual: converter para PDF/imagem temporária via LibreOffice e inspecionar todas as células (sem copiar QA para `/mnt/documents/`)
4. Corrigir e regerar se houver texto cortado, sobreposição ou layout quebrado
5. Entregar com tag `<presentation-artifact>` para download

## Critério de aceite
- Planilha abre sem erros
- 10 linhas preenchidas, texto legível, sem cortes
- Linguagem clara para júnior leigo
- Reflete o fluxo **atual** do ERP (com o workaround "criar sem empresa, vincular depois")
