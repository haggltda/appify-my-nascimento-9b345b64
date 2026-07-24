import { useMemo, useState } from "react";
import { Pergunta } from "./Formularios";

// =====================================================================
// PAINEL GERENCIAL — aba INDICADORES E CÁLCULOS
//
// O dicionário do painel: o que cada indicador significa, de onde ele sai,
// em que tela aparece e com que gráfico. Existe porque a pergunta que mais
// chega ao RH não é "quanto deu?", é "esse número saiu de onde?".
//
// Duas decisões que valem mais que a tela bonita:
//
// 1) O catálogo é DESCRITIVO, mas não é enfeite: cada indicador declara qual
//    chave do mapeamento o alimenta (`mapaKey`), então a coluna "Pergunta que
//    alimenta" mostra a pergunta REAL do formulário selecionado — ou avisa que
//    ninguém foi mapeado. É aqui que se descobre por que um card veio vazio.
//
// 2) Indicador que ainda não existe no código aparece como "Em breve", nunca
//    como se estivesse rodando. Documentação que promete número que a tela não
//    entrega é pior que documentação nenhuma.
// =====================================================================

const cardBox: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)" };
const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "7px 13px", borderRadius: 9, border, background: bg, color: c, fontSize: 12.5, fontWeight: 700, cursor: "pointer" });
const inp: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", color: "#0f172a", boxSizing: "border-box" };
const th: React.CSSProperties = { padding: "8px 8px", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".4px", color: "#94a3b8", textAlign: "left", borderBottom: "1px solid #eef2f7", verticalAlign: "bottom" };
const td: React.CSSProperties = { padding: "10px 8px", fontSize: 11.5, color: "#475569", borderTop: "1px solid #f5f7fb", verticalAlign: "top", lineHeight: 1.5 };

const CSS_IC = `
.ic-grid{display:grid;gap:14px;grid-template-columns:minmax(0,2.15fr) minmax(0,1fr);align-items:start}
@media(max-width:1180px){.ic-grid{grid-template-columns:1fr}}
.ic-rodape{display:grid;gap:14px;grid-template-columns:1.25fr 1fr}
@media(max-width:900px){.ic-rodape{grid-template-columns:1fr}}
.ic-tab tbody tr:hover{background:#fbfdff}
`;

type Tipo = "Contagem" | "Percentual" | "Distribuição" | "Índice 1–5" | "Comparativo";
const COR_TIPO: Record<Tipo, string> = {
  "Contagem": "#2563eb", "Percentual": "#7c3aed", "Distribuição": "#0891b2",
  "Índice 1–5": "#0f3171", "Comparativo": "#16a34a",
};

interface ItemInd {
  key: string;
  icone: string;
  cor: string;
  label: string;
  calculo: string;          // como o número sai — a regra que está no código
  visual: string;           // gráfico recomendado (e usado)
  telas: string[];          // abas onde aparece
  tipo: Tipo;
  freq: string;
  /** Chave do mapeamento pergunta→indicador que alimenta este número. */
  mapaKey?: string;
  /** false = ainda não implementado; a linha aparece marcada "Em breve". */
  ativo?: boolean;
}

