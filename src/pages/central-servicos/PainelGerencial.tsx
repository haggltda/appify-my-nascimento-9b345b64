import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from "recharts";
import { Formulario, Pergunta, normalizaPerguntas } from "./Formularios";

// =====================================================================
// PAINEL GERENCIAL — Nascimento Formulários (feedbacks)
// Painel de BI sobre UM formulário de feedback. Submódulos em abas; nesta
// versão a aba DESENVOLVIMENTO está implementada (as demais entram depois).
// O mapeamento pergunta→indicador é auto (palavra-chave) e ajustável na tela;
// fica salvo por formulário no navegador (localStorage) — sem tocar no banco.
// =====================================================================

const CORES = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#ea580c", "#64748b", "#0f3171"];
const CAT_CORES = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#64748b"];  // situação: desenvolvimento/pronto/acompanhamento/risco/outros
const CHART_TIPOS = ["multipla_escolha", "caixas_selecao", "lista_suspensa", "escala", "escala_trabalho"];
type Viz = "barras" | "colunas" | "pizza" | "rosca" | "linha" | "area";
const VIZ_OPCOES: { v: Viz; r: string }[] = [
  { v: "barras", r: "Barras" }, { v: "colunas", r: "Colunas" }, { v: "pizza", r: "Pizza" },
  { v: "rosca", r: "Rosca" }, { v: "linha", r: "Linha" }, { v: "area", r: "Área" },
];

const TABS = ["Visão Executiva", "Cumprimento", "Desenvolvimento", "Liderança", "Alinhamento e Entrega", "Planos de Ação", "Histórico Individual"];

interface Resp { id: string; formulario_id: string; enviado_em: string; respondente_nome?: string | null; setor?: string | null; itens: Record<string, any>; }

const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "7px 13px", borderRadius: 9, border, background: bg, color: c, fontSize: 12.5, fontWeight: 700, cursor: "pointer" });
const inp: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", color: "#0f172a" };
const lbl: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// indicadores de DESENVOLVIMENTO e as palavras-chave para o auto-mapeamento.
const IND: { key: string; label: string; kw: string[] }[] = [
  { key: "situacao", label: "Situação profissional", kw: ["situacao", "como voce acredita", "acredita que est", "nivel prof", "visao do liderado"] },
  { key: "necessidades", label: "Necessidades de desenvolvimento", kw: ["dificuldade", "necessidade", "precisa desenvolver"] },
  { key: "fortes", label: "Pontos fortes", kw: ["fazendo bem", "ponto forte", "faz bem", "pontos fortes"] },
  { key: "melhoria", label: "Pontos de melhoria", kw: ["precisa melhorar", "melhorar", "melhoria", "sente que precisa"] },
];
// Indicadores da aba ALINHAMENTO E ENTREGA (todos viram nota 1..5).
const IND_ALIN: { key: string; label: string; kw: string[]; opcional?: boolean }[] = [
  { key: "alinhamento", label: "Alinhamento às metas", kw: ["alinhad", "alinhamento", "visao do liderado", "meta"] },
  { key: "entrega", label: "Qualidade da entrega", kw: ["entrega", "nivel de entrega", "qualidade"] },
  { key: "contribuicao", label: "Contribuição para resultados", kw: ["comprometimento", "contribui", "resultado"] },
  { key: "metasConcluidas", label: "Metas concluídas (opcional)", kw: ["meta concluida", "metas concluidas", "concluiu"], opcional: true },
  { key: "metasPrazo", label: "Metas no prazo (opcional)", kw: ["no prazo", "dentro do prazo", "prazo"], opcional: true },
];

type Mapa = Record<string, any>;  // singles = id da pergunta; dimensoes = string[]

function autoMapa(pergs: Pergunta[]): Mapa {
  const m: Mapa = {};
  const chart = pergs.filter(p => CHART_TIPOS.includes(p.tipo));
  for (const ind of IND) {
    const achou = chart.find(p => ind.kw.some(k => semAcento(p.titulo || "").includes(k)));
    if (achou) m[ind.key] = achou.id;
  }
  // LIDERANÇA: quem é a liderança avaliada (pergunta do tipo colaborador) …
  const lid = pergs.find(p => p.tipo === "colaborador" && /lideranc|lider/.test(semAcento(p.titulo || "")))
    ?? pergs.find(p => p.tipo === "colaborador");
  if (lid) m.lider = lid.id;
  // … e as dimensões avaliadas: escalas (ideal) ou perguntas "o nível/como está".
  const escalas = pergs.filter(p => p.tipo === "escala");
  const ordinais = pergs.filter(p => ["multipla_escolha", "lista_suspensa"].includes(p.tipo)
    && /nivel|como est|avalia|visao do liderado|comprometimento|entrega/.test(semAcento(p.titulo || "")));
  const dims = (escalas.length ? escalas : ordinais).map(p => p.id);
  if (dims.length) m.dimensoes = dims;
  // ALINHAMENTO E ENTREGA: cada indicador é uma pergunta ordinal/escala.
  const notaveis = pergs.filter(p => ["escala", "multipla_escolha", "lista_suspensa"].includes(p.tipo));
  for (const ind of IND_ALIN) {
    const achou = notaveis.find(p => ind.kw.some(k => semAcento(p.titulo || "").includes(k)));
    if (achou) m[ind.key] = achou.id;
  }
  return m;
}

// Converte a resposta de uma pergunta em nota 1..5.
// Escala: normaliza min..max. Opções: assume ordenadas da MELHOR para a PIOR
// (1ª opção = 5, última = 1) — é como os formulários de feedback são escritos.
function nota(p: Pergunta, valor: string): number | null {
  if (!valor) return null;
  if (p.tipo === "escala") {
    const n = Number(valor); if (isNaN(n)) return null;
    const min = p.config?.min ?? 1, max = p.config?.max ?? 5;
    return max === min ? null : 1 + ((n - min) / (max - min)) * 4;
  }
  const i = p.opcoes.indexOf(valor);
  if (i < 0 || p.opcoes.length < 2) return null;
  return 5 - (i / (p.opcoes.length - 1)) * 4;
}
const faixa = (n: number) => n >= 4 ? "destaque" : n >= 3 ? "atencao" : "critica";

function distrib(p: Pergunta | undefined, resps: Resp[]) {
  if (!p) return [] as { nome: string; completo: string; n: number }[];
  const cont: Record<string, number> = {};
  resps.forEach(r => { const v = r.itens[p.id]; if (v == null || v === "") return; (Array.isArray(v) ? v : [v]).forEach(x => { cont[String(x)] = (cont[String(x)] || 0) + 1; }); });
  let chaves: string[];
  if (p.tipo === "escala") { chaves = []; for (let n = p.config?.min ?? 1; n <= (p.config?.max ?? 5); n++) chaves.push(String(n)); }
  else chaves = p.opcoes.length ? p.opcoes : Object.keys(cont);
  return chaves.map(k => ({ nome: k.length > 24 ? k.slice(0, 24) + "…" : k, completo: k, n: cont[k] || 0 }));
}
const trimestre = (iso: string) => { const d = new Date(iso); return `${Math.floor(d.getMonth() / 3) + 1}º Tri/${String(d.getFullYear()).slice(2)}`; };
const respValor = (r: Resp, pid?: string) => { if (!pid) return ""; const v = r.itens[pid]; return v == null ? "" : String(Array.isArray(v) ? v[0] : v); };
// Resposta sem setor = respondente anônimo/sem vínculo E formulário sem pergunta
// de setor. Não é um setor real: aparece rotulada, mas fica fora dos rankings.
const SEM_SETOR = "Sem setor";
const setorDe = (r: Resp) => (r.setor ?? "").trim() || SEM_SETOR;

function mediaNota(p: Pergunta | undefined, resps: Resp[]): number | null {
  if (!p) return null;
  const ns = resps.map(r => nota(p, respValor(r, p.id))).filter((x): x is number => x != null);
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
}

function serieTrimestre(resps: Resp[], valor: (r: Resp) => number | null) {
  const porTri: Record<string, { soma: number; n: number; o: number }> = {};
  resps.forEach(r => {
    const v = valor(r); if (v == null) return;
    const t = trimestre(r.enviado_em);
    (porTri[t] ??= { soma: 0, n: 0, o: +new Date(r.enviado_em) }); porTri[t].soma += v; porTri[t].n++;
  });
  return Object.entries(porTri).map(([t, v]) => ({ tri: t, valor: +(v.soma / v.n).toFixed(2), _o: v.o }))
    .sort((a, b) => a._o - b._o).slice(-6);
}
const deltaSerie = (s: { valor: number }[]) => s.length > 1 ? s[s.length - 1].valor - s[s.length - 2].valor : null;

