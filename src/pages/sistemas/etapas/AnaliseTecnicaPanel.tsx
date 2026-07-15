import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Undo2 } from "lucide-react";
import type { EtapaPanelProps, PtvDados } from "./types";
import { CLASSIFICACAO_DEMANDA_OPCOES, GRAU_URGENCIA_LABEL, TIPO_SOLICITACAO_LABEL, fmtData, sdNumero } from "./types";

// ── Lógica automática ─────────────────────────────────────────────────────────

const GRUPO1 = ["obrigatoriedade_legal_prazo","risco_paralisacao","impossibilidade_faturamento","falha_critica_funcionamento","risco_juridico_trabalhista","determinacao_presidencia"];
const GRUPO2 = ["correcao_bug_escopo","alto_impacto_operacional","alto_usuarios_impactados","reducao_retrabalho","automacao_processo_critico","integracao_rotina_relevante","impacto_cliente_contrato"];
const GRUPO3 = ["projeto_planejamento_estrategico","projeto_aprovado_presidencia","novo_modulo_corporativo","implantacao_indicadores","projeto_multi_diretoria"];
const GRUPO4 = ["ganho_operacional_relevante","melhoria_processo_existente","reducao_controles_manuais","melhor_rastreabilidade","melhoria_indicadores","melhoria_comunicacao_areas"];

export function calcPrioridade(criterios: string[]): string {
  if (GRUPO1.some((k) => criterios.includes(k))) return "Crítica";
  if (GRUPO2.some((k) => criterios.includes(k))) return "Alta";
  if (GRUPO3.some((k) => criterios.includes(k))) return "Estratégica";
  if (GRUPO4.some((k) => criterios.includes(k))) return "Média";
  return "Baixa";
}

const COMPLEXIDADE_CRITICA = ["novo_modulo_estruturante","multiplas_integracoes","migracao_dados","saneamento_dados","acesso_externo_dados_sensiveis","dependencia_fornecedor_tecnico","alto_volume_dados"];
const COMPLEXIDADE_ALTA = ["nova_funcionalidade","workflow_novo","multiplos_perfis","integracao_outro_sistema","geracao_documentos","dashboard_multiplos_filtros","alteracao_banco_dados","acesso_externo_usuarios","seguranca_informacao"];
const COMPLEXIDADE_MEDIA = ["alteracao_funcionalidade_existente","criacao_tela","criacao_campos","criacao_workflow","regras_automaticas","configuracao_perfil","relatorio_filtros","dashboard_simples"];

export function calcComplexidade(itens: string[]): string {
  if (COMPLEXIDADE_CRITICA.some((k) => itens.includes(k))) return "Crítica";
  if (COMPLEXIDADE_ALTA.some((k) => itens.includes(k))) return "Alta";
  if (COMPLEXIDADE_MEDIA.some((k) => itens.includes(k))) return "Média";
  return "Baixa";
}

const PRAZO_MATRIX: Record<string, Record<string, string>> = {
  "Baixa":       { "Baixa": "1–5 du",   "Média": "5–10 du",  "Alta": "10–20 du", "Crítica": "20–30 du" },
  "Média":       { "Baixa": "3–10 du",  "Média": "10–20 du", "Alta": "20–40 du", "Crítica": "30–45 du" },
  "Alta":        { "Baixa": "5–15 du",  "Média": "15–30 du", "Alta": "30–60 du", "Crítica": "45–90 du" },
  "Estratégica": { "Baixa": "10–20 du", "Média": "20–35 du", "Alta": "30–60 du", "Crítica": "45–90 du" },
  "Crítica":     { "Baixa": "15–30 du", "Média": "30–50 du", "Alta": "45–90 du", "Crítica": "60–120 du" },
};

export function calcPrazo(prioridade: string, complexidade: string): string {
  return PRAZO_MATRIX[prioridade]?.[complexidade] ?? "—";
}

// ── Constantes das seções ─────────────────────────────────────────────────────

const DFD_PENDENCIAS = [
  { k: "escopo_funcional_insuficiente", l: "Escopo funcional insuficiente" },
  { k: "regras_negocio_insuficientes", l: "Regras de negócio insuficientes" },
  { k: "requisitos_funcionais_insuficientes", l: "Requisitos funcionais insuficientes" },
  { k: "validacoes_insuficientes", l: "Validações funcionais insuficientes" },
  { k: "perfis_permissoes_insuficientes", l: "Perfis e permissões insuficientes" },
  { k: "integracoes_insuficientes", l: "Integrações insuficientes" },
  { k: "documentos_gerados_insuficientes", l: "Documentos gerados insuficientes" },
  { k: "indicadores_insuficientes", l: "Indicadores insuficientes" },
  { k: "criterios_homologacao_insuficientes", l: "Critérios de homologação insuficientes" },
  { k: "premissas_restricoes_insuficientes", l: "Premissas ou restrições insuficientes" },
  { k: "outro", l: "Outro" },
];

