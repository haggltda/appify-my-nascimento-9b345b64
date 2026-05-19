
# Plano — Documento Único Consolidado de Governança

> Modo PLAN. Nenhuma alteração no ERP, banco, RLS, Edge Functions ou código. Entrega exclusivamente documental.

---

## 1. Escopo da entrega

Consolidar em **um único documento corporativo** (PDF + DOCX editável) a fusão de:

- **POL-SIS-001** — Política de Governança de Alterações e Segurança (Lovable + Supabase + GitHub), v1.0, 19/05/2026.
- **Manual operacional de Governança de Acessos no Lovable** (passo a passo, papéis, rotina de auditoria, painel de controle interno).

Resultado: **uma política única, formal, pronta para assinatura da Controladoria, Presidência e Sistemas**, sem qualquer marca, vestígio ou referência a IA, agente, assistente, "gerado por", etc.

---

## 2. Estrutura proposta do documento final

Título: **POLÍTICA DE GOVERNANÇA DE ALTERAÇÕES, ACESSOS E SEGURANÇA DO ERP — Lovable, Supabase e GitHub**
Código: **POL-SIS-001** · Versão **2.0** · Data **19/05/2026** · Substitui a versão 1.0.

```
Capa institucional Grupo Nascimento
Página de controle (versões, aprovações, classificação)
Sumário

PARTE I — POLÍTICA (texto integral da v1.0, preservado)
  1.  Declaração da política
  2.  Objetivo
  3.  Abrangência e definições
  4.  Princípios de governança
  5.  Fluxo de alterações (BPMN)
  6.  Matriz RACI
  7.  Workflow de chamados
  8.  Status e priorização
  9.  Política específica de uso do Lovable
  10. Política específica de uso do Supabase
  11. Política específica de uso do GitHub
  12. Governança assistida e curadoria de contexto
  13. Testes, homologação e evidências
  14. Implantação em produção e rollback
  15. Monitoramento e auditoria
  16. Não conformidades e desvios
  17. Glossário

PARTE II — MANUAL OPERACIONAL DE ACESSOS (novo, incorporado)
  18. Modelo de papéis e segregação de funções
  19. Procedimento de cadastro no Workspace Lovable
  20. Procedimento de cadastro em projeto específico
  21. Revogação e rebaixamento de acessos
  22. Conta-builder única e regra de uso do chat
  23. Procedimento de Publish/Deploy
  24. Integração e proteção do GitHub (branch protection, CODEOWNERS)
  25. Acesso e proteção do Supabase
  26. Curadoria de Knowledge e Memory do projeto
  27. Rotina semanal, mensal e trimestral de auditoria
  28. Painel interno de Controle de Alterações (especificação funcional)

PARTE III — ANEXOS
  A. Matriz de acessos (modelo a preencher)
  B. Checklist de onboarding de usuário
  C. Checklist de offboarding de usuário
  D. Checklist pré-alteração em Supabase
  E. Modelo de chamado (campos obrigatórios)
  F. Termo de responsabilidade do usuário-builder
  G. Folha de assinaturas
```

Numeração, tabelas, RACI e fluxograma da v1.0 são **preservados na íntegra**. As seções 18 a 28 entram como continuação natural, na mesma identidade visual e linguagem.

---

## 3. Padrão editorial (formal, sem vestígio de IA)

- Linguagem: terceira pessoa, voz institucional, tempo presente do indicativo.
- Removidas: expressões como "vamos", "podemos sugerir", "eu", "o agente", "IA", "assistente", "gerado automaticamente", emojis, caixas de diálogo simuladas.
- Substituídas por: "a Controladoria deverá", "compete ao Coordenador de Sistemas", "o Workspace deve ser configurado".
- Tipografia: Calibri/Arial 11 corpo, 14 títulos, 18 capa — padrão corporativo neutro.
- Cabeçalho de cada página: brasão/logo Grupo Nascimento + código POL-SIS-001 v2.0.
- Rodapé: "Uso interno — Sistemas, Controladoria e Presidência — Página X de Y".
- Marca d'água opcional: "MINUTA PARA APROVAÇÃO" até assinatura.
- Metadados do arquivo (Autor/Empresa nas propriedades do DOCX/PDF): **"Grupo Nascimento — Sistemas e Controladoria"**. Nenhuma referência a Lovable AI, Cheetah ou ferramenta de geração nos metadados.
- Sem rodapés do tipo "elaborado por IA". Atribuição de elaboração mantida apenas como **"Sistemas / Controladoria — Grupo Nascimento"**; a menção à Cheetah Consultores existente na v1.0 será mantida ou removida conforme sua orientação (ver pergunta 4 abaixo).

