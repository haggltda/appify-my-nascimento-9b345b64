# Trocar a empresa de um Centro de Custo (CC) ou Contrato

> **Para quem é este manual:** administradores, controladoria e presidência do Grupo Nascimento. Esta é uma operação **sensível** que altera a "dona" contábil de um CC e, em cadeia, do contrato vinculado. Leia tudo antes de fazer a primeira troca.

---

## 1. Quando usar (e quando NÃO usar)

### ✅ Use quando:
- O CC foi cadastrado na empresa errada (ex.: lançado em **HAGG**, mas a obra é da **AGPS**).
- Houve **reestruturação societária** e um contrato migrou de uma empresa do grupo para outra.
- Um CC administrativo precisa ser **realocado** entre filiais sem movimento financeiro relevante.

### ❌ NÃO use quando:
- O CC já tem **notas fiscais lançadas, títulos pagos, requisições aprovadas ou lançamentos contábeis** na empresa atual. Nesses casos o sistema **bloqueia automaticamente**. A solução correta é:
  1. **Inativar** o CC antigo.
  2. **Criar um novo CC** na empresa correta.
  3. Lançar novos documentos no CC novo (não tente "migrar histórico").
- Você não tem certeza do impacto. **Em dúvida, abra um chamado para a Controladoria antes.**

---

## 2. Os 3 cenários do sistema (entenda antes de clicar)

Ao clicar em **Trocar empresa**, o sistema executa um **diagnóstico em tempo real** e classifica o CC em um destes 3 cenários:

### 🟢 Cenário A — Livre
- **O que é:** o CC **não tem nenhuma movimentação** (sem NF, sem título, sem requisição, sem lançamento contábil) **e** não tem contrato ativo vinculado.
- **O que acontece:** a troca é feita **na hora**, sem perguntas extras. Só pede o motivo (texto livre).
- **Quem pode:** admin, controladoria, presidência.

### 🟡 Cenário B — Confirmação obrigatória
- **O que é:** o CC **não tem movimento financeiro**, mas tem um **contrato ativo** vinculado.
- **O que acontece:** o sistema avisa **"existe contrato X-Y-Z ativo nesta empresa. Ao trocar, o contrato também será movido para a nova empresa."** Você precisa marcar **"Estou ciente"** e digitar o motivo (mínimo 20 caracteres).
- **Efeito:** o `contrato.empresa_id` é atualizado **automaticamente** junto com o CC (trigger faz isso sozinho — não precisa abrir a tela do contrato).
- **Quem pode:** admin, controladoria, presidência.

### 🔴 Cenário C — Bloqueado
- **O que é:** o CC tem **qualquer movimentação financeira/fiscal/contábil** registrada na empresa atual: NF de entrada, pré-título, pagamento, requisição já aprovada, lançamento no razão, rateio etc.
- **O que acontece:** o botão fica desabilitado e o sistema lista **exatamente quais documentos** impedem a troca (ex.: "12 NFs em 2026, 3 títulos pagos, 1 contrato em execução").
- **Por que é bloqueado:** mover um CC com histórico **quebra a contabilidade da empresa de origem** (DRE, balancete, fluxo de caixa, conciliação). Isso **não é negociável** — é regra contábil, não escolha do sistema.
- **O que fazer:** siga o procedimento da seção **"NÃO use quando"** acima (inativar + criar novo).

---

## 3. Passo a passo — como trocar a empresa

### Onde ficam os botões

| Origem | Caminho | Quem vê |
|---|---|---|
| Lista de CCs | **Administração → Centros de Custo** → linha do CC → botão **"Trocar empresa"** (ícone de prédio) | Admin, Controladoria, Presidência |
| Lista de Contratos | **Suprimentos → Contratos** → abrir contrato → aba **"Configuração"** → **"Trocar empresa"** | Admin, Controladoria, Presidência |

> ⚠️ Se você **não vê** o botão, é porque seu perfil não tem permissão. Procure o administrador.

