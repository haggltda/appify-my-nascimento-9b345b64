import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { Formulario, Pergunta, fmtDt, normalizaPerguntas } from "./Formularios";

// =====================================================================
// NASCIMENTO FORMULÁRIOS — 📊 Dashboard customizável
// O usuário monta o próprio painel com widgets sobre os formulários:
//   kpi      — indicador (total/hoje/7 dias/30 dias de respostas)
//   grafico  — respostas de uma pergunta (barras ou pizza)
//   tempo    — respostas por dia (série temporal)
//   ultimas  — últimas respostas de um formulário
// Cada widget tem título, formulário, largura (1/3, 2/3, cheia) e pode ser
// reordenado. O layout é salvo por usuário em CS_FORM_ACESSOS
// (papel 'dashboard', config jsonb).
// Os dados respeitam a RLS: só aparecem formulários que o usuário vê.
// =====================================================================

interface Widget {
  id: string;
  tipo: "kpi" | "grafico" | "tempo" | "ultimas";
  titulo?: string;
  formulario_id?: string | "todos";
  pergunta_id?: string;
  estilo?: "barras" | "pizza";
  metrica?: "total" | "hoje" | "7dias" | "30dias";
  dias?: number;
  limite?: number;
  largura?: 1 | 2 | 3;
}
type Perg = Pergunta & { formulario_id: string };
interface Resp { id: string; formulario_id: string; enviado_em: string; respondente_nome?: string | null; itens: Record<string, any>; }

const CORES = ["#0f3171", "#2563eb", "#0891b2", "#16a34a", "#eab308", "#ea580c", "#dc2626", "#9333ea", "#db2777", "#64748b"];
const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "6px 12px", borderRadius: 9, border, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" });
const inp: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { display: "block", fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 };
const novoId = () => Math.random().toString(36).slice(2, 10);

const WIDGETS_PADRAO: Widget[] = [
  { id: novoId(), tipo: "kpi", metrica: "total", formulario_id: "todos", largura: 1 },
  { id: novoId(), tipo: "kpi", metrica: "7dias", formulario_id: "todos", largura: 1 },
  { id: novoId(), tipo: "tempo", formulario_id: "todos", dias: 14, largura: 1 },
];