const DFD_ENCAMINHAMENTO = [
  { k: "seguir_analise", l: "Seguir para análise técnica" },
  { k: "seguir_ressalva", l: "Seguir com ressalva" },
  { k: "retornar_ajuste_dfd", l: "Retornar para ajuste do DFD" },
  { k: "suspender_complementacao", l: "Suspender análise até complementação" },
];

const FORMA_ATENDIMENTO = [
  { k: "configuracao_funcionalidade_existente", l: "Configuração de funcionalidade existente" },
  { k: "ajuste_funcionalidade_existente", l: "Ajuste em funcionalidade existente" },
  { k: "desenvolvimento_nova_funcionalidade", l: "Desenvolvimento de nova funcionalidade" },
  { k: "desenvolvimento_novo_modulo", l: "Desenvolvimento de novo módulo" },
  { k: "criacao_relatorio", l: "Criação de relatório" },
  { k: "criacao_dashboard", l: "Criação de dashboard" },
  { k: "automacao_processo", l: "Automação de processo" },
  { k: "integracao_sistemas", l: "Integração entre sistemas" },
  { k: "importacao_dados", l: "Importação de dados" },
  { k: "exportacao_dados", l: "Exportação de dados" },
  { k: "ajuste_permissao_acesso", l: "Ajuste de permissão/acesso" },
  { k: "solucao_temporaria_manual_controlada", l: "Solução temporária/manual controlada" },
  { k: "outro", l: "Outro" },
];

const IMPEDIMENTO_TIPOS = [
  { k: "sistema_atual_nao_comporta", l: "Sistema atual não comporta a solução" },
  { k: "limitacao_seguranca", l: "Limitação de segurança" },
  { k: "ausencia_integracao", l: "Ausência de integração disponível" },
  { k: "necessidade_saneamento_dados", l: "Necessidade de saneamento de dados" },
  { k: "base_dados_inconsistente", l: "Base de dados inconsistente" },
  { k: "dependencia_fornecedor_externo", l: "Dependência de fornecedor externo" },
  { k: "necessidade_definicao_funcional_complementar", l: "Necessidade de definição funcional complementar" },
  { k: "limitacao_infraestrutura", l: "Limitação de infraestrutura" },
  { k: "outro", l: "Outro" },
];

const COMPLEXIDADE_ITENS = [
  { k: "configuracao_simples", l: "Configuração simples" },
  { k: "integracao_outro_sistema", l: "Integração com outro sistema" },
  { k: "ajuste_pontual", l: "Ajuste pontual" },
  { k: "alteracao_banco_dados", l: "Alteração em banco de dados" },
  { k: "alteracao_funcionalidade_existente", l: "Alteração em funcionalidade existente" },
  { k: "migracao_dados", l: "Migração de dados" },
  { k: "criacao_tela", l: "Criação de tela" },
  { k: "saneamento_dados", l: "Saneamento de base de dados" },
  { k: "criacao_campos", l: "Criação de campos" },
  { k: "acesso_externo_usuarios", l: "Acesso externo de usuários" },
  { k: "criacao_workflow", l: "Criação de workflow" },
  { k: "seguranca_informacao", l: "Segurança da informação" },
  { k: "regras_automaticas", l: "Criação de regras automáticas" },
  { k: "dependencia_fornecedor_tecnico", l: "Dependência de fornecedor técnico" },
  { k: "configuracao_perfil", l: "Configuração de perfil e permissões" },
  { k: "novo_modulo_estruturante", l: "Novo módulo estruturante" },
  { k: "relatorio_filtros", l: "Relatório" },
  { k: "multiplas_integracoes", l: "Múltiplas integrações" },
  { k: "dashboard_simples", l: "Dashboard" },
  { k: "alto_volume_dados", l: "Alto volume de dados" },
  { k: "geracao_documentos", l: "Geração automática de documento" },
  { k: "outro", l: "Outro" },
];

const DEPENDENCIA_TIPOS = [
  { k: "fornecedor_externo", l: "Fornecedor externo" }, { k: "integracao", l: "Integração" },
  { k: "banco_dados", l: "Banco de dados" }, { k: "infraestrutura", l: "Infraestrutura" },
  { k: "seguranca_informacao", l: "Segurança da informação" }, { k: "saneamento_dados", l: "Saneamento de dados" },
  { k: "definicao_funcional_complementar", l: "Definição funcional complementar" },
  { k: "aprovacao_superior", l: "Aprovação superior" }, { k: "outro", l: "Outro" },
];

