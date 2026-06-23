import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVinculoEmpregado } from "@/hooks/useVinculoEmpregado";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend, CartesianGrid } from "recharts";

// =====================================================================
// JURÍDICO — Processos (adaptado ao layout do ERP)
// 3 telas (itens de menu): "Dashboard - Processos", "Processos", "Audiências".
// Dados: JUR_PROCESSOS (1 linha por motivo, agrupadas por numero_processo)
// + SISTEMA_COMENTARIOS (modulo='processo'). Agrupamento/somatórios espelham o routes.py.
// =====================================================================

const VAL_FIELDS = ["valor_pedidos", "valor_acordo", "valor_sentenca", "valor_final", "valor_outros_custos", "valor_deposito_recursal", "valor_custas_processuais"] as const;

interface MotivoItem { ordem: number; motivo: string; valor_pedidos: number; valor_acordo: number; valor_sentenca: number; valor_final: number; valor_outros_custos: number; valor_deposito_recursal: number; valor_custas_processuais: number; }
interface Audiencia { ordem: number; data: string; tipo_audiencia?: string; modalidade_audiencia?: string; horario?: string; }
interface Processo {
  numero_processo: string; reclamante: string; reclamada: string; comarca: string; municipio_origem: string;
  status: string; ano_processo: number; origem: string; contrato: string;
  valor_causa: number; valor_pedidos: number; valor_acordo: number; valor_sentenca: number;
  valor_final: number; valor_outros_custos: number; valor_deposito_recursal: number; valor_custas_processuais: number;
  motivos: string; motivo_items: MotivoItem[]; houve_acordo: string; status_sentenca: string;
  data_entrada_reclamatoria: string; tipo_audiencia: string; modalidade_audiencia: string; audiencias: Audiencia[];
}
interface Comentario { id: number; entidade_id?: string; autor_nome?: string; texto: string; created_at?: string; }

const STATUS_OPC = ["EM ANDAMENTO", "INDEFINIDO", "ARQUIVADO"];
const PALETTE = ["#f97316", "#14b8a6", "#eab308", "#a78bfa", "#2563eb", "#dc2626", "#16a34a", "#0f3171", "#ec4899", "#0891b2"];

