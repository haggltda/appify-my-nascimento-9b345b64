import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Contas from "./Contas";

// =====================================================================
// JURÍDICO — Gestão Patrimonial e Obrigações
// Patrimônios (imóveis, veículos...) + obrigações (despesas/seguros) +
// acessos (portais), contatos, documentos e histórico.
// =====================================================================

interface Patrimonio {
  id: number; codigo?: string; tipo: string; descricao: string; localizacao?: string;
  placa?: string; cidade?: string; empresa?: string; responsavel?: string;
  centro_custo?: string; status: string; observacoes?: string; created_at?: string;
}
interface Obrigacao {
  id: number; patrimonio_id: number; categoria: string; descricao?: string; valor?: number;
  vencimento?: string; periodicidade?: string; forma_pagamento?: string; responsavel?: string;
  status: string; pago_em?: string; seguradora?: string; apolice?: string;
  vigencia_inicio?: string; vigencia_fim?: string; premio?: number; parcelas?: string;
}
interface Acesso { id: number; patrimonio_id: number; servico?: string; link?: string; usuario?: string; local_senha?: string; observacao?: string; }
interface Contato { id: number; patrimonio_id: number; tipo?: string; nome?: string; telefone?: string; email?: string; observacao?: string; }
interface Documento { id: number; patrimonio_id: number; tipo?: string; nome?: string; storage_path?: string; criado_por?: string; created_at?: string; }
interface Historico { id: number; patrimonio_id: number; acao: string; detalhe?: string; autor?: string; created_at?: string; }

const TIPOS = ["Imóvel", "Veículo", "Terreno", "Equipamento", "Outros"];
const CATEGORIAS = ["IPTU", "Condomínio", "Energia", "Água", "Internet", "Seguro", "Aluguel", "IPVA", "Licenciamento", "Manutenção", "Rastreamento", "Outros"];
const PERIODICIDADES = ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual", "Único"];

const fmtDt = (s?: string) => { if (!s) return "—"; const d = new Date(s.length <= 10 ? s + "T12:00:00" : s); return isNaN(+d) ? s : d.toLocaleDateString("pt-BR"); };
const money = (v?: number | null) => (v == null || isNaN(Number(v))) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const diasAte = (d?: string) => { if (!d) return null; const t = new Date(d + "T12:00:00").getTime(); if (isNaN(t)) return null; return Math.ceil((t - Date.now()) / 86400000); };
// Status efetivo da obrigação (deriva "Vencido" quando passou do vencimento e não foi pago).
const statusObr = (o: Obrigacao): "Pago" | "Vencido" | "Pendente" => {
  if (o.status === "Pago") return "Pago";
  if (o.vencimento && o.vencimento < hoje()) return "Vencido";
  return "Pendente";
};

const PATRIM_RESET = { codigo: "", tipo: "Imóvel", descricao: "", localizacao: "", placa: "", cidade: "", empresa: "", responsavel: "", centro_custo: "", status: "Ativo", observacoes: "" };
const OBR_RESET = { categoria: "Energia", descricao: "", valor: "", vencimento: "", periodicidade: "Mensal", forma_pagamento: "", responsavel: "", seguradora: "", apolice: "", vigencia_inicio: "", vigencia_fim: "", premio: "", parcelas: "" };