### Fluxo na tela (Centros de Custo)

1. **Vá em** `Administração → Centros de Custo` (menu lateral).
2. Use os filtros do topo (empresa, busca por código ou nome) para localizar o CC.
3. Na linha do CC, clique no ícone **🏢 Trocar empresa**.
4. O modal **"Trocar empresa do Centro de Custo"** abre e mostra:
   - **Empresa atual** (fixa, só leitura).
   - **Diagnóstico** (cenário A, B ou C — colorido).
   - **Lista de vínculos detectados** (contratos, NFs, títulos, requisições — com contagem e link clicável).
   - **Nova empresa** (combobox apenas com as 6 empresas do grupo às quais você tem acesso).
   - **Motivo da troca** (obrigatório, mínimo 20 caracteres — fica gravado no log para auditoria).
   - **Checkbox "Estou ciente"** (aparece só no Cenário B).
5. Clique em **Confirmar troca**.
6. O sistema:
   - Grava o evento em `centros_custo_empresa_log` (quem, quando, de qual empresa para qual, motivo, cenário).
   - Atualiza `centros_custo.empresa_id`.
   - Se houver contrato ativo, atualiza `contrato.empresa_id` na mesma transação (trigger).
   - Recarrega a lista.

### Fluxo na tela (Contratos)

Mesma lógica, mas a troca **arrasta o CC junto** se o contrato tiver CC exclusivo. Se o contrato compartilha CC com outros contratos, o sistema avisa e **não move o CC** — apenas o contrato.

---

## 4. O que NÃO acontece (para sua tranquilidade)

- ❌ **Não move histórico:** NFs, títulos, lançamentos antigos **permanecem na empresa de origem**. A troca vale **da data atual em diante**.
- ❌ **Não recalcula DRE retroativo.**
- ❌ **Não altera saldos iniciais de caixa.**
- ❌ **Não muda o código do CC** — só a empresa dona.
- ❌ **Não notifica fornecedores** automaticamente. Se houver contrato vigente, **avise o fornecedor por escrito** que a nota fiscal a partir da próxima competência deve ser emitida contra o novo CNPJ.

---

## 5. Auditoria — quem vê o quê

Toda troca fica gravada na tabela `centros_custo_empresa_log` com:
- Quem fez (usuário).
- Quando (timestamp).
- Empresa origem → Empresa destino.
- Cenário detectado (A/B/C).
- Motivo digitado.
- Se houve contrato arrastado junto.

**Como consultar o histórico:**
- `Administração → Centros de Custo → abrir CC → aba "Histórico"`.
- Ou peça à Controladoria um relatório consolidado (a área tem acesso direto ao log).

---

## 6. Exemplos práticos

### Exemplo 1 — Cenário A (Livre)
> **Situação:** o CC `AGPS-ADM-099 — Sala de reunião` foi criado por engano em **AGPS**, mas é da **NH**. Não tem nada lançado.
>
> **Ação:** Centros de Custo → Trocar empresa → escolhe NH → motivo: *"Cadastro inicial em empresa incorreta, corrigindo antes de qualquer movimento."* → Confirmar.
>
> **Resultado:** troca imediata. CC fica em NH. Nenhum efeito colateral.

### Exemplo 2 — Cenário B (Confirmação)
> **Situação:** contrato `HAGG-OP-CT-014` está em HAGG, mas a obra foi assumida pela **SN**. Ainda não houve faturamento.
>
> **Ação:** Trocar empresa → modal mostra *"⚠ Contrato HAGG-OP-CT-014 ativo será movido junto"* → marca **Estou ciente** → motivo: *"Transferência de execução conforme aditivo contratual 03/2026 assinado em 15/05/2026."* → Confirmar.
>
> **Resultado:** CC e contrato vão para SN na mesma transação. Próximas NFs já entram em SN.