// Agrupa por chave (líder, setor…) com média e evolução vs. trimestre anterior.
function agrupaMedia(resps: Resp[], chave: (r: Resp) => string, valor: (r: Resp) => number | null) {
  const tot: Record<string, { soma: number; n: number }> = {};
  const tris: Record<string, Record<string, { soma: number; n: number; o: number }>> = {};
  resps.forEach(r => {
    const k = (chave(r) || "").trim(); if (!k) return;
    const v = valor(r); if (v == null) return;
    (tot[k] ??= { soma: 0, n: 0 }); tot[k].soma += v; tot[k].n++;
    const t = trimestre(r.enviado_em);
    ((tris[k] ??= {})[t] ??= { soma: 0, n: 0, o: +new Date(r.enviado_em) }); tris[k][t].soma += v; tris[k][t].n++;
  });
  return Object.entries(tot).map(([k, g]) => {
    const ts = Object.entries(tris[k] ?? {}).sort((a, b) => a[1].o - b[1].o);
    const ult = ts[ts.length - 1], ant = ts[ts.length - 2];
    const evol = ult && ant ? (ult[1].soma / ult[1].n) - (ant[1].soma / ant[1].n) : null;
    return { chave: k, media: g.soma / g.n, n: g.n, evol };
  }).sort((a, b) => b.media - a.media);
}

// % das respostas que marcaram a 1ª opção (ex.: "Sim" / "Concluída" / "No prazo").
function pctPrimeiraOpcao(p: Pergunta | undefined, resps: Resp[]): number | null {
  if (!p || !p.opcoes.length) return null;
  const vals = resps.map(r => respValor(r, p.id)).filter(Boolean);
  return vals.length ? (vals.filter(v => v === p.opcoes[0]).length / vals.length) * 100 : null;
}

