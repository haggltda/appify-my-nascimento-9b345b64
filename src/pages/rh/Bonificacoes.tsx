import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Helpers ──────────────────────────────────────────────────────────
function fmtDt(s?: string) {
  if (!s) return "—";
  const d = new Date(s.length <= 10 ? s + "T12:00:00" : s);
  return isNaN(+d) ? (s ?? "—") : d.toLocaleDateString("pt-BR");
}
function mesLabel(s?: string) {
  const m = String(s ?? "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return s || "—";
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[+m[2] - 1] ?? m[2]}/${m[1]}`;
}

const STATUS_CFG: Record<string, { bg: string; fg: string; bd: string }> = {
  Pendente: { bg: "#fef9c3", fg: "#854d0e", bd: "#fde68a" },
  Aprovada: { bg: "#dcfce7", fg: "#15803d", bd: "#86efac" },
  Reprovada: { bg: "#fee2e2", fg: "#b91c1c", bd: "#fecaca" },
  Cancelada: { bg: "#f1f5f9", fg: "#475569", bd: "#e2e8f0" },
};
function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? { bg: "#dbeafe", fg: "#1d4ed8", bd: "#bfdbfe" };
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, whiteSpace: "nowrap" }}>{status}</span>;
}

const FILTROS = ["", "Pendente", "Aprovada", "Reprovada", "Cancelada"];

export default function Bonificacoes() {
  const { user } = useAuth();
  const [nome, setNome] = useState("");

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState("");
  const [busca, setBusca] = useState("");

  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [sol, setSol] = useState<any | null>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);
  const toastId = useRef(0);
  const toast = useCallback((msg: string, type = "info") => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("display_name, email").eq("id", user.id).maybeSingle()
      .then(({ data }) => setNome(data?.display_name || data?.email || user.email || ""));
  }, [user?.id]);

  const carregar = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("SISTEMA_SOLICITACOES_BONIFICACAO").select("*").order("criado_em", { ascending: false }).limit(200);
    if (statusFilter) q = q.eq("status", statusFilter);
    if (busca.trim()) q = q.or(`solicitante_nome.ilike.%${busca.trim()}%,descricao.ilike.%${busca.trim()}%`);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast("Erro ao carregar: " + error.message, "err"); return; }
    setRows(data ?? []);
  }, [statusFilter, busca, toast]);

  const carregarStats = useCallback(async () => {
    const { data } = await (supabase as any).from("SISTEMA_SOLICITACOES_BONIFICACAO").select("status").limit(2000);
    if (!data) return;
    const m: Record<string, number> = { total: data.length };
    for (const r of data) m[r.status] = (m[r.status] ?? 0) + 1;
    setStats(m);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarStats(); }, [carregarStats]);

  const abrirDrawer = async (row: any) => {
    setDrawerId(row.id);
    setSol(row);
    setReprovando(false);
    setMotivo("");
    setItens([]);
    setMsgs([]);
    const [{ data: it }, { data: ch }] = await Promise.all([
      (supabase as any).from("SISTEMA_BONIFICACAO_ITENS").select("*").eq("solicitacao_id", row.id).order("colaborador_nome"),
      (supabase as any).from("SISTEMA_SOL_BONIF_CHAT").select("*").eq("solicitacao_id", row.id).order("criado_em"),
    ]);
    setItens(it ?? []);
    setMsgs(ch ?? []);
  };
  const fecharDrawer = () => { setDrawerId(null); setSol(null); };

  const recarregarTudo = () => { carregar(); carregarStats(); };

  const acao = async (novo: string, motivoTxt?: string) => {
    if (!drawerId) return;
    const patch: any = { status: novo, aprovado_por: nome || user?.email || "", aprovado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() };
    if (motivoTxt !== undefined) patch.motivo_reprovacao = motivoTxt;
    const { error } = await (supabase as any).from("SISTEMA_SOLICITACOES_BONIFICACAO").update(patch).eq("id", drawerId);
    if (error) { toast("Erro: " + error.message, "err"); return; }
    toast(`Solicitação ${novo.toLowerCase()}.`, "ok");
    setSol((s: any) => ({ ...s, ...patch }));
    setReprovando(false);
    setMotivo("");
    recarregarTudo();
  };

  const enviarMsg = async () => {
    if (!chatInput.trim() || !drawerId) return;
    const txt = chatInput.trim();
    setChatInput("");
    const { error } = await (supabase as any).from("SISTEMA_SOL_BONIF_CHAT").insert({
      solicitacao_id: drawerId, mensagem: txt,
      autor_nome: nome || user?.email || "Usuário", autor_cpf: user?.email ?? "",
    });
    if (error) { toast("Erro ao enviar.", "err"); return; }
    const { data } = await (supabase as any).from("SISTEMA_SOL_BONIF_CHAT").select("*").eq("solicitacao_id", drawerId).order("criado_em");
    setMsgs(data ?? []);
  };

  const kpi = (label: string, val: number, cor: string) => (
    <div style={{ flex: 1, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 4px 16px rgba(15,23,42,.05)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: cor, marginTop: 2 }}>{val ?? 0}</div>
    </div>
  );

  return (
    <div style={{ padding: "4px 2px 40px" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>🎁 Gestão de Bonificações</h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Pedidos de bonificação dos colaboradores — aprove, reprove ou acompanhe.</p>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {kpi("Pendentes", stats["Pendente"] ?? 0, "#854d0e")}
        {kpi("Aprovadas", stats["Aprovada"] ?? 0, "#15803d")}
        {kpi("Reprovadas", stats["Reprovada"] ?? 0, "#b91c1c")}
        {kpi("Total", stats["total"] ?? 0, "#0f3171")}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {FILTROS.map(f => (
          <button key={f || "all"} onClick={() => setStatusFilter(f)}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${statusFilter === f ? "#0f3171" : "#e2e8f0"}`,
              background: statusFilter === f ? "#0f3171" : "#fff", color: statusFilter === f ? "#fff" : "#475569" }}>
            {f || "Todas"}
          </button>
        ))}
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar solicitante / descrição..."
          style={{ marginLeft: "auto", minWidth: 240, padding: "8px 12px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, outline: "none" }} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Solicitante", "Mês Pagto", "Colaboradores", "Descrição", "Status", "Criado"].map(h => (
                <th key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".7px", padding: "11px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Carregando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>Nenhuma solicitação de bonificação.
              </td></tr>
            ) : rows.map(r => (
              <tr key={r.id} onClick={() => abrirDrawer(r)} style={{ cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fbff")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{r.solicitante_nome || "—"}</td>
                <td style={{ padding: "11px 14px", fontSize: 12, color: "#475569" }}>{mesLabel(r.mes_pagamento)}</td>
                <td style={{ padding: "11px 14px", fontSize: 12, color: "#475569" }}>{r.total_colaboradores ?? 0}</td>
                <td style={{ padding: "11px 14px", fontSize: 12, color: "#94a3b8", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.descricao || "—"}</td>
                <td style={{ padding: "11px 14px" }}><StatusBadge status={r.status} /></td>
                <td style={{ padding: "11px 14px", fontSize: 11, color: "#94a3b8" }}>{fmtDt(r.criado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {drawerId && sol && (
        <div onClick={e => { if (e.target === e.currentTarget) fecharDrawer(); }}
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(15,23,42,.42)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: "82%", maxWidth: 720, height: "100%", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-20px 0 60px rgba(15,23,42,.18)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Bonificação #{sol.id}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{sol.solicitante_nome} · Pagamento {mesLabel(sol.mes_pagamento)} · {sol.total_colaboradores ?? itens.length} colaborador(es)</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <StatusBadge status={sol.status} />
                <button onClick={fecharDrawer} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 22, cursor: "pointer" }}>✕</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {sol.descricao && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Descrição</div>
                  <div style={{ fontSize: 13, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", lineHeight: 1.6 }}>{sol.descricao}</div>
                </div>
              )}

              {/* Colaboradores */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Colaboradores ({itens.length})</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  {itens.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Carregando colaboradores...</div>
                  ) : itens.map((it, i) => (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: i < itens.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: "#eef4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#0f3171", fontWeight: 700 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{it.colaborador_nome}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{it.colaborador_cargo}{it.colaborador_filial ? ` · ${it.colaborador_filial}` : ""}{it.colaborador_cpf ? ` · ${it.colaborador_cpf}` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {sol.status === "Reprovada" && sol.motivo_reprovacao && (
                <div style={{ marginBottom: 18, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Motivo da reprovação</div>
                  <div style={{ fontSize: 13, color: "#7f1d1d" }}>{sol.motivo_reprovacao}</div>
                </div>
              )}

              {/* Ações */}
              {sol.status === "Pendente" && (
                <div style={{ marginBottom: 20 }}>
                  {!reprovando ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => acao("Aprovada")} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✓ Aprovar</button>
                      <button onClick={() => setReprovando(true)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✕ Reprovar</button>
                      <button onClick={() => acao("Cancelada")} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                    </div>
                  ) : (
                    <div>
                      <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="Motivo da reprovação..."
                        style={{ width: "100%", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => { if (!motivo.trim()) { toast("Informe o motivo.", "err"); return; } acao("Reprovada", motivo.trim()); }}
                          style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirmar reprovação</button>
                        <button onClick={() => { setReprovando(false); setMotivo(""); }} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Voltar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10 }}>💬 Conversa</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {msgs.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "12px 0" }}>Nenhuma mensagem ainda.</div>
                  ) : msgs.map(m => {
                    const mine = m.autor_cpf === user?.email;
                    return (
                      <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                        <div style={{ fontSize: 10, color: "#94a3b8", padding: "0 2px", textAlign: mine ? "right" : "left" }}>{m.autor_nome}</div>
                        <div style={{ background: mine ? "#0f3171" : "#f1f5f9", color: mine ? "#fff" : "#0f172a", borderRadius: 12, padding: "8px 12px", fontSize: 13 }}>{m.mensagem}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8", padding: "0 2px", textAlign: mine ? "right" : "left" }}>{fmtDt(m.criado_em)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") enviarMsg(); }}
                    placeholder="Escreva uma mensagem..." style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none" }} />
                  <button onClick={enviarMsg} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: "#0f3171", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enviar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, boxShadow: "0 16px 40px rgba(15,23,42,.1)",
            background: t.type === "ok" ? "#ecfdf3" : t.type === "err" ? "#fef2f2" : "#eff6ff",
            color: t.type === "ok" ? "#15803d" : t.type === "err" ? "#b91c1c" : "#1d4ed8",
            border: `1px solid ${t.type === "ok" ? "#86efac" : t.type === "err" ? "#fecaca" : "#bfdbfe"}`,
          }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
