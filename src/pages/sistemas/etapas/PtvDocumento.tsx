import { createContext, useContext, useEffect, useState } from "react";
import type { PtvDados, Solicitacao } from "./types";
import { CLASSIFICACAO_DEMANDA_OPCOES, GRAU_URGENCIA_LABEL, TIPO_SOLICITACAO_LABEL, fmtData, sdNumero } from "./types";

// ── Lógica automática (exportada para Resumos.tsx e AnaliseTecnicaPanel.tsx) ──

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

// ── Constantes ────────────────────────────────────────────────────────────────

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
  { k: "ajuste_permissao_acesso", l: "Ajuste de permissão/acesso" },
  { k: "ajuste_funcionalidade_existente", l: "Ajuste em funcionalidade existente" },
  { k: "solucao_temporaria_manual_controlada", l: "Solução temporária/manual controlada" },
  { k: "desenvolvimento_nova_funcionalidade", l: "Desenvolvimento de nova funcionalidade" },
  { k: "desenvolvimento_novo_modulo", l: "Desenvolvimento de novo módulo" },
  { k: "criacao_relatorio", l: "Criação de relatório" },
  { k: "criacao_dashboard", l: "Criação de dashboard" },
  { k: "automacao_processo", l: "Automação de processo" },
  { k: "integracao_sistemas", l: "Integração entre sistemas" },
  { k: "importacao_dados", l: "Importação de dados" },
  { k: "exportacao_dados", l: "Exportação de dados" },
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

// ── Estilos compartilhados ────────────────────────────────────────────────────

const S = {
  secao: "bg-[#153169] text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide",
  sub: "flex items-center gap-1 bg-[#153169]/10 border-l-[3px] border-[#153169] pl-2 pr-1 py-0.5 text-[10px] font-bold text-[#153169] uppercase tracking-wide mb-1.5 rounded-r-sm",
  th: "border border-gray-300 bg-[#153169]/8 px-1.5 py-1 text-[10px] font-semibold text-center text-[#153169]",
  td: "border border-gray-300 px-1.5 py-1 text-[10px] text-center align-middle",
  tdl: "border border-gray-300 px-1.5 py-1 text-[10px] align-middle",
  campo: "text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5",
  auto: "flex items-center justify-between bg-[#153169]/5 border border-[#153169]/20 rounded px-2 py-1 text-[10px]",
  badge: "ml-1 rounded bg-[#153169] px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white",
  info: "flex items-start gap-1.5 rounded border border-blue-200 bg-blue-50 p-2 text-[10px] text-blue-800 mt-1",
  group: "rounded border border-gray-200 bg-gray-50/70 p-1.5",
};

// ── Contexto (evita redefinição de componentes a cada render → mantém foco) ───

interface PtvCtxValue {
  ro: boolean;
  d: PtvDados;
  patch: (p: Partial<PtvDados>) => void;
  hasArr: (field: keyof PtvDados, key: string) => boolean;
  toggleArr: (field: keyof PtvDados, key: string, checked: boolean) => void;
}
const PtvCtx = createContext<PtvCtxValue>(null!);

// ── Primitivos (fora do componente principal para identidade estável) ─────────

