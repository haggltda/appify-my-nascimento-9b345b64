import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// =====================================================================
// JURÍDICO — Contas (recorrentes) organizadas por mês.
// Conta-mestra define a recorrência (a cada 7/15/20/30 dias) e o site de
// pagamento; os lançamentos por competência (mês) têm status próprio.
// =====================================================================

interface Conta {
  id: number; descricao: string; categoria?: string; empresa?: string; responsavel?: string;
  onde_pagar?: string; possui_recorrencia?: boolean; intervalo_dias?: number;
  data_inicio?: string; valor?: number; status?: string; observacoes?: string;
}
interface Lanc { id: number; conta_id: number; competencia?: string; vencimento?: string; valor?: number; status: string; pago_em?: string; }

const CATEGORIAS = ["Água", "Luz", "Internet", "Telefone", "Aluguel", "Condomínio", "Seguro", "Imposto", "Outros"];
const INTERVALOS = [7, 15, 20, 30];

const money = (v?: number | null) => (v == null || isNaN(Number(v))) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDt = (s?: string) => { if (!s) return "—"; const d = new Date(s + "T12:00:00"); return isNaN(+d) ? s : d.toLocaleDateString("pt-BR"); };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const compAtual = () => hoje().slice(0, 7);
const addMes = (comp: string, delta: number) => { const [y, m] = comp.split("-").map(Number); return ymd(new Date(y, m - 1 + delta, 1)).slice(0, 7); };
const mesNome = (comp: string) => { const [y, m] = comp.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };
const statusLanc = (l: Lanc): "Pago" | "Vencido" | "Pendente" => l.status === "Pago" ? "Pago" : (l.vencimento && l.vencimento < hoje() ? "Vencido" : "Pendente");

// Datas de ocorrência da conta dentro da competência (mês).
function ocorrencias(dataInicio: string | undefined, intervalo: number | undefined, comp: string): string[] {
  if (!dataInicio || !intervalo) return [];
  const [y, m] = comp.split("-").map(Number);
  const ini = new Date(y, m - 1, 1, 12), fim = new Date(y, m, 0, 12);
  const d = new Date(dataInicio + "T12:00:00");
  if (isNaN(+d)) return [];
  const out: string[] = []; let g = 0;
  while (d < ini && g < 5000) { d.setDate(d.getDate() + intervalo); g++; }
  while (d <= fim && g < 5000) { out.push(ymd(d)); d.setDate(d.getDate() + intervalo); g++; }
  return out;
}

const CONTA_RESET = { descricao: "", categoria: "Água", empresa: "", responsavel: "", onde_pagar: "", possui_recorrencia: "Não", intervalo_dias: "30", data_inicio: hoje(), valor: "", status: "Ativo", observacoes: "" };