export default function PainelGerencial() {
  const nav = useNavigate();
  const [forms, setForms] = useState<Formulario[]>([]);
  const [resps, setResps] = useState<Resp[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Desenvolvimento");
  const [formSel, setFormSel] = useState("");
  const [mapa, setMapa] = useState<Mapa>({});
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [viz, setViz] = useState<Record<string, Viz>>({ necessidades: "barras", distribuicao: "rosca", fortes: "barras", melhoria: "barras", evolucao: "linha" });
  // filtros
  const [periodo, setPeriodo] = useState<"todos" | "90" | "180" | "365">("todos");
  const [fSetor, setFSetor] = useState("");
  const [fResp, setFResp] = useState("");
  const [fSituacao, setFSituacao] = useState("");
  const [fNecessidade, setFNecessidade] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [fRes, rRes] = await Promise.all([
      (supabase as any).from("CS_FORMULARIOS").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      (supabase as any).from("CS_FORM_RESPOSTAS").select("id, formulario_id, enviado_em, respondente_nome, setor, itens").order("enviado_em", { ascending: false }).limit(10000),
    ]);
    const fs: Formulario[] = fRes.data ?? [];
    setForms(fs);
    setResps((rRes.data ?? []).map((r: any) => ({ ...r, itens: r.itens ?? {} })));
    // formulário padrão: o que tiver "feedback" no título, senão o primeiro.
    const padrao = fs.find(f => /feedback/i.test(f.titulo)) ?? fs[0];
    if (padrao) setFormSel(prev => prev || padrao.id);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const form = useMemo(() => forms.find(f => f.id === formSel) ?? null, [forms, formSel]);
  const pergs = useMemo(() => form ? normalizaPerguntas(form.perguntas) : [], [form]);

  // carrega/gera o mapeamento ao trocar de formulário (localStorage por form).
  useEffect(() => {
    if (!form) return;
    let salvo: Mapa = {};
    try { salvo = JSON.parse(localStorage.getItem("painel_map_" + form.id) || "{}"); } catch { salvo = {}; }
    const auto = autoMapa(pergs);
    setMapa({ ...auto, ...salvo });
  }, [form, pergs]);
  const salvarMapa = (m: Mapa) => { setMapa(m); if (form) try { localStorage.setItem("painel_map_" + form.id, JSON.stringify(m)); } catch { /* ignore */ } };
  const pq = (key: string) => pergs.find(p => p.id === mapa[key]);

  // respostas do formulário + filtros (setor/respondente/período aplicam a tudo)
  const respsForm = useMemo(() => resps.filter(r => r.formulario_id === formSel), [resps, formSel]);
  const base = useMemo(() => {
    let rs = respsForm;
    const dias = periodo === "todos" ? 0 : Number(periodo);
    if (dias) { const corte = Date.now() - dias * 86400000; rs = rs.filter(r => +new Date(r.enviado_em) >= corte); }
    if (fSetor) rs = rs.filter(r => (r.setor ?? "") === fSetor);
    const q = fResp.trim().toLowerCase();
    if (q) rs = rs.filter(r => (r.respondente_nome ?? "").toLowerCase().includes(q));
    return rs;
  }, [respsForm, periodo, fSetor, fResp]);
  // recorte final também respeita situação/necessidade (filtros específicos)
  const filtradas = useMemo(() => {
    let rs = base;
    if (fSituacao) rs = rs.filter(r => respValor(r, mapa.situacao) === fSituacao);
    if (fNecessidade) rs = rs.filter(r => { const v = r.itens[mapa.necessidades ?? ""]; return (Array.isArray(v) ? v : [v]).map(String).includes(fNecessidade); });
    return rs;
  }, [base, fSituacao, fNecessidade, mapa]);

  const setores = useMemo(() => [...new Set(respsForm.map(r => (r.setor ?? "").trim()).filter(Boolean))].sort(), [respsForm]);
  const distSituacao = useMemo(() => distrib(pq("situacao"), filtradas), [pergs, mapa, filtradas]);
  const distNecess = useMemo(() => distrib(pq("necessidades"), filtradas), [pergs, mapa, filtradas]);
  const distFortes = useMemo(() => distrib(pq("fortes"), filtradas), [pergs, mapa, filtradas]);
  const distMelhoria = useMemo(() => distrib(pq("melhoria"), filtradas), [pergs, mapa, filtradas]);

  // evolução da situação por trimestre (usa base, sem o filtro de situação)
  const evolucao = useMemo(() => {
    const sitP = pq("situacao"); if (!sitP) return { data: [] as any[], cats: [] as string[] };
    const cats = (sitP.opcoes.length ? sitP.opcoes : [...new Set(base.map(r => respValor(r, sitP.id)).filter(Boolean))]).slice(0, 5);
    const porTri: Record<string, any> = {};
    base.forEach(r => { const t = trimestre(r.enviado_em); const v = respValor(r, sitP.id); if (!v) return; (porTri[t] ??= { tri: t, _ord: +new Date(r.enviado_em) }); porTri[t][v] = (porTri[t][v] || 0) + 1; });
    const data = Object.values(porTri).sort((a: any, b: any) => a._ord - b._ord).slice(-6);
    return { data, cats };
  }, [pergs, mapa, base]);

  const totalMenc = (d: { n: number }[]) => d.reduce((s, x) => s + x.n, 0);
  const topNecessPorSetor = useMemo(() => {
    const nP = pq("necessidades"); if (!nP) return [] as { setor: string; nec: string; n: number }[];
    const porSetor: Record<string, Record<string, number>> = {};
    filtradas.forEach(r => { const s = setorDe(r); const v = r.itens[nP.id]; (Array.isArray(v) ? v : [v]).forEach((x: any) => { if (x == null || x === "") return; (porSetor[s] ??= {}); porSetor[s][String(x)] = (porSetor[s][String(x)] || 0) + 1; }); });
    return Object.entries(porSetor).map(([setor, cont]) => { const top = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]; return { setor, nec: top?.[0] ?? "—", n: top?.[1] ?? 0 }; }).sort((a, b) => b.n - a.n).slice(0, 6);
  }, [pergs, mapa, filtradas]);

  // ── LIDERANÇA ────────────────────────────────────────────────────────
  const dimsPergs = useMemo(() => ((mapa.dimensoes ?? []) as string[])
    .map(id => pergs.find(p => p.id === id)).filter(Boolean) as Pergunta[], [pergs, mapa]);
  // nota de uma resposta = média das dimensões que ela respondeu (1..5)
  const notaResp = useCallback((r: Resp) => {
    const ns = dimsPergs.map(p => nota(p, respValor(r, p.id))).filter((x): x is number => x != null);
    return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
  }, [dimsPergs]);

  const indiceGeral = useMemo(() => {
    const ns = filtradas.map(notaResp).filter((x): x is number => x != null);
    return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
  }, [filtradas, notaResp]);

  const porDimensao = useMemo(() => dimsPergs.map(p => {
    const ns = filtradas.map(r => nota(p, respValor(r, p.id))).filter((x): x is number => x != null);
    const t = p.titulo || "—";
    return { nome: t.length > 34 ? t.slice(0, 34) + "…" : t, completo: t, valor: ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0, n: ns.length };
  }).sort((a, b) => b.valor - a.valor), [dimsPergs, filtradas]);

  const porLideranca = useMemo(() => {
    const lp = pq("lider"); if (!lp) return [] as { lider: string; indice: number; n: number; evol: number | null }[];
    const grupos: Record<string, { soma: number; n: number }> = {};
    const tris: Record<string, Record<string, { soma: number; n: number }>> = {};
    filtradas.forEach(r => {
      const quem = respValor(r, lp.id); if (!quem) return;
      const nt = notaResp(r); if (nt == null) return;
      (grupos[quem] ??= { soma: 0, n: 0 }); grupos[quem].soma += nt; grupos[quem].n++;
      const t = trimestre(r.enviado_em);
      ((tris[quem] ??= {})[t] ??= { soma: 0, n: 0 }); tris[quem][t].soma += nt; tris[quem][t].n++;
    });
    const ordemTri = [...new Set(filtradas.map(r => ({ t: trimestre(r.enviado_em), o: +new Date(r.enviado_em) }))
      .sort((a, b) => a.o - b.o).map(x => x.t))];
    return Object.entries(grupos).map(([lider, g]) => {
      const ts = tris[lider] ?? {};
      const pres = ordemTri.filter(t => ts[t]);
      const ult = pres[pres.length - 1], ant = pres[pres.length - 2];
      const evol = ult && ant ? (ts[ult].soma / ts[ult].n) - (ts[ant].soma / ts[ant].n) : null;
      return { lider, indice: g.soma / g.n, n: g.n, evol };
    }).sort((a, b) => b.indice - a.indice);
  }, [pergs, mapa, filtradas, notaResp]);

  const distLideranca = useMemo(() => {
    const c = { destaque: 0, atencao: 0, critica: 0 };
    porLideranca.forEach(l => { c[faixa(l.indice) as keyof typeof c]++; });
    return [
      { nome: "Acima de 4,0", completo: "Acima de 4,0", n: c.destaque },
      { nome: "Entre 3,0 e 4,0", completo: "Entre 3,0 e 4,0", n: c.atencao },
      { nome: "Abaixo de 3,0", completo: "Abaixo de 3,0", n: c.critica },
    ];
  }, [porLideranca]);

  const evolIndice = useMemo(() => {
    const porTri: Record<string, { soma: number; n: number; o: number }> = {};
    filtradas.forEach(r => { const nt = notaResp(r); if (nt == null) return; const t = trimestre(r.enviado_em); (porTri[t] ??= { soma: 0, n: 0, o: +new Date(r.enviado_em) }); porTri[t].soma += nt; porTri[t].n++; });
    return Object.entries(porTri).map(([t, v]) => ({ tri: t, indice: +(v.soma / v.n).toFixed(2), _o: v.o })).sort((a, b) => a._o - b._o).slice(-6);
  }, [filtradas, notaResp]);
  const deltaIndice = evolIndice.length > 1 ? evolIndice[evolIndice.length - 1].indice - evolIndice[evolIndice.length - 2].indice : null;
  const avaliados = useMemo(() => filtradas.filter(r => notaResp(r) != null).length, [filtradas, notaResp]);

  // ── ALINHAMENTO E ENTREGA ────────────────────────────────────────────
  const alinP = pq("alinhamento"), entP = pq("entrega"), contP = pq("contribuicao");
  const indiceAlin = useCallback((r: Resp) => {
    const ns = [alinP, entP, contP].map(p => p ? nota(p, respValor(r, p.id)) : null).filter((x): x is number => x != null);
    return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
  }, [alinP, entP, contP]);

  const alinKpis = useMemo(() => {
    const sAlin = serieTrimestre(filtradas, r => alinP ? nota(alinP, respValor(r, alinP.id)) : null);
    const sEnt = serieTrimestre(filtradas, r => entP ? nota(entP, respValor(r, entP.id)) : null);
    const sCon = serieTrimestre(filtradas, r => contP ? nota(contP, respValor(r, contP.id)) : null);
    const sGer = serieTrimestre(filtradas, indiceAlin);
    return {
      alin: mediaNota(alinP, filtradas), dAlin: deltaSerie(sAlin),
      ent: mediaNota(entP, filtradas), dEnt: deltaSerie(sEnt),
      con: mediaNota(contP, filtradas), dCon: deltaSerie(sCon),
      geral: (() => { const ns = filtradas.map(indiceAlin).filter((x): x is number => x != null); return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null; })(),
      dGeral: deltaSerie(sGer), serieGeral: sGer,
      metasConcl: pctPrimeiraOpcao(pq("metasConcluidas"), filtradas),
      metasPrazo: pctPrimeiraOpcao(pq("metasPrazo"), filtradas),
    };
  }, [filtradas, alinP, entP, contP, indiceAlin, pergs, mapa]);

  const distAlin = useMemo(() => {
    const c = { alto: 0, medio: 0, baixo: 0 };
    filtradas.forEach(r => { const v = indiceAlin(r); if (v == null) return; if (v >= 4) c.alto++; else if (v >= 3) c.medio++; else c.baixo++; });
    return [
      { nome: "Alto (4,0 a 5,0)", completo: "Alto (4,0 a 5,0)", n: c.alto },
      { nome: "Médio (3,0 a 3,9)", completo: "Médio (3,0 a 3,9)", n: c.medio },
      { nome: "Baixo (0 a 2,9)", completo: "Baixo (0 a 2,9)", n: c.baixo },
    ];
  }, [filtradas, indiceAlin]);

  const alinPorSetor = useMemo(() => agrupaMedia(filtradas, setorDe, indiceAlin), [filtradas, indiceAlin]);
  const topLidAlin = useMemo(() => agrupaMedia(filtradas, r => respValor(r, mapa.lider), indiceAlin), [filtradas, mapa, indiceAlin]);
  // Rankings comparam times reais: "Sem setor" fica de fora.
  const topSetorEntrega = useMemo(() => agrupaMedia(filtradas, setorDe, r => entP ? nota(entP, respValor(r, entP.id)) : null).filter(x => x.chave !== SEM_SETOR), [filtradas, entP]);
  const topLidContrib = useMemo(() => agrupaMedia(filtradas, r => respValor(r, mapa.lider), r => contP ? nota(contP, respValor(r, contP.id)) : null), [filtradas, mapa, contP]);

  const exportarCsvAlin = () => {
    const l: string[][] = [["Bloco", "Item", "Valor"]];
    l.push(["Índice", "Alinhamento às metas", alinKpis.alin != null ? alinKpis.alin.toFixed(2) : "—"]);
    l.push(["Índice", "Qualidade da entrega", alinKpis.ent != null ? alinKpis.ent.toFixed(2) : "—"]);
    l.push(["Índice", "Contribuição para resultados", alinKpis.con != null ? alinKpis.con.toFixed(2) : "—"]);
    l.push(["Índice", "Geral de alinhamento", alinKpis.geral != null ? alinKpis.geral.toFixed(2) : "—"]);
    distAlin.forEach(d => l.push(["Distribuição", d.completo, String(d.n)]));
    alinPorSetor.forEach(s => l.push(["Alinhamento por setor", s.chave, s.media.toFixed(2)]));
    topLidAlin.forEach(x => l.push(["Líder — alinhamento", x.chave, x.media.toFixed(2)]));
    topSetorEntrega.forEach(x => l.push(["Setor — entrega", x.chave, x.media.toFixed(2)]));
    const csv = l.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `alinhamento-entrega-${(form?.titulo ?? "painel").replace(/[^\w-]+/g, "_")}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const ultimaAtualizacao = useMemo(() => {
    const ts = respsForm.reduce((m, r) => Math.max(m, +new Date(r.enviado_em)), 0);
    return ts ? new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
  }, [respsForm]);

  // categoria de "risco": a que parecer risco/ruim, senão a última opção da pergunta.
  const catRisco = useMemo(() => {
    const sitP = pq("situacao"); if (!sitP) return "";
    const ops = sitP.opcoes ?? [];
    return ops.find(o => /risco|ruim|insatisf|cr[íi]tic/i.test(o)) ?? ops[ops.length - 1] ?? "";
  }, [pergs, mapa]);

  const riscoPorNecessidade = useMemo(() => {
    const nP = pq("necessidades"), sP = pq("situacao");
    if (!nP || !sP || !catRisco) return [] as { nec: string; n: number }[];
    const emRisco = filtradas.filter(r => respValor(r, sP.id) === catRisco);
    const cont: Record<string, number> = {};
    emRisco.forEach(r => { const v = r.itens[nP.id]; (Array.isArray(v) ? v : [v]).forEach((x: any) => { if (x == null || x === "") return; cont[String(x)] = (cont[String(x)] || 0) + 1; }); });
    return Object.entries(cont).map(([nec, n]) => ({ nec, n })).sort((a, b) => b.n - a.n).slice(0, 6);
  }, [pergs, mapa, filtradas, catRisco]);

  const exportarCsv = () => {
    const linhas: string[][] = [["Indicador", "Item", "Quantidade"]];
    const push = (ind: string, d: { completo: string; n: number }[]) => d.forEach(x => linhas.push([ind, x.completo, String(x.n)]));
    push("Situação profissional", distSituacao);
    push("Necessidades de desenvolvimento", distNecess);
    push("Pontos fortes", distFortes);
    push("Pontos de melhoria", distMelhoria);
    const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `desenvolvimento-${(form?.titulo ?? "painel").replace(/[^\w-]+/g, "_")}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const exportarCsvLid = () => {
    const linhas: string[][] = [["Bloco", "Item", "Valor"]];
    linhas.push(["Índice geral", "Média (1-5)", indiceGeral != null ? indiceGeral.toFixed(2) : "—"]);
    porDimensao.forEach(d => linhas.push(["Índice por dimensão", d.completo, d.valor.toFixed(2)]));
    distLideranca.forEach(d => linhas.push(["Distribuição", d.completo, String(d.n)]));
    porLideranca.forEach(l => linhas.push(["Liderança", l.lider, `${l.indice.toFixed(2)} (${l.n} avaliações)`]));
    const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lideranca-${(form?.titulo ?? "painel").replace(/[^\w-]+/g, "_")}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Carregando…</div>;

  const mudaViz = (k: string, v: Viz) => setViz(x => ({ ...x, [k]: v }));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      {/* Cabeçalho + abas */}
      <div style={{ margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 16, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px 10px", flexWrap: "wrap" }}>
          <button onClick={() => nav("/app/central-servicos/formularios")} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>← Voltar</button>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>📈 Painel Gerencial</div>
            <div style={{ fontSize: 11.5, color: "#94a3b8" }}>Indicadores dos feedbacks — apoio à gestão.</div>
          </div>
          <div style={{ minWidth: 240 }}>
            <label style={lbl}>Formulário (fonte)</label>
            <select value={formSel} onChange={e => setFormSel(e.target.value)} style={inp}>
              {forms.map(f => <option key={f.id} value={f.id}>{f.titulo}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, padding: "0 12px", borderTop: "1px solid #f1f5f9", overflowX: "auto" }}>
          {TABS.map(t => {
            const on = t === tab;
            const pronto = ["Desenvolvimento", "Liderança", "Alinhamento e Entrega"].includes(t);
            return (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "11px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: on ? 800 : 600, color: on ? "#0f3171" : "#94a3b8", borderBottom: on ? "3px solid #0f3171" : "3px solid transparent", whiteSpace: "nowrap" }}>
                {t}{!pronto && <span style={{ fontSize: 9, marginLeft: 5, color: "#cbd5e1" }}>em breve</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de filtros */}
      <div style={{ margin: "12px 24px 0", padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <div><label style={lbl}>Período</label>
            <select value={periodo} onChange={e => setPeriodo(e.target.value as any)} style={inp}>
              <option value="todos">Todo o período</option><option value="90">Últimos 90 dias</option><option value="180">Últimos 180 dias</option><option value="365">Último ano</option>
            </select></div>
          <FiltroFuturo label="Empresa" /><FiltroFuturo label="Diretoria" />
          <div><label style={lbl}>Setor</label>
            <select value={fSetor} onChange={e => setFSetor(e.target.value)} style={inp}><option value="">Todos</option>{setores.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <FiltroFuturo label="Liderança" />
          <div><label style={lbl}>Colaborador</label><input value={fResp} onChange={e => setFResp(e.target.value)} placeholder="Nome…" style={inp} /></div>
          <FiltroFuturo label="Situação do feedback" />
          <div><label style={lbl}>Situação profissional</label>
            <select value={fSituacao} onChange={e => setFSituacao(e.target.value)} style={inp}><option value="">Todas</option>{(pq("situacao")?.opcoes ?? []).map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div><label style={lbl}>Necessidade</label>
            <select value={fNecessidade} onChange={e => setFNecessidade(e.target.value)} style={inp}><option value="">Todas</option>{(pq("necessidades")?.opcoes ?? []).map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <FiltroFuturo label="Situação do plano de ação" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setMostrarMapa(v => !v)} style={{ background: "none", border: "none", color: "#0f3171", fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>⚙ Mapeamento de perguntas {mostrarMapa ? "▴" : "▾"}</button>
          <button onClick={() => { setPeriodo("todos"); setFSetor(""); setFResp(""); setFSituacao(""); setFNecessidade(""); }} style={btn("#f1f5f9", "#475569", "1px solid #e2e8f0")}>Limpar filtros</button>
        </div>
        {mostrarMapa && (
          <div style={{ marginTop: 10, borderTop: "1px dashed #e2e8f0", paddingTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {tab === "Liderança" ? (
              <>
                <div><label style={lbl}>Quem é a liderança avaliada</label>
                  <select value={mapa.lider ?? ""} onChange={e => salvarMapa({ ...mapa, lider: e.target.value || undefined })} style={inp}>
                    <option value="">— nenhuma —</option>
                    {pergs.map(p => <option key={p.id} value={p.id}>{p.titulo || "(sem título)"}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Dimensões avaliadas (viram o índice 1–5)</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {pergs.filter(p => ["escala", "multipla_escolha", "lista_suspensa"].includes(p.tipo)).map(p => {
                      const on = ((mapa.dimensoes ?? []) as string[]).includes(p.id);
                      return (
                        <span key={p.id} onClick={() => {
                          const atual = (mapa.dimensoes ?? []) as string[];
                          salvarMapa({ ...mapa, dimensoes: on ? atual.filter(x => x !== p.id) : [...atual, p.id] });
                        }} title={p.titulo}
                          style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", border: on ? "1px solid #0f3171" : "1px solid #e2e8f0", background: on ? "#0f3171" : "#fff", color: on ? "#fff" : "#64748b" }}>
                          {p.titulo || "(sem título)"}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                    Escalas viram nota direto. Em perguntas de opção, assume-se a <b>1ª opção como a melhor</b> (5) e a última como a pior (1).
                  </div>
                </div>
              </>
            ) : tab === "Alinhamento e Entrega" ? IND_ALIN.map(ind => (
              <div key={ind.key}><label style={lbl}>{ind.label}</label>
                <select value={mapa[ind.key] ?? ""} onChange={e => salvarMapa({ ...mapa, [ind.key]: e.target.value || undefined })} style={inp}>
                  <option value="">— nenhuma —</option>
                  {pergs.filter(p => ["escala", "multipla_escolha", "lista_suspensa"].includes(p.tipo)).map(p => <option key={p.id} value={p.id}>{p.titulo || "(sem título)"}</option>)}
                </select>
              </div>
            )) : IND.map(ind => (
              <div key={ind.key}><label style={lbl}>{ind.label}</label>
                <select value={mapa[ind.key] ?? ""} onChange={e => salvarMapa({ ...mapa, [ind.key]: e.target.value || undefined })} style={inp}>
                  <option value="">— nenhuma —</option>
                  {pergs.filter(p => CHART_TIPOS.includes(p.tipo)).map(p => <option key={p.id} value={p.id}>{p.titulo || "(sem título)"}</option>)}
                </select>
              </div>
            ))}
            <div style={{ gridColumn: "1/-1", fontSize: 11, color: "#94a3b8" }}>Escolha qual pergunta alimenta cada indicador. Fica salvo neste navegador por formulário.</div>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 40px" }}>
        {!form ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Selecione um formulário.</div>
        ) : tab === "Liderança" ? (
          <PainelLideranca
            indice={indiceGeral} dist={distLideranca} porDim={porDimensao} evol={evolIndice}
            delta={deltaIndice} avaliados={avaliados} lideres={porLideranca}
            temMapa={!!pq("lider") && dimsPergs.length > 0}
            ultima={ultimaAtualizacao} onExport={exportarCsvLid}
            viz={viz} onViz={mudaViz} onAbrirMapa={() => setMostrarMapa(true)} />
        ) : tab === "Alinhamento e Entrega" ? (
          <PainelAlinhamento
            k={alinKpis} dist={distAlin} porSetor={alinPorSetor}
            topLidAlin={topLidAlin} topSetorEntrega={topSetorEntrega} topLidContrib={topLidContrib}
            temMapa={!!(alinP || entP || contP)} ultima={ultimaAtualizacao} onExport={exportarCsvAlin}
            viz={viz} onViz={mudaViz} onAbrirMapa={() => setMostrarMapa(true)} />
        ) : tab !== "Desenvolvimento" ? (
          <div style={{ padding: 70, textAlign: "center", color: "#94a3b8", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14 }}>
            A aba <b>{tab}</b> entra em breve.
          </div>
        ) : (
          <>
            {/* Título da seção + exportar */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 21, fontWeight: 800, color: "#0f172a" }}>DESENVOLVIMENTO</div>
                <div style={{ fontSize: 12.5, color: "#64748b" }}>Entenda as necessidades de desenvolvimento da equipe e onde concentrar esforços.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "right", lineHeight: 1.4 }}>
                  Última atualização<br /><b style={{ color: "#475569" }}>{ultimaAtualizacao}</b>
                </div>
                <button onClick={exportarCsv} style={btn("#fff", "#0f3171", "1px solid #0f3171")}>⬇ Exportar relatório</button>
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
              {distSituacao.slice(0, 4).map((d, i) => (
                <Kpi key={d.completo} titulo={d.completo} valor={d.n} cor={CAT_CORES[i]} icone={["🧭", "🚀", "🤝", "⚠️"][i] ?? "•"} sub={`${pct(d.n, totalMenc(distSituacao))} do total`} />
              ))}
              <Kpi titulo="Pontos fortes citados" valor={totalMenc(distFortes)} cor="#7c3aed" icone="⭐" sub="Menções no período" />
              <Kpi titulo="Pontos de melhoria citados" valor={totalMenc(distMelhoria)} cor="#0891b2" icone="🎯" sub="Menções no período" />
            </div>

            {filtradas.length === 0 ? (
              <div style={{ padding: 50, textAlign: "center", color: "#94a3b8", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14 }}>Sem respostas no recorte atual.</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginBottom: 14 }}>
                  <Painel titulo="Evolução da situação profissional" viz={viz.evolucao} onViz={v => mudaViz("evolucao", v)} vizOpts={["linha", "area", "colunas"]} perg={pq("situacao")}>
                    <EvolucaoChart data={evolucao.data} cats={evolucao.cats} viz={viz.evolucao} />
                  </Painel>
                  <Painel titulo="Necessidades de desenvolvimento" viz={viz.necessidades} onViz={v => mudaViz("necessidades", v)} perg={pq("necessidades")}>
                    <Chart dados={distNecess} viz={viz.necessidades} cor="#2563eb" />
                  </Painel>
                  <Painel titulo="Distribuição por necessidade" viz={viz.distribuicao} onViz={v => mudaViz("distribuicao", v)} perg={pq("necessidades")}>
                    <Chart dados={distNecess} viz={viz.distribuicao} cor="#2563eb" />
                  </Painel>
                  <Painel titulo="Top necessidades por setor" semViz>
                    {topNecessPorSetor.length === 0 ? <Vazio /> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {topNecessPorSetor.map((x, i) => (
                          <div key={x.setor} style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "baseline", borderTop: i ? "1px solid #f1f5f9" : "none", paddingTop: i ? 6 : 0 }}>
                            <span style={{ fontWeight: 800, color: "#94a3b8", width: 16 }}>{i + 1}</span>
                            <span style={{ fontWeight: 700, color: "#0f172a", minWidth: 90 }}>{x.setor}</span>
                            <span style={{ flex: 1, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nec}</span>
                            <span style={{ fontWeight: 800, color: "#0f172a" }}>{x.n}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Painel>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginBottom: 14 }}>
                  <Painel titulo="Pontos fortes mais citados" viz={viz.fortes} onViz={v => mudaViz("fortes", v)} perg={pq("fortes")}>
                    <Chart dados={distFortes} viz={viz.fortes} cor="#16a34a" />
                  </Painel>
                  <Painel titulo="Pontos de melhoria mais citados" viz={viz.melhoria} onViz={v => mudaViz("melhoria", v)} perg={pq("melhoria")}>
                    <Chart dados={distMelhoria} viz={viz.melhoria} cor="#dc2626" />
                  </Painel>
                  <Painel titulo={`Em ${catRisco || "risco"} por principal necessidade`} semViz>
                    {riscoPorNecessidade.length === 0 ? <Vazio /> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {riscoPorNecessidade.map((x, i) => {
                          const tot = riscoPorNecessidade.reduce((s, y) => s + y.n, 0);
                          return (
                            <div key={x.nec} style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "baseline", borderTop: i ? "1px solid #f1f5f9" : "none", paddingTop: i ? 6 : 0 }}>
                              <span style={{ flex: 1, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={x.nec}>{x.nec}</span>
                              <span style={{ fontWeight: 800, color: "#dc2626" }}>{x.n}</span>
                              <span style={{ fontSize: 11, color: "#94a3b8", width: 42, textAlign: "right" }}>{pct(x.n, tot)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Painel>
                  <Painel titulo="Insights principais" semViz>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "#334155" }}>
                      {insightNec(distNecess)}
                      {insightSit(distSituacao)}
                      {insightForte(distFortes)}
                    </div>
                  </Painel>
                </div>

                {/* Detalhamento por situação — clique filtra o painel inteiro */}
                <div style={{ fontSize: 12, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".5px", margin: "4px 0 8px" }}>Detalhamento por situação</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                  {distSituacao.slice(0, 4).map((d, i) => {
                    const ativo = fSituacao === d.completo;
                    return (
                      <button key={d.completo} onClick={() => setFSituacao(ativo ? "" : d.completo)} title="Clique para filtrar por esta situação"
                        style={{ textAlign: "left", cursor: "pointer", background: "#fff", border: ativo ? `2px solid ${CAT_CORES[i]}` : "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: CAT_CORES[i], textTransform: "uppercase", letterSpacing: ".4px" }}>{d.completo}{ativo ? " ✓" : ""}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{d.n}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>colaborador(es) · {pct(d.n, totalMenc(distSituacao))}</div>
                        <div style={{ fontSize: 10.5, color: "#cbd5e1", marginTop: 4 }}>{ativo ? "filtrando — clique p/ limpar" : "clique para filtrar"}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 18, borderTop: "1px solid #eef2f7", paddingTop: 10 }}>
          ⓘ Os indicadores são baseados nas respostas dos feedbacks e têm caráter de apoio à gestão, não devendo ser usados isoladamente para decisões de promoção, punição ou desligamento.
        </div>
      </div>
    </div>
  );
}

const pct = (n: number, tot: number) => tot ? `${Math.round((n / tot) * 100)}%` : "0%";
function Vazio() { return <div style={{ fontSize: 12, color: "#94a3b8", padding: "10px 0" }}>Sem dados no recorte.</div>; }
function FiltroFuturo({ label }: { label: string }) {
  return <div><label style={lbl}>{label}</label><select disabled style={{ ...inp, background: "#f8fafc", color: "#94a3b8", cursor: "not-allowed" }}><option>Todas (em breve)</option></select></div>;
}

function Kpi({ titulo, valor, cor, sub, icone }: { titulo: string; valor: number | string; cor: string; sub?: string; icone?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)", display: "flex", gap: 12, alignItems: "flex-start" }}>
      {icone && (
        <div style={{ width: 38, height: 38, borderRadius: 11, background: cor + "1a", color: cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icone}</div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={titulo}>{titulo}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: cor, marginTop: 2 }}>{valor}</div>
        {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Painel({ titulo, children, viz, onViz, vizOpts, semViz, semPerg, perg }: { titulo: string; children: React.ReactNode; viz?: Viz; onViz?: (v: Viz) => void; vizOpts?: Viz[]; semViz?: boolean; semPerg?: boolean; perg?: Pergunta }) {
  const opts = VIZ_OPCOES.filter(o => !vizOpts || vizOpts.includes(o.v));
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>
        {!semViz && onViz && (
          <select value={viz} onChange={e => onViz(e.target.value as Viz)} title="Tipo de gráfico" style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "3px 6px", fontSize: 11, color: "#64748b", background: "#fff", cursor: "pointer" }}>
            {opts.map(o => <option key={o.v} value={o.v}>{o.r}</option>)}
          </select>
        )}
      </div>
      {!semViz && !semPerg && perg === undefined
        ? <div style={{ fontSize: 11.5, color: "#a16207", marginTop: 8 }}>Defina a pergunta em ⚙ Mapeamento.</div>
        : <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

function Chart({ dados, viz, cor }: { dados: { nome: string; completo: string; n: number }[]; viz: Viz; cor: string }) {
  const comDados = dados.filter(d => d.n);
  if (!comDados.length) return <Vazio />;
  // rótulos longos: limita o balão para não estourar o card e cobrir o vizinho.
  const tip = <Tooltip
    contentStyle={{ maxWidth: 260, whiteSpace: "normal", wordBreak: "break-word", fontSize: 12, lineHeight: 1.35, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,.12)" }}
    wrapperStyle={{ zIndex: 60 }}
    formatter={(v: any, _n: any, e: any) => [v, e?.payload?.completo]} />;
  if (viz === "pizza" || viz === "rosca") {
    // Sem rótulo em volta (estourava o card com opções longas): rosca + legenda.
    const totP = comDados.reduce((s, d) => s + d.n, 0);
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ width: 168, height: 190, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={comDados} dataKey="n" nameKey="nome" cx="50%" cy="50%" innerRadius={viz === "rosca" ? 46 : 0} outerRadius={72} paddingAngle={1}>
                {comDados.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Pie>{tip}
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 5, maxHeight: 200, overflowY: "auto" }}>
          {comDados.map((d, i) => (
            <div key={d.completo} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 11.5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: CORES[i % CORES.length], flexShrink: 0 }} />
              <span style={{ flex: 1, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.completo}>{d.completo}</span>
              <b style={{ color: "#0f172a" }}>{d.n}</b>
              <span style={{ color: "#94a3b8", width: 38, textAlign: "right" }}>{pct(d.n, totP)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (viz === "colunas") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={dados} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="nome" tick={{ fontSize: 9 }} interval={0} angle={dados.length > 4 ? -25 : 0} textAnchor={dados.length > 4 ? "end" : "middle"} height={dados.length > 4 ? 54 : 24} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />{tip}
          <Bar dataKey="n" radius={[4, 4, 0, 0]}>{dados.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (viz === "linha" || viz === "area") {
    const Cmp: any = viz === "linha" ? LineChart : AreaChart;
    const Serie: any = viz === "linha" ? Line : Area;
    return (
      <ResponsiveContainer width="100%" height={220}>
        <Cmp data={dados} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="nome" tick={{ fontSize: 9 }} interval={0} angle={dados.length > 4 ? -25 : 0} textAnchor={dados.length > 4 ? "end" : "middle"} height={dados.length > 4 ? 54 : 24} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />{tip}
          <Serie type="monotone" dataKey="n" stroke={cor} fill={cor} fillOpacity={0.2} strokeWidth={2} />
        </Cmp>
      </ResponsiveContainer>
    );
  }
  // barras (horizontal) — default; rótulo "n (x%)" na ponta, como no painel de referência.
  const tot = dados.reduce((s, d) => s + d.n, 0);
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 32)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 62, left: 8, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
        <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 10 }} />{tip}
        <Bar dataKey="n" radius={[0, 4, 4, 0]}>
          {dados.map((_, i) => <Cell key={i} fill={cor} />)}
          <LabelList dataKey="n" position="right" style={{ fontSize: 10, fill: "#475569", fontWeight: 700 }}
            formatter={(v: any) => (tot ? `${v} (${Math.round((Number(v) / tot) * 100)}%)` : String(v))} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EvolucaoChart({ data, cats, viz }: { data: any[]; cats: string[]; viz: Viz }) {
  if (!data.length || !cats.length) return <Vazio />;
  if (viz === "colunas") {
    return (
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="tri" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} />
          {cats.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={CAT_CORES[i % CAT_CORES.length]} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  const Cmp: any = viz === "area" ? AreaChart : LineChart;
  const Serie: any = viz === "area" ? Area : Line;
  return (
    <ResponsiveContainer width="100%" height={230}>
      <Cmp data={data} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="tri" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} />
        {cats.map((c, i) => <Serie key={c} type="monotone" dataKey={c} stroke={CAT_CORES[i % CAT_CORES.length]} fill={CAT_CORES[i % CAT_CORES.length]} fillOpacity={0.15} strokeWidth={2} />)}
      </Cmp>
    </ResponsiveContainer>
  );
}

// ── Aba LIDERANÇA ─────────────────────────────────────────────────────────
type Lider = { lider: string; indice: number; n: number; evol: number | null };
const nf = (n: number) => n.toFixed(2).replace(".", ",");
const evolTxt = (e: number | null) => e == null ? "—" : `${e >= 0 ? "▲" : "▼"} ${Math.abs(e).toFixed(2).replace(".", ",")}`;
const evolCor = (e: number | null) => e == null ? "#94a3b8" : e >= 0 ? "#16a34a" : "#dc2626";

function TabelaLideres({ titulo, lista, cor }: { titulo: string; lista: Lider[]; cor: string }) {
  return (
    <Painel titulo={titulo} semViz>
      {lista.length === 0 ? <Vazio /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", gap: 8, fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px" }}>
            <span style={{ width: 14 }}>#</span><span style={{ flex: 1 }}>Liderança</span><span style={{ width: 46, textAlign: "right" }}>Índice</span><span style={{ width: 58, textAlign: "right" }}>Evolução</span>
          </div>
          {lista.map((l, i) => (
            <div key={l.lider} style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "baseline", borderTop: "1px solid #f1f5f9", paddingTop: 5 }}>
              <span style={{ width: 14, fontWeight: 800, color: "#94a3b8" }}>{i + 1}</span>
              <span style={{ flex: 1, color: "#0f172a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${l.lider} · ${l.n} avaliação(ões)`}>{l.lider}</span>
              <span style={{ width: 46, textAlign: "right", fontWeight: 800, color: cor }}>{nf(l.indice)}</span>
              <span style={{ width: 58, textAlign: "right", fontSize: 11.5, fontWeight: 700, color: evolCor(l.evol) }}>{evolTxt(l.evol)}</span>
            </div>
          ))}
        </div>
      )}
    </Painel>
  );
}

function PainelLideranca({ indice, dist, porDim, evol, delta, avaliados, lideres, temMapa, ultima, onExport, viz, onViz, onAbrirMapa }: {
  indice: number | null; dist: { nome: string; completo: string; n: number }[];
  porDim: { nome: string; completo: string; valor: number; n: number }[];
  evol: { tri: string; indice: number }[]; delta: number | null; avaliados: number; lideres: Lider[];
  temMapa: boolean; ultima: string; onExport: () => void;
  viz: Record<string, Viz>; onViz: (k: string, v: Viz) => void; onAbrirMapa: () => void;
}) {
  if (!temMapa) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Falta configurar a Liderança</div>
        <div style={{ fontSize: 12.5, color: "#64748b", maxWidth: 520, margin: "0 auto 14px" }}>
          Para calcular o índice eu preciso saber <b>qual pergunta identifica a liderança</b> avaliada e <b>quais perguntas são as dimensões</b> (viram nota de 1 a 5).
        </div>
        <button onClick={onAbrirMapa} style={btn("#0f3171")}>⚙ Abrir mapeamento</button>
      </div>
    );
  }
  const destaque = lideres.filter(l => l.indice >= 4);
  const atencao = lideres.filter(l => l.indice >= 3 && l.indice < 4);
  const critica = lideres.filter(l => l.indice < 3);
  const maxDim = Math.max(5, ...porDim.map(d => d.valor));
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "#0f172a" }}>LIDERANÇA</div>
          <div style={{ fontSize: 12.5, color: "#64748b" }}>Avaliação da liderança percebida pela equipe.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "right", lineHeight: 1.4 }}>Última atualização<br /><b style={{ color: "#475569" }}>{ultima}</b></div>
          <button onClick={onExport} style={btn("#fff", "#0f3171", "1px solid #0f3171")}>⬇ Exportar relatório</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
        <Kpi titulo="Índice geral de liderança" valor={indice != null ? `${nf(indice)} / 5` : "—"} cor="#7c3aed" icone="⭐" sub="Média no período (1–5)" />
        <Kpi titulo="Lideranças em destaque" valor={destaque.length} cor="#16a34a" icone="📈" sub="Acima de 4,0" />
        <Kpi titulo="Lideranças em atenção" valor={atencao.length} cor="#f59e0b" icone="🙂" sub="Entre 3,0 e 4,0" />
        <Kpi titulo="Lideranças críticas" valor={critica.length} cor="#dc2626" icone="⚠️" sub="Abaixo de 3,0" />
        <Kpi titulo="Profissionais avaliados" valor={avaliados} cor="#2563eb" icone="👥" sub="Com avaliação de liderança" />
        <Kpi titulo="Evolução do índice" valor={delta != null ? `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(2).replace(".", ",")}` : "—"} cor={delta != null && delta < 0 ? "#dc2626" : "#0891b2"} icone="📊" sub="vs. período anterior" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginBottom: 14 }}>
        <Painel titulo="Evolução do índice geral de liderança" viz={viz.lidEvol ?? "linha"} onViz={v => onViz("lidEvol", v)} vizOpts={["linha", "area", "colunas"]} semPerg>
          {evol.length === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height={230}>
              {(viz.lidEvol ?? "linha") === "colunas" ? (
                <BarChart data={evol} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="tri" tick={{ fontSize: 10 }} /><YAxis domain={[1, 5]} tick={{ fontSize: 10 }} /><Tooltip />
                  <Bar dataKey="indice" fill="#7c3aed" radius={[4, 4, 0, 0]}><LabelList dataKey="indice" position="top" style={{ fontSize: 10, fill: "#475569" }} /></Bar>
                </BarChart>
              ) : (viz.lidEvol ?? "linha") === "area" ? (
                <AreaChart data={evol} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tri" tick={{ fontSize: 10 }} /><YAxis domain={[1, 5]} tick={{ fontSize: 10 }} /><Tooltip />
                  <Area type="monotone" dataKey="indice" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.18} strokeWidth={2} />
                </AreaChart>
              ) : (
                <LineChart data={evol} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tri" tick={{ fontSize: 10 }} /><YAxis domain={[1, 5]} tick={{ fontSize: 10 }} /><Tooltip />
                  <Line type="monotone" dataKey="indice" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4 }}>
                    <LabelList dataKey="indice" position="top" style={{ fontSize: 10, fill: "#475569" }} />
                  </Line>
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </Painel>

        <Painel titulo="Distribuição do índice de liderança" viz={viz.lidDist ?? "rosca"} onViz={v => onViz("lidDist", v)} semPerg>
          <ChartFaixas dados={dist} viz={viz.lidDist ?? "rosca"} />
        </Painel>

        <Painel titulo="Índice por dimensão de liderança" semViz>
          {porDim.length === 0 ? <Vazio /> : (
            <div>
              {porDim.map(d => (
                <div key={d.completo} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3, gap: 8 }}>
                    <span style={{ color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.completo}>{d.nome}</span>
                    <b style={{ color: "#0f172a" }}>{nf(d.valor)}</b>
                  </div>
                  <div style={{ height: 8, background: "#eef2f7", borderRadius: 20, overflow: "hidden" }}>
                    <div style={{ width: `${(d.valor / maxDim) * 100}%`, height: "100%", background: "#7c3aed", borderRadius: 20 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Painel>

        <Painel titulo="Insights principais" semViz>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "#334155" }}>
            {porDim.length > 0 && <div>✅ Ponto mais forte: <b>{porDim[0].completo}</b> ({nf(porDim[0].valor)}).</div>}
            {porDim.length > 1 && <div>📈 Maior oportunidade: <b>{porDim[porDim.length - 1].completo}</b> ({nf(porDim[porDim.length - 1].valor)}).</div>}
            {critica.length > 0 && <div>⚠️ <b>{critica.length}</b> liderança(s) abaixo de 3,0 — apoio imediato.</div>}
            {delta != null && <div>{delta >= 0 ? "🟢" : "🔴"} O índice {delta >= 0 ? "subiu" : "caiu"} <b>{Math.abs(delta).toFixed(2).replace(".", ",")}</b> vs. o período anterior.</div>}
          </div>
        </Painel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginBottom: 14 }}>
        <TabelaLideres titulo="Top 5 – Lideranças melhor avaliadas" lista={destaque.slice(0, 5)} cor="#16a34a" />
        <TabelaLideres titulo="Top 5 – Lideranças em atenção" lista={atencao.slice(0, 5)} cor="#f59e0b" />
        <TabelaLideres titulo="Top 5 – Lideranças críticas" lista={critica.slice(-5).reverse()} cor="#dc2626" />
        <Painel titulo="Alertas de liderança" semViz>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 12.5 }}>
            <Alerta cor="#dc2626" titulo={`${critica.length} liderança(s) com índice abaixo de 3,0`} sub="Ação imediata recomendada" />
            <Alerta cor="#f59e0b" titulo={`${atencao.length} liderança(s) em atenção (3,0 a 4,0)`} sub="Acompanhar e apoiar desenvolvimento" />
            <Alerta cor="#2563eb" titulo={`${lideres.filter(l => l.evol != null && l.evol < 0).length} liderança(s) em queda`} sub="Comparado ao período anterior" />
          </div>
        </Painel>
      </div>
    </>
  );
}

// ── Aba ALINHAMENTO E ENTREGA ─────────────────────────────────────────────
type Grupo = { chave: string; media: number; n: number; evol: number | null };

function TabelaGrupo({ titulo, lista, colChave, colValor, cor }: { titulo: string; lista: Grupo[]; colChave: string; colValor: string; cor: string }) {
  return (
    <Painel titulo={titulo} semViz>
      {lista.length === 0 ? <Vazio /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", gap: 8, fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px" }}>
            <span style={{ width: 14 }}>#</span><span style={{ flex: 1 }}>{colChave}</span>
            <span style={{ width: 52, textAlign: "right" }}>{colValor}</span><span style={{ width: 58, textAlign: "right" }}>Evolução</span>
          </div>
          {lista.map((x, i) => (
            <div key={x.chave} style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "baseline", borderTop: "1px solid #f1f5f9", paddingTop: 5 }}>
              <span style={{ width: 14, fontWeight: 800, color: "#94a3b8" }}>{i + 1}</span>
              <span style={{ flex: 1, color: "#0f172a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${x.chave} · ${x.n} avaliação(ões)`}>{x.chave}</span>
              <span style={{ width: 52, textAlign: "right", fontWeight: 800, color: cor }}>{nf(x.media)}</span>
              <span style={{ width: 58, textAlign: "right", fontSize: 11.5, fontWeight: 700, color: evolCor(x.evol) }}>{evolTxt(x.evol)}</span>
            </div>
          ))}
        </div>
      )}
    </Painel>
  );
}

function KpiIndice({ titulo, valor, delta, cor, icone, sub }: { titulo: string; valor: number | null; delta?: number | null; cor: string; icone: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: cor + "1a", color: cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icone}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={titulo}>{titulo}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: cor, marginTop: 2 }}>
          {valor != null ? nf(valor) : "—"}{valor != null && <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700 }}> / 5</span>}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub ?? "Média no período"}</div>
        {delta != null && <div style={{ fontSize: 11, fontWeight: 700, color: evolCor(delta), marginTop: 2 }}>{evolTxt(delta)} vs. tri anterior</div>}
      </div>
    </div>
  );
}

function PainelAlinhamento({ k, dist, porSetor, topLidAlin, topSetorEntrega, topLidContrib, temMapa, ultima, onExport, viz, onViz, onAbrirMapa }: {
  k: { alin: number | null; dAlin: number | null; ent: number | null; dEnt: number | null; con: number | null; dCon: number | null; geral: number | null; dGeral: number | null; serieGeral: { tri: string; valor: number }[]; metasConcl: number | null; metasPrazo: number | null };
  dist: { nome: string; completo: string; n: number }[]; porSetor: Grupo[];
  topLidAlin: Grupo[]; topSetorEntrega: Grupo[]; topLidContrib: Grupo[];
  temMapa: boolean; ultima: string; onExport: () => void;
  viz: Record<string, Viz>; onViz: (k: string, v: Viz) => void; onAbrirMapa: () => void;
}) {
  if (!temMapa) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Falta configurar Alinhamento e Entrega</div>
        <div style={{ fontSize: 12.5, color: "#64748b", maxWidth: 540, margin: "0 auto 14px" }}>
          Preciso saber quais perguntas medem <b>alinhamento às metas</b>, <b>qualidade da entrega</b> e <b>contribuição para resultados</b>.
        </div>
        <button onClick={onAbrirMapa} style={btn("#0f3171")}>⚙ Abrir mapeamento</button>
      </div>
    );
  }
  const maxSetor = Math.max(5, ...porSetor.map(s => s.media));
  const vEvol = viz.alinEvol ?? "linha";
  const reais = porSetor.filter(s => s.chave !== SEM_SETOR);  // insights/alertas só com setor real
  const semSetor = porSetor.find(s => s.chave === SEM_SETOR);
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "#0f172a" }}>ALINHAMENTO E ENTREGA</div>
          <div style={{ fontSize: 12.5, color: "#64748b" }}>Avaliação do alinhamento da equipe às metas, qualidade da entrega e contribuição para os resultados.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "right", lineHeight: 1.4 }}>Última atualização<br /><b style={{ color: "#475569" }}>{ultima}</b></div>
          <button onClick={onExport} style={btn("#fff", "#0f3171", "1px solid #0f3171")}>⬇ Exportar relatório</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
        <KpiIndice titulo="Alinhamento às metas" valor={k.alin} delta={k.dAlin} cor="#2563eb" icone="🎯" />
        <KpiIndice titulo="Qualidade da entrega" valor={k.ent} delta={k.dEnt} cor="#16a34a" icone="✅" />
        <KpiIndice titulo="Contribuição para resultados" valor={k.con} delta={k.dCon} cor="#f59e0b" icone="👥" />
        <KpiIndice titulo="Índice geral de alinhamento" valor={k.geral} delta={k.dGeral} cor="#7c3aed" icone="⭐" />
        <Kpi titulo="Metas concluídas no período" valor={k.metasConcl != null ? `${Math.round(k.metasConcl)}%` : "—"} cor="#0891b2" icone="🏁"
          sub={k.metasConcl != null ? "Do total de metas" : "Mapeie a pergunta em ⚙"} />
        <Kpi titulo="Metas até o prazo" valor={k.metasPrazo != null ? `${Math.round(k.metasPrazo)}%` : "—"} cor="#dc2626" icone="⏱"
          sub={k.metasPrazo != null ? "No período" : "Mapeie a pergunta em ⚙"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginBottom: 14 }}>
        <Painel titulo="Evolução do índice geral de alinhamento" viz={vEvol} onViz={v => onViz("alinEvol", v)} vizOpts={["linha", "area", "colunas"]} semPerg>
          {k.serieGeral.length === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height={230}>
              {vEvol === "colunas" ? (
                <BarChart data={k.serieGeral} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="tri" tick={{ fontSize: 10 }} /><YAxis domain={[2, 5]} tick={{ fontSize: 10 }} /><Tooltip />
                  <Bar dataKey="valor" fill="#2563eb" radius={[4, 4, 0, 0]}><LabelList dataKey="valor" position="top" style={{ fontSize: 10, fill: "#475569" }} /></Bar>
                </BarChart>
              ) : vEvol === "area" ? (
                <AreaChart data={k.serieGeral} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tri" tick={{ fontSize: 10 }} /><YAxis domain={[2, 5]} tick={{ fontSize: 10 }} /><Tooltip />
                  <Area type="monotone" dataKey="valor" stroke="#2563eb" fill="#2563eb" fillOpacity={0.18} strokeWidth={2} />
                </AreaChart>
              ) : (
                <LineChart data={k.serieGeral} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tri" tick={{ fontSize: 10 }} /><YAxis domain={[2, 5]} tick={{ fontSize: 10 }} /><Tooltip />
                  <Line type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }}>
                    <LabelList dataKey="valor" position="top" style={{ fontSize: 10, fill: "#475569" }} />
                  </Line>
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </Painel>

        <Painel titulo="Distribuição do alinhamento da equipe" viz={viz.alinDist ?? "rosca"} onViz={v => onViz("alinDist", v)} semPerg>
          <ChartFaixas dados={dist} viz={viz.alinDist ?? "rosca"} rotulo="avaliações" />
        </Painel>

        <Painel titulo="Alinhamento por setor" semViz>
          {porSetor.length === 0 ? <Vazio /> : (
            <div>
              {porSetor.slice(0, 8).map(s => (
                <div key={s.chave} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3, gap: 8 }}>
                    <span style={{ color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.chave}>{s.chave}</span>
                    <b style={{ color: "#0f172a" }}>{nf(s.media)}</b>
                  </div>
                  <div style={{ height: 8, background: "#eef2f7", borderRadius: 20, overflow: "hidden" }}>
                    <div style={{ width: `${(s.media / maxSetor) * 100}%`, height: "100%", background: s.chave === SEM_SETOR ? "#cbd5e1" : "#4f46e5", borderRadius: 20 }} />
                  </div>
                </div>
              ))}
              {semSetor && (
                <div style={{ fontSize: 10.5, color: "#94a3b8", borderTop: "1px dashed #e2e8f0", paddingTop: 7, marginTop: 2 }}>
                  ⓘ <b>Sem setor</b> = {semSetor.n} resposta(s) de quem respondeu sem login/vínculo, num formulário sem pergunta de setor. Fica fora dos rankings.
                </div>
              )}
            </div>
          )}
        </Painel>

        <Painel titulo="Insights principais" semViz>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "#334155" }}>
            {reais.length > 0 && <div>📈 <b>{reais[0].chave}</b> lidera o alinhamento com média <b>{nf(reais[0].media)}</b>.</div>}
            {k.dEnt != null && <div>🎯 A qualidade da entrega {k.dEnt >= 0 ? "cresceu" : "caiu"} <b>{Math.abs(k.dEnt).toFixed(2).replace(".", ",")}</b> ponto(s).</div>}
            {k.metasPrazo != null && <div>⏱ <b>{Math.round(k.metasPrazo)}%</b> das metas foram concluídas dentro do prazo.</div>}
            {reais.length > 1 && <div>⚠️ <b>{reais[reais.length - 1].chave}</b> possui o menor índice ({nf(reais[reais.length - 1].media)}).</div>}
          </div>
        </Painel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginBottom: 14 }}>
        <TabelaGrupo titulo="Top 5 – Líderes com melhor alinhamento" lista={topLidAlin.slice(0, 5)} colChave="Liderança" colValor="Índice" cor="#2563eb" />
        <TabelaGrupo titulo="Top 5 – Setores com melhor entrega" lista={topSetorEntrega.slice(0, 5)} colChave="Setor" colValor="Entrega" cor="#16a34a" />
        <TabelaGrupo titulo="Top 5 – Maiores contribuições" lista={topLidContrib.slice(0, 5)} colChave="Liderança" colValor="Contrib." cor="#f59e0b" />
        <Painel titulo="Alertas e atenções" semViz>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 12.5 }}>
            <Alerta cor="#dc2626" titulo={`${dist[2]?.n ?? 0} avaliação(ões) com alinhamento baixo`} sub="Abaixo de 3,0 — acompanhar plano de ação" />
            <Alerta cor="#f59e0b" titulo={`${dist[1]?.n ?? 0} em nível médio (3,0 a 3,9)`} sub="Ação corretiva recomendada" />
            <Alerta cor="#2563eb" titulo={`${reais.filter(s => s.media < 3.5).length} setor(es) com índice abaixo de 3,5`} sub="Atenção da liderança" />
          </div>
        </Painel>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>Ações recomendadas</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
          {[
            { i: "🎯", t: `Reforçar alinhamento de metas${porSetor.length ? ` com ${porSetor[porSetor.length - 1].chave}` : ""}.` },
            { i: "👏", t: "Reconhecer e compartilhar boas práticas das equipes com maior entrega." },
            { i: "📈", t: "Acompanhar de perto as metas em risco de não conclusão." },
            { i: "💬", t: "Fortalecer comunicação entre áreas para melhorar contribuições." },
            { i: "✅", t: "Revisar metas do próximo ciclo com base nos gaps identificados." },
          ].map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <span style={{ width: 28, height: 28, borderRadius: 9, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{a.i}</span>
              <span style={{ fontSize: 12, color: "#475569", lineHeight: 1.45 }}>{a.t}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Alerta({ cor, titulo, sub }: { cor: string; titulo: string; sub: string }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, background: cor + "1a", color: cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>●</span>
      <div><div style={{ fontWeight: 700, color: "#0f172a" }}>{titulo}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div></div>
    </div>
  );
}

// Distribuição por faixa (verde/amarelo/vermelho) — rosca com legenda ou barras.
function ChartFaixas({ dados, viz, rotulo = "lideranças" }: { dados: { nome: string; completo: string; n: number }[]; viz: Viz; rotulo?: string }) {
  const cores = ["#16a34a", "#f59e0b", "#dc2626"];
  const tot = dados.reduce((s, d) => s + d.n, 0);
  if (!tot) return <Vazio />;
  if (viz === "barras" || viz === "colunas" || viz === "linha" || viz === "area") {
    return (
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={dados} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="nome" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} /><Tooltip />
          <Bar dataKey="n" radius={[4, 4, 0, 0]}>{dados.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ width: 168, height: 190, flexShrink: 0, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados.filter(d => d.n)} dataKey="n" nameKey="nome" cx="50%" cy="50%" innerRadius={viz === "rosca" ? 46 : 0} outerRadius={72} paddingAngle={1}>
              {dados.filter(d => d.n).map((d, i) => <Cell key={i} fill={cores[dados.indexOf(d) % cores.length]} />)}
            </Pie><Tooltip />
          </PieChart>
        </ResponsiveContainer>
        {viz === "rosca" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{tot}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{rotulo}</div>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 7 }}>
        {dados.map((d, i) => (
          <div key={d.completo} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: cores[i % cores.length], flexShrink: 0 }} />
            <span style={{ flex: 1, color: "#334155" }}>{d.completo}</span>
            <b style={{ color: "#0f172a" }}>{d.n}</b>
            <span style={{ color: "#94a3b8", width: 38, textAlign: "right" }}>{pct(d.n, tot)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function insightNec(d: { completo: string; n: number }[]) {
  const tot = d.reduce((s, x) => s + x.n, 0); const top = [...d].filter(x => x.n).sort((a, b) => b.n - a.n)[0];
  if (!top) return null;
  return <div>💡 Necessidade mais citada: <b>{top.completo}</b> ({pct(top.n, tot)}).</div>;
}
function insightSit(d: { completo: string; n: number }[]) {
  const tot = d.reduce((s, x) => s + x.n, 0); const risco = d.find(x => /risco|ruim|insatisf/i.test(x.completo));
  if (!risco || !tot) return null;
  return <div>⚠️ <b>{pct(risco.n, tot)}</b> em <b>{risco.completo}</b> — atenção prioritária.</div>;
}
function insightForte(d: { completo: string; n: number }[]) {
  const top = [...d].filter(x => x.n).sort((a, b) => b.n - a.n)[0];
  if (!top) return null;
  return <div>⭐ Ponto forte mais reconhecido: <b>{top.completo}</b>.</div>;
}