function Chk({ field, k, label }: { field: keyof PtvDados; k: string; label: string }) {
  const { ro, hasArr, toggleArr } = useContext(PtvCtx);
  const checked = hasArr(field, k);
  if (ro) return (
    <span className={`flex items-start gap-1 text-[11px] leading-tight px-0.5 py-px rounded ${checked ? "bg-[#153169]/10 text-[#153169] font-semibold" : "text-gray-500"}`}>
      <span className="flex-shrink-0 mt-px">{checked ? "☑" : "☐"}</span>
      <span>{label}</span>
    </span>
  );
  return (
    <label className={`flex items-start gap-1.5 text-[11px] leading-tight cursor-pointer select-none px-0.5 py-px rounded ${checked ? "bg-[#153169]/10 text-[#153169] font-semibold" : "hover:bg-gray-100"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => toggleArr(field, k, e.target.checked)}
        className="mt-px h-3 w-3 flex-shrink-0 accent-[#153169]" />
      <span>{label}</span>
    </label>
  );
}

function ChkGrp({ field, opcoes, cols = 1, grouped = true }: { field: keyof PtvDados; opcoes: { k: string; l: string }[]; cols?: number; grouped?: boolean }) {
  return (
    <div className={grouped ? "rounded border border-gray-200 bg-gray-50/70 p-1.5" : ""}>
      <div className="grid gap-x-2 gap-y-0.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {opcoes.map(({ k, l }) => <Chk key={k} field={field} k={k} label={l} />)}
      </div>
    </div>
  );
}

function RadioItem({ field, k, label }: { field: keyof PtvDados; k: string; label: string }) {
  const { ro, d, patch } = useContext(PtvCtx);
  const checked = (d[field] as string | undefined) === k;
  if (ro) return (
    <span className={`flex items-center gap-1 text-[11px] px-1 py-px rounded ${checked ? "bg-[#153169]/10 text-[#153169] font-semibold" : "text-gray-500"}`}>
      <span>{checked ? "●" : "○"}</span> {label}
    </span>
  );
  return (
    <label className={`flex items-center gap-1.5 text-[11px] cursor-pointer select-none px-1 py-px rounded ${checked ? "bg-[#153169]/10 text-[#153169] font-semibold" : "hover:bg-gray-100"}`}>
      <input type="radio" checked={checked}
        onChange={() => patch({ [field]: (d[field] as string | undefined) === k ? undefined : k } as Partial<PtvDados>)}
        className="h-3 w-3 flex-shrink-0 accent-[#153169]" />
      {label}
    </label>
  );
}

function TxtArea({ value, onChange, placeholder, rows = 2 }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; rows?: number;
}) {
  const { ro } = useContext(PtvCtx);
  if (ro) return (
    <div className="text-[11px] min-h-[2rem] whitespace-pre-wrap break-words">
      {value || <span className="text-gray-400">—</span>}
    </div>
  );
  return (
    <textarea value={value} rows={rows} placeholder={placeholder}
      className="w-full rounded border border-gray-300 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#153169] resize-none"
      onChange={(e) => onChange?.(e.target.value)} />
  );
}

// ── Interface ─────────────────────────────────────────────────────────────────

export interface PtvDocumentoProps {
  dados: PtvDados;
  card: Solicitacao;
  isReadOnly: boolean;
  onPatch?: (dados: PtvDados) => void;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function PtvDocumento({ dados, card, isReadOnly: ro, onPatch }: PtvDocumentoProps) {
  const [d, setD] = useState<PtvDados>(dados);
  useEffect(() => { setD(dados); }, [dados]);

  function patch(p: Partial<PtvDados>) {
    if (ro) return;
    const novo = { ...d, ...p };
    setD(novo);
    onPatch?.(novo);
  }
  function hasArr(field: keyof PtvDados, key: string) {
    return ((d[field] as string[] | undefined) ?? []).includes(key);
  }
  function toggleArr(field: keyof PtvDados, key: string, checked: boolean) {
    const cur = (d[field] as string[] | undefined) ?? [];
    patch({ [field]: checked ? [...cur, key] : cur.filter((k) => k !== key) } as Partial<PtvDados>);
  }

  // ── Helpers de layout ─────────────────────────────────────────────────────

  function Secao({ num, title }: { num: number | string; title: string }) {
    return (
      <div className={S.secao}>
        {num}. {title}
      </div>
    );
  }

  function Sub({ title, badge }: { title: string; badge?: boolean }) {
    return (
      <div className={S.sub}>
        <span className="flex-1">{title}</span>
        {badge && <span className={S.badge}>AUTO</span>}
      </div>
    );
  }

  function Auto({ label, value }: { label: string; value: string }) {
    return (
      <div className={S.auto}>
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-[#153169]">{value || "—"}</span>
      </div>
    );
  }

  function Info({ text }: { text: string }) {
    return (
      <div className={S.info}>
        <span className="flex-shrink-0">ℹ</span>
        <span>{text}</span>
      </div>
    );
  }

  function Pagina({ num }: { num: number }) {
    return (
      <div className="flex items-center justify-center py-1 border-y border-gray-200 bg-[#153169]/5 my-0">
        <span className="text-[10px] font-bold text-[#153169] tracking-widest uppercase">PÁGINA {num} DE 2</span>
      </div>
    );
  }

  // ── Valores automáticos ───────────────────────────────────────────────────

  const criterios = card.an_criterios ?? [];
  const prioridadeAuto = calcPrioridade(criterios);
  const prioridadeEfetiva = d.prioridade_override ?? prioridadeAuto;
  const complexidadeAuto = calcComplexidade(d.complexidade_itens ?? []);
  const prazoAuto = calcPrazo(prioridadeEfetiva, complexidadeAuto);
  const resultadoCombinado = `${prioridadeEfetiva} + ${complexidadeAuto}`;

  const tipoDemanda = card.classificacao_demanda?.length
    ? card.classificacao_demanda.map((v) => CLASSIFICACAO_DEMANDA_OPCOES.find((o) => o.value === v)?.label ?? v).join(", ")
    : (card.tipo_solicitacao ? (TIPO_SOLICITACAO_LABEL[card.tipo_solicitacao] ?? card.tipo_solicitacao) : "—");

  const pessoasLabel: Record<string, string> = {
    "1_5": "1 – 5 pessoas", "5_10": "5 – 10 pessoas", "mais_10": "Mais de 10 pessoas",
  };

  const encaminhamentoSugerido = d.tecnicamente_viavel === "nao_viavel"
    ? "Considerar tecnicamente inviável no momento"
    : d.dfd_suficiente === "nao"
    ? "Retornar para ajuste do DFD"
    : d.encaminhar_comite === "sim"
    ? "Encaminhar para avaliação do Comitê de Governança"
    : "Seguir para Anexo IV – Ata de Aprovação e Priorização";

  const CRITERIOS_41: [string, string, string][] = [
    ["Tipo de demanda", "Card Solicitação ERP", tipoDemanda],
    ["Necessidade aprovada pelo Comitê", "Fluxo da demanda", "Sim"],
    ["Critério principal de priorização", "Grau de Urgência", card.grau_urgencia ? (GRAU_URGENCIA_LABEL[card.grau_urgencia] ?? card.grau_urgencia) : "—"],
    ["Obrigatoriedade legal", "Análise da Necessidade", criterios.includes("obrigatoriedade_legal_prazo") ? "Sim" : "Não"],
    ["Continuidade da operação", "Análise da Necessidade", criterios.includes("risco_paralisacao") ? "Sim" : "Não"],
    ["Correção de Bug", "Card Solicitação ERP", criterios.includes("correcao_bug_escopo") ? "Sim" : "Não"],
    ["Demanda estratégica", "Análise da Necessidade", criterios.includes("impacto_cliente_contrato") ? "Sim" : "Não"],
    ["Ganho operacional", "Análise da Necessidade", criterios.includes("ganho_operacional_relevante") ? "Sim" : "Não"],
    ["Melhorias evolutivas", "Análise da Necessidade", criterios.includes("melhoria_evolutiva_sem_critico") ? "Sim" : "Não"],
    ["Impacto Financeiro", "Análise da Necessidade", criterios.includes("risco_juridico_trabalhista") ? "Sim" : "Não"],
    ["Impacto Operacional", "Análise da Necessidade", criterios.includes("alto_impacto_operacional") ? "Sim" : "Não"],
    ["Número de usuários impactados", "Análise da Necessidade", card.an_pessoas_impactadas ? (pessoasLabel[card.an_pessoas_impactadas] ?? card.an_pessoas_impactadas) : "—"],
    ["Riscos envolvidos", "Análise da Necessidade", criterios.includes("risco_juridico_trabalhista") ? "Sim" : "Não"],
    ["Urgência Institucional", "Grau de Urgência", card.grau_urgencia ? (GRAU_URGENCIA_LABEL[card.grau_urgencia] ?? card.grau_urgencia) : "—"],
    ["Alinhamento estratégico", "Regra do processo", "Sim"],
  ];

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <PtvCtx.Provider value={{ ro, d, patch, hasArr, toggleArr }}>
    <div className="text-[11px] font-[Arial,sans-serif] border border-gray-300 rounded">

      {/* ── CABEÇALHO ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-300 bg-white">
        <div className="flex items-center gap-3">
          <div style={{ width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderBottom: "21px solid #E55B00", flexShrink: 0 }} />
          <span className="font-bold text-[13px] uppercase tracking-wide text-gray-900">ANEXO III – PARECER TÉCNICO DE VIABILIDADE (PTV)</span>
        </div>
        <div className="text-right border border-gray-400 px-2 py-0.5 min-w-[110px]">
          <p className="text-[9px] font-semibold uppercase text-gray-500">Nº da Solicitação</p>
          <p className="text-[13px] font-bold text-[#153169]">{sdNumero(card)}</p>
        </div>
      </div>

      <Pagina num={1} />

      {/* ── PÁGINA 1: Seções 1, 2, 3 em 3 colunas ────────────────────────── */}
      <div className="grid border-b border-gray-300" style={{ gridTemplateColumns: "0.8fr 1fr 2fr" }}>

        {/* SEÇÃO 1 — IDENTIFICAÇÃO (sempre auto) */}
        <div className="border-r border-gray-300">
          <div className={S.secao}>1. IDENTIFICAÇÃO DA DEMANDA</div>
          <div className="p-2 space-y-1">
            {([
              ["Número da demanda:", sdNumero(card)],
              ["Área solicitante:", card.area_solicitante ?? "—"],
              ["Responsável pela solicitação:", card.responsavel_solicitacao ?? "—"],
              ["Cargo:", card.cargo_solicitante ?? "—"],
              ["E-mail:", card.email_solicitante ?? "—"],
              ["Telefone:", card.telefone_solicitante ?? "—"],
              ["Data da solicitação:", card.created_at ? fmtData(card.created_at.slice(0, 10)) ?? "—" : "—"],
              ["Tipo de demanda:", tipoDemanda],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} className="flex gap-1 flex-wrap">
                <span className="font-semibold text-[#153169] text-[10px] whitespace-nowrap">{label}</span>
                <span className="text-[10px]">{val}</span>
              </div>
            ))}
            <Info text="Origem: Card Solicitação ERP" />
          </div>
        </div>

        {/* SEÇÃO 2 — CONFERÊNCIA MÍNIMA DO DFD */}
        <div className="border-r border-gray-300">
          <div className={S.secao}>2. CONFERÊNCIA MÍNIMA DO DFD</div>
          <div className="p-2 space-y-2">
            <div>
              <Sub title="O DFD possui informações suficientes para análise técnica?" />
              <div className="flex flex-wrap gap-3">
                {[{ k: "sim", l: "Sim" }, { k: "nao", l: "Não" }, { k: "parcialmente", l: "Parcialmente" }].map(({ k, l }) => (
                  <RadioItem key={k} field="dfd_suficiente" k={k} label={l} />
                ))}
              </div>
            </div>
            {(d.dfd_suficiente === "nao" || d.dfd_suficiente === "parcialmente" || (ro && d.dfd_pendencias && d.dfd_pendencias.length > 0)) && (
              <div>
                <p className="text-[10px] text-gray-500 mb-1">Caso NÃO ou PARCIALMENTE, indicar a pendência:</p>
                <ChkGrp field="dfd_pendencias" opcoes={DFD_PENDENCIAS} cols={2} />
              </div>
            )}
            <div>
              <Sub title="Encaminhamento:" />
              <ChkGrp field="dfd_encaminhamento" opcoes={DFD_ENCAMINHAMENTO} cols={2} />
            </div>
          </div>
        </div>

        {/* SEÇÃO 3 — PARECER DE VIABILIDADE TÉCNICA */}
        <div>
          <div className={S.secao}>3. PARECER DE VIABILIDADE TÉCNICA</div>
          <div className="p-2">
            <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr) minmax(0,1.2fr)" }}>
              {/* Col A: tecnicamente viável */}
              <div>
                <Sub title="A demanda é tecnicamente viável?" />
                <div className="flex flex-col gap-0.5">
                  {[
                    { k: "sim", l: "Sim" },
                    { k: "sim_ajustes", l: "Sim, com ajustes" },
                    { k: "parcialmente", l: "Parcialmente viável" },
                    { k: "nao_viavel", l: "Não viável no momento tecnicamente" },
                  ].map(({ k, l }) => <RadioItem key={k} field="tecnicamente_viavel" k={k} label={l} />)}
                </div>
              </div>
              {/* Col B: forma técnica */}
              <div>
                <Sub title="Forma técnica de atendimento:" />
                <ChkGrp field="forma_atendimento" opcoes={FORMA_ATENDIMENTO} cols={2} />
              </div>
              {/* Col C: impedimento */}
              <div>
                <Sub title="Existe impedimento técnico para continuidade?" />
                <div className="flex gap-3 mb-1">
                  <RadioItem field="impedimento_tecnico" k="sim" label="Sim" />
                  <RadioItem field="impedimento_tecnico" k="nao" label="Não" />
                </div>
                {(d.impedimento_tecnico === "sim" || (ro && d.impedimento_tipos && d.impedimento_tipos.length > 0)) && (
                  <>
                    <p className="text-[10px] text-gray-500 mb-0.5">Se SIM, indicar:</p>
                    <ChkGrp field="impedimento_tipos" opcoes={IMPEDIMENTO_TIPOS} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 4 — CLASSIFICAÇÃO DA DEMANDA ───────────────────────────── */}
      <div className={S.secao + " text-center text-[12px]"}>4. CLASSIFICAÇÃO DA DEMANDA</div>

      {/* 4.1 a 4.6 em layout de 6 colunas */}
      <div className="grid border-b border-gray-300" style={{ gridTemplateColumns: "1.8fr 1.5fr 1.2fr 1.5fr 1.5fr 0.8fr" }}>

        {/* 4.1 Prioridade Institucional (AUTO) */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="4.1 Prioridade Institucional – Preenchimento" badge />
          <Info text="As informações abaixo são importadas automaticamente dos dados do card e da Análise de Necessidade." />
          <table className="w-full border-collapse text-[9px] mt-1">
            <thead>
              <tr>
                <th className={S.th + " text-left"}>Informação</th>
                <th className={S.th + " text-left"}>Onde buscar</th>
                <th className={S.th}>Valor (Auto)</th>
              </tr>
            </thead>
            <tbody>
              {CRITERIOS_41.map(([info, fonte, valor]) => (
                <tr key={info}>
                  <td className={S.tdl + " font-semibold text-[9px]"}>{info}</td>
                  <td className={S.tdl + " text-gray-500 text-[9px]"}>{fonte}</td>
                  <td className={S.td + " font-semibold text-[#153169] text-[9px]"}>{valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Info text="Este bloco é preenchido automaticamente pelo sistema." />
        </div>

        {/* 4.2 Regra de Classificação (AUTO) */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="4.2 Regra de Classificação Automática da Prioridade Institucional" badge />
          <div className="space-y-1.5 text-[9px] text-gray-600">
            <p><strong className="text-[#153169]">Prioridade Crítica:</strong> Obrigatoriedade legal, risco de paralisação, impossibilidade de faturamento, falha crítica, risco jurídico/financeiro/contratual ou determinação da Presidência/Comitê.</p>
            <p><strong className="text-[#153169]">Prioridade Alta:</strong> Correção de bug, alto impacto operacional, muitos usuários, redução de retrabalho, automação crítica, integrações necessárias ou impacto direto em cliente/contrato.</p>
            <p><strong className="text-[#153169]">Prioridade Estratégica:</strong> Projeto vinculado ao planejamento estratégico, aprovado pela Presidência, novo módulo corporativo, indicadores estratégicos ou iniciativas estratégicas da diretoria.</p>
            <p><strong className="text-[#153169]">Prioridade Média:</strong> Ganho operacional relevante, melhoria de processos, relatórios ou controles importantes, sem impacto crítico.</p>
            <p><strong className="text-[#153169]">Prioridade Baixa:</strong> Melhoria evolutiva sem caráter crítico, ajuste de layout, novo filtro simples, relatório sem urgência, ajuste de usabilidade.</p>
          </div>
          <Info text="Este bloco é gerado automaticamente pelo sistema." />
        </div>

        {/* 4.3 Resultado AUTO + override manual */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="4.3 Resultado Automático da Prioridade Institucional" badge />
          <div className="space-y-1 mb-2">
            <Auto label="Critério principal" value={criterios[0] ?? "—"} />
            <Auto label="Prioridade sugerida" value={prioridadeAuto} />
            <Auto label="Motivo automático" value={criterios.length ? `${criterios.length} critério(s)` : "Sem critérios"} />
          </div>
          <div className="rounded border border-amber-300 bg-amber-50 p-1.5 text-[9px]">
            <p className="font-semibold text-amber-800 mb-1">A PRIORIDADE INSTITUCIONAL PODERÁ SER ALTERADA MANUALMENTE?<br />(Preenchimento exclusivo do Gerente de Sistemas)</p>
            <div className="flex flex-col gap-0.5 mb-1">
              <RadioItem field="pode_alterar_prioridade" k="sim" label="Sim, apenas pelo Gerente de Sistemas" />
              <RadioItem field="pode_alterar_prioridade" k="nao" label="Não" />
            </div>
            {(d.pode_alterar_prioridade === "sim" || (ro && d.prioridade_override)) && (
              <div className="space-y-1">
                <div className="flex flex-wrap gap-1">
                  {["Baixa", "Média", "Alta", "Estratégica", "Crítica"].map((p) => (
                    ro ? (
                      <span key={p} className="text-[9px]">{d.prioridade_override === p ? "●" : "○"} {p}</span>
                    ) : (
                      <label key={p} className="flex items-center gap-0.5 text-[9px] cursor-pointer">
                        <input type="radio" checked={d.prioridade_override === p}
                          onChange={() => patch({ prioridade_override: p })}
                          className="h-2.5 w-2.5 accent-[#153169]" /> {p}
                      </label>
                    )
                  ))}
                </div>
                <p className="text-[9px] text-gray-500">Justificativa:</p>
                <TxtArea value={d.prioridade_justificativa ?? ""} onChange={(v) => patch({ prioridade_justificativa: v })} rows={2} />
              </div>
            )}
          </div>
          <Info text="Este bloco é de preenchimento manual pelo Gerente de Sistemas." />
        </div>

        {/* 4.4 Complexidade Técnica (MANUAL) */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="4.4 Complexidade Técnica – Preenchimento pela TI" />
          <p className="text-[9px] text-gray-500 mb-1">A TI deverá marcar apenas os itens técnicos aplicáveis:</p>
          <ChkGrp field="complexidade_itens" opcoes={COMPLEXIDADE_ITENS} cols={3} />
          <Info text="Este bloco é preenchido manualmente pela TI." />
        </div>

        {/* 4.5 Regra Complexidade (AUTO) */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="4.5 Regra de Classificação Automática da Complexidade Técnica" badge />
          <div className="space-y-1.5 text-[9px] text-gray-600">
            <p><strong className="text-[#153169]">Baixa Complexidade Técnica:</strong> Configuração simples, ajuste pontual, poucos campos, relatório simples, sem integração, sem alteração relevante em banco de dados, sem acesso externo e baixo impacto sistêmico.</p>
            <p><strong className="text-[#153169]">Média Complexidade Técnica:</strong> Alteração em funcionalidade existente, criação de tela simples, regras/validações simples, ajuste de permissões, relatório com filtros, dashboard simples, integração limitada ou necessidade de testes ampliados.</p>
            <p><strong className="text-[#153169]">Alta Complexidade Técnica:</strong> Nova funcionalidade, workflow novo, várias regras e validações, múltiplos perfis, integração com outro sistema, geração de documentos, dashboard com múltiplos filtros, alteração relevante em banco, acesso externo e elevado impacto operacional.</p>
            <p><strong className="text-[#153169]">Complexidade Técnica Crítica:</strong> Novo módulo estruturante, múltiplas integrações, integração crítica, alto volume ou migração de dados, saneamento relevante, alteração estrutural no ERP, alto impacto em segurança da informação, acesso externo com dados sensíveis, dependência crítica de fornecedor técnico e risco de indisponibilidade do sistema.</p>
          </div>
          <Info text="Este bloco é gerado automaticamente pelo sistema." />
        </div>

        {/* 4.6 Resultado Complexidade (AUTO) */}
        <div className="p-2">
          <Sub title="4.6 Resultado Automático da Complexidade Técnica" badge />
          <div className="space-y-1">
            <Auto label="Itens técnicos marcados" value={`${(d.complexidade_itens ?? []).length}`} />
            <div className="flex flex-col gap-0.5 mt-1">
              {["Baixa", "Média", "Alta", "Crítica"].map((c) => (
                <span key={c} className={`text-[10px] px-1 py-px rounded ${complexidadeAuto === c ? "bg-[#153169] text-white font-bold" : "text-gray-400"}`}>
                  {complexidadeAuto === c ? "●" : "○"} {c}
                </span>
              ))}
            </div>
            <Auto label="Motivo técnico" value="Automático" />
          </div>
          <Info text="Este bloco é gerado automaticamente pelo sistema." />
        </div>
      </div>

      {/* Assinaturas página 1 */}
      <div className="border-b border-gray-300 px-3 py-2 grid grid-cols-3 gap-4 text-[10px]">
        <div>
          <span className="font-semibold text-[#153169]">Responsável pela análise técnica: </span>
          <span className="inline-block border-b border-gray-400 w-40 align-bottom">&nbsp;</span>
        </div>
        <div>
          <span className="font-semibold text-[#153169]">Assinatura: </span>
          <span className="inline-block border-b border-gray-400 w-32 align-bottom">&nbsp;</span>
        </div>
        <div>
          <span className="font-semibold text-[#153169]">Data: </span>
          <span className="inline-block border-b border-gray-400 w-20 align-bottom">&nbsp;</span>
        </div>
      </div>

      <Pagina num={2} />

      {/* ── PÁGINA 2: Seções 4.7–4.10 em 4 colunas ──────────────────────── */}
      <div className="grid border-b border-gray-300" style={{ gridTemplateColumns: "1.2fr 1.5fr 1.5fr 1fr" }}>

        {/* 4.7 Cruzamento AUTO */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="4.7 Cruzamento Automático entre Prioridade Institucional e Complexidade Técnica" badge />
          <p className="text-[9px] text-gray-500 mb-1">O sistema realizará o cruzamento automático entre a prioridade institucional (item 4.3) e a complexidade técnica (item 4.6).</p>
          <div className="space-y-1">
            {([
              ["Prioridade institucional", prioridadeEfetiva],
              ["Complexidade técnica", complexidadeAuto],
              ["Resultado combinado", resultadoCombinado],
              ["Prazo técnico estimado", prazoAuto],
              ["Encaminhamento sugerido", encaminhamentoSugerido],
            ] as [string, string][]).map(([label, val]) => (
              <Auto key={label} label={label} value={val} />
            ))}
          </div>
          <Info text="Este bloco é gerado automaticamente pelo sistema." />
        </div>

        {/* 4.8 Matriz Prazo (AUTO) */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="4.8 Matriz de Prazo Técnico Estimado" badge />
          <p className="text-[9px] text-gray-500 mb-1">O prazo técnico estimado será definido automaticamente conforme o cruzamento da prioridade institucional com a complexidade técnica.</p>
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                <th className={S.th + " text-left"}>Prioridade</th>
                {["Baixa", "Média", "Alta", "Crítica"].map((c) => (
                  <th key={c} className={S.th + (complexidadeAuto === c ? " bg-[#153169]/10" : "")}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["Baixa", "Média", "Alta", "Estratégica", "Crítica"] as const).map((p) => (
                <tr key={p} className={prioridadeEfetiva === p ? "bg-[#153169]/5" : ""}>
                  <td className={S.tdl + " font-semibold"}>{p}</td>
                  {(["Baixa", "Média", "Alta", "Crítica"] as const).map((c) => (
                    <td key={c} className={S.td + (prioridadeEfetiva === p && complexidadeAuto === c ? " bg-[#153169]/15 font-bold text-[#153169]" : "")}>
                      {PRAZO_MATRIX[p]?.[c] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <Info text="Este bloco é gerado automaticamente pelo sistema conforme matriz acima." />
        </div>

        {/* 4.9 Encaminhamento AUTO */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="4.9 Encaminhamento Automático Sugerido" badge />
          <p className="text-[9px] text-gray-500 mb-1">O sistema sugerirá automaticamente o encaminhamento conforme o resultado combinado (item 4.7).</p>
          <div className="space-y-0.5 text-[9px]">
            {[
              { k: "Seguir para Anexo IV – Ata de Aprovação e Priorização", icon: "✅" },
              { k: "Seguir para Anexo IV com prioridade alta", icon: "🔵" },
              { k: "Seguir para Anexo IV com prioridade média", icon: "🟡" },
              { k: "Seguir para Anexo IV com prioridade baixa", icon: "🟠" },
              { k: "Retornar para ajuste do DFD", icon: "🔴" },
              { k: "Retornar para complementação da área solicitante", icon: "🟣" },
              { k: "Suspender temporariamente a demanda", icon: "⚠️" },
              { k: "Considerar tecnicamente inviável no momento", icon: "⛔" },
              { k: "Encaminhar para avaliação do Comitê de Governança", icon: "🏛️" },
            ].map(({ k, icon }) => (
              <div key={k} className={`flex items-center gap-1 px-1 py-0.5 rounded ${encaminhamentoSugerido === k ? "bg-[#153169]/10 font-semibold text-[#153169]" : "text-gray-500"}`}>
                <span>{icon}</span> <span>{k}</span>
              </div>
            ))}
          </div>
          <Info text="Este bloco é gerado automaticamente pelo sistema." />
        </div>

        {/* 4.10 Registro Decisões AUTO */}
        <div className="p-2">
          <Sub title="4.10 Registro de Decisões Automáticas" badge />
          <p className="text-[9px] text-gray-500 mb-1">Este campo registra automaticamente as decisões geradas pelo sistema neste Anexo.</p>
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                <th className={S.th + " text-left"}>Decisão / Informação</th>
                <th className={S.th}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {([
                ["Prioridade institucional", prioridadeEfetiva],
                ["Complexidade técnica", complexidadeAuto],
                ["Resultado combinado", resultadoCombinado],
                ["Prazo técnico estimado", prazoAuto],
                ["Encaminhamento sugerido", encaminhamentoSugerido],
                ["Data e hora da geração", new Date().toLocaleString("pt-BR")],
                ["Responsável pela geração", "Sistema"],
              ] as [string, string][]).map(([label, val]) => (
                <tr key={label}>
                  <td className={S.tdl}>{label}</td>
                  <td className={S.td + " font-semibold text-[#153169]"}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Info text="Este bloco é preenchido automaticamente pelo sistema." />
        </div>
      </div>

      {/* ── SEÇÃO 5 — DEPENDÊNCIAS, RISCOS E CONDIÇÕES ───────────────────── */}
      <div className={S.secao}>5. DEPENDÊNCIAS, RISCOS E CONDIÇÕES</div>
      <div className="grid border-b border-gray-300" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 0.7fr" }}>

        {/* 5.1 */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="5.1 A demanda possui dependências técnicas?" />
          <div className="flex gap-3 mb-1">
            <RadioItem field="tem_dependencias" k="sim" label="Sim" />
            <RadioItem field="tem_dependencias" k="nao" label="Não" />
          </div>
          {(d.tem_dependencias === "sim" || (ro && d.dependencia_tipos && d.dependencia_tipos.length > 0)) && (
            <>
              <p className="text-[10px] text-gray-500 mb-0.5">Se SIM, indicar:</p>
              <ChkGrp field="dependencia_tipos" opcoes={DEPENDENCIA_TIPOS} />
            </>
          )}
        </div>

        {/* 5.2 */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="5.2 A demanda apresenta risco técnico relevante?" />
          <div className="flex gap-3 mb-1">
            <RadioItem field="tem_risco_tecnico" k="sim" label="Sim" />
            <RadioItem field="tem_risco_tecnico" k="nao" label="Não" />
          </div>
          {(d.tem_risco_tecnico === "sim" || (ro && d.risco_tipos && d.risco_tipos.length > 0)) && (
            <>
              <p className="text-[10px] text-gray-500 mb-0.5">Se SIM, indicar:</p>
              <ChkGrp field="risco_tipos" opcoes={RISCO_TIPOS} />
            </>
          )}
        </div>

        {/* 5.3 */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="5.3 A demanda deverá ser dividida em fases?" />
          <div className="flex gap-3 mb-1">
            <RadioItem field="dividir_fases" k="sim" label="Sim" />
            <RadioItem field="dividir_fases" k="nao" label="Não" />
          </div>
          {(d.dividir_fases === "sim" || (ro && (d.fase1_entrega || d.fase2_complementacao))) && (
            <div className="space-y-1.5">
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Fase 1 — Entrega mínima necessária:</p>
                <TxtArea value={d.fase1_entrega ?? ""} onChange={(v) => patch({ fase1_entrega: v })} rows={2} placeholder="Fase 1..." />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Fase 2 — Complementação futura:</p>
                <TxtArea value={d.fase2_complementacao ?? ""} onChange={(v) => patch({ fase2_complementacao: v })} rows={2} placeholder="Fase 2..." />
              </div>
            </div>
          )}
        </div>

        {/* 5.4 */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="5.4 Necessita encaminhamento ao Comitê de Governança?" />
          <div className="flex gap-3 mb-1">
            <RadioItem field="encaminhar_comite" k="sim" label="Sim" />
            <RadioItem field="encaminhar_comite" k="nao" label="Não" />
          </div>
          <p className="text-[10px] text-gray-500 mb-0.5">Encaminhar ao Comitê quando houver:</p>
          <ChkGrp field="comite_motivos" opcoes={COMITE_MOTIVOS} />
        </div>

        {/* Observação 5 */}
        <div className="p-2">
          <Sub title="Observação" />
          <Info text="O registro da necessidade de encaminhamento ao Comitê neste parecer não representa decisão final. A decisão formal deverá ser registrada no Anexo IV – Ata de Aprovação e Priorização." />
          {(!ro || d.observacao_5) && (
            <div className="mt-2">
              <TxtArea value={d.observacao_5 ?? ""} onChange={(v) => patch({ observacao_5: v })} rows={3} placeholder="Observação..." />
            </div>
          )}
        </div>
      </div>

      {/* ── SEÇÃO 6 — PARECER TÉCNICO FINAL ──────────────────────────────── */}
      <div className={S.secao}>6. PARECER TÉCNICO FINAL</div>
      <div className="grid border-b border-gray-300" style={{ gridTemplateColumns: "2fr 1fr" }}>

        {/* Checkboxes parecer */}
        <div className="border-r border-gray-200 p-2">
          <Sub title="Após análise técnica, a TI recomenda:" />
          <ChkGrp field="parecer_final" opcoes={PARECER_FINAL_OPCOES} cols={2} />
        </div>

        {/* Observações */}
        <div className="p-2">
          <Sub title="Observações / Justificativas:" />
          <TxtArea value={d.observacoes_justificativas ?? ""} onChange={(v) => patch({ observacoes_justificativas: v })} rows={4} placeholder="Observações e justificativas..." />
        </div>
      </div>

      {/* Rodapé */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-[9px] text-gray-500">
        <span>Este documento é preenchido pela TI. As informações dos blocos identificados como AUTOMÁTICOS são calculadas pelo sistema e não podem ser alteradas manualmente.</span>
        <span className="whitespace-nowrap font-semibold">Versão: 1.0 | Data: {fmtData(card.created_at?.slice(0, 10) ?? "") ?? "—"}</span>
      </div>

    </div>
    </PtvCtx.Provider>
  );
}