const RISCO_TIPOS = [
  { k: "risco_atraso", l: "Risco de atraso" }, { k: "risco_falha_integracao", l: "Risco de falha de integração" },
  { k: "risco_inconsistencia_dados", l: "Risco de inconsistência de dados" },
  { k: "risco_seguranca_informacao", l: "Risco de segurança da informação" },
  { k: "risco_impacto_sistema_existente", l: "Risco de impacto em sistema existente" },
  { k: "risco_indisponibilidade", l: "Risco de indisponibilidade" },
  { k: "risco_dependencia_fornecedor", l: "Risco de dependência de fornecedor" }, { k: "outro", l: "Outro" },
];

const COMITE_MOTIVOS = [
  { k: "impacto_estrategico", l: "Impacto estratégico" }, { k: "impacto_financeiro_relevante", l: "Impacto financeiro relevante" },
  { k: "impacto_operacional_relevante", l: "Impacto operacional relevante" }, { k: "impacto_mais_diretoria", l: "Impacto em mais de uma diretoria" },
  { k: "risco_juridico_trabalhista_contratual", l: "Risco jurídico, trabalhista ou contratual" },
  { k: "necessidade_investimento_fornecedor_externo", l: "Necessidade de investimento ou fornecedor externo" },
  { k: "desenvolvimento_alta_complexidade", l: "Desenvolvimento de alta complexidade" },
  { k: "integracao_critica", l: "Integração crítica" }, { k: "excecao_regras_fluxos", l: "Exceção às regras ou fluxos definidos" },
  { k: "outro", l: "Outro" },
];

const PARECER_FINAL_OPCOES = [
  { k: "aprovar_continuidade", l: "Aprovar tecnicamente a continuidade da demanda" },
  { k: "aprovar_ressalvas", l: "Aprovar tecnicamente com ressalvas" },
  { k: "retornar_ajuste_dfd", l: "Retornar para ajuste do DFD" },
  { k: "retornar_complementacao_area", l: "Retornar para complementação da área solicitante" },
  { k: "dividir_fases", l: "Dividir a demanda em fases" },
  { k: "encaminhar_comite_governanca", l: "Encaminhar para avaliação do Comitê de Governança" },
  { k: "suspender_temporariamente", l: "Suspender temporariamente a demanda" },
  { k: "considerar_inviavel", l: "Considerar tecnicamente inviável no momento" },
];

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Secao({ num, title }: { num: number | string; title: string }) {
  return (
    <div className="flex items-center gap-2 rounded-t bg-[#153169] px-3 py-1.5">
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#153169]">{num}</span>
      <span className="text-xs font-bold uppercase tracking-wide text-white">{title}</span>
    </div>
  );
}

function SubSecao({ title }: { title: React.ReactNode }) {
  return <p className="mb-1.5 border-b border-border pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#153169]">{title}</p>;
}

function AutoBadge() {
  return <span className="ml-1 rounded bg-[#153169] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">AUTOMÁTICO</span>;
}