// Ordem = a ordem em que a pessoa encontra os números navegando pelo painel:
// Desenvolvimento → Liderança → Alinhamento → Planos → Histórico → Cumprimento.
const CATALOGO: ItemInd[] = [
  // ── Desenvolvimento ────────────────────────────────────────────────
  { key: "situacao", icone: "🧭", cor: "#2563eb", label: "Situação profissional", mapaKey: "situacao", ativo: true,
    calculo: "Distribuição das respostas da pergunta mapeada. Cada alternativa vira um card e uma fatia; o % é sobre o total de menções, não sobre o total de respostas.",
    visual: "Rosca (ou barras) + cards", telas: ["Desenvolvimento"], tipo: "Distribuição", freq: "A cada carregamento" },
  { key: "necessidades", icone: "🎯", cor: "#dc2626", label: "Necessidades de desenvolvimento", mapaKey: "necessidades", ativo: true,
    calculo: "Frequência de cada alternativa marcada. Pergunta de múltipla seleção conta uma menção por alternativa — a soma passa do total de respostas de propósito.",
    visual: "Ranking horizontal", telas: ["Desenvolvimento"], tipo: "Contagem", freq: "A cada carregamento" },
  { key: "fortes", icone: "⭐", cor: "#7c3aed", label: "Pontos fortes", mapaKey: "fortes", ativo: true,
    calculo: "Frequência das alternativas da pergunta mapeada, no período e nos filtros ativos.",
    visual: "Ranking horizontal", telas: ["Desenvolvimento", "Histórico Individual"], tipo: "Contagem", freq: "A cada carregamento" },
  { key: "melhoria", icone: "🔧", cor: "#0891b2", label: "Pontos de melhoria", mapaKey: "melhoria", ativo: true,
    calculo: "Frequência das alternativas da pergunta mapeada. No Histórico Individual, o que se repete em ciclos seguidos é destacado.",
    visual: "Ranking horizontal", telas: ["Desenvolvimento", "Histórico Individual"], tipo: "Contagem", freq: "A cada carregamento" },

  // ── Liderança ──────────────────────────────────────────────────────
  { key: "indiceLid", icone: "🏅", cor: "#0f3171", label: "Índice de liderança (1–5)", mapaKey: "dimensoes", ativo: true,
    calculo: "Média das dimensões avaliadas, cada uma convertida para 1–5. Resposta que não preencheu nenhuma dimensão fica fora da média (não entra como zero).",
    visual: "Cartão com meta + linha temporal", telas: ["Liderança", "Histórico Individual"], tipo: "Índice 1–5", freq: "A cada carregamento" },
  { key: "distLid", icone: "📊", cor: "#16a34a", label: "Distribuição do índice", mapaKey: "dimensoes", ativo: true,
    calculo: "As avaliações caem em três faixas pelo índice: 4,0–5,0 destaque · 3,0–3,9 atenção · abaixo de 3,0 crítica.",
    visual: "Rosca com legenda", telas: ["Liderança", "Alinhamento e Entrega"], tipo: "Distribuição", freq: "A cada carregamento" },
  { key: "porDimensao", icone: "🧩", cor: "#7c3aed", label: "Índice por dimensão", mapaKey: "dimensoes", ativo: true,
    calculo: "Média 1–5 de cada dimensão isolada. Mostra qual competência puxa o índice para baixo.",
    visual: "Barras horizontais", telas: ["Liderança", "Histórico Individual"], tipo: "Índice 1–5", freq: "A cada carregamento" },
  { key: "porLideranca", icone: "👤", cor: "#ea580c", label: "Ranking por liderança", mapaKey: "lider", ativo: true,
    calculo: "Agrupa as avaliações pela liderança e tira a média. Sem pergunta de liderança mapeada, usa o líder do setor (Setor_ERP + nível, com os ajustes de Líderes por setor).",
    visual: "Tabela ordenada + tops", telas: ["Liderança"], tipo: "Índice 1–5", freq: "A cada carregamento" },
  { key: "evolucao", icone: "📈", cor: "#0891b2", label: "Evolução (variação)", ativo: true,
    calculo: "Série por trimestre (últimos 6). A variação exibida é o último trimestre menos o anterior — com um único trimestre não há variação, e a tela mostra “—”.",
    visual: "Linha temporal", telas: ["Liderança", "Alinhamento e Entrega", "Histórico Individual"], tipo: "Comparativo", freq: "Por ciclo (trimestre)" },

  // ── Alinhamento e Entrega ──────────────────────────────────────────
  { key: "alinhamento", icone: "🎯", cor: "#2563eb", label: "Alinhamento às metas", mapaKey: "alinhamento", ativo: true,
    calculo: "Média 1–5 da pergunta mapeada, com evolução vs. trimestre anterior.",
    visual: "Cartão + linha temporal", telas: ["Alinhamento e Entrega"], tipo: "Índice 1–5", freq: "A cada carregamento" },
  { key: "entrega", icone: "📦", cor: "#16a34a", label: "Nível de entrega", mapaKey: "entrega", ativo: true,
    calculo: "Média 1–5 da pergunta mapeada, com evolução vs. trimestre anterior.",
    visual: "Cartão + linha temporal", telas: ["Alinhamento e Entrega"], tipo: "Índice 1–5", freq: "A cada carregamento" },
  { key: "contribuicao", icone: "🤝", cor: "#7c3aed", label: "Comprometimento / contribuição", mapaKey: "contribuicao", ativo: true,
    calculo: "Média 1–5 da pergunta mapeada, com evolução vs. trimestre anterior.",
    visual: "Cartão + linha temporal", telas: ["Alinhamento e Entrega"], tipo: "Índice 1–5", freq: "A cada carregamento" },
  { key: "indiceAlin", icone: "🧮", cor: "#0f3171", label: "Índice geral de alinhamento", ativo: true,
    calculo: "Média dos três índices acima que a resposta preencheu. Quem respondeu só parte das perguntas entra com o que respondeu.",
    visual: "Cartão + linha temporal", telas: ["Alinhamento e Entrega"], tipo: "Índice 1–5", freq: "A cada carregamento" },
  { key: "metasConcluidas", icone: "✅", cor: "#16a34a", label: "Metas concluídas (%)", mapaKey: "metasConcluidas", ativo: true,
    calculo: "% das respostas que marcaram a PRIMEIRA alternativa da pergunta (a convenção do painel: a 1ª opção é a melhor). Respostas em branco ficam fora da conta.",
    visual: "Cartão com barra de progresso", telas: ["Alinhamento e Entrega"], tipo: "Percentual", freq: "A cada carregamento" },
  { key: "metasPrazo", icone: "⏱️", cor: "#0891b2", label: "Metas no prazo (%)", mapaKey: "metasPrazo", ativo: true,
    calculo: "Mesma regra de “Metas concluídas”: % que marcou a primeira alternativa da pergunta mapeada.",
    visual: "Cartão com barra de progresso", telas: ["Alinhamento e Entrega"], tipo: "Percentual", freq: "A cada carregamento" },
  { key: "porSetor", icone: "🏢", cor: "#ea580c", label: "Índice por setor", ativo: true,
    calculo: "Agrupa por Setor_ERP da resposta. Resposta sem setor é rotulada “Sem setor” e fica FORA dos rankings e dos tops — não é um setor real.",
    visual: "Barras + tabela", telas: ["Alinhamento e Entrega", "Liderança"], tipo: "Índice 1–5", freq: "A cada carregamento" },

  // ── Planos de Ação ─────────────────────────────────────────────────
  { key: "planosTotal", icone: "📋", cor: "#2563eb", label: "Planos de ação (total)", mapaKey: "acaoPlano", ativo: true,
    calculo: "Cada resposta que preencheu a pergunta “ação definida” é um plano. Não se redigita nada: o plano JÁ é a resposta do formulário.",
    visual: "Cartão numérico", telas: ["Planos de Ação"], tipo: "Contagem", freq: "A cada carregamento" },
  { key: "planosVencidos", icone: "🚨", cor: "#dc2626", label: "Planos vencidos / atrasados", mapaKey: "prazoPlano", ativo: true,
    calculo: "Prazo anterior a hoje e o plano não concluído nem cancelado. A situação NÃO é gravada — é derivada de prazo + status + conclusão a cada abertura, senão o número envelhecia da noite para o dia.",
    visual: "Cartão vermelho + ranking", telas: ["Planos de Ação", "Visão Executiva"], tipo: "Contagem", freq: "A cada carregamento" },
  { key: "planosProx", icone: "📆", cor: "#f59e0b", label: "Próximos do prazo (7 dias)", mapaKey: "prazoPlano", ativo: true,
    calculo: "Planos em andamento com vencimento nos próximos 7 dias, contados a partir de hoje.",
    visual: "Lista amarela", telas: ["Planos de Ação"], tipo: "Contagem", freq: "A cada carregamento" },
  { key: "planosAtraso", icone: "⌛", cor: "#0891b2", label: "Média de dias em atraso", ativo: true,
    calculo: "Média dos dias corridos entre o prazo e hoje, só entre os vencidos.",
    visual: "Cartão numérico", telas: ["Planos de Ação"], tipo: "Comparativo", freq: "A cada carregamento" },
  { key: "planosSit", icone: "🗂️", cor: "#7c3aed", label: "Planos por situação / prioridade / origem", ativo: true,
    calculo: "Situação derivada (concluído no prazo, com atraso, em andamento, vencido, sem prazo, cancelado); prioridade e origem vêm do acompanhamento gravado em CS_FORM_PLANOS_ACAO.",
    visual: "Barras empilhadas + rosca", telas: ["Planos de Ação"], tipo: "Distribuição", freq: "A cada carregamento" },
  { key: "planosSemPrazo", icone: "❓", cor: "#a855f7", label: "Planos sem prazo legível", mapaKey: "prazoPlano", ativo: true,
    calculo: "O prazo é lido tanto em 2026-08-10 quanto em 31/07/2026. O que não dá para interpretar entra como “sem prazo” — e a tela avisa, porque 0 vencidos com tudo sem prazo não é boa notícia.",
    visual: "Aviso + lista", telas: ["Planos de Ação"], tipo: "Contagem", freq: "A cada carregamento" },

  // ── Histórico Individual ───────────────────────────────────────────
  { key: "hist", icone: "🧑", cor: "#0f3171", label: "Trajetória do colaborador", mapaKey: "avaliado", ativo: true,
    calculo: "Todos os feedbacks da pessoa em ordem, pela pergunta “colaborador avaliado”. Não usa o respondente: quem preenche o feedback é o líder.",
    visual: "Linha temporal + tabela", telas: ["Histórico Individual"], tipo: "Comparativo", freq: "A cada carregamento" },
  { key: "histMetas", icone: "🥅", cor: "#16a34a", label: "Metas do acompanhamento", ativo: true,
    calculo: "Referências fixas hoje no código: média 4,0 · evolução +0,2 · 4 feedbacks no período · 100% dos planos concluídos · até 15 dias desde o último feedback. Viram configuração quando o RH fechar os números.",
    visual: "Cartões com meta", telas: ["Histórico Individual"], tipo: "Comparativo", freq: "Por ciclo" },

  // ── Visão Executiva ────────────────────────────────────────────────
  { key: "esperados", icone: "👥", cor: "#2563eb", label: "Feedbacks esperados", ativo: true,
    calculo: "Quem o RH definiu que participa do ciclo: Perfil_ERP = ADMINISTRATIVO e Situação = Trabalhando, dentro do recorte de setor. Aqui a situação é ESTRITA — quem está de férias ou afastado não é cobrado por um feedback do período (diferente da régua de liderança, onde férias continua valendo).",
    visual: "Cartão numérico", telas: ["Visão Executiva"], tipo: "Contagem", freq: "A cada carregamento" },
  { key: "realizados", icone: "✔️", cor: "#16a34a", label: "Feedbacks realizados", mapaKey: "avaliado", ativo: true,
    calculo: "Pessoas DISTINTAS do quadro com pelo menos um feedback no período — casadas pelo nome (sem acento e sem caixa) da pergunta “colaborador avaliado”. Três feedbacks da mesma pessoa contam uma vez.",
    visual: "Cartão numérico", telas: ["Visão Executiva"], tipo: "Contagem", freq: "A cada carregamento" },
  { key: "pctRealizacao", icone: "％", cor: "#7c3aed", label: "Taxa de realização", mapaKey: "avaliado", ativo: true,
    calculo: "Realizados ÷ esperados × 100, contra a meta de 100% do período. Feedback de quem não está no quadro ativo NÃO entra — senão a taxa passaria de 100%.",
    visual: "Cartão com meta + linha temporal", telas: ["Visão Executiva"], tipo: "Percentual", freq: "A cada carregamento" },
  { key: "pendentes", icone: "⏳", cor: "#dc2626", label: "Feedbacks pendentes", mapaKey: "avaliado", ativo: true,
    calculo: "Quem está no quadro ativo e não aparece em nenhuma resposta do período. Vem com nome, setor e cargo — e exporta em CSV, que é o que o RH cobra.",
    visual: "Cartão + lista nominal", telas: ["Visão Executiva"], tipo: "Contagem", freq: "A cada carregamento" },
  { key: "porDiretoria", icone: "🏛️", cor: "#ea580c", label: "Realização por diretoria / setor", ativo: true,
    calculo: "Agrupa esperados e realizados pelo diretor responsável pelo setor (RH_SETOR_DIRETOR). Setor sem diretor designado vira a faixa “Sem diretor definido” — esconder daria falsa sensação de cobertura.",
    visual: "Colunas com meta", telas: ["Visão Executiva"], tipo: "Percentual", freq: "A cada carregamento" },
  { key: "necLideranca", icone: "🤝", cor: "#7c3aed", label: "O que se pede da liderança", mapaKey: "necLideranca", ativo: true,
    calculo: "Frequência das alternativas da pergunta sobre o que o colaborador precisa DA liderança — diferente do que ele mesmo precisa desenvolver.",
    visual: "Ranking horizontal", telas: ["Visão Executiva"], tipo: "Contagem", freq: "A cada carregamento" },
  { key: "foraQuadro", icone: "❓", cor: "#0891b2", label: "Feedbacks fora do quadro", mapaKey: "avaliado", ativo: true,
    calculo: "Respostas cujo avaliado não bate com ninguém do quadro esperado: outro perfil, afastado, desligado depois do feedback, nome digitado diferente ou setor fora do filtro. Fica visível, mas fora da taxa.",
    visual: "Barra + alerta", telas: ["Visão Executiva"], tipo: "Contagem", freq: "A cada carregamento" },
  { key: "alertas", icone: "🚨", cor: "#dc2626", label: "Alertas críticos e insights", ativo: true,
    calculo: "Derivados dos próprios indicadores: pendentes, planos vencidos, pior faixa de situação profissional, menor cobertura entre as diretorias e setores sem diretor. Cada alerta leva à aba que resolve.",
    visual: "Lista clicável", telas: ["Visão Executiva"], tipo: "Contagem", freq: "A cada carregamento" },

  // ── Ainda não implementados ────────────────────────────────────────
  { key: "cumprimento", icone: "📌", cor: "#94a3b8", label: "Cumprimento por líder",
    calculo: "A mesma régua de esperados/realizados, mas quebrada por liderança e com o histórico de cada ciclo. A Visão Executiva já entrega o consolidado.",
    visual: "Lista ordenada por líder", telas: ["Cumprimento"], tipo: "Percentual", freq: "A cada carregamento" },
  { key: "reincidencia", icone: "🔁", cor: "#94a3b8", label: "Reincidência",
    calculo: "Mesmo ponto de melhoria ou necessidade em dois ciclos seguidos. O Histórico Individual já marca recorrência por pessoa; falta o consolidado do painel.",
    visual: "Lista de atenção", telas: ["Desenvolvimento", "Visão Executiva"], tipo: "Contagem", freq: "Por ciclo" },
];