const toFloat = (v: any) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const money = (v?: number) => (v == null || isNaN(Number(v))) ? "R$ 0,00" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyShort = (v: number) => { const a = Math.abs(v); if (a >= 1e6) return "R$ " + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "M"; if (a >= 1e3) return "R$ " + (v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "k"; return money(v); };
const fmtDt = (s?: string) => { if (!s) return "—"; const d = new Date(String(s).length <= 10 ? s + "T12:00:00" : s); return isNaN(+d) ? String(s) : d.toLocaleDateString("pt-BR"); };
const hojeISO = () => new Date().toISOString().slice(0, 10);
const anoDoNumero = (n: string) => { const m = String(n || "").match(/\.(\d{4})\.\d\.\d{2}\./); return m ? Number(m[1]) : null; };
const custoTotal = (p: any) => p.valor_final > 0 ? p.valor_final : p.valor_acordo + p.valor_sentenca + p.valor_outros_custos + p.valor_deposito_recursal + p.valor_custas_processuais;
const motivoTotal = (i: MotivoItem) => VAL_FIELDS.reduce((s, k) => s + toFloat(i[k]), 0);

function parseAudiencias(rs: any[]): Audiencia[] {
  for (const r of rs) {
    const raw = r.audiencias_json;
    if (raw && String(raw).trim() && String(raw).trim() !== "[]") {
      try {
        const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(arr) && arr.length) return arr.filter((a: any) => a && (a.data || a.data_audiencia)).map((a: any, i: number) => ({ ordem: i + 1, data: String(a.data || a.data_audiencia).slice(0, 10), tipo_audiencia: a.tipo_audiencia || a.tipo || "Audiência", modalidade_audiencia: a.modalidade_audiencia || a.modalidade, horario: a.horario })).sort((a, b) => a.data.localeCompare(b.data));
      } catch { /* json inválido */ }
    }
  }
  const out: Audiencia[] = [];
  const pick = (k: string) => { for (const r of rs) { const v = r[k]; if (v) return String(v).slice(0, 10); } return null; };
  const d = pick("data_audiencia_designada") || pick("data_audiencia_instrucao") || pick("primeira_audiencia") || pick("data_primeira_audiencia");
  if (d) out.push({ ordem: 1, data: d, tipo_audiencia: rs[0]?.tipo_audiencia || "Audiência", modalidade_audiencia: rs[0]?.modalidade_audiencia });
  return out;
}
function agrupar(rows: any[]): Processo[] {
  const seen = new Map<string, any>();
  for (const r of rows) { const key = `${r.numero_processo}|${String(r.motivos || "").trim()}|${r.motivo_ordem ?? 0}`; const prev = seen.get(key); if (!prev || Number(r.id || 0) < Number(prev.id || 0)) seen.set(key, r); }
  const groups = new Map<string, any[]>();
  for (const r of seen.values()) { const n = r.numero_processo; if (!n) continue; if (!groups.has(n)) groups.set(n, []); groups.get(n)!.push(r); }
  const out: Processo[] = [];
  for (const [numero, rs] of groups) {
    rs.sort((a, b) => (Number(a.motivo_ordem ?? a.id) - Number(b.motivo_ordem ?? b.id)) || Number(a.id) - Number(b.id));
    const first = (k: string) => { for (const r of rs) { const v = String(r[k] ?? "").trim(); if (v) return v; } return ""; };
    const sum = (k: string) => rs.reduce((s, r) => s + toFloat(r[k]), 0);
    const maxN = (k: string) => rs.reduce((m, r) => Math.max(m, Number(r[k]) || 0), 0);
    const motivo_items: MotivoItem[] = rs.map((r, i) => { const o: any = { ordem: Number(r.motivo_ordem ?? i + 1), motivo: String(r.motivos ?? "").trim() || "Sem motivo" }; VAL_FIELDS.forEach(k => o[k] = toFloat(r[k])); return o; });
    out.push({
      numero_processo: numero, reclamante: first("reclamante"), reclamada: first("reclamada"), comarca: first("comarca"), municipio_origem: first("municipio_origem"),
      status: (first("status") || "EM ANDAMENTO").toUpperCase(), ano_processo: maxN("ano_processo"), origem: first("origem").toLowerCase(), contrato: first("contrato"),
      valor_causa: sum("valor_causa"), valor_pedidos: sum("valor_pedidos"), valor_acordo: sum("valor_acordo"), valor_sentenca: sum("valor_sentenca"),
      valor_final: sum("valor_final"), valor_outros_custos: sum("valor_outros_custos"), valor_deposito_recursal: sum("valor_deposito_recursal"), valor_custas_processuais: sum("valor_custas_processuais"),
      motivos: rs.map(r => String(r.motivos ?? "").trim() || "Sem motivo").join(" • "), motivo_items,
      houve_acordo: first("houve_acordo"), status_sentenca: first("status_sentenca"), data_entrada_reclamatoria: first("data_entrada_reclamatoria"),
      tipo_audiencia: first("tipo_audiencia"), modalidade_audiencia: first("modalidade_audiencia"), audiencias: parseAudiencias(rs),
    });
  }
  out.sort((a, b) => (b.ano_processo - a.ano_processo) || a.numero_processo.localeCompare(b.numero_processo));
  return out;
}

const ativo = (p: Processo) => p.status !== "ARQUIVADO";
const FORM_RESET = () => ({ numero_processo: "", reclamante: "", reclamada: "", status: "EM ANDAMENTO", comarca: "", municipio_origem: "", data_entrada_reclamatoria: "", contrato: "" });
const MOTIVO_RESET = (): MotivoItem => ({ ordem: 1, motivo: "", valor_pedidos: 0, valor_acordo: 0, valor_sentenca: 0, valor_final: 0, valor_outros_custos: 0, valor_deposito_recursal: 0, valor_custas_processuais: 0 });

const TITULOS: Record<string, string> = { dashboard: "📊 Dashboard - Processos", processos: "📁 Processos", audiencias: "📅 Audiências" };

