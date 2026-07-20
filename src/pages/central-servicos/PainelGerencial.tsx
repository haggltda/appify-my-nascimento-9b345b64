import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
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
type Mapa = Record<string, string | undefined>;

function autoMapa(pergs: Pergunta[]): Mapa {
  const m: Mapa = {};
  const chart = pergs.filter(p => CHART_TIPOS.includes(p.tipo));
  for (const ind of IND) {
    const achou = chart.find(p => ind.kw.some(k => semAcento(p.titulo || "").includes(k)));
    if (achou) m[ind.key] = achou.id;
  }
  return m;
}

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
    filtradas.forEach(r => { const s = (r.setor ?? "—").trim() || "—"; const v = r.itens[nP.id]; (Array.isArray(v) ? v : [v]).forEach((x: any) => { if (x == null || x === "") return; (porSetor[s] ??= {}); porSetor[s][String(x)] = (porSetor[s][String(x)] || 0) + 1; }); });
    return Object.entries(porSetor).map(([setor, cont]) => { const top = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]; return { setor, nec: top?.[0] ?? "—", n: top?.[1] ?? 0 }; }).sort((a, b) => b.n - a.n).slice(0, 6);
  }, [pergs, mapa, filtradas]);

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
            const pronto = t === "Desenvolvimento";
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
            {IND.map(ind => (
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
        {tab !== "Desenvolvimento" ? (
          <div style={{ padding: 70, textAlign: "center", color: "#94a3b8", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14 }}>
            A aba <b>{tab}</b> entra em breve. Estamos começando por <b>Desenvolvimento</b>.
          </div>
        ) : !form ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Selecione um formulário.</div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
              {distSituacao.slice(0, 4).map((d, i) => (
                <Kpi key={d.completo} titulo={d.completo} valor={d.n} cor={CAT_CORES[i]} sub={`${pct(d.n, totalMenc(distSituacao))} do total`} />
              ))}
              <Kpi titulo="Pontos fortes citados" valor={totalMenc(distFortes)} cor="#7c3aed" sub="Menções no período" />
              <Kpi titulo="Pontos de melhoria citados" valor={totalMenc(distMelhoria)} cor="#0891b2" sub="Menções no período" />
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
                  <Painel titulo="Insights principais" semViz>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "#334155" }}>
                      {insightNec(distNecess)}
                      {insightSit(distSituacao)}
                      {insightForte(distFortes)}
                    </div>
                  </Painel>
                </div>

                {/* Detalhamento por situação */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                  {distSituacao.slice(0, 4).map((d, i) => (
                    <div key={d.completo} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: CAT_CORES[i], textTransform: "uppercase", letterSpacing: ".4px" }}>{d.completo}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{d.n}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>colaborador(es) · {pct(d.n, totalMenc(distSituacao))}</div>
                    </div>
                  ))}
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

function Kpi({ titulo, valor, cor, sub }: { titulo: string; valor: number; cor: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: cor, marginTop: 4 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Painel({ titulo, children, viz, onViz, vizOpts, semViz, perg }: { titulo: string; children: React.ReactNode; viz?: Viz; onViz?: (v: Viz) => void; vizOpts?: Viz[]; semViz?: boolean; perg?: Pergunta }) {
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
      {!semViz && perg === undefined
        ? <div style={{ fontSize: 11.5, color: "#a16207", marginTop: 8 }}>Defina a pergunta em ⚙ Mapeamento.</div>
        : <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

function Chart({ dados, viz, cor }: { dados: { nome: string; completo: string; n: number }[]; viz: Viz; cor: string }) {
  const comDados = dados.filter(d => d.n);
  if (!comDados.length) return <Vazio />;
  const tip = <Tooltip formatter={(v: any, _n: any, e: any) => [v, e?.payload?.completo]} />;
  if (viz === "pizza" || viz === "rosca") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={comDados} dataKey="n" nameKey="nome" cx="50%" cy="50%" innerRadius={viz === "rosca" ? 50 : 0} outerRadius={80} label={(e: any) => e.nome}>
            {comDados.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
          </Pie>{tip}
        </PieChart>
      </ResponsiveContainer>
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
  // barras (horizontal) — default
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 30)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 14, left: 8, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
        <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 10 }} />{tip}
        <Bar dataKey="n" radius={[0, 4, 4, 0]}>{dados.map((_, i) => <Cell key={i} fill={cor} />)}</Bar>
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