function Chk({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-1.5 text-[11px] select-none ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-3 w-3 flex-shrink-0 accent-[#153169]" />
      {label}
    </label>
  );
}

function Radio({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-1.5 text-[11px] select-none ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <input type="radio" checked={checked} disabled={disabled} onChange={onChange} className="h-3 w-3 flex-shrink-0 accent-[#153169]" />
      {label}
    </label>
  );
}

function InfoBox({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2.5 text-[11px] text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
      <span className="mt-0.5 text-sm">ℹ</span>
      <span>{texto}</span>
    </div>
  );
}

function AutoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-dashed border-border bg-muted/30 px-2 py-1 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-[#153169]">{value || "—"}</span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function AnaliseTecnicaPanel({ card, papeis, onUpdate }: EtapaPanelProps) {
  const podeAgir = papeis.gerenteSistemas;
  const [ptv, setPtv] = useState<PtvDados>(card.ptv_dados ?? {});

  useEffect(() => { setPtv(card.ptv_dados ?? {}); }, [card.ptv_dados]);

  function patch(p: Partial<PtvDados>) {
    const novo = { ...ptv, ...p };
    setPtv(novo);
    onUpdate({ ptv_dados: novo });
  }

  function toggleArr(field: keyof PtvDados, key: string, checked: boolean) {
    const cur = (ptv[field] as string[] | undefined) ?? [];
    patch({ [field]: checked ? [...cur, key] : cur.filter((k) => k !== key) });
  }

  function hasArr(field: keyof PtvDados, key: string) {
    return ((ptv[field] as string[] | undefined) ?? []).includes(key);
  }

  function ChkGroup({ field, opcoes, cols = 2 }: { field: keyof PtvDados; opcoes: { k: string; l: string }[]; cols?: number }) {
    return (
      <div className="grid gap-x-4 gap-y-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {opcoes.map(({ k, l }) => (
          <Chk key={k} checked={hasArr(field, k)} label={l} disabled={!podeAgir}
            onChange={(v) => toggleArr(field, k, v)} />
        ))}
      </div>
    );
  }

  // Calculos automáticos
  const criterios = card.an_criterios ?? [];
  const complexItens = ptv.complexidade_itens ?? [];
  const prioridadeAuto = calcPrioridade(criterios);
  const prioridadeEfetiva = ptv.prioridade_override ?? prioridadeAuto;
  const complexidadeAuto = calcComplexidade(complexItens);
  const prazoAuto = calcPrazo(prioridadeEfetiva, complexidadeAuto);
  const resultadoCombinado = `${prioridadeEfetiva} + ${complexidadeAuto}`;

  const tipoDemanda = card.classificacao_demanda?.length
    ? card.classificacao_demanda.map((v) => CLASSIFICACAO_DEMANDA_OPCOES.find((o) => o.value === v)?.label ?? v).join(", ")
    : (card.tipo_solicitacao ? (TIPO_SOLICITACAO_LABEL[card.tipo_solicitacao] ?? card.tipo_solicitacao) : "—");

  const pessoasLabel: Record<string, string> = { "1_5": "1 – 5 pessoas", "5_10": "5 – 10 pessoas", "mais_10": "Mais de 10 pessoas" };

  const encaminhamentoSugerido = ptv.tecnicamente_viavel === "nao_viavel"
    ? "Considerar tecnicamente inviável no momento"
    : ptv.dfd_suficiente === "nao"
    ? "Retornar para ajuste do DFD"
    : ptv.encaminhar_comite === "sim"
    ? "Encaminhar para avaliação do Comitê de Governança"
    : "Seguir para Anexo IV – Ata de Aprovação e Priorização";

  return (
    <div className="space-y-4 text-[11px]">

      {/* ── SEÇÃO 1 — IDENTIFICAÇÃO ── */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          ANEXO III – PARECER TÉCNICO DE VIABILIDADE (PTV) — <AutoBadge />
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div><span className="font-semibold text-primary">Número da Demanda:</span> <span>{sdNumero(card)}</span></div>
          <div><span className="font-semibold text-primary">Área Solicitante:</span> <span>{card.area_solicitante ?? "—"}</span></div>
          <div><span className="font-semibold text-primary">Responsável:</span> <span>{card.responsavel_solicitacao ?? "—"}</span></div>
          <div><span className="font-semibold text-primary">Cargo:</span> <span>{card.cargo_solicitante ?? "—"}</span></div>
          <div><span className="font-semibold text-primary">E-mail:</span> <span>{card.email_solicitante ?? "—"}</span></div>
          <div><span className="font-semibold text-primary">Telefone:</span> <span>{card.telefone_solicitante ?? "—"}</span></div>
          <div><span className="font-semibold text-primary">Data da solicitação:</span> <span>{card.created_at ? fmtData(card.created_at.slice(0, 10)) : "—"}</span></div>
          <div><span className="font-semibold text-primary">Tipo de demanda:</span> <span>{tipoDemanda}</span></div>
        </div>
        <InfoBox texto="Origem: Card Solicitação ERP" />
      </div>

      {/* ── SEÇÃO 2 — CONFERÊNCIA MÍNIMA DO DFD ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={2} title="CONFERÊNCIA MÍNIMA DO DFD" />
        <div className="p-3 space-y-3">
          <div>
            <SubSecao title="O DFD possui informações suficientes para análise técnica?" />
            <div className="flex gap-4">
              {[{ k: "sim", l: "Sim" }, { k: "nao", l: "Não" }, { k: "parcialmente", l: "Parcialmente" }].map(({ k, l }) => (
                <Radio key={k} checked={ptv.dfd_suficiente === k} label={l} disabled={!podeAgir}
                  onChange={() => patch({ dfd_suficiente: ptv.dfd_suficiente === k ? undefined : k })} />
              ))}
            </div>
          </div>
          {(ptv.dfd_suficiente === "nao" || ptv.dfd_suficiente === "parcialmente") && (
            <div>
              <SubSecao title="Caso NÃO ou PARCIALMENTE, indicar a pendência:" />
              <ChkGroup field="dfd_pendencias" opcoes={DFD_PENDENCIAS} cols={2} />
            </div>
          )}
          <div>
            <SubSecao title="Encaminhamento:" />
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {DFD_ENCAMINHAMENTO.map(({ k, l }) => (
                <Chk key={k} checked={hasArr("dfd_encaminhamento", k)} label={l} disabled={!podeAgir}
                  onChange={(v) => toggleArr("dfd_encaminhamento", k, v)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 3 — PARECER DE VIABILIDADE TÉCNICA ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={3} title="PARECER DE VIABILIDADE TÉCNICA" />
        <div className="p-3 space-y-3">
          <div>
            <SubSecao title="A demanda é tecnicamente viável?" />
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {[{ k: "sim", l: "Sim" }, { k: "sim_ajustes", l: "Sim, com ajustes" }, { k: "parcialmente", l: "Parcialmente viável" }, { k: "nao_viavel", l: "Não viável no momento" }].map(({ k, l }) => (
                <Radio key={k} checked={ptv.tecnicamente_viavel === k} label={l} disabled={!podeAgir}
                  onChange={() => patch({ tecnicamente_viavel: ptv.tecnicamente_viavel === k ? undefined : k })} />
              ))}
            </div>
          </div>
          <div>
            <SubSecao title="Forma técnica de atendimento:" />
            <ChkGroup field="forma_atendimento" opcoes={FORMA_ATENDIMENTO} cols={2} />
          </div>
          <div>
            <SubSecao title="Existe impedimento técnico para continuidade?" />
            <div className="flex gap-4 mb-2">
              <Radio checked={ptv.impedimento_tecnico === "sim"} label="Sim" disabled={!podeAgir}
                onChange={() => patch({ impedimento_tecnico: "sim" })} />
              <Radio checked={ptv.impedimento_tecnico === "nao"} label="Não" disabled={!podeAgir}
                onChange={() => patch({ impedimento_tecnico: "nao" })} />
            </div>
            {ptv.impedimento_tecnico === "sim" && (
              <>
                <p className="text-[10px] text-muted-foreground mb-1">Se SIM, indicar:</p>
                <ChkGroup field="impedimento_tipos" opcoes={IMPEDIMENTO_TIPOS} cols={2} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 4 — CLASSIFICAÇÃO DA DEMANDA ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={4} title="CLASSIFICAÇÃO DA DEMANDA" />
        <div className="p-3 space-y-4">

          {/* 4.1 */}
          <div>
            <SubSecao title={<>4.1 Prioridade Institucional — Preenchimento <AutoBadge /></>} />
            <InfoBox texto="As informações abaixo são importadas automaticamente dos dados do card e da Análise de Necessidade." />
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-2 py-1 text-left">Informação</th>
                    <th className="border border-border px-2 py-1 text-left">Onde buscar</th>
                    <th className="border border-border px-2 py-1 text-left">Valor (Automático)</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["Tipo de demanda", "Card Solicitação ERP", tipoDemanda],
                    ["Necessidade aprovada pelo Comitê", "Fluxo da demanda", "Sim"],
                    ["Critério principal de priorização", "Card Solicitação ERP – Grau de Urgência", card.grau_urgencia ? (GRAU_URGENCIA_LABEL[card.grau_urgencia] ?? card.grau_urgencia) : "—"],
                    ["Obrigatoriedade legal", "Card Análise da Necessidade", criterios.includes("obrigatoriedade_legal_prazo") ? "Sim" : "Não"],
                    ["Continuidade da operação", "Card Análise da Necessidade", criterios.includes("risco_paralisacao") ? "Sim" : "Não"],
                    ["Correção de Bug", "Card Solicitação ERP", criterios.includes("correcao_bug_escopo") ? "Sim" : "Não"],
                    ["Demanda estratégica", "Card Análise da Necessidade", criterios.includes("impacto_cliente_contrato") ? "Sim" : "Não"],
                    ["Ganho operacional", "Card Análise da Necessidade", criterios.includes("ganho_operacional_relevante") ? "Sim" : "Não"],
                    ["Melhorias evolutivas", "Card Análise da Necessidade", criterios.includes("melhoria_evolutiva_sem_critico") ? "Sim" : "Não"],
                    ["Impacto Financeiro", "Card Análise da Necessidade", criterios.includes("risco_juridico_trabalhista") ? "Sim" : "Não"],
                    ["Impacto Operacional", "Card Análise da Necessidade", criterios.includes("alto_impacto_operacional") ? "Sim" : "Não"],
                    ["Número de usuários impactados", "Card Análise da Necessidade", card.an_pessoas_impactadas ? (pessoasLabel[card.an_pessoas_impactadas] ?? card.an_pessoas_impactadas) : "—"],
                    ["Riscos envolvidos", "Card Análise da Necessidade", criterios.includes("risco_juridico_trabalhista") ? "Sim" : "Não"],
                    ["Urgência Institucional", "Card Solicitação ERP – Grau de Urgência", card.grau_urgencia ? (GRAU_URGENCIA_LABEL[card.grau_urgencia] ?? card.grau_urgencia) : "—"],
                    ["Alinhamento estratégico", "Regra do processo", "Sim"],
                  ] as [string, string, string][]).map(([info, fonte, valor]) => (
                    <tr key={info}>
                      <td className="border border-border px-2 py-1 font-semibold">{info}</td>
                      <td className="border border-border px-2 py-1 text-muted-foreground">{fonte}</td>
                      <td className="border border-border px-2 py-1 font-semibold text-[#153169]">{valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-1"><InfoBox texto="Este bloco é preenchido automaticamente pelo sistema." /></div>
          </div>

          {/* 4.2 */}
          <div>
            <SubSecao title="4.2 Regra de Classificação Automática da Prioridade Institucional" />
            <div className="rounded border border-border bg-muted/20 p-2 text-[10px] space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Prioridade Crítica:</strong> Obrigatoriedade legal, risco de paralisação, impossibilidade de faturamento, falha crítica, risco jurídico/financeiro/contratual ou determinação da Presidência/Comitê.</p>
              <p><strong className="text-foreground">Prioridade Alta:</strong> Correção de Bug, alto impacto operacional, alto número de usuários, redução de retrabalho, automação de processo crítico, integração necessária ou impacto direto em cliente/contrato.</p>
              <p><strong className="text-foreground">Prioridade Estratégica:</strong> Projeto vinculado ao Planejamento Estratégico, aprovado pela Presidência, novo módulo corporativo, indicadores estratégicos ou impacto em mais de uma diretoria.</p>
              <p><strong className="text-foreground">Prioridade Média:</strong> Ganho operacional relevante, melhoria de processo, redução de controles manuais, rastreabilidade, melhoria de indicadores ou comunicação entre áreas.</p>
              <p><strong className="text-foreground">Prioridade Baixa:</strong> Melhoria evolutiva sem caráter crítico, ajuste de layout, novo filtro simples, relatório sem urgência, ajuste de usabilidade.</p>
            </div>
          </div>

          {/* 4.3 */}
          <div>
            <SubSecao title={<>4.3 Resultado Automático da Prioridade Institucional <AutoBadge /></>} />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <AutoField label="Critério principal identificado" value={criterios[0] ?? "—"} />
              <AutoField label="Critérios complementares identificados" value={criterios.length > 1 ? `${criterios.length - 1} identificados` : "—"} />
              <AutoField label="Prioridade institucional sugerida" value={prioridadeAuto} />
            </div>
            <div className="rounded border border-amber-300 bg-amber-50 p-2.5 space-y-2 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">A prioridade institucional poderá ser alterada manualmente? (Preenchimento exclusivo do Gerente de Sistemas)</p>
              <div className="flex gap-4">
                <Radio checked={ptv.pode_alterar_prioridade === "sim"} label="Sim, apenas pelo Gerente de Sistemas" disabled={!podeAgir}
                  onChange={() => patch({ pode_alterar_prioridade: "sim", prioridade_override: undefined })} />
                <Radio checked={ptv.pode_alterar_prioridade === "nao"} label="Não" disabled={!podeAgir}
                  onChange={() => patch({ pode_alterar_prioridade: "nao", prioridade_override: undefined })} />
              </div>
              {ptv.pode_alterar_prioridade === "sim" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {["Baixa", "Média", "Alta", "Estratégica", "Crítica"].map((p) => (
                      <Radio key={p} checked={ptv.prioridade_override === p} label={p} disabled={!podeAgir}
                        onChange={() => patch({ prioridade_override: p })} />
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Justificativa para alteração manual, se houver:</p>
                    <Textarea value={ptv.prioridade_justificativa ?? ""} disabled={!podeAgir} placeholder="Justificativa..."
                      className="min-h-[40px] text-[11px]" onChange={(e) => patch({ prioridade_justificativa: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4.4 */}
          <div>
            <SubSecao title="4.4 Complexidade Técnica — Preenchimento pela TI" />
            <p className="text-[10px] text-muted-foreground mb-2">A TI deverá marcar apenas os itens técnicos aplicáveis:</p>
            <ChkGroup field="complexidade_itens" opcoes={COMPLEXIDADE_ITENS} cols={2} />
            <div className="mt-1"><InfoBox texto="Este bloco é preenchido manualmente pela TI." /></div>
          </div>

          {/* 4.5 */}
          <div>
            <SubSecao title="4.5 Regra de Classificação Automática da Complexidade Técnica" />
            <div className="rounded border border-border bg-muted/20 p-2 text-[10px] space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Baixa Complexidade:</strong> Configuração simples, ajuste pontual, poucos campos, relatório simples, sem integração, sem alteração relevante em banco de dados, sem acesso externo e baixo impacto sistêmico.</p>
              <p><strong className="text-foreground">Média Complexidade:</strong> Alteração em funcionalidade existente, criação de tela simples, regras/validações simples, ajuste de permissões, relatório com filtros, dashboard simples, integração limitada ou testes ampliados.</p>
              <p><strong className="text-foreground">Alta Complexidade:</strong> Nova funcionalidade, workflow novo, várias regras e validações, múltiplos perfis, integração com outro sistema, geração de documentos, dashboard com múltiplos filtros, alteração relevante em banco, acesso externo e elevado impacto operacional.</p>
              <p><strong className="text-foreground">Complexidade Crítica:</strong> Novo módulo estruturante, múltiplas integrações, integração crítica, alto volume ou migração de dados, saneamento relevante, alteração estrutural no ERP, alto impacto em segurança da informação, acesso externo com dados sensíveis, dependência crítica de fornecedor técnico e risco de indisponibilidade do sistema.</p>
            </div>
          </div>

          {/* 4.6 */}
          <div>
            <SubSecao title={<>4.6 Resultado Automático da Complexidade Técnica <AutoBadge /></>} />
            <div className="space-y-1">
              <AutoField label="Itens técnicos marcados" value={`${complexItens.length} itens`} />
              <AutoField label="Complexidade técnica sugerida pelo sistema" value={complexidadeAuto} />
            </div>
            <div className="mt-1"><InfoBox texto="Este bloco é gerado automaticamente pelo sistema." /></div>
          </div>

          {/* 4.7 */}
          <div>
            <SubSecao title={<>4.7 Cruzamento Automático — Prioridade × Complexidade <AutoBadge /></>} />
            <div className="grid grid-cols-2 gap-2">
              <AutoField label="Prioridade institucional" value={prioridadeEfetiva} />
              <AutoField label="Complexidade técnica" value={complexidadeAuto} />
              <AutoField label="Resultado combinado" value={resultadoCombinado} />
            </div>
          </div>

          {/* 4.8 */}
          <div>
            <SubSecao title={<>4.8 Prazo Técnico Estimado <AutoBadge /></>} />
            <AutoField label="Prazo técnico estimado" value={prazoAuto} />
            <div className="mt-1"><InfoBox texto="O prazo técnico estimado será definido automaticamente conforme o cruzamento da prioridade institucional com a complexidade técnica." /></div>
          </div>

          {/* 4.9 */}
          <div>
            <SubSecao title={<>4.9 Encaminhamento Automático Sugerido <AutoBadge /></>} />
            <div className="rounded border border-dashed border-border bg-muted/20 p-2 text-[11px] font-semibold text-[#153169]">
              {encaminhamentoSugerido}
            </div>
            <div className="mt-1"><InfoBox texto="Este bloco é gerado automaticamente pelo sistema." /></div>
          </div>

          {/* 4.10 */}
          <div>
            <SubSecao title={<>4.10 Registro de Decisões Automáticas <AutoBadge /></>} />
            <div className="space-y-1">
              {([
                ["Prioridade institucional", prioridadeEfetiva],
                ["Complexidade técnica", complexidadeAuto],
                ["Resultado combinado", resultadoCombinado],
                ["Prazo técnico estimado", prazoAuto],
                ["Encaminhamento sugerido", encaminhamentoSugerido],
                ["Data e hora da geração", new Date().toLocaleString("pt-BR")],
              ] as [string, string][]).map(([label, valor]) => (
                <AutoField key={label} label={label} value={valor} />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── SEÇÃO 5 — DEPENDÊNCIAS, RISCOS E CONDIÇÕES ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={5} title="DEPENDÊNCIAS, RISCOS E CONDIÇÕES" />
        <div className="p-3 grid grid-cols-2 gap-4">

          <div className="space-y-2">
            <SubSecao title="5.1 A demanda possui dependências técnicas?" />
            <div className="flex gap-4">
              <Radio checked={ptv.tem_dependencias === "sim"} label="Sim" disabled={!podeAgir} onChange={() => patch({ tem_dependencias: "sim" })} />
              <Radio checked={ptv.tem_dependencias === "nao"} label="Não" disabled={!podeAgir} onChange={() => patch({ tem_dependencias: "nao" })} />
            </div>
            {ptv.tem_dependencias === "sim" && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Se SIM, indicar:</p>
                {DEPENDENCIA_TIPOS.map(({ k, l }) => (
                  <Chk key={k} checked={hasArr("dependencia_tipos", k)} label={l} disabled={!podeAgir}
                    onChange={(v) => toggleArr("dependencia_tipos", k, v)} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <SubSecao title="5.2 A demanda apresenta risco técnico relevante?" />
            <div className="flex gap-4">
              <Radio checked={ptv.tem_risco_tecnico === "sim"} label="Sim" disabled={!podeAgir} onChange={() => patch({ tem_risco_tecnico: "sim" })} />
              <Radio checked={ptv.tem_risco_tecnico === "nao"} label="Não" disabled={!podeAgir} onChange={() => patch({ tem_risco_tecnico: "nao" })} />
            </div>
            {ptv.tem_risco_tecnico === "sim" && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Se SIM, indicar:</p>
                {RISCO_TIPOS.map(({ k, l }) => (
                  <Chk key={k} checked={hasArr("risco_tipos", k)} label={l} disabled={!podeAgir}
                    onChange={(v) => toggleArr("risco_tipos", k, v)} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <SubSecao title="5.3 A demanda deverá ser dividida em fases?" />
            <div className="flex gap-4">
              <Radio checked={ptv.dividir_fases === "sim"} label="Sim" disabled={!podeAgir} onChange={() => patch({ dividir_fases: "sim" })} />
              <Radio checked={ptv.dividir_fases === "nao"} label="Não" disabled={!podeAgir} onChange={() => patch({ dividir_fases: "nao" })} />
            </div>
            {ptv.dividir_fases === "sim" && (
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fase 1 — Entrega mínima necessária:</p>
                  <Textarea value={ptv.fase1_entrega ?? ""} disabled={!podeAgir} placeholder="Descreva a Fase 1..."
                    className="min-h-[50px] text-[11px]" onChange={(e) => patch({ fase1_entrega: e.target.value })} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fase 2 — Complementação futura:</p>
                  <Textarea value={ptv.fase2_complementacao ?? ""} disabled={!podeAgir} placeholder="Descreva a Fase 2..."
                    className="min-h-[50px] text-[11px]" onChange={(e) => patch({ fase2_complementacao: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <SubSecao title="5.4 Necessita encaminhamento ao Comitê de Governança?" />
            <div className="flex gap-4">
              <Radio checked={ptv.encaminhar_comite === "sim"} label="Sim" disabled={!podeAgir} onChange={() => patch({ encaminhar_comite: "sim" })} />
              <Radio checked={ptv.encaminhar_comite === "nao"} label="Não" disabled={!podeAgir} onChange={() => patch({ encaminhar_comite: "nao" })} />
            </div>
            {ptv.encaminhar_comite === "sim" && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Encaminhar ao Comitê quando houver:</p>
                {COMITE_MOTIVOS.map(({ k, l }) => (
                  <Chk key={k} checked={hasArr("comite_motivos", k)} label={l} disabled={!podeAgir}
                    onChange={(v) => toggleArr("comite_motivos", k, v)} />
                ))}
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Observação:</p>
              <Textarea value={ptv.observacao_5 ?? ""} disabled={!podeAgir} placeholder="Observação..."
                className="min-h-[40px] text-[11px]" onChange={(e) => patch({ observacao_5: e.target.value })} />
            </div>
            <InfoBox texto="O registro da necessidade de encaminhamento ao Comitê neste parecer não representa decisão final. A decisão formal deverá ser registrada no Anexo IV." />
          </div>

        </div>
      </div>

      {/* ── SEÇÃO 6 — PARECER TÉCNICO FINAL ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={6} title="PARECER TÉCNICO FINAL" />
        <div className="p-3 space-y-3">
          <div>
            <SubSecao title="Após análise técnica, a TI recomenda:" />
            <ChkGroup field="parecer_final" opcoes={PARECER_FINAL_OPCOES} cols={2} />
          </div>
          <div>
            <SubSecao title="Observações / Justificativas:" />
            <Textarea value={ptv.observacoes_justificativas ?? ""} disabled={!podeAgir} placeholder="Observações e justificativas..."
              className="min-h-[60px] text-[11px]" onChange={(e) => patch({ observacoes_justificativas: e.target.value })} />
          </div>
          <InfoBox texto="Este documento é preenchido pela TI. As informações dos blocos identificados como AUTOMÁTICOS são calculadas pelo sistema e não podem ser alteradas manualmente." />
        </div>
      </div>

      {/* ── BOTÕES ── */}
      <div className="flex gap-2">
        <Button className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "aprovacao_priorizacao" })}>
          <ArrowRight className="h-3.5 w-3.5" /> Avançar para Aprovação e Priorização
        </Button>
        <Button variant="outline" className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "analise_necessidade" })}>
          <Undo2 className="h-3.5 w-3.5" /> Retornar para Análise de Necessidade
        </Button>
      </div>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só o Gerente de Sistemas age nesta etapa.</p>}
    </div>
  );
}