export default function Contas({ patrimonioId }: { patrimonioId: number }) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [comp, setComp] = useState(compAtual());
  const [view, setView] = useState<"mes" | "cadastro">("mes");
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...CONTA_RESET });

  const toast = (msg: string, t = "info") => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, t }]); setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 3200); };

  const loadContas = useCallback(async () => {
    const { data } = await (supabase as any).from("JUR_CONTAS").select("*").eq("patrimonio_id", patrimonioId).order("descricao");
    setContas(data ?? []);
    return (data ?? []) as Conta[];
  }, [patrimonioId]);

  // Gera (idempotente) os lançamentos recorrentes do mês e carrega tudo.
  const gerarECarregar = useCallback(async (cs: Conta[], competencia: string) => {
    setLoading(true);
    const ativos = cs.filter(c => (c.status ?? "Ativo") === "Ativo");
    const novos: any[] = [];
    for (const c of ativos) {
      let datas: string[] = [];
      if (c.possui_recorrencia && c.intervalo_dias) datas = ocorrencias(c.data_inicio, c.intervalo_dias, competencia);
      else if (c.data_inicio && c.data_inicio.slice(0, 7) === competencia) datas = [c.data_inicio];
      for (const dt of datas) novos.push({ conta_id: c.id, competencia, vencimento: dt, valor: c.valor ?? null, status: "Pendente" });
    }
    if (novos.length) await (supabase as any).from("JUR_CONTA_LANCAMENTOS").upsert(novos, { onConflict: "conta_id,vencimento", ignoreDuplicates: true });
    const { data } = await (supabase as any).from("JUR_CONTA_LANCAMENTOS").select("*").eq("competencia", competencia).order("vencimento");
    setLancs(data ?? []); setLoading(false);
  }, []);

  useEffect(() => { loadContas().then(cs => gerarECarregar(cs, comp)); }, [loadContas, gerarECarregar, comp]);

  // ── Conta (master) ─────────────────────────────────────────────
  const abrirNova = () => { setEditId(null); setForm({ ...CONTA_RESET }); setModal(true); };
  const abrirEditar = (c: Conta) => {
    setEditId(c.id);
    setForm({ ...CONTA_RESET, ...c, possui_recorrencia: c.possui_recorrencia ? "Sim" : "Não", intervalo_dias: String(c.intervalo_dias ?? 30), valor: c.valor != null ? String(c.valor) : "", data_inicio: c.data_inicio ?? hoje() } as any);
    setModal(true);
  };
  const salvar = async () => {
    if (!form.descricao.trim()) { toast("Informe a descrição.", "err"); return; }
    const rec = form.possui_recorrencia === "Sim";
    const payload: any = {
      descricao: form.descricao, categoria: form.categoria, empresa: form.empresa || null, responsavel: form.responsavel || null,
      onde_pagar: form.onde_pagar || null, possui_recorrencia: rec, intervalo_dias: rec ? Number(form.intervalo_dias) : null,
      data_inicio: form.data_inicio || null, valor: form.valor ? Number(form.valor) : null, status: form.status,
      observacoes: form.observacoes || null, patrimonio_id: patrimonioId, updated_at: new Date().toISOString(),
    };
    if (editId) {
      const { error } = await (supabase as any).from("JUR_CONTAS").update(payload).eq("id", editId);
      if (error) { toast("Erro: " + error.message, "err"); return; }
    } else {
      const { error } = await (supabase as any).from("JUR_CONTAS").insert(payload);
      if (error) { toast("Erro: " + error.message, "err"); return; }
    }
    setModal(false); toast("Conta salva.", "ok");
    const cs = await loadContas(); gerarECarregar(cs, comp);
  };
  const excluirConta = async (c: Conta) => {
    if (!confirm(`Excluir a conta "${c.descricao}" e todos os lançamentos dela?`)) return;
    await (supabase as any).from("JUR_CONTAS").delete().eq("id", c.id);
    const cs = await loadContas(); gerarECarregar(cs, comp);
  };

  // ── Lançamentos ────────────────────────────────────────────────
  const marcarPago = async (l: Lanc) => {
    await (supabase as any).from("JUR_CONTA_LANCAMENTOS").update({ status: "Pago", pago_em: hoje() }).eq("id", l.id);
    setLancs(x => x.map(i => i.id === l.id ? { ...i, status: "Pago", pago_em: hoje() } : i));
  };
  const desmarcarPago = async (l: Lanc) => {
    await (supabase as any).from("JUR_CONTA_LANCAMENTOS").update({ status: "Pendente", pago_em: null }).eq("id", l.id);
    setLancs(x => x.map(i => i.id === l.id ? { ...i, status: "Pendente", pago_em: undefined } : i));
  };
  const setValorLanc = async (l: Lanc, v: string) => {
    const valor = v ? Number(v) : null;
    await (supabase as any).from("JUR_CONTA_LANCAMENTOS").update({ valor }).eq("id", l.id);
    setLancs(x => x.map(i => i.id === l.id ? { ...i, valor: valor ?? undefined } : i));
  };

  const contaDe = (id: number) => contas.find(c => c.id === id);
  const linkPagar = (u?: string) => u ? (/^https?:\/\//i.test(u) ? u : "https://" + u) : "";

  // indicadores do mês
  const previsto = lancs.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const pago = lancs.filter(l => l.status === "Pago").reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const nPend = lancs.filter(l => statusLanc(l) === "Pendente").length;
  const nVenc = lancs.filter(l => statusLanc(l) === "Vencido").length;

  const card = (label: string, valor: string | number, cor: string) => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 18px", flex: 1, minWidth: 140, boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: cor, marginTop: 4 }}>{valor}</div>
    </div>
  );

  return (
    <div>
      <style>{`
        .jc-fi{width:100%;height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 11px;font-size:13px;background:#fff;box-sizing:border-box}
        textarea.jc-fi{height:auto;padding:9px 11px;resize:vertical}
        .jc-fi:focus{outline:none;border-color:#0f3171;box-shadow:0 0 0 3px rgba(15,49,113,.1)}
        .jc-fg{margin-bottom:11px}
        .jc-fg label{display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
        .jc-btn{border:none;border-radius:9px;font-weight:700;cursor:pointer;font-size:12px;padding:8px 14px}
        .jc-ov{position:fixed;inset:0;z-index:700;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
        .jc-modal{background:#fff;border-radius:16px;padding:22px;width:100%;max-width:600px;max-height:92vh;overflow-y:auto;position:relative;box-shadow:0 16px 40px rgba(15,23,42,.18)}
        .jc-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(max-width:560px){.jc-grid2{grid-template-columns:1fr}}
        .jc-tab{padding:8px 14px;border:1px solid #e2e8f0;background:#fff;border-radius:9px;font-size:12px;font-weight:700;color:#64748b;cursor:pointer}
        .jc-tab.on{background:#0f3171;color:#fff;border-color:#0f3171}
      `}</style>

      {/* Header compacto (dentro da aba do patrimônio) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f3171" }}>💳 Contas deste patrimônio</div>
        <button className="jc-btn" onClick={abrirNova} style={{ background: "#0f3171", color: "#fff" }}>+ Nova Conta</button>
      </div>

      <div>
        {/* Toggle de visão */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button className={`jc-tab${view === "mes" ? " on" : ""}`} onClick={() => setView("mes")}>📅 Por mês</button>
          <button className={`jc-tab${view === "cadastro" ? " on" : ""}`} onClick={() => setView("cadastro")}>🗂 Contas cadastradas</button>
        </div>

        {view === "mes" && (<>
          {/* Navegação de mês */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <button className="jc-btn" onClick={() => setComp(addMes(comp, -1))} style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#0f3171" }}>◀</button>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", minWidth: 170, textAlign: "center", textTransform: "capitalize" }}>{mesNome(comp)}</div>
            <button className="jc-btn" onClick={() => setComp(addMes(comp, 1))} style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#0f3171" }}>▶</button>
            <input type="month" className="jc-fi" style={{ maxWidth: 160 }} value={comp} onChange={e => e.target.value && setComp(e.target.value)} />
          </div>

          {/* Indicadores */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {card("Previsto no mês", money(previsto), "#0f3171")}
            {card("Pago", money(pago), "#15803d")}
            {card("Pendentes", nPend, nPend > 0 ? "#ea580c" : "#16a34a")}
            {card("Vencidas", nVenc, nVenc > 0 ? "#dc2626" : "#16a34a")}
          </div>

          {/* Lançamentos do mês */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
            {loading ? <div style={{ padding: 46, textAlign: "center", color: "#94a3b8" }}>Carregando…</div>
              : lancs.length === 0 ? <div style={{ padding: 46, textAlign: "center", color: "#94a3b8" }}>Nenhuma conta neste mês. Cadastre uma conta recorrente.</div>
                : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px" }}>
                        <th style={{ textAlign: "left", padding: "10px 14px" }}>Conta</th>
                        <th style={{ textAlign: "left", padding: "10px 14px" }}>Vencimento</th>
                        <th style={{ textAlign: "left", padding: "10px 14px" }}>Valor</th>
                        <th style={{ textAlign: "left", padding: "10px 14px" }}>Status</th>
                        <th style={{ textAlign: "right", padding: "10px 14px" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancs.map(l => {
                        const c = contaDe(l.conta_id); const st = statusLanc(l);
                        const cor = st === "Pago" ? "#16a34a" : st === "Vencido" ? "#dc2626" : "#ea580c";
                        return (
                          <tr key={l.id} style={{ borderTop: "1px solid #eef2f7" }}>
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ fontWeight: 700, color: "#0f172a" }}>{c?.descricao ?? "—"}</div>
                              <div style={{ fontSize: 11, color: "#94a3b8" }}>{[c?.categoria, c?.empresa].filter(Boolean).join(" · ")}</div>
                            </td>
                            <td style={{ padding: "10px 14px", color: "#475569" }}>{fmtDt(l.vencimento)}</td>
                            <td style={{ padding: "10px 14px" }}>
                              <input className="jc-fi" style={{ width: 110, height: 32 }} type="number" step="0.01" defaultValue={l.valor ?? ""} onBlur={e => setValorLanc(l, e.target.value)} />
                            </td>
                            <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 20, background: cor + "20", color: cor }}>{st}</span></td>
                            <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                              {c?.onde_pagar && <a className="jc-btn" href={linkPagar(c.onde_pagar)} target="_blank" rel="noreferrer" style={{ background: "rgba(15,49,113,.08)", color: "#0f3171", border: "1px solid rgba(15,49,113,.2)", textDecoration: "none", marginRight: 6 }}>Pagar →</a>}
                              {st === "Pago"
                                ? <button className="jc-btn" onClick={() => desmarcarPago(l)} style={{ background: "#f1f5f9", color: "#64748b" }}>Desfazer</button>
                                : <button className="jc-btn" onClick={() => marcarPago(l)} style={{ background: "rgba(22,163,74,.12)", color: "#15803d", border: "1px solid rgba(22,163,74,.25)" }}>✓ Pagar</button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
          </div>
        </>)}

        {view === "cadastro" && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
            {contas.length === 0 ? <div style={{ padding: 46, textAlign: "center", color: "#94a3b8" }}>Nenhuma conta cadastrada.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px" }}>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Conta</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Recorrência</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Valor ref.</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Status</th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {contas.map(c => (
                    <tr key={c.id} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td style={{ padding: "10px 14px" }}><div style={{ fontWeight: 700, color: "#0f172a" }}>{c.descricao}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{[c.categoria, c.empresa].filter(Boolean).join(" · ")}</div></td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>{c.possui_recorrencia ? `A cada ${c.intervalo_dias} dias` : "Não recorrente"}</td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>{money(c.valor)}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: c.status === "Ativo" ? "#dcfce7" : "#f1f5f9", color: c.status === "Ativo" ? "#15803d" : "#64748b" }}>{c.status}</span></td>
                      <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="jc-btn" onClick={() => abrirEditar(c)} style={{ background: "#eef4ff", color: "#0f3171", marginRight: 6 }}>Editar</button>
                        <button className="jc-btn" onClick={() => excluirConta(c)} style={{ background: "none", color: "#dc2626" }}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Modal Conta ── */}
      {modal && (
        <div className="jc-ov" onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="jc-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModal(false)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{editId ? "Editar Conta" : "Nova Conta"}</div>
            <div className="jc-grid2">
              <div className="jc-fg"><label>Descrição *</label><input className="jc-fi" value={form.descricao} onChange={e => setForm(v => ({ ...v, descricao: e.target.value }))} placeholder="Ex.: Água casa Guiomar" /></div>
              <div className="jc-fg"><label>Categoria</label><select className="jc-fi" value={form.categoria} onChange={e => setForm(v => ({ ...v, categoria: e.target.value }))}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></div>
              <div className="jc-fg"><label>Empresa</label><input className="jc-fi" value={form.empresa} onChange={e => setForm(v => ({ ...v, empresa: e.target.value }))} placeholder="HAGG, CANAÃ…" /></div>
              <div className="jc-fg"><label>Responsável</label><input className="jc-fi" value={form.responsavel} onChange={e => setForm(v => ({ ...v, responsavel: e.target.value }))} /></div>
            </div>
            <div className="jc-fg"><label>Onde pagar essa conta? (URL)</label><input className="jc-fi" value={form.onde_pagar} onChange={e => setForm(v => ({ ...v, onde_pagar: e.target.value }))} placeholder="https://www.corsan.com.br, site da CPFL…" /></div>
            <div className="jc-grid2">
              <div className="jc-fg"><label>Possui recorrência?</label><select className="jc-fi" value={form.possui_recorrencia} onChange={e => setForm(v => ({ ...v, possui_recorrencia: e.target.value }))}><option>Não</option><option>Sim</option></select></div>
              {form.possui_recorrencia === "Sim"
                ? <div className="jc-fg"><label>Quanto em quanto tempo?</label><select className="jc-fi" value={form.intervalo_dias} onChange={e => setForm(v => ({ ...v, intervalo_dias: e.target.value }))}>{INTERVALOS.map(i => <option key={i} value={i}>{i} dias</option>)}</select></div>
                : <div className="jc-fg" />}
              <div className="jc-fg"><label>{form.possui_recorrencia === "Sim" ? "1º vencimento (referência)" : "Vencimento"}</label><input className="jc-fi" type="date" value={form.data_inicio} onChange={e => setForm(v => ({ ...v, data_inicio: e.target.value }))} /></div>
              <div className="jc-fg"><label>Valor de referência (R$)</label><input className="jc-fi" type="number" step="0.01" value={form.valor} onChange={e => setForm(v => ({ ...v, valor: e.target.value }))} /></div>
              <div className="jc-fg"><label>Status</label><select className="jc-fi" value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}><option>Ativo</option><option>Inativo</option></select></div>
            </div>
            <div className="jc-fg"><label>Observações</label><textarea className="jc-fi" rows={2} value={form.observacoes} onChange={e => setForm(v => ({ ...v, observacoes: e.target.value }))} /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button className="jc-btn" onClick={() => setModal(false)} style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>Cancelar</button>
              <button className="jc-btn" onClick={salvar} style={{ background: "#0f3171", color: "#fff" }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, boxShadow: "0 16px 40px rgba(15,23,42,.12)", background: t.t === "ok" ? "#ecfdf3" : t.t === "err" ? "#fef2f2" : "#eff6ff", color: t.t === "ok" ? "#15803d" : t.t === "err" ? "#b91c1c" : "#1d4ed8", border: `1px solid ${t.t === "ok" ? "#86efac" : t.t === "err" ? "#fecaca" : "#bfdbfe"}` }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