export default function FormulariosDashboard() {
  const nav = useNavigate();
  const [forms, setForms] = useState<Formulario[]>([]);
  const [resps, setResps] = useState<Resp[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [sujo, setSujo] = useState(false);
  const [editando, setEditando] = useState<Widget | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);
  const toast = (msg: string, t = "info") => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, t }]); setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 4200); };

  const load = useCallback(async () => {
    setLoading(true);
    const [fRes, rRes, dRes] = await Promise.all([
      (supabase as any).from("CS_FORMULARIOS").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("CS_FORM_RESPOSTAS").select("id, formulario_id, enviado_em, respondente_nome, itens").order("enviado_em", { ascending: false }).limit(5000),
      (supabase as any).from("CS_FORM_ACESSOS").select("config").eq("papel", "dashboard").maybeSingle(),  // RLS: só a linha do próprio usuário
    ]);
    setForms(fRes.data ?? []);
    setResps((rRes.data ?? []).map((r: any) => ({ ...r, itens: r.itens ?? {} })));
    const cfg = dRes.data?.config;
    setWidgets(Array.isArray(cfg) && cfg.length ? cfg : WIDGETS_PADRAO);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const pergs = useMemo<Perg[]>(() => forms.flatMap(f => normalizaPerguntas(f.perguntas).map(p => ({ ...p, formulario_id: f.id }))), [forms]);

  const salvar = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: atual } = await (supabase as any).from("CS_FORM_ACESSOS")
      .select("id").eq("papel", "dashboard").eq("user_id", u.user.id).maybeSingle();
    const { error } = atual
      ? await (supabase as any).from("CS_FORM_ACESSOS").update({ config: widgets }).eq("id", atual.id)
      : await (supabase as any).from("CS_FORM_ACESSOS").insert({ papel: "dashboard", user_id: u.user.id, config: widgets });
    if (error) { toast("Erro ao salvar: " + error.message, "err"); return; }
    setSujo(false);
    toast("Dashboard salvo.", "ok");
  };

  const muda = (w: Widget[]) => { setWidgets(w); setSujo(true); };
  const move = (i: number, dir: -1 | 1) => { const a = [...widgets]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; muda(a); };
  const remove = (i: number) => muda(widgets.filter((_, j) => j !== i));
  const aplicaEdicao = (w: Widget) => {
    const existe = widgets.some(x => x.id === w.id);
    muda(existe ? widgets.map(x => (x.id === w.id ? w : x)) : [...widgets, w]);
    setEditando(null);
  };

  const formPorId = useMemo(() => Object.fromEntries(forms.map(f => [f.id, f])), [forms]);
  const respsDe = useCallback((fid?: string | "todos") => (!fid || fid === "todos") ? resps : resps.filter(r => r.formulario_id === fid), [resps]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Carregando...</div>;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, flexWrap: "wrap" }}>
        <button onClick={() => nav("/app/central-servicos/formularios")} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>← Voltar</button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171" }}>📊 Dashboard — Nascimento Formulários</div>
          <div style={{ fontSize: 11.5, color: "#94a3b8" }}>Monte seu painel: adicione, configure, reordene e redimensione os widgets. O layout é seu.</div>
        </div>
        <button onClick={() => setEditando({ id: novoId(), tipo: "kpi", metrica: "total", formulario_id: "todos", largura: 1 })} style={btn("#fff", "#0f3171", "1px solid #0f3171")}>+ Widget</button>
        <button onClick={salvar} style={btn(sujo ? "#0f3171" : "#94a3b8")}>💾 Salvar layout</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 40px" }}>
        {widgets.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Painel vazio — clique em <b>+ Widget</b> para começar.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {widgets.map((w, i) => (
              <div key={w.id} style={{ gridColumn: `span ${Math.min(w.largura ?? 1, 3)}`, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 8px 24px rgba(15,23,42,.06)", display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 0" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tituloWidget(w, formPorId, pergs)}</div>
                  <button onClick={() => move(i, -1)} title="Mover para trás" style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 12 }}>◀</button>
                  <button onClick={() => move(i, 1)} title="Mover para frente" style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 12 }}>▶</button>
                  <button onClick={() => setEditando(w)} title="Configurar" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>⚙</button>
                  <button onClick={() => remove(i)} title="Remover" style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12 }}>✕</button>
                </div>
                <div style={{ padding: "8px 14px 14px", flex: 1, minWidth: 0 }}>
                  <CorpoWidget w={w} resps={respsDe(w.formulario_id)} pergs={pergs} forms={forms} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editando && <ModalWidget w={editando} forms={forms} pergs={pergs} onClose={() => setEditando(null)} onOk={aplicaEdicao} />}

      <div style={{ position: "fixed", bottom: 18, right: 18, display: "flex", flexDirection: "column", gap: 8, zIndex: 999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.t === "err" ? "#fee2e2" : t.t === "ok" ? "#dcfce7" : "#e0f2fe", color: t.t === "err" ? "#b91c1c" : t.t === "ok" ? "#15803d" : "#0369a1", padding: "10px 16px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, boxShadow: "0 8px 24px rgba(15,23,42,.15)", maxWidth: 380 }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

function tituloWidget(w: Widget, formPorId: Record<string, Formulario>, pergs: Perg[]) {
  if (w.titulo?.trim()) return w.titulo;
  const nomeForm = w.formulario_id && w.formulario_id !== "todos" ? formPorId[w.formulario_id]?.titulo ?? "Formulário" : "Todos os formulários";
  if (w.tipo === "kpi") return ({ total: "Total de respostas", hoje: "Respostas hoje", "7dias": "Respostas — 7 dias", "30dias": "Respostas — 30 dias" }[w.metrica ?? "total"]) + " · " + nomeForm;
  if (w.tipo === "tempo") return "Respostas por dia · " + nomeForm;
  if (w.tipo === "ultimas") return "Últimas respostas · " + nomeForm;
  const p = pergs.find(x => x.id === w.pergunta_id);
  return p ? p.titulo : "Gráfico de pergunta";
}

function CorpoWidget({ w, resps, pergs, forms }: { w: Widget; resps: Resp[]; pergs: Perg[]; forms: Formulario[] }) {
  if (w.tipo === "kpi") {
    const agora = Date.now();
    const corte = w.metrica === "hoje" ? new Date().setHours(0, 0, 0, 0)
      : w.metrica === "7dias" ? agora - 7 * 86400000
      : w.metrica === "30dias" ? agora - 30 * 86400000 : 0;
    const n = resps.filter(r => +new Date(r.enviado_em) >= corte).length;
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: "#0f3171", lineHeight: 1 }}>{n}</div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>resposta(s)</div>
      </div>
    );
  }

  if (w.tipo === "tempo") {
    const dias = w.dias ?? 14;
    const buckets: { dia: string; n: number }[] = [];
    for (let d = dias - 1; d >= 0; d--) {
      const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - d);
      const prox = +dt + 86400000;
      buckets.push({ dia: dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), n: resps.filter(r => { const t = +new Date(r.enviado_em); return t >= +dt && t < prox; }).length });
    }
    return (
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={buckets} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
          <XAxis dataKey="dia" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip formatter={(v: any) => [v, "respostas"]} />
          <Bar dataKey="n" fill="#0f3171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (w.tipo === "ultimas") {
    const lim = w.limite ?? 5;
    const ult = resps.slice(0, lim);
    if (!ult.length) return <div style={{ fontSize: 12, color: "#94a3b8" }}>Sem respostas ainda.</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {ult.map(r => (
          <div key={r.id} style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "baseline", borderBottom: "1px solid #f8fafc", paddingBottom: 4 }}>
            <span style={{ fontWeight: 700, color: "#0f172a", flexShrink: 0 }}>{r.respondente_nome || "Anônimo"}</span>
            <span style={{ color: "#94a3b8", flexShrink: 0 }}>{fmtDt(r.enviado_em)}</span>
            <span style={{ color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {forms.find(f => f.id === r.formulario_id)?.titulo ?? ""}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // grafico — distribuição das respostas de uma pergunta
  const p = pergs.find(x => x.id === w.pergunta_id);
  if (!p) return <div style={{ fontSize: 12, color: "#94a3b8" }}>Configure a pergunta no ⚙.</div>;
  const cont: Record<string, number> = {};
  resps.forEach(r => {
    const v = r.itens[p.id];
    if (v == null || v === "") return;
    (Array.isArray(v) ? v : [v]).forEach(x => { cont[String(x)] = (cont[String(x)] || 0) + 1; });
  });
  let chaves: string[];
  if (p.tipo === "escala") { chaves = []; for (let n = p.config?.min ?? 1; n <= (p.config?.max ?? 5); n++) chaves.push(String(n)); }
  else chaves = p.opcoes.length ? p.opcoes : Object.keys(cont);
  const dados = chaves.map(k => ({ nome: k.length > 22 ? k.slice(0, 22) + "…" : k, completo: k, n: cont[k] || 0 }));
  if (!dados.some(d => d.n)) return <div style={{ fontSize: 12, color: "#94a3b8" }}>Sem respostas para esta pergunta.</div>;

  if (w.estilo === "pizza") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={dados.filter(d => d.n)} dataKey="n" nameKey="nome" cx="50%" cy="50%" outerRadius={70} label={(e: any) => e.nome}>
            {dados.filter(d => d.n).map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any, _n: any, e: any) => [v, e?.payload?.completo]} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, dados.length * 26)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
        <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 10.5 }} />
        <Tooltip formatter={(v: any, _n: any, e: any) => [v, e?.payload?.completo]} />
        <Bar dataKey="n" fill="#0f3171" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ModalWidget({ w, forms, pergs, onClose, onOk }: { w: Widget; forms: Formulario[]; pergs: Perg[]; onClose: () => void; onOk: (w: Widget) => void }) {
  const [cfg, setCfg] = useState<Widget>({ ...w });
  const m = (patch: Partial<Widget>) => setCfg(x => ({ ...x, ...patch }));
  const pergsDoForm = pergs.filter(p => p.formulario_id === cfg.formulario_id && ["multipla_escolha", "caixas_selecao", "lista_suspensa", "escala"].includes(p.tipo));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 900, padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 22, width: 480, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Configurar widget</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lbl}>Tipo</label>
            <select value={cfg.tipo} onChange={e => m({ tipo: e.target.value as Widget["tipo"] })} style={inp}>
              <option value="kpi">Indicador (nº de respostas)</option>
              <option value="grafico">Gráfico de uma pergunta</option>
              <option value="tempo">Respostas por dia</option>
              <option value="ultimas">Últimas respostas</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Título (opcional — vazio usa o automático)</label>
            <input value={cfg.titulo ?? ""} onChange={e => m({ titulo: e.target.value })} style={inp} placeholder="Ex.: Clima — satisfação geral" />
          </div>
          <div>
            <label style={lbl}>Formulário</label>
            <select value={cfg.formulario_id ?? "todos"} onChange={e => m({ formulario_id: e.target.value, pergunta_id: undefined })} style={inp}>
              {cfg.tipo !== "grafico" && <option value="todos">Todos os formulários</option>}
              {forms.map(f => <option key={f.id} value={f.id}>{f.titulo}</option>)}
            </select>
          </div>
          {cfg.tipo === "kpi" && (
            <div>
              <label style={lbl}>Métrica</label>
              <select value={cfg.metrica ?? "total"} onChange={e => m({ metrica: e.target.value as Widget["metrica"] })} style={inp}>
                <option value="total">Total de respostas</option>
                <option value="hoje">Respostas hoje</option>
                <option value="7dias">Últimos 7 dias</option>
                <option value="30dias">Últimos 30 dias</option>
              </select>
            </div>
          )}
          {cfg.tipo === "grafico" && (
            <>
              <div>
                <label style={lbl}>Pergunta (escolhas ou escala)</label>
                <select value={cfg.pergunta_id ?? ""} onChange={e => m({ pergunta_id: e.target.value })} style={inp}>
                  <option value="">Selecione...</option>
                  {pergsDoForm.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                </select>
                {cfg.formulario_id && cfg.formulario_id !== "todos" && pergsDoForm.length === 0 && (
                  <div style={{ fontSize: 11.5, color: "#a16207", marginTop: 4 }}>Este formulário não tem perguntas de escolha/escala.</div>
                )}
              </div>
              <div>
                <label style={lbl}>Estilo</label>
                <select value={cfg.estilo ?? "barras"} onChange={e => m({ estilo: e.target.value as Widget["estilo"] })} style={inp}>
                  <option value="barras">Barras</option>
                  <option value="pizza">Pizza</option>
                </select>
              </div>
            </>
          )}
          {cfg.tipo === "tempo" && (
            <div>
              <label style={lbl}>Período</label>
              <select value={cfg.dias ?? 14} onChange={e => m({ dias: Number(e.target.value) })} style={inp}>
                <option value={7}>7 dias</option><option value={14}>14 dias</option><option value={30}>30 dias</option><option value={60}>60 dias</option>
              </select>
            </div>
          )}
          {cfg.tipo === "ultimas" && (
            <div>
              <label style={lbl}>Quantidade</label>
              <select value={cfg.limite ?? 5} onChange={e => m({ limite: Number(e.target.value) })} style={inp}>
                <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
              </select>
            </div>
          )}
          <div>
            <label style={lbl}>Largura</label>
            <select value={cfg.largura ?? 1} onChange={e => m({ largura: Number(e.target.value) as Widget["largura"] })} style={inp}>
              <option value={1}>1/3 da tela</option><option value={2}>2/3 da tela</option><option value={3}>Tela inteira</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>Cancelar</button>
          <button onClick={() => onOk(cfg)} disabled={cfg.tipo === "grafico" && !cfg.pergunta_id} style={btn(cfg.tipo === "grafico" && !cfg.pergunta_id ? "#94a3b8" : "#0f3171")}>✓ Aplicar</button>
        </div>
      </div>
    </div>
  );
}