export default function Processos({ view = "processos" }: { view?: "dashboard" | "processos" | "audiencias" }) {
  const { user } = useAuth();
  const { empregado } = useVinculoEmpregado();
  const autor = empregado?.nome || (user?.user_metadata as any)?.nome || user?.email || "Usuário";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  const [sel, setSel] = useState<Processo | null>(null);
  const [coments, setComents] = useState<Comentario[]>([]);
  const [novoComent, setNovoComent] = useState("");

  const [modal, setModal] = useState(false);
  const [editNumero, setEditNumero] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_RESET());
  const [motivos, setMotivos] = useState<MotivoItem[]>([MOTIVO_RESET()]);
  const [auds, setAuds] = useState<Audiencia[]>([]);

  const toast = (msg: string, t = "info") => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, t }]); setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 3600); };

  const load = useCallback(async () => {
    setLoading(true); setErro(null);
    const all: any[] = []; const chunk = 1000;
    for (let from = 0; from <= 300000; from += chunk) {
      const { data, error } = await (supabase as any).from("JUR_PROCESSOS").select("*").order("id", { ascending: true }).range(from, from + chunk - 1);
      if (error) { setErro(error.message); setRows([]); setLoading(false); return; }
      all.push(...(data ?? [])); if (!data || data.length < chunk) break;
    }
    setRows(all); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const processos = useMemo(() => agrupar(rows), [rows]);
  const resumo = useMemo(() => {
    const r = { processos: processos.length, em_andamento: 0, pedidos: 0, acordos: 0, sentencas: 0, final: 0, causa_rt: 0 };
    for (const p of processos) { if (ativo(p)) r.em_andamento++; r.pedidos += p.valor_pedidos; r.acordos += p.valor_acordo; r.sentencas += p.valor_sentenca; r.final += custoTotal(p); if (p.origem === "rtgeral") r.causa_rt += p.valor_causa; }
    return r;
  }, [processos]);
  const porMotivo = useMemo(() => {
    const acc = new Map<string, any>();
    for (const p of processos) for (const it of p.motivo_items) { const m = it.motivo || "Não especificado"; const s = acc.get(m) || { motivo: m, count: 0, processos: new Set(), total: 0 }; s.count++; s.processos.add(p.numero_processo); s.total += motivoTotal(it); acc.set(m, s); }
    return [...acc.values()].map(v => ({ motivo: v.motivo, count: v.count, processos: v.processos.size, total: v.total })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [processos]);
  const porAno = useMemo(() => {
    const acc = new Map<number, any>();
    for (const p of processos) { if (!p.ano_processo) continue; const s = acc.get(p.ano_processo) || { ano: String(p.ano_processo), count: 0, pedidos: 0, acordos: 0, total: 0 }; s.count++; s.pedidos += p.valor_pedidos; s.acordos += p.valor_acordo; s.total += custoTotal(p); acc.set(p.ano_processo, s); }
    return [...acc.values()].sort((a, b) => Number(a.ano) - Number(b.ano));
  }, [processos]);
  const porReclamada = useMemo(() => {
    const acc = new Map<string, any>();
    for (const p of processos) { const e = p.reclamada || "Não informado"; const s = acc.get(e) || { empresa: e, num: 0, total: 0 }; s.num++; s.total += custoTotal(p); acc.set(e, s); }
    return [...acc.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [processos]);
  const audiencias = useMemo(() => {
    const out: any[] = []; const hoje = hojeISO();
    for (const p of processos) for (const a of p.audiencias) { if (!a.data) continue; out.push({ numero: p.numero_processo, reclamante: p.reclamante, reclamada: p.reclamada, data: a.data, tipo: a.tipo_audiencia, modalidade: a.modalidade_audiencia, status: p.status, futuro: a.data >= hoje }); }
    out.sort((a, b) => (a.futuro === b.futuro ? (a.futuro ? a.data.localeCompare(b.data) : b.data.localeCompare(a.data)) : (a.futuro ? -1 : 1)));
    return out;
  }, [processos]);
  const filtrados = useMemo(() => processos.filter(p => {
    if (fStatus && p.status !== fStatus) return false;
    if (busca) { const q = busca.toLowerCase(); return [p.numero_processo, p.reclamante, p.reclamada, p.motivos, p.comarca, String(p.ano_processo)].some(x => String(x || "").toLowerCase().includes(q)); }
    return true;
  }), [processos, busca, fStatus]);
  const motivosNoRecorte = useMemo(() => filtrados.reduce((s, p) => s + p.motivo_items.length, 0), [filtrados]);
  const statusPredominante = useMemo(() => { const c: Record<string, number> = {}; filtrados.forEach(p => c[p.status] = (c[p.status] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || "—"; }, [filtrados]);

  // ── comentários ────────────────────────────────────────────────
  const abrirDetalhe = async (p: Processo) => {
    setSel(p); setComents([]); setNovoComent("");
    const { data } = await (supabase as any).from("SISTEMA_COMENTARIOS").select("*").eq("modulo", "processo").eq("entidade_id", p.numero_processo).order("created_at", { ascending: false });
    setComents(data ?? []);
  };
  const addComent = async () => {
    if (!sel || !novoComent.trim()) return;
    const { data, error } = await (supabase as any).from("SISTEMA_COMENTARIOS").insert({ modulo: "processo", entidade_id: sel.numero_processo, autor_nome: autor, texto: novoComent.trim() }).select("*").single();
    if (error) { toast("Erro ao comentar: " + error.message, "err"); return; }
    setComents(c => [data, ...c]); setNovoComent("");
  };
  const delComent = async (c: Comentario) => { if (!confirm("Excluir este comentário?")) return; const { error } = await (supabase as any).from("SISTEMA_COMENTARIOS").delete().eq("id", c.id); if (error) { toast("Erro: " + error.message, "err"); return; } setComents(x => x.filter(i => i.id !== c.id)); };

  // ── CRUD ───────────────────────────────────────────────────────
  const abrirNovo = () => { setEditNumero(null); setForm(FORM_RESET()); setMotivos([MOTIVO_RESET()]); setAuds([]); setModal(true); };
  const abrirEditar = (p: Processo) => {
    setEditNumero(p.numero_processo);
    setForm({ numero_processo: p.numero_processo, reclamante: p.reclamante, reclamada: p.reclamada, status: p.status, comarca: p.comarca, municipio_origem: p.municipio_origem, data_entrada_reclamatoria: (p.data_entrada_reclamatoria || "").slice(0, 10), contrato: p.contrato });
    setMotivos(p.motivo_items.length ? p.motivo_items.map(m => ({ ...m })) : [MOTIVO_RESET()]); setAuds(p.audiencias.map(a => ({ ...a }))); setModal(true);
  };
  const salvar = async () => {
    const numero = form.numero_processo.replace(/\s+/g, "").trim();
    if (!numero) { toast("Informe o número do processo.", "err"); return; }
    if (!form.reclamante.trim()) { toast("Informe o reclamante.", "err"); return; }
    const dataEntrada = form.data_entrada_reclamatoria || null;
    const ano = (dataEntrada ? Number(dataEntrada.slice(0, 4)) : null) || anoDoNumero(numero) || null;
    const audsJson = auds.length ? JSON.stringify(auds.map((a, i) => ({ ordem: i + 1, data: a.data, tipo_audiencia: a.tipo_audiencia || "Audiência", modalidade_audiencia: a.modalidade_audiencia, horario: a.horario }))) : null;
    const primeira = auds.length ? auds.map(a => a.data).filter(Boolean).sort()[0] || null : null;
    const lista = motivos.length ? motivos : [MOTIVO_RESET()];
    const novas = lista.map((m, idx) => ({
      numero_processo: numero, reclamante: form.reclamante.trim(), reclamada: form.reclamada.trim() || null, motivos: m.motivo.trim() || "Sem motivo",
      status: form.status, ano_processo: ano, motivo_ordem: idx + 1,
      valor_pedidos: m.valor_pedidos || 0, valor_acordo: m.valor_acordo || 0, valor_sentenca: m.valor_sentenca || 0, valor_final: m.valor_final || 0,
      valor_outros_custos: m.valor_outros_custos || 0, valor_deposito_recursal: m.valor_deposito_recursal || 0, valor_custas_processuais: m.valor_custas_processuais || 0,
      houve_acordo: m.valor_acordo > 0 ? "Sim" : "Não", comarca: form.comarca.trim() || null, municipio_origem: form.municipio_origem.trim() || null,
      contrato: form.contrato.trim() || null, data_entrada_reclamatoria: dataEntrada, primeira_audiencia: primeira, data_primeira_audiencia: primeira,
      audiencias_json: audsJson, tipo_audiencia: auds[0]?.tipo_audiencia || null, modalidade_audiencia: auds[0]?.modalidade_audiencia || null, updated_at: new Date().toISOString(),
    }));
    if (editNumero && editNumero !== numero && processos.some(p => p.numero_processo === numero)) { toast("Já existe outro processo com esse número.", "err"); return; }
    const del = await (supabase as any).from("JUR_PROCESSOS").delete().eq("numero_processo", editNumero || numero);
    if (del.error) { toast("Erro ao salvar: " + del.error.message, "err"); return; }
    const ins = await (supabase as any).from("JUR_PROCESSOS").insert(novas);
    if (ins.error) { toast("Erro ao salvar: " + ins.error.message, "err"); return; }
    setModal(false); toast(editNumero ? "Processo atualizado." : "Processo cadastrado.", "ok"); load();
  };
  const excluir = async (p: Processo) => {
    if (!confirm(`Excluir o processo ${p.numero_processo} e todos os seus lançamentos?`)) return;
    const { error } = await (supabase as any).from("JUR_PROCESSOS").delete().eq("numero_processo", p.numero_processo);
    if (error) { toast("Erro ao excluir: " + error.message, "err"); return; }
    setSel(null); toast("Processo excluído.", "ok"); load();
  };
  const setMotivo = (i: number, patch: Partial<MotivoItem>) => setMotivos(ms => ms.map((m, idx) => idx === i ? { ...m, ...patch } : m));

  const statusCor = (s: string) => s === "ARQUIVADO" ? { bg: "#f1f5f9", c: "#64748b" } : s === "INDEFINIDO" ? { bg: "#fef9c3", c: "#a16207" } : { bg: "#fef3c7", c: "#b45309" };
  const kpi = (label: string, valor: string | number, cor: string, sub?: string) => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 18px", flex: 1, minWidth: 165, boxShadow: "0 8px 24px rgba(15,23,42,.05)", borderTop: `3px solid ${cor}` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".6px" }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: cor, marginTop: 3 }}>{valor}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, boxShadow: "0 8px 24px rgba(15,23,42,.05)" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <style>{`
        .jpr-fi{width:100%;height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 11px;font-size:13px;background:#fff;box-sizing:border-box}
        textarea.jpr-fi{height:auto;padding:9px 11px;resize:vertical}
        .jpr-fi:focus{outline:none;border-color:#0f3171;box-shadow:0 0 0 3px rgba(15,49,113,.1)}
        .jpr-fg label{display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
        .jpr-btn{border:none;border-radius:9px;font-weight:700;cursor:pointer;font-size:12px;padding:8px 14px}
        .jpr-ov{position:fixed;inset:0;z-index:700;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
        .jpr-modal{background:#fff;border-radius:16px;padding:22px;width:100%;max-width:780px;max-height:94vh;overflow-y:auto;position:relative;box-shadow:0 16px 40px rgba(15,23,42,.18)}
        .jpr-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(max-width:760px){.jpr-grid2{grid-template-columns:1fr}}
      `}</style>

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 16, background: "linear-gradient(135deg,#fff,#f8fbff)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f3171" }}>{TITULOS[view]}</div>
        {view === "processos" && <button className="jpr-btn" onClick={abrirNovo} style={{ background: "#0f3171", color: "#fff", boxShadow: "0 10px 22px rgba(15,49,113,.18)" }}>+ Novo Processo</button>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 28px" }}>
        {erro && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, marginBottom: 14 }}>Não foi possível carregar os processos: {erro}. Verifique se as tabelas foram migradas e o RLS aplicado (migration 20260622000015).</div>}
        {loading ? <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Carregando…</div> : (<>

          {/* ── DASHBOARD ── */}
          {view === "dashboard" && (<>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {kpi("Processos únicos", resumo.processos, "#0f3171", "Total cadastrado")}
              {kpi("Total acordos", moneyShort(resumo.acordos), "#dc2626", "Soma dos acordos")}
              {kpi("Total sentenças", moneyShort(resumo.sentencas), "#2563eb", "Condenações")}
              {kpi("Custo total final", moneyShort(resumo.final), "#15803d", "Valores finais")}
              {kpi("Em andamento", resumo.em_andamento, "#a78bfa", "Processos ativos")}
              {kpi("Valor causa RT", moneyShort(resumo.causa_rt), "#eab308", "RT Geral")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }} className="jpr-grid2">
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Gasto por Motivo</div>
                <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>Top 10 — soma geral de todos os valores por motivo</div>
                {porMotivo.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13, padding: 30, textAlign: "center" }}>Sem dados.</div> : (
                  <ResponsiveContainer width="100%" height={Math.max(220, porMotivo.length * 34)}>
                    <BarChart data={porMotivo} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid horizontal={false} stroke="#eef2f7" />
                      <XAxis type="number" tickFormatter={(v) => moneyShort(v)} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <YAxis type="category" dataKey="motivo" width={150} tick={{ fontSize: 10.5, fill: "#475569" }} />
                      <Tooltip formatter={(v: any) => money(Number(v))} />
                      <Bar dataKey="total" fill="#f97316" radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Por Empresa (Reclamada)</div>
                <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>Distribuição do custo total</div>
                {porReclamada.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13, padding: 30, textAlign: "center" }}>Sem dados.</div> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={porReclamada} dataKey="total" nameKey="empresa" innerRadius={62} outerRadius={95} paddingAngle={2}>
                        {porReclamada.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => money(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Evolução por Ano</div>
              <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>Valor pedido × acordo × custo final</div>
              {porAno.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13, padding: 30, textAlign: "center" }}>Sem dados.</div> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={porAno} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid vertical={false} stroke="#eef2f7" />
                    <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "#475569" }} />
                    <YAxis tickFormatter={(v) => moneyShort(v)} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip formatter={(v: any) => money(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="pedidos" name="Pedidos" fill="#0f3171" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="acordos" name="Acordos" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="total" name="Custo final" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </>)}

          {/* ── PROCESSOS ── */}
          {view === "processos" && (<>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {kpi("Processos cadastrados", processos.length, "#0f3171", "Base consolidada")}
              {kpi("Resultados filtrados", filtrados.length, "#2563eb", "Com os filtros atuais")}
              {kpi("Motivos no recorte", motivosNoRecorte, "#7c3aed", "Soma dos motivos")}
              {kpi("Status predominante", statusPredominante, "#b45309", "Conjunto filtrado")}
            </div>
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Consulta de processos</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input className="jpr-fi" style={{ maxWidth: 360 }} placeholder="Buscar por nº, reclamante, reclamada, motivo, ano…" value={busca} onChange={e => setBusca(e.target.value)} />
                <select className="jpr-fi" style={{ maxWidth: 190 }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
                  <option value="">Todos os status</option>{STATUS_OPC.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {(busca || fStatus) && <button className="jpr-btn" onClick={() => { setBusca(""); setFStatus(""); }} style={{ background: "#f1f5f9", color: "#475569" }}>Limpar filtros</button>}
              </div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
              {filtrados.length === 0 ? <div style={{ padding: 46, textAlign: "center", color: "#94a3b8" }}>Nenhum processo encontrado.</div> : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ background: "#f8fafc", color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px" }}>Nº / Reclamante</th><th style={{ padding: "10px 14px" }}>Reclamada</th><th style={{ padding: "10px 14px" }}>Motivos</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Total pedido</th><th style={{ padding: "10px 14px", textAlign: "right" }}>Custo final</th><th style={{ padding: "10px 14px" }}>Status</th><th style={{ padding: "10px 14px", textAlign: "right" }}>Ações</th>
                  </tr></thead>
                  <tbody>{filtrados.map(p => { const sc = statusCor(p.status); return (
                    <tr key={p.numero_processo} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td style={{ padding: "10px 14px" }}><div style={{ fontWeight: 700, color: "#0f172a" }}>{p.reclamante || "—"}</div><div style={{ fontSize: 11.5, color: "#94a3b8" }}>{p.numero_processo}{p.ano_processo ? ` · ${p.ano_processo}` : ""}</div></td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>{p.reclamada || "—"}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11.5, color: "#0f172a" }}>{p.motivo_items[0]?.motivo || "—"}</span>{p.motivo_items.length > 1 && <span style={{ fontSize: 11, color: "#0f3171", fontWeight: 700 }}> +{p.motivo_items.length - 1}</span>}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#475569" }}>{money(p.valor_pedidos)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{money(custoTotal(p))}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, fontWeight: 800, padding: "2px 9px", borderRadius: 20, background: sc.bg, color: sc.c }}>{p.status}</span></td>
                      <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="jpr-btn" onClick={() => abrirDetalhe(p)} style={{ background: "#eef4ff", color: "#0f3171", marginRight: 5 }}>Ver</button>
                        <button className="jpr-btn" onClick={() => abrirEditar(p)} style={{ background: "#f1f5f9", color: "#475569", marginRight: 5 }}>Editar</button>
                        <button className="jpr-btn" onClick={() => excluir(p)} style={{ background: "none", color: "#dc2626" }}>Excluir</button>
                      </td>
                    </tr>
                  ); })}</tbody>
                </table>
              )}
            </div>
          </>)}

          {/* ── AUDIÊNCIAS ── */}
          {view === "audiencias" && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
              {audiencias.length === 0 ? <div style={{ padding: 46, textAlign: "center", color: "#94a3b8" }}>Nenhuma audiência registrada.</div> : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ background: "#f8fafc", color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px" }}>Data</th><th style={{ padding: "10px 14px" }}>Processo / Reclamante</th><th style={{ padding: "10px 14px" }}>Reclamada</th><th style={{ padding: "10px 14px" }}>Tipo</th><th style={{ padding: "10px 14px" }}>Situação</th>
                  </tr></thead>
                  <tbody>{audiencias.map((a, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #eef2f7", background: a.futuro ? "#fff" : "#fcfcfd" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: a.futuro ? "#0f3171" : "#94a3b8" }}>{fmtDt(a.data)}</td>
                      <td style={{ padding: "10px 14px" }}><div style={{ fontWeight: 600, color: "#0f172a" }}>{a.reclamante || "—"}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{a.numero}</div></td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>{a.reclamada || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>{a.tipo || "Audiência"}{a.modalidade ? ` · ${a.modalidade}` : ""}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: a.futuro ? "#dbeafe" : "#f1f5f9", color: a.futuro ? "#1d4ed8" : "#64748b" }}>{a.futuro ? "Em andamento" : "Já passou"}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          )}
        </>)}
      </div>

      {/* ── Detalhe ── */}
      {sel && (
        <div className="jpr-ov" onClick={e => { if (e.target === e.currentTarget) setSel(null); }}>
          <div className="jpr-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSel(null)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>{sel.numero_processo}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{sel.reclamante || "—"}</div>
            <div style={{ fontSize: 12.5, color: "#475569", marginTop: 2 }}>Reclamada: <b>{sel.reclamada || "—"}</b>{sel.comarca ? ` · ${sel.comarca}` : ""}{sel.ano_processo ? ` · ${sel.ano_processo}` : ""}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
              {[["Pedidos", sel.valor_pedidos, "#ea580c"], ["Acordo", sel.valor_acordo, "#dc2626"], ["Sentença", sel.valor_sentenca, "#2563eb"], ["Custo final", custoTotal(sel), "#15803d"]].map(([l, v, c]: any) => (
                <div key={l} style={{ flex: 1, minWidth: 120, background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 10, padding: "8px 11px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{l}</div><div style={{ fontSize: 14, fontWeight: 800, color: c }}>{money(v)}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Motivos ({sel.motivo_items.length})</div>
            <div style={{ border: "1px solid #eef2f7", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
              {sel.motivo_items.map((m, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 11px", borderTop: i ? "1px solid #f1f5f9" : "none" }}><span style={{ fontSize: 12.5, color: "#0f172a" }}>{m.motivo}</span><span style={{ fontSize: 12, fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>{money(motivoTotal(m))}</span></div>))}
            </div>
            {sel.audiencias.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Audiências</div>
              <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 5 }}>{sel.audiencias.map((a, i) => (<div key={i} style={{ fontSize: 12.5, color: "#334155" }}>📅 <b>{fmtDt(a.data)}</b> — {a.tipo_audiencia || "Audiência"}{a.modalidade_audiencia ? ` (${a.modalidade_audiencia})` : ""}</div>))}</div>
            </>)}
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Comentários</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input className="jpr-fi" placeholder="Escreva um comentário…" value={novoComent} onChange={e => setNovoComent(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addComent(); }} />
              <button className="jpr-btn" onClick={addComent} disabled={!novoComent.trim()} style={{ background: novoComent.trim() ? "#0f3171" : "#cbd5e1", color: "#fff", whiteSpace: "nowrap" }}>Comentar</button>
            </div>
            {coments.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 12.5, padding: "6px 0" }}>Sem comentários.</div> : coments.map(c => (
              <div key={c.id} style={{ background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 10, padding: "9px 12px", marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#0f3171" }}>{c.autor_nome || "Usuário"}</span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDt(c.created_at)}</span><button onClick={() => delComent(c)} style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>excluir</button></span>
                </div>
                <div style={{ fontSize: 13, color: "#0f172a", whiteSpace: "pre-wrap" }}>{c.texto}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal Criar/Editar ── */}
      {modal && (
        <div className="jpr-ov" onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="jpr-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModal(false)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{editNumero ? "Editar processo" : "Novo processo"}</div>
            <div className="jpr-grid2">
              <div className="jpr-fg"><label>Nº do processo *</label><input className="jpr-fi" value={form.numero_processo} onChange={e => setForm(v => ({ ...v, numero_processo: e.target.value }))} placeholder="0000000-00.0000.5.00.0000" /></div>
              <div className="jpr-fg"><label>Status</label><select className="jpr-fi" value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}>{STATUS_OPC.map(s => <option key={s}>{s}</option>)}</select></div>
              <div className="jpr-fg"><label>Reclamante *</label><input className="jpr-fi" value={form.reclamante} onChange={e => setForm(v => ({ ...v, reclamante: e.target.value }))} /></div>
              <div className="jpr-fg"><label>Reclamada</label><input className="jpr-fi" value={form.reclamada} onChange={e => setForm(v => ({ ...v, reclamada: e.target.value }))} placeholder="Empresa" /></div>
              <div className="jpr-fg"><label>Comarca</label><input className="jpr-fi" value={form.comarca} onChange={e => setForm(v => ({ ...v, comarca: e.target.value }))} /></div>
              <div className="jpr-fg"><label>Município de origem</label><input className="jpr-fi" value={form.municipio_origem} onChange={e => setForm(v => ({ ...v, municipio_origem: e.target.value }))} /></div>
              <div className="jpr-fg"><label>Data de entrada</label><input className="jpr-fi" type="date" value={form.data_entrada_reclamatoria} onChange={e => setForm(v => ({ ...v, data_entrada_reclamatoria: e.target.value }))} /></div>
              <div className="jpr-fg"><label>Contrato</label><input className="jpr-fi" value={form.contrato} onChange={e => setForm(v => ({ ...v, contrato: e.target.value }))} /></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 6px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".4px" }}>Motivos e valores</div>
              <button className="jpr-btn" onClick={() => setMotivos(ms => [...ms, { ...MOTIVO_RESET(), ordem: ms.length + 1 }])} style={{ background: "#eef4ff", color: "#0f3171", padding: "5px 10px" }}>+ Motivo</button>
            </div>
            {motivos.map((m, i) => (
              <div key={i} style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: 10, marginBottom: 8, background: "#fbfdff" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input className="jpr-fi" placeholder="Motivo (ex.: Horas extras)" value={m.motivo} onChange={e => setMotivo(i, { motivo: e.target.value })} />
                  {motivos.length > 1 && <button className="jpr-btn" onClick={() => setMotivos(ms => ms.filter((_, idx) => idx !== i))} style={{ background: "none", color: "#dc2626" }}>✕</button>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {([["valor_pedidos", "Pedidos"], ["valor_acordo", "Acordo"], ["valor_sentenca", "Sentença"], ["valor_final", "Final"], ["valor_outros_custos", "Outros"], ["valor_deposito_recursal", "Depósito"], ["valor_custas_processuais", "Custas"]] as const).map(([k, l]) => (
                    <div key={k}><label style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{l}</label><input className="jpr-fi" style={{ height: 34 }} type="number" step="0.01" value={m[k] || ""} onChange={e => setMotivo(i, { [k]: toFloat(e.target.value) } as any)} /></div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 6px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".4px" }}>Audiências</div>
              <button className="jpr-btn" onClick={() => setAuds(a => [...a, { ordem: a.length + 1, data: "", tipo_audiencia: "Instrução", modalidade_audiencia: "Presencial" }])} style={{ background: "#eef4ff", color: "#0f3171", padding: "5px 10px" }}>+ Audiência</button>
            </div>
            {auds.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <input className="jpr-fi" type="date" value={a.data} onChange={e => setAuds(x => x.map((y, idx) => idx === i ? { ...y, data: e.target.value } : y))} />
                <select className="jpr-fi" value={a.tipo_audiencia} onChange={e => setAuds(x => x.map((y, idx) => idx === i ? { ...y, tipo_audiencia: e.target.value } : y))}>{["Instrução", "Conciliação", "Una", "De instrução e julgamento", "Audiência"].map(o => <option key={o}>{o}</option>)}</select>
                <select className="jpr-fi" value={a.modalidade_audiencia} onChange={e => setAuds(x => x.map((y, idx) => idx === i ? { ...y, modalidade_audiencia: e.target.value } : y))}>{["Presencial", "Online"].map(o => <option key={o}>{o}</option>)}</select>
                <button className="jpr-btn" onClick={() => setAuds(x => x.filter((_, idx) => idx !== i))} style={{ background: "none", color: "#dc2626" }}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button className="jpr-btn" onClick={() => setModal(false)} style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>Cancelar</button>
              <button className="jpr-btn" onClick={salvar} style={{ background: "#0f3171", color: "#fff" }}>Salvar processo</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        {toasts.map(t => (<div key={t.id} style={{ padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, boxShadow: "0 16px 40px rgba(15,23,42,.12)", background: t.t === "ok" ? "#ecfdf3" : t.t === "err" ? "#fef2f2" : "#eff6ff", color: t.t === "ok" ? "#15803d" : t.t === "err" ? "#b91c1c" : "#1d4ed8", border: `1px solid ${t.t === "ok" ? "#86efac" : t.t === "err" ? "#fecaca" : "#bfdbfe"}` }}>{t.msg}</div>))}
      </div>
    </div>
  );
}