### Exemplo 3 — Cenário C (Bloqueado)
> **Situação:** CC `LF-OP-001 — Obra Centro` tem 47 NFs e 12 títulos pagos em 2026. Querem mudar para CANAA.
>
> **Ação:** Trocar empresa → modal mostra **🚫 Bloqueado: 47 NFs, 12 títulos, 3 requisições**.
>
> **Solução correta:**
> 1. Inativar `LF-OP-001` (marca como `ativo = false`).
> 2. Criar `CANAA-OP-001 — Obra Centro` em CANAA.
> 3. Novas NFs e títulos a partir de hoje vão no CC novo.
> 4. Relatórios consolidados continuam mostrando o histórico em LF (correto contabilmente).

---

## 7. Erros comuns e como evitar

| Erro | Por que acontece | Como evitar |
|---|---|---|
| "Forcei a troca e a DRE da empresa antiga ficou estranha" | Você ignorou o bloqueio do Cenário C usando SQL direto ou outro caminho. | **Nunca** burle o bloqueio. Use inativar + recriar. |
| "Troquei a empresa e o fornecedor mandou nota no CNPJ antigo" | Não houve comunicação externa. | Avise o fornecedor por escrito **antes** da troca. |
| "Não consigo ver o botão" | Falta de papel `admin`/`controladoria`/`presidencia`. | Solicitar ao administrador via *Gestão de Usuário Sistema*. |
| "Motivo muito curto, não salva" | Mínimo de 20 caracteres é obrigatório. | Escreva uma frase completa explicando o **porquê**, não só "ajuste". |
| "Troquei o CC mas o contrato continuou na empresa antiga" | O contrato estava **inativo** ou **compartilhado** com outros CCs. | Verifique a aba Vínculos do CC antes; se necessário, abra o contrato e troque por lá. |

---

## 8. Perguntas frequentes (FAQ)

**P: Posso desfazer uma troca?**
R: Sim, **se ainda estiver no Cenário A** depois da troca (ou seja, ninguém lançou nada na nova empresa). Basta executar uma nova troca de volta. Se já houve movimento na nova empresa, a reversão vira Cenário C (bloqueada) — mesma regra.

**P: A troca afeta o seletor de empresa do topbar?**
R: Não. O seletor mostra as empresas que o usuário pode atuar. O CC trocado simplesmente passa a aparecer no contexto da nova empresa.

**P: E os rateios automáticos?**
R: Rateios futuros usam a nova empresa. Rateios já efetivados permanecem na empresa antiga.

**P: Posso trocar em lote (vários CCs de uma vez)?**
R: Hoje **não**. Cada troca exige diagnóstico individual e motivo. Isso é proposital: troca em massa é a principal causa de erro contábil grave.

**P: Quem aprova a troca?**
R: A troca **não passa por alçada de aprovação** — quem tem o papel pode executar diretamente. A governança é **post-facto** via log de auditoria. Se quiser exigir aprovação prévia, abra solicitação para configurar um fluxo no engine de alçadas (ver manual *Cadastro de Alçadas*).

---

## 9. Glossário rápido

- **CC (Centro de Custo):** unidade contábil que agrupa receitas e despesas (uma obra, uma filial, um setor).
- **Empresa:** uma das 6 razões sociais do grupo (AGPS, CANAA, HAGG, LF, NH, SN).
- **Contrato ativo:** contrato com `status = 'ativo'` e dentro da vigência.
- **Movimento:** qualquer registro financeiro/fiscal/contábil vinculado ao CC.
- **Cenário A/B/C:** classificação automática do impacto da troca.

---

## 10. Em caso de dúvida

- **Antes de trocar:** fale com a Controladoria.
- **Depois de trocar e algo deu errado:** abra chamado **imediatamente** — quanto mais cedo, mais fácil corrigir.
- **Para configurar fluxo de aprovação prévia:** veja o manual *Cadastro de Alçadas*.
- **Para entender quem tem cada papel:** veja o manual *Gestão de Usuário Sistema*.