// Regras de leitura de gráfico — o porquê de cada escolha visual do painel.
const REGRAS_GRAFICO = [
  { tipo: "Barras / colunas", quando: "Comparar valores entre categorias ou áreas.", carac: "Quantificação fácil, comparação visual direta." },
  { tipo: "Pizza / rosca", quando: "Mostrar proporção de um todo (até ~6 fatias).", carac: "Legenda ao lado, nunca rótulo dentro — texto longo estoura o card." },
  { tipo: "Linhas", quando: "Evolução no tempo (trimestres).", carac: "Evidencia tendência; precisa de 2+ pontos para significar algo." },
  { tipo: "Cartões", quando: "Destacar número-chave e meta.", carac: "Leitura rápida, com variação vs. período anterior." },
  { tipo: "Listas e tabelas", quando: "Detalhe, ranking e texto.", carac: "É onde o gestor age — clicável para o caso a caso." },
];

const ALERTAS = [
  { cor: "#dc2626", nome: "Vermelho (crítico)", desc: "Índice abaixo de 3,0 ou plano vencido.", comp: "Destaque no topo do painel; entra nos alertas da aba." },
  { cor: "#f59e0b", nome: "Laranja (atenção)", desc: "Índice de 3,0 a 3,9, ou prazo nos próximos 7 dias.", comp: "Alerta visível, sem urgência imediata." },
  { cor: "#eab308", nome: "Amarelo (acompanhar)", desc: "Queda vs. trimestre anterior, ainda dentro da faixa boa.", comp: "Indicação discreta na variação." },
  { cor: "#2563eb", nome: "Azul (informativo)", desc: "Contagens e tendências sem julgamento.", comp: "Exibição informativa." },
  { cor: "#16a34a", nome: "Verde (ok)", desc: "Índice 4,0 ou mais; plano concluído no prazo.", comp: "Sem alerta, somente registro." },
];