export default function Patrimonios() {
  const { user } = useAuth();
  const autor = user?.user_metadata?.nome ?? user?.email ?? "Usuário";

  const [pats, setPats] = useState<Patrimonio[]>([]);
  const [obrAll, setObrAll] = useState<Obrigacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  // modal patrimônio
  const [modalPat, setModalPat] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [pat, setPat] = useState({ ...PATRIM_RESET });

  // drawer
  const [sel, setSel] = useState<Patrimonio | null>(null);
  const [tab, setTab] = useState("obrigacoes");
  const [obrs, setObrs] = useState<Obrigacao[]>([]);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [hist, setHist] = useState<Historico[]>([]);

  // sub-modal obrigação
  const [modalObr, setModalObr] = useState(false);
  const [obrEditId, setObrEditId] = useState<number | null>(null);
  const [obr, setObr] = useState({ ...OBR_RESET });

  const toast = (msg: string, t = "info") => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, t }]); setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 3200); };

  // ── Carregar lista + indicadores ───────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: o }] = await Promise.all([
      (supabase as any).from("JUR_PATRIMONIOS").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("JUR_OBRIGACOES").select("id,patrimonio_id,categoria,valor,vencimento,status,pago_em,vigencia_fim"),
    ]);
    setPats(p ?? []); setObrAll(o ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const logHist = async (patId: number, acao: string, detalhe?: string) => {
    await (supabase as any).from("JUR_HISTORICO").insert({ patrimonio_id: patId, acao, detalhe, autor });
  };

  // ── Patrimônio: salvar ─────────────────────────────────────────
  const abrirNovoPat = () => { setEditId(null); setPat({ ...PATRIM_RESET }); setModalPat(true); };
  const abrirEditarPat = (p: Patrimonio) => { setEditId(p.id); setPat({ ...PATRIM_RESET, ...p } as any); setModalPat(true); };
  const salvarPat = async () => {
    if (!pat.descricao.trim()) { toast("Informe a descrição.", "err"); return; }
    const payload = { ...pat, updated_at: new Date().toISOString() };
    if (editId) {
      const { error } = await (supabase as any).from("JUR_PATRIMONIOS").update(payload).eq("id", editId);
      if (error) { toast("Erro: " + error.message, "err"); return; }
      await logHist(editId, "Patrimônio atualizado");
      toast("Patrimônio atualizado.", "ok");
    } else {
      const { data, error } = await (supabase as any).from("JUR_PATRIMONIOS").insert(payload).select("id").single();
      if (error) { toast("Erro: " + error.message, "err"); return; }
      if (data?.id) await logHist(data.id, "Patrimônio cadastrado");
      toast("Patrimônio cadastrado.", "ok");
    }
    setModalPat(false); load();
  };

  // ── Drawer: abrir e carregar relacionados ──────────────────────
  const abrirDrawer = async (p: Patrimonio) => {
    setSel(p); setTab("obrigacoes");
    setObrs([]); setAcessos([]); setContatos([]); setDocs([]); setHist([]);
    const [o, a, c, d, h] = await Promise.all([
      (supabase as any).from("JUR_OBRIGACOES").select("*").eq("patrimonio_id", p.id).order("vencimento", { ascending: true }),
      (supabase as any).from("JUR_ACESSOS").select("*").eq("patrimonio_id", p.id).order("id"),
      (supabase as any).from("JUR_CONTATOS").select("*").eq("patrimonio_id", p.id).order("id"),
      (supabase as any).from("JUR_DOCUMENTOS").select("*").eq("patrimonio_id", p.id).order("created_at", { ascending: false }),
      (supabase as any).from("JUR_HISTORICO").select("*").eq("patrimonio_id", p.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setObrs(o.data ?? []); setAcessos(a.data ?? []); setContatos(c.data ?? []); setDocs(d.data ?? []); setHist(h.data ?? []);
  };
  const recarregarObrs = async () => { if (!sel) return; const { data } = await (supabase as any).from("JUR_OBRIGACOES").select("*").eq("patrimonio_id", sel.id).order("vencimento"); setObrs(data ?? []); load(); };
  const recarregarHist = async () => { if (!sel) return; const { data } = await (supabase as any).from("JUR_HISTORICO").select("*").eq("patrimonio_id", sel.id).order("created_at", { ascending: false }).limit(50); setHist(data ?? []); };

  // ── Obrigação ──────────────────────────────────────────────────
  const abrirNovaObr = () => { setObrEditId(null); setObr({ ...OBR_RESET }); setModalObr(true); };
  const abrirEditarObr = (o: Obrigacao) => {
    setObrEditId(o.id);
    setObr({ ...OBR_RESET, ...o, valor: o.valor != null ? String(o.valor) : "", premio: o.premio != null ? String(o.premio) : "" } as any);
    setModalObr(true);
  };
  const salvarObr = async () => {
    if (!sel) return;
    if (!obr.categoria) { toast("Selecione a categoria.", "err"); return; }
    const payload: any = {
      patrimonio_id: sel.id, categoria: obr.categoria, descricao: obr.descricao || null,
      valor: obr.valor ? Number(obr.valor) : null, vencimento: obr.vencimento || null,
      periodicidade: obr.periodicidade || null, forma_pagamento: obr.forma_pagamento || null,
      responsavel: obr.responsavel || null, updated_at: new Date().toISOString(),
      seguradora: obr.seguradora || null, apolice: obr.apolice || null,
      vigencia_inicio: obr.vigencia_inicio || null, vigencia_fim: obr.vigencia_fim || null,
      premio: obr.premio ? Number(obr.premio) : null, parcelas: obr.parcelas || null,
    };
    if (obrEditId) {
      const { error } = await (supabase as any).from("JUR_OBRIGACOES").update(payload).eq("id", obrEditId);
      if (error) { toast("Erro: " + error.message, "err"); return; }
      await logHist(sel.id, "Obrigação atualizada", `${obr.categoria}`);
    } else {
      const { error } = await (supabase as any).from("JUR_OBRIGACOES").insert({ ...payload, status: "Pendente" });
      if (error) { toast("Erro: " + error.message, "err"); return; }
      await logHist(sel.id, "Obrigação cadastrada", `${obr.categoria}${obr.vencimento ? " · venc. " + fmtDt(obr.vencimento) : ""}`);
    }
    setModalObr(false); toast("Obrigação salva.", "ok"); recarregarObrs(); recarregarHist();
  };
  const marcarPago = async (o: Obrigacao) => {
    if (!sel) return;
    const { error } = await (supabase as any).from("JUR_OBRIGACOES").update({ status: "Pago", pago_em: hoje() }).eq("id", o.id);
    if (error) { toast("Erro: " + error.message, "err"); return; }
    await logHist(sel.id, "Obrigação paga", `${o.categoria} · ${money(o.valor)}`);
    toast("Marcada como paga.", "ok"); recarregarObrs(); recarregarHist();
  };
  const excluirObr = async (o: Obrigacao) => {
    if (!confirm("Excluir esta obrigação?")) return;
    await (supabase as any).from("JUR_OBRIGACOES").delete().eq("id", o.id);
    recarregarObrs();
  };

  // ── Acessos / Contatos (add inline) ────────────────────────────
  const addAcesso = async () => {
    if (!sel) return;
    const { data } = await (supabase as any).from("JUR_ACESSOS").insert({ patrimonio_id: sel.id, servico: "", link: "", usuario: "", local_senha: "" }).select("*").single();
    if (data) setAcessos(a => [...a, data]);
  };
  const salvarAcesso = async (a: Acesso) => { await (supabase as any).from("JUR_ACESSOS").update({ servico: a.servico, link: a.link, usuario: a.usuario, local_senha: a.local_senha, observacao: a.observacao }).eq("id", a.id); };
  const excluirAcesso = async (id: number) => { await (supabase as any).from("JUR_ACESSOS").delete().eq("id", id); setAcessos(a => a.filter(x => x.id !== id)); };
  const addContato = async () => {
    if (!sel) return;
    const { data } = await (supabase as any).from("JUR_CONTATOS").insert({ patrimonio_id: sel.id, tipo: "", nome: "", telefone: "", email: "" }).select("*").single();
    if (data) setContatos(c => [...c, data]);
  };
  const salvarContato = async (c: Contato) => { await (supabase as any).from("JUR_CONTATOS").update({ tipo: c.tipo, nome: c.nome, telefone: c.telefone, email: c.email, observacao: c.observacao }).eq("id", c.id); };
  const excluirContato = async (id: number) => { await (supabase as any).from("JUR_CONTATOS").delete().eq("id", id); setContatos(c => c.filter(x => x.id !== id)); };

  // ── Documentos ─────────────────────────────────────────────────
  const uploadDoc = async (file: File, tipo: string) => {
    if (!sel || !file) return;
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${sel.id}/${Date.now()}_${safe}`;
    const { error: up } = await supabase.storage.from("juridico-docs").upload(path, file, { upsert: false });
    if (up) { toast("Falha no upload: " + up.message, "err"); return; }
    const { data } = await (supabase as any).from("JUR_DOCUMENTOS").insert({ patrimonio_id: sel.id, tipo, nome: file.name, storage_path: path, criado_por: autor }).select("*").single();
    if (data) setDocs(d => [data, ...d]);
    await logHist(sel.id, "Documento anexado", `${tipo}: ${file.name}`); recarregarHist();
    toast("Documento anexado.", "ok");
  };
  const baixarDoc = async (d: Documento) => {
    if (!d.storage_path) return;
    const { data, error } = await supabase.storage.from("juridico-docs").createSignedUrl(d.storage_path, 3600);
    if (error || !data?.signedUrl) { toast("Não foi possível abrir.", "err"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const excluirDoc = async (d: Documento) => {
    if (!confirm("Excluir este documento?")) return;
    if (d.storage_path) await supabase.storage.from("juridico-docs").remove([d.storage_path]);
    await (supabase as any).from("JUR_DOCUMENTOS").delete().eq("id", d.id);
    setDocs(x => x.filter(i => i.id !== d.id));
  };

  // ── Indicadores ────────────────────────────────────────────────
  const ativos = pats.filter(p => p.status === "Ativo").length;
  const naoPagas = obrAll.filter(o => o.status !== "Pago");
  const vencidas = naoPagas.filter(o => o.vencimento && o.vencimento < hoje()).length;
  const prox30 = naoPagas.filter(o => { const d = diasAte(o.vencimento); return d != null && d >= 0 && d <= 30; }).length;
  const mesAtual = hoje().slice(0, 7);
  const pagoMes = obrAll.filter(o => o.status === "Pago" && (o.pago_em || "").slice(0, 7) === mesAtual).reduce((s, o) => s + (Number(o.valor) || 0), 0);

  const listaFiltrada = pats.filter(p => {
    if (fTipo && p.tipo !== fTipo) return false;
    if (busca) { const q = busca.toLowerCase(); return [p.descricao, p.codigo, p.localizacao, p.placa, p.cidade, p.empresa, p.responsavel].some(x => (x || "").toLowerCase().includes(q)); }
    return true;
  });

  const card = (label: string, valor: string | number, cor: string) => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 18px", flex: 1, minWidth: 150, boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: cor, marginTop: 4 }}>{valor}</div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <style>{`
        .jp-fi{width:100%;height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 11px;font-size:13px;background:#fff;box-sizing:border-box}
        textarea.jp-fi{height:auto;padding:9px 11px;resize:vertical}
        .jp-fi:focus{outline:none;border-color:#0f3171;box-shadow:0 0 0 3px rgba(15,49,113,.1)}
        .jp-fg label{display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
        .jp-fg{margin-bottom:11px}
        .jp-btn{border:none;border-radius:9px;font-weight:700;cursor:pointer;font-size:12px;padding:8px 14px}
        .jp-ov{position:fixed;inset:0;z-index:700;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
        .jp-modal{background:#fff;border-radius:16px;padding:22px;width:100%;max-width:620px;max-height:92vh;overflow-y:auto;position:relative;box-shadow:0 16px 40px rgba(15,23,42,.18)}
        .jp-drawer-ov{position:fixed;inset:0;z-index:680;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);display:flex;justify-content:flex-end}
        .jp-drawer{width:92%;max-width:860px;height:100%;background:#f8fafc;display:flex;flex-direction:column;box-shadow:-20px 0 50px rgba(15,23,42,.18)}
        .jp-tab{padding:9px 14px;border:none;background:none;font-size:13px;font-weight:700;color:#64748b;cursor:pointer;border-bottom:2px solid transparent}
        .jp-tab.on{color:#0f3171;border-bottom-color:#0f3171}
        .jp-row{display:flex;gap:10px}
        @media(max-width:640px){.jp-row{flex-direction:column}}
        .jp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(max-width:560px){.jp-grid2{grid-template-columns:1fr}}
      `}</style>

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 16, background: "linear-gradient(135deg,#fff,#f8fbff)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f3171" }}>⚖️ Gestão Patrimonial e Obrigações</div>
        <button className="jp-btn" onClick={abrirNovoPat} style={{ background: "#0f3171", color: "#fff", boxShadow: "0 10px 22px rgba(15,49,113,.18)" }}>+ Novo Patrimônio</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 28px" }}>
        {/* Indicadores */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {card("Patrimônios ativos", ativos, "#0f3171")}
          {card("Obrigações vencidas", vencidas, vencidas > 0 ? "#dc2626" : "#16a34a")}
          {card("Vencem em 30 dias", prox30, prox30 > 0 ? "#ea580c" : "#16a34a")}
          {card("Pago no mês", money(pagoMes), "#15803d")}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input className="jp-fi" style={{ maxWidth: 320 }} placeholder="Buscar por descrição, código, placa, cidade…" value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="jp-fi" style={{ maxWidth: 180 }} value={fTipo} onChange={e => setFTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Lista */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
          {loading ? (
            <div style={{ padding: 50, textAlign: "center", color: "#94a3b8" }}>Carregando…</div>
          ) : listaFiltrada.length === 0 ? (
            <div style={{ padding: 50, textAlign: "center", color: "#94a3b8" }}>Nenhum patrimônio. Clique em "+ Novo Patrimônio".</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px" }}>
                  <th style={{ textAlign: "left", padding: "10px 14px" }}>Patrimônio</th>
                  <th style={{ textAlign: "left", padding: "10px 14px" }}>Tipo</th>
                  <th style={{ textAlign: "left", padding: "10px 14px" }}>Localização</th>
                  <th style={{ textAlign: "left", padding: "10px 14px" }}>Empresa</th>
                  <th style={{ textAlign: "left", padding: "10px 14px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map(p => (
                  <tr key={p.id} onClick={() => abrirDrawer(p)} style={{ borderTop: "1px solid #eef2f7", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fbff")} onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: "#0f172a" }}>{p.descricao}{p.codigo ? <span style={{ color: "#94a3b8", fontWeight: 500 }}> · {p.codigo}</span> : ""}</td>
                    <td style={{ padding: "11px 14px", color: "#475569" }}>{p.tipo}</td>
                    <td style={{ padding: "11px 14px", color: "#475569" }}>{[p.localizacao, p.cidade].filter(Boolean).join(" · ") || p.placa || "—"}</td>
                    <td style={{ padding: "11px 14px", color: "#475569" }}>{p.empresa || "—"}</td>
                    <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: p.status === "Ativo" ? "#dcfce7" : "#f1f5f9", color: p.status === "Ativo" ? "#15803d" : "#64748b" }}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal Patrimônio ── */}
      {modalPat && (
        <div className="jp-ov" onClick={e => { if (e.target === e.currentTarget) setModalPat(false); }}>
          <div className="jp-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModalPat(false)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{editId ? "Editar Patrimônio" : "Novo Patrimônio"}</div>
            <div className="jp-grid2">
              <div className="jp-fg"><label>Descrição *</label><input className="jp-fi" value={pat.descricao} onChange={e => setPat(v => ({ ...v, descricao: e.target.value }))} placeholder="Ex.: Casa 22, Veículo ABC1D23" /></div>
              <div className="jp-fg"><label>Código</label><input className="jp-fi" value={pat.codigo} onChange={e => setPat(v => ({ ...v, codigo: e.target.value }))} /></div>
              <div className="jp-fg"><label>Tipo</label><select className="jp-fi" value={pat.tipo} onChange={e => setPat(v => ({ ...v, tipo: e.target.value }))}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="jp-fg"><label>Status</label><select className="jp-fi" value={pat.status} onChange={e => setPat(v => ({ ...v, status: e.target.value }))}><option>Ativo</option><option>Inativo</option></select></div>
              <div className="jp-fg"><label>{pat.tipo === "Veículo" ? "Placa" : "Endereço / Localização"}</label><input className="jp-fi" value={pat.tipo === "Veículo" ? pat.placa : pat.localizacao} onChange={e => setPat(v => pat.tipo === "Veículo" ? { ...v, placa: e.target.value } : { ...v, localizacao: e.target.value })} /></div>
              <div className="jp-fg"><label>Cidade</label><input className="jp-fi" value={pat.cidade} onChange={e => setPat(v => ({ ...v, cidade: e.target.value }))} /></div>
              <div className="jp-fg"><label>Empresa</label><input className="jp-fi" value={pat.empresa} onChange={e => setPat(v => ({ ...v, empresa: e.target.value }))} placeholder="HAGG, CANAÃ…" /></div>
              <div className="jp-fg"><label>Responsável interno</label><input className="jp-fi" value={pat.responsavel} onChange={e => setPat(v => ({ ...v, responsavel: e.target.value }))} /></div>
              <div className="jp-fg"><label>Centro de custo</label><input className="jp-fi" value={pat.centro_custo} onChange={e => setPat(v => ({ ...v, centro_custo: e.target.value }))} /></div>
            </div>
            <div className="jp-fg"><label>Observações</label><textarea className="jp-fi" rows={2} value={pat.observacoes} onChange={e => setPat(v => ({ ...v, observacoes: e.target.value }))} /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button className="jp-btn" onClick={() => setModalPat(false)} style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>Cancelar</button>
              <button className="jp-btn" onClick={salvarPat} style={{ background: "#0f3171", color: "#fff" }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawer do patrimônio ── */}
      {sel && (
        <div className="jp-drawer-ov" onClick={e => { if (e.target === e.currentTarget) setSel(null); }}>
          <div className="jp-drawer">
            <div style={{ padding: "16px 22px", borderBottom: "1px solid #e2e8f0", background: "#fff", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>{sel.descricao}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{[sel.tipo, sel.codigo, [sel.localizacao, sel.cidade].filter(Boolean).join(" · ") || sel.placa, sel.empresa].filter(Boolean).join(" · ")}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="jp-btn" onClick={() => abrirEditarPat(sel)} style={{ background: "#eef4ff", color: "#0f3171", border: "1px solid #dbe4f0" }}>Editar</button>
                <button onClick={() => setSel(null)} style={{ border: "none", background: "none", fontSize: 22, color: "#94a3b8", cursor: "pointer" }}>✕</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 2, padding: "0 16px", borderBottom: "1px solid #e2e8f0", background: "#fff", flexWrap: "wrap" }}>
              {[["obrigacoes", "Obrigações"], ["contas", "Contas"], ["acessos", "Acessos"], ["contatos", "Contatos"], ["documentos", "Documentos"], ["historico", "Histórico"]].map(([k, l]) => (
                <button key={k} className={`jp-tab${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
              {/* OBRIGAÇÕES */}
              {tab === "obrigacoes" && (<>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <button className="jp-btn" onClick={abrirNovaObr} style={{ background: "#0f3171", color: "#fff" }}>+ Nova obrigação</button>
                </div>
                {obrs.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13, padding: 20, textAlign: "center" }}>Nenhuma obrigação cadastrada.</div> : obrs.map(o => {
                  const st = statusObr(o); const cor = st === "Pago" ? "#16a34a" : st === "Vencido" ? "#dc2626" : "#ea580c";
                  return (
                    <div key={o.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 11, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <span style={{ fontWeight: 800, color: "#0f172a" }}>{o.categoria}</span>
                          {o.descricao && <span style={{ color: "#64748b" }}> · {o.descricao}</span>}
                          <div style={{ fontSize: 12, color: "#475569", marginTop: 3, display: "flex", flexWrap: "wrap", gap: "2px 12px" }}>
                            <span><b>{money(o.valor)}</b></span>
                            {o.vencimento && <span>Venc.: {fmtDt(o.vencimento)}</span>}
                            {o.periodicidade && <span>{o.periodicidade}</span>}
                            {o.forma_pagamento && <span>{o.forma_pagamento}</span>}
                            {o.categoria === "Seguro" && o.vigencia_fim && <span>Vigência até {fmtDt(o.vigencia_fim)}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, height: "fit-content", padding: "2px 10px", borderRadius: 20, background: cor + "20", color: cor }}>{st}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        {st !== "Pago" && <button className="jp-btn" onClick={() => marcarPago(o)} style={{ background: "rgba(22,163,74,.1)", color: "#15803d", border: "1px solid rgba(22,163,74,.25)", padding: "5px 11px" }}>✓ Marcar pago</button>}
                        <button className="jp-btn" onClick={() => abrirEditarObr(o)} style={{ background: "#f1f5f9", color: "#475569", padding: "5px 11px" }}>Editar</button>
                        <button className="jp-btn" onClick={() => excluirObr(o)} style={{ background: "none", color: "#dc2626", padding: "5px 8px" }}>Excluir</button>
                      </div>
                    </div>
                  );
                })}
              </>)}

              {/* CONTAS (submódulo embutido no patrimônio) */}
              {tab === "contas" && <Contas patrimonioId={sel.id} />}

              {/* ACESSOS */}
              {tab === "acessos" && (<>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>⚠️ Guarde apenas <b>onde</b> a senha está (cofre/TI), nunca a senha.</span>
                  <button className="jp-btn" onClick={addAcesso} style={{ background: "#0f3171", color: "#fff" }}>+ Acesso</button>
                </div>
                {acessos.map(a => (
                  <div key={a.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 11, padding: 12, marginBottom: 8 }}>
                    <div className="jp-grid2">
                      <input className="jp-fi" placeholder="Serviço (Energia, Condomínio…)" defaultValue={a.servico} onBlur={e => { a.servico = e.target.value; salvarAcesso(a); }} />
                      <input className="jp-fi" placeholder="Link do portal" defaultValue={a.link} onBlur={e => { a.link = e.target.value; salvarAcesso(a); }} />
                      <input className="jp-fi" placeholder="Usuário/login" defaultValue={a.usuario} onBlur={e => { a.usuario = e.target.value; salvarAcesso(a); }} />
                      <input className="jp-fi" placeholder="Local da senha (Cofre, TI…)" defaultValue={a.local_senha} onBlur={e => { a.local_senha = e.target.value; salvarAcesso(a); }} />
                    </div>
                    <div style={{ textAlign: "right", marginTop: 6 }}><button className="jp-btn" onClick={() => excluirAcesso(a.id)} style={{ background: "none", color: "#dc2626", padding: "3px 8px" }}>Excluir</button></div>
                  </div>
                ))}
                {acessos.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, padding: 20, textAlign: "center" }}>Nenhum acesso cadastrado.</div>}
              </>)}

              {/* CONTATOS */}
              {tab === "contatos" && (<>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><button className="jp-btn" onClick={addContato} style={{ background: "#0f3171", color: "#fff" }}>+ Contato</button></div>
                {contatos.map(c => (
                  <div key={c.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 11, padding: 12, marginBottom: 8 }}>
                    <div className="jp-grid2">
                      <input className="jp-fi" placeholder="Tipo (Corretor, Imobiliária…)" defaultValue={c.tipo} onBlur={e => { c.tipo = e.target.value; salvarContato(c); }} />
                      <input className="jp-fi" placeholder="Nome" defaultValue={c.nome} onBlur={e => { c.nome = e.target.value; salvarContato(c); }} />
                      <input className="jp-fi" placeholder="Telefone" defaultValue={c.telefone} onBlur={e => { c.telefone = e.target.value; salvarContato(c); }} />
                      <input className="jp-fi" placeholder="E-mail" defaultValue={c.email} onBlur={e => { c.email = e.target.value; salvarContato(c); }} />
                    </div>
                    <div style={{ textAlign: "right", marginTop: 6 }}><button className="jp-btn" onClick={() => excluirContato(c.id)} style={{ background: "none", color: "#dc2626", padding: "3px 8px" }}>Excluir</button></div>
                  </div>
                ))}
                {contatos.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, padding: 20, textAlign: "center" }}>Nenhum contato cadastrado.</div>}
              </>)}

              {/* DOCUMENTOS */}
              {tab === "documentos" && (<>
                <label className="jp-btn" style={{ display: "inline-block", background: "#0f3171", color: "#fff", marginBottom: 12 }}>
                  + Anexar documento
                  <input type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { const tipo = prompt("Tipo do documento (Escritura, Apólice, CRLV, IPTU…):", "Documento") || "Documento"; uploadDoc(f, tipo); } e.currentTarget.value = ""; }} />
                </label>
                {docs.map(d => (
                  <div key={d.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 11, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {d.nome}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{d.tipo} · {fmtDt(d.created_at)}{d.criado_por ? " · " + d.criado_por : ""}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="jp-btn" onClick={() => baixarDoc(d)} style={{ background: "rgba(249,115,22,.12)", color: "#f97316", border: "1px solid rgba(249,115,22,.25)", padding: "5px 11px" }}>↓ Baixar</button>
                      <button className="jp-btn" onClick={() => excluirDoc(d)} style={{ background: "none", color: "#dc2626", padding: "5px 8px" }}>Excluir</button>
                    </div>
                  </div>
                ))}
                {docs.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, padding: 20, textAlign: "center" }}>Nenhum documento anexado.</div>}
              </>)}

              {/* HISTÓRICO */}
              {tab === "historico" && (
                hist.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13, padding: 20, textAlign: "center" }}>Sem movimentações.</div> :
                <div style={{ position: "relative", paddingLeft: 14 }}>
                  {hist.map(h => (
                    <div key={h.id} style={{ borderLeft: "2px solid #e2e8f0", paddingLeft: 16, paddingBottom: 14, position: "relative" }}>
                      <div style={{ position: "absolute", left: -5, top: 3, width: 8, height: 8, borderRadius: "50%", background: "#0f3171" }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{h.acao}</div>
                      {h.detalhe && <div style={{ fontSize: 12, color: "#475569" }}>{h.detalhe}</div>}
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDt(h.created_at)}{h.autor ? " · " + h.autor : ""}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Obrigação ── */}
      {modalObr && (
        <div className="jp-ov" onClick={e => { if (e.target === e.currentTarget) setModalObr(false); }}>
          <div className="jp-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModalObr(false)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{obrEditId ? "Editar obrigação" : "Nova obrigação"}</div>
            <div className="jp-grid2">
              <div className="jp-fg"><label>Categoria *</label><select className="jp-fi" value={obr.categoria} onChange={e => setObr(v => ({ ...v, categoria: e.target.value }))}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></div>
              <div className="jp-fg"><label>Valor (R$)</label><input className="jp-fi" type="number" step="0.01" value={obr.valor} onChange={e => setObr(v => ({ ...v, valor: e.target.value }))} /></div>
              <div className="jp-fg"><label>Vencimento</label><input className="jp-fi" type="date" value={obr.vencimento} onChange={e => setObr(v => ({ ...v, vencimento: e.target.value }))} /></div>
              <div className="jp-fg"><label>Periodicidade</label><select className="jp-fi" value={obr.periodicidade} onChange={e => setObr(v => ({ ...v, periodicidade: e.target.value }))}>{PERIODICIDADES.map(p => <option key={p}>{p}</option>)}</select></div>
              <div className="jp-fg"><label>Forma de pagamento</label><input className="jp-fi" value={obr.forma_pagamento} onChange={e => setObr(v => ({ ...v, forma_pagamento: e.target.value }))} placeholder="Boleto, Débito em conta…" /></div>
              <div className="jp-fg"><label>Responsável</label><input className="jp-fi" value={obr.responsavel} onChange={e => setObr(v => ({ ...v, responsavel: e.target.value }))} /></div>
            </div>
            <div className="jp-fg"><label>Descrição</label><input className="jp-fi" value={obr.descricao} onChange={e => setObr(v => ({ ...v, descricao: e.target.value }))} /></div>
            {obr.categoria === "Seguro" && (
              <div style={{ borderTop: "1px dashed #e2e8f0", marginTop: 6, paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", marginBottom: 8 }}>Dados do seguro</div>
                <div className="jp-grid2">
                  <div className="jp-fg"><label>Seguradora</label><input className="jp-fi" value={obr.seguradora} onChange={e => setObr(v => ({ ...v, seguradora: e.target.value }))} /></div>
                  <div className="jp-fg"><label>Nº Apólice</label><input className="jp-fi" value={obr.apolice} onChange={e => setObr(v => ({ ...v, apolice: e.target.value }))} /></div>
                  <div className="jp-fg"><label>Vigência início</label><input className="jp-fi" type="date" value={obr.vigencia_inicio} onChange={e => setObr(v => ({ ...v, vigencia_inicio: e.target.value }))} /></div>
                  <div className="jp-fg"><label>Vigência fim</label><input className="jp-fi" type="date" value={obr.vigencia_fim} onChange={e => setObr(v => ({ ...v, vigencia_fim: e.target.value }))} /></div>
                  <div className="jp-fg"><label>Prêmio (R$)</label><input className="jp-fi" type="number" step="0.01" value={obr.premio} onChange={e => setObr(v => ({ ...v, premio: e.target.value }))} /></div>
                  <div className="jp-fg"><label>Parcelas</label><input className="jp-fi" value={obr.parcelas} onChange={e => setObr(v => ({ ...v, parcelas: e.target.value }))} placeholder="05/10" /></div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="jp-btn" onClick={() => setModalObr(false)} style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>Cancelar</button>
              <button className="jp-btn" onClick={salvarObr} style={{ background: "#0f3171", color: "#fff" }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, boxShadow: "0 16px 40px rgba(15,23,42,.12)", background: t.t === "ok" ? "#ecfdf3" : t.t === "err" ? "#fef2f2" : "#eff6ff", color: t.t === "ok" ? "#15803d" : t.t === "err" ? "#b91c1c" : "#1d4ed8", border: `1px solid ${t.t === "ok" ? "#86efac" : t.t === "err" ? "#fecaca" : "#bfdbfe"}` }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