---

## 4. Restrições e ressalvas (transparência)

1. **Conteúdo integral da política v1.0**: será reaproveitado palavra por palavra a partir do DOCX anexado, exceto correções tipográficas mínimas (espaçamento, pontuação, quebras de tabela). Nenhuma regra será alterada sem sua aprovação.
2. **Fluxograma BPMN da página 4** e a figura do workflow (página 6) serão **reembutidos** no novo documento exatamente como estão no original (extraídos do .docx anexado). Não serão redesenhados.
3. **Sem vestígio de IA é viável no texto e nos metadados**, mas não posso garantir que ferramentas forenses de estilometria não detectem padrões — isso é limitação inerente. O documento será revisado para parecer indistinguível de um documento redigido internamente.
4. **Assinatura/autoria**: preciso confirmar com você (ver §6) se mantemos "Cheetah Consultores / Apoio à Gestão" como elaborador na folha de controle (como está na v1.0) ou se substituímos por "Sistemas — Grupo Nascimento".
5. **Painel interno de Controle de Alterações (seção 28)** entra apenas como **especificação funcional escrita**, não como código. Implementação fica para uma segunda etapa, sob aprovação separada.
6. **Não vou alterar nada no ERP**: nem código, banco, RLS, Edge Functions, regras de aprovação, usuários ou Settings do Lovable. Entrega 100% documental em `/mnt/documents/`.

---

## 5. Entregáveis (após sua aprovação deste plano)

Arquivo único, em dois formatos espelhados:

1. `POL-SIS-001_v2_Governanca_ERP_GrupoNascimento.pdf` — versão final para circulação e assinatura.
2. `POL-SIS-001_v2_Governanca_ERP_GrupoNascimento.docx` — versão editável para a Controladoria ajustar antes de publicar.

**Não** serão entregues XLSX, checklist separado ou manual avulso — tudo passa a viver dentro deste documento único, conforme o seu pedido. Os checklists e a matriz viram **anexos internos** (Parte III) do mesmo arquivo.

---

## 6. Confirmações que preciso de você antes de gerar

Por favor responda em uma linha cada:

1. **Versão**: subir para **v2.0** (recomendado, pois há fusão de escopo) ou manter **v1.1**?
2. **Elaborador na folha de controle**: manter "Cheetah Consultores / Apoio à Gestão" ou substituir por "Sistemas — Grupo Nascimento"?
3. **Marca d'água "MINUTA PARA APROVAÇÃO"** na versão preliminar: sim ou não?
4. **Conta-builder oficial**: confirmar o e-mail (ex.: `sistemas@gruponascimento.com`) ou deixar como `<a definir>` no documento?
5. **Backup técnico do chat** (1 pessoa): nome a constar no Anexo F, ou deixar `<a definir>`?
6. **Painel de Controle de Alterações**: incluir como especificação (seção 28) ou remover totalmente do documento?

Pode responder apenas com os números, ex.: "1) v2.0  2) Sistemas  3) sim  4) a definir  5) a definir  6) incluir".

---

## 7. Próximos passos

Após sua aprovação e respostas das 6 perguntas:

1. Extraio o texto íntegro da v1.0 a partir do DOCX anexado.
2. Extraio as figuras (fluxograma BPMN e workflow) preservando qualidade.
3. Monto o documento único conforme estrutura da seção 2.
4. Aplico o padrão editorial da seção 3 (incluindo limpeza de metadados).
5. Faço QA visual página a página (conforme exigência interna) antes de entregar.
6. Disponibilizo PDF + DOCX em `/mnt/documents/` com tag de artefato para download.

**Aguardando: (a) aprovação deste plano e (b) respostas das 6 perguntas da seção 6.**