const ORIGENS_DADOS = [
  { icone: "📝", cor: "#2563eb", fonte: "CS_FORMULARIOS", desc: "Formulário selecionado, suas perguntas e alternativas. Formulário na lixeira não entra." },
  { icone: "📥", cor: "#16a34a", fonte: "CS_FORM_RESPOSTAS", desc: "Todas as respostas: itens, setor e data de envio. É a base de quase todo indicador." },
  { icone: "📋", cor: "#7c3aed", fonte: "CS_FORM_PLANOS_ACAO", desc: "Só o acompanhamento do plano (status, prioridade, origem, conclusão). A ação e o prazo vêm da resposta." },
  { icone: "👥", cor: "#ea580c", fonte: "EMPREGADOS (via rh_hierarquia_dados)", desc: "Setor, nível e situação — quem está ativo e quem lidera cada setor." },
  { icone: "🧭", cor: "#0891b2", fonte: "CS_LIDERES_SETOR · RH_SETOR_DIRETOR", desc: "Ajustes manuais de quem responde pelo setor e de qual diretor cuida dele." },
];

function Chip({ texto, cor, titulo }: { texto: string; cor: string; titulo?: string }) {
  return <span title={titulo} style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: cor + "1a", color: cor, whiteSpace: "nowrap", display: "inline-block" }}>{texto}</span>;
}

function Secao({ n, titulo, hint, children, style }: { n: string; titulo: string; hint?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...cardBox, padding: 0, overflow: "hidden", ...style }}>
      <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f3171", letterSpacing: ".3px" }}>
          <span style={{ color: "#cbd5e1", marginRight: 6 }}>{n}.</span>{titulo}
        </div>
        {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, lineHeight: 1.45 }}>{hint}</div>}
      </div>
      <div style={{ padding: "12px 16px 14px" }}>{children}</div>
    </div>
  );
}

export default function IndicadoresCalculos({ pergs, mapa, ultima, onAbrirMapa, onIrTab, temForm }: {
  pergs: Pergunta[];
  mapa: Record<string, any>;
  ultima: string;
  onAbrirMapa: () => void;
  onIrTab: (tab: string) => void;
  temForm: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [fTela, setFTela] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);

  const tituloPergunta = (id: string) => pergs.find(p => p.id === id)?.titulo || "(pergunta sem título)";

  // Como cada indicador está mapeado NO FORMULÁRIO SELECIONADO. É o que
  // transforma o catálogo em diagnóstico: card vazio quase sempre é indicador
  // sem pergunta apontada.
  const mapeamento = useMemo(() => {
    const m = new Map<string, { texto: string; ok: boolean }>();
    CATALOGO.forEach(i => {
      if (!i.mapaKey) return;
      const v = mapa[i.mapaKey];
      if (i.mapaKey === "dimensoes") {
        const ids = (v ?? []) as string[];
        m.set(i.key, ids.length
          ? { texto: `${ids.length} dimensão(ões): ${ids.map(tituloPergunta).join(" · ")}`, ok: true }
          : { texto: "Nenhuma dimensão marcada", ok: false });
        return;
      }
      m.set(i.key, v ? { texto: tituloPergunta(String(v)), ok: true } : { texto: "Nenhuma pergunta apontada", ok: false });
    });
    return m;
  }, [mapa, pergs]);

  const telas = useMemo(() => [...new Set(CATALOGO.flatMap(i => i.telas))].sort((a, b) => a.localeCompare(b, "pt-BR")), []);

  const vis = useMemo(() => {
    const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    return CATALOGO.filter(i => {
      const alvo = `${i.label} ${i.calculo} ${i.telas.join(" ")} ${i.tipo}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const pend = i.ativo && mapeamento.get(i.key) && !mapeamento.get(i.key)!.ok;
      return (!q || alvo.includes(q)) && (!fTela || i.telas.includes(fTela)) && (!soPendentes || pend);
    });
  }, [busca, fTela, soPendentes, mapeamento]);

  const ativos = CATALOGO.filter(i => i.ativo).length;
  const pendentes = CATALOGO.filter(i => i.ativo && mapeamento.get(i.key) && !mapeamento.get(i.key)!.ok).length;

  const exportar = () => {
    const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const L = [["Indicador", "Status", "Cálculo / Origem", "Pergunta que alimenta", "Visual", "Telas", "Tipo", "Frequência"]];
    CATALOGO.forEach(i => L.push([
      i.label, i.ativo ? "Ativo" : "Em breve", i.calculo,
      i.mapaKey ? (mapeamento.get(i.key)?.texto ?? "") : "Não depende de mapeamento",
      i.visual, i.telas.join(" / "), i.tipo, i.freq,
    ]));
    const csv = "﻿" + L.map(l => l.map(esc).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "indicadores-e-calculos.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <style>{CSS_IC}</style>

      {/* Título da seção + exportar (mesmo cabeçalho das outras abas) */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "#0f172a" }}>INDICADORES E CÁLCULOS</div>
          <div style={{ fontSize: 12.5, color: "#64748b" }}>Como cada indicador é calculado, de onde vem o dado e onde ele aparece no painel.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "right", lineHeight: 1.4 }}>
            Última atualização<br /><b style={{ color: "#475569" }}>{ultima}</b>
          </div>
          <button onClick={exportar} style={btn("#fff", "#0f3171", "1px solid #0f3171")}>⬇ Exportar relatório</button>
        </div>
      </div>

      {/* Barra de contexto: o que está ativo, o que falta mapear */}
      <div style={{ ...cardBox, background: "#f8fbff", borderColor: "#dbeafe", marginBottom: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, fontSize: 11.5, color: "#475569", lineHeight: 1.5 }}>
          <b style={{ color: "#0f3171" }}>{ativos}</b> indicadores ativos e <b>{CATALOGO.length - ativos}</b> previstos.{" "}
          {!temForm ? "Selecione um formulário para ver quais perguntas alimentam cada um."
            : pendentes > 0 ? <>Neste formulário, <b style={{ color: "#b45309" }}>{pendentes}</b> indicador(es) ativo(s) estão sem pergunta apontada — é por isso que o card aparece vazio.</>
            : "Todos os indicadores ativos têm pergunta apontada neste formulário."}
        </div>
        <button onClick={onAbrirMapa} style={btn("#0f3171")}>⚙ Ajustar mapeamento</button>
      </div>

      <div className="ic-grid">
        {/* ── 9. Catálogo ── */}
        <Secao n="9" titulo="INDICADORES E REGRAS DE CÁLCULO"
          hint="Cada linha é um número do painel. “Pergunta que alimenta” mostra o mapeamento do formulário selecionado.">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔎 Buscar indicador, regra ou tela…" style={inp} />
            </div>
            <select value={fTela} onChange={e => setFTela(e.target.value)} style={{ ...inp, width: "auto", minWidth: 170 }}>
              <option value="">Todas as telas</option>
              {telas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#475569", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={soPendentes} onChange={e => setSoPendentes(e.target.checked)} />
              Só sem mapeamento
            </label>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="ic-tab" style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead><tr>
                <th style={{ ...th, minWidth: 168 }}>Indicador</th>
                <th style={{ ...th, minWidth: 250 }}>Cálculo / Origem</th>
                <th style={{ ...th, minWidth: 120 }}>Visual</th>
                <th style={{ ...th, minWidth: 130 }}>Telas onde aparece</th>
                <th style={{ ...th, minWidth: 92 }}>Tipo</th>
                <th style={{ ...th, minWidth: 100 }}>Atualização</th>
              </tr></thead>
              <tbody>
                {vis.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 26 }}>Nenhum indicador no filtro.</td></tr>
                ) : vis.map(i => {
                  const mp = i.mapaKey ? mapeamento.get(i.key) : undefined;
                  return (
                    <tr key={i.key} style={{ opacity: i.ativo ? 1 : .72 }}>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <span style={{ width: 26, height: 26, borderRadius: 8, background: i.cor + "18", color: i.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{i.icone}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{i.label}</div>
                            {!i.ativo && <div style={{ marginTop: 3 }}><Chip texto="Em breve" cor="#94a3b8" titulo="Ainda não implementado no painel" /></div>}
                            {i.ativo && mp && (
                              <div style={{ marginTop: 3, fontSize: 10.5, color: mp.ok ? "#94a3b8" : "#b45309", lineHeight: 1.4 }} title={mp.texto}>
                                {mp.ok ? "↳ " : "⚠ "}{mp.texto.length > 64 ? mp.texto.slice(0, 64) + "…" : mp.texto}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={td}>{i.calculo}</td>
                      <td style={td}><Chip texto={i.visual} cor="#16a34a" /></td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {i.telas.map(t => (
                            <span key={t} onClick={() => onIrTab(t)} title={`Ir para ${t}`}
                              style={{ fontSize: 10, color: "#0f3171", background: "#eef4ff", borderRadius: 20, padding: "2px 8px", cursor: "pointer", fontWeight: 700 }}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td style={td}><Chip texto={i.tipo} cor={COR_TIPO[i.tipo]} /></td>
                      <td style={{ ...td, fontSize: 11 }}>{i.freq}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 10 }}>
            Mostrando {vis.length} de {CATALOGO.length} indicadores. Clique numa tela para ir direto até ela.
          </div>
        </Secao>

        {/* Coluna direita: fórmulas, gráficos, alertas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Secao n="10" titulo="COMO A NOTA 1–5 É CALCULADA"
            hint="Toda pergunta vira nota antes de entrar em qualquer média.">
            <div style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.6 }}>
              <div style={{ background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 10, padding: "9px 11px", marginBottom: 9 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>Pergunta de escala</div>
                <code style={{ fontSize: 11, color: "#0f3171" }}>nota = 1 + (valor − mín) ÷ (máx − mín) × 4</code>
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>Uma escala 0–10 e outra 1–5 acabam na mesma régua.</div>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 10, padding: "9px 11px", marginBottom: 9 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>Pergunta de opções</div>
                <code style={{ fontSize: 11, color: "#0f3171" }}>nota = 5 − (posição ÷ (nº opções − 1)) × 4</code>
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>
                  Assume as alternativas escritas <b>da melhor para a pior</b>. Se o formulário inverter a ordem, o índice inverte junto — vale conferir antes de cobrar alguém pelo número.
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip texto="4,0 a 5,0 · destaque" cor="#16a34a" />
                <Chip texto="3,0 a 3,9 · atenção" cor="#f59e0b" />
                <Chip texto="abaixo de 3,0 · crítico" cor="#dc2626" />
              </div>
            </div>
          </Secao>

          <Secao n="11" titulo="REGRA DE USO DOS GRÁFICOS">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REGRAS_GRAFICO.map(r => (
                <div key={r.tipo} style={{ borderLeft: "3px solid #dbeafe", paddingLeft: 9 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>{r.tipo}</div>
                  <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.45 }}>{r.quando}</div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.45 }}>{r.carac}</div>
                </div>
              ))}
            </div>
          </Secao>

          <Secao n="12" titulo="ALERTAS, CORES E PRIORIDADES">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ALERTAS.map(a => (
                <div key={a.nome} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: a.cor, flexShrink: 0, marginTop: 3 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>{a.nome}</div>
                    <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.45 }}>{a.desc}</div>
                    <div style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.45 }}>{a.comp}</div>
                  </div>
                </div>
              ))}
            </div>
          </Secao>
        </div>
      </div>

      {/* ── Rodapé: observações + origem dos dados ── */}
      <div className="ic-rodape" style={{ marginTop: 14 }}>
        <Secao n="13" titulo="OBSERVAÇÕES IMPORTANTES">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: "#475569", lineHeight: 1.75 }}>
            <li>Os números são calculados <b>na hora em que a tela abre</b>, direto das respostas — não existe fechamento noturno para “esperar”.</li>
            <li>Todos os cálculos respeitam os <b>filtros do topo</b> (período, setor, colaborador). Trocar um filtro muda todo indicador da aba.</li>
            <li>Só entram <b>colaboradores ativos</b>. Férias, atestado e afastamento continuam ativos; demissão, rescisão e aposentadoria saem.</li>
            <li>Resposta <b>sem setor</b> aparece rotulada “Sem setor” e fica fora de rankings e tops — não é um setor de verdade.</li>
            <li>A variação (“evolução”) compara <b>trimestres</b>. Formulário com um único trimestre de respostas mostra “—”, não zero.</li>
            <li>O <b>mapeamento pergunta→indicador</b> fica salvo neste navegador, por formulário. Em outro computador pode estar diferente — se um card vier vazio, confira o mapeamento antes de suspeitar do dado.</li>
            <li>Plano de ação <b>não se redigita</b>: a ação e o prazo já são respostas do formulário. Aqui só se acompanha o andamento.</li>
          </ul>
        </Secao>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Secao n="14" titulo="ORIGEM DOS DADOS">
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {ORIGENS_DADOS.map(o => (
                <div key={o.fonte} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: o.cor + "18", color: o.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{o.icone}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>{o.fonte}</div>
                    <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.45 }}>{o.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Secao>

          <Secao n="15" titulo="ACESSOS RELACIONADOS">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button onClick={onAbrirMapa} style={{ ...btn("#f8fbff", "#0f3171", "1px solid #dbeafe"), textAlign: "left", width: "100%" }}>
                ⚙ Mapeamento de perguntas <span style={{ float: "right", color: "#94a3b8" }}>›</span>
              </button>
              {["Desenvolvimento", "Liderança", "Alinhamento e Entrega", "Planos de Ação", "Histórico Individual"].map(t => (
                <button key={t} onClick={() => onIrTab(t)} style={{ ...btn("#fff", "#475569", "1px solid #e2e8f0"), textAlign: "left", width: "100%" }}>
                  {t} <span style={{ float: "right", color: "#cbd5e1" }}>›</span>
                </button>
              ))}
            </div>
          </Secao>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 16 }}>
        ⓘ Em caso de dúvida sobre um cálculo, confira aqui a pergunta que alimenta o indicador antes de acionar a Gestão de Pessoas.
      </div>
    </>
  );
}
