import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// =====================================================================
// CENTRAL DE SERVIÇOS — Denúncias (Canal de Ética / Contato Seguro)
// Espelho local das denúncias ANÔNIMAS da plataforma Contato Seguro.
// A confidencialidade é garantida pela RLS no banco (autoridade final):
// sem papel admin, o select de CS_DENUNCIAS volta vazio.
// "Sincronizar agora" chama a edge function sync-denuncias-contato-seguro.
// Admins mantêm a lista de RESPONSÁVEIS pelo tratamento e atribuem um
// responsável a cada denúncia (grava só responsavel_* — o conteúdo da
// denúncia é imutável pela API; quem escreve o resto é o sync).
// =====================================================================

interface Denuncia {
  id: number; cs_id: string; protocolo?: string; categoria?: string;
  assunto?: string; relato?: string; status?: string; canal?: string;
  empresa?: string; area?: string; criado_na_origem?: string;
  atualizado_na_origem?: string; sincronizado_em?: string; raw?: Record<string, unknown>;
  responsavel_user_id?: string | null; responsavel_definido_em?: string;
}
interface SyncLog {
  id: number; executado_em: string; sucesso: boolean; mensagem?: string;
  total_recebidas?: number; novas?: number; atualizadas?: number;
}
interface Responsavel { id: number; user_id: string; created_at: string; }
interface Perfil { id: string; display_name?: string; email?: string; }

const fmtDt = (s?: string) => { if (!s) return "—"; const d = new Date(s); return isNaN(+d) ? s : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); };
const statusCor = (s?: string): { bg: string; c: string } => {
  const t = (s || "").toLowerCase();
  if (/(conclu|encerr|fechad|resolvid)/.test(t)) return { bg: "#dcfce7", c: "#15803d" };
  if (/(andamento|análise|analise|apura)/.test(t)) return { bg: "#fef9c3", c: "#a16207" };
  if (/(nova|aberta|pendente|recebid)/.test(t)) return { bg: "#fff7ed", c: "#ea580c" };
  return { bg: "#e0f2fe", c: "#0369a1" };
};

export default function Denuncias() {
  const { user } = useAuth();

  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [ultimoSync, setUltimoSync] = useState<SyncLog | null>(null);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [perfis, setPerfis] = useState<Record<string, Perfil>>({});
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fCat, setFCat] = useState("");
  const [detalhe, setDetalhe] = useState<Denuncia | null>(null);
  const [respModal, setRespModal] = useState(false);
  const [buscaUser, setBuscaUser] = useState("");
  const [resultUsers, setResultUsers] = useState<Perfil[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  const toast = (msg: string, t = "info") => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, t }]); setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 5000); };
  const nome = (uid?: string | null) => { if (!uid) return "—"; const p = perfis[uid]; return p?.display_name || p?.email || uid.slice(0, 8); };

  const load = useCallback(async () => {
    setLoading(true);
    const [dRes, lRes, rRes] = await Promise.all([
      (supabase as any).from("CS_DENUNCIAS").select("*").order("criado_na_origem", { ascending: false, nullsFirst: false }).limit(2000),
      (supabase as any).from("CS_DENUNCIAS_SYNC_LOG").select("*").order("executado_em", { ascending: false }).limit(1),
      (supabase as any).from("CS_DENUNCIAS_RESPONSAVEIS").select("id, user_id, created_at").order("created_at"),
    ]);
    const dens: Denuncia[] = dRes.data ?? [];
    const resps: Responsavel[] = rRes.data ?? [];
    setDenuncias(dens); setUltimoSync(lRes.data?.[0] ?? null); setResponsaveis(resps);

    // Nomes: responsáveis da lista + responsáveis já atribuídos em denúncias
    const ids = [...new Set([...resps.map(r => r.user_id), ...dens.map(d => d.responsavel_user_id).filter(Boolean) as string[]])];
    if (ids.length) {
      const { data: profs } = await (supabase as any).from("profiles").select("id, display_name, email").in("id", ids);
      setPerfis(Object.fromEntries((profs ?? []).map((p: Perfil) => [p.id, p])));
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-denuncias-contato-seguro", { body: {} });
      if (error) {
        let msg = error.message;
        try { const ctx = await (error as any).context?.json?.(); if (ctx?.msg) msg = ctx.msg; } catch { /* usa error.message */ }
        toast(msg, "err");
      } else {
        toast(data?.msg ?? "Sincronização concluída.", data?.success ? "ok" : "err");
      }
    } catch (e) {
      toast("Erro ao chamar a sincronização: " + (e instanceof Error ? e.message : String(e)), "err");
    }
    setSincronizando(false);
    load();
  };

  // ── Responsáveis ────────────────────────────────────────────────────
  const buscarUsuarios = async (q: string) => {
    setBuscaUser(q);
    if (q.trim().length < 2) { setResultUsers([]); return; }
    const { data } = await (supabase as any).from("profiles")
      .select("id, display_name, email")
      .or(`display_name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`)
      .limit(10);
    const jaSao = new Set(responsaveis.map(r => r.user_id));
    setResultUsers((data ?? []).filter((p: Perfil) => !jaSao.has(p.id)));
  };

  const addResponsavel = async (p: Perfil) => {
    const { error } = await (supabase as any).from("CS_DENUNCIAS_RESPONSAVEIS").insert({ user_id: p.id, criado_por: user?.id ?? null });
    if (error) { toast("Erro ao adicionar: " + error.message, "err"); return; }
    setPerfis(x => ({ ...x, [p.id]: p }));
    setBuscaUser(""); setResultUsers([]);
    toast(`${p.display_name || p.email} agora é responsável pelas denúncias.`, "ok");
    load();
  };

  const removeResponsavel = async (r: Responsavel) => {
    const { error } = await (supabase as any).from("CS_DENUNCIAS_RESPONSAVEIS").delete().eq("id", r.id);
    if (error) { toast("Erro ao remover: " + error.message, "err"); return; }
    toast(`${nome(r.user_id)} removido dos responsáveis.`, "ok");
    load();
  };

  const atribuir = async (d: Denuncia, uid: string) => {
    const valor = uid || null;
    const { error } = await (supabase as any).from("CS_DENUNCIAS").update({
      responsavel_user_id: valor,
      responsavel_definido_em: valor ? new Date().toISOString() : null,
      responsavel_definido_por: valor ? user?.id ?? null : null,
    }).eq("id", d.id);
    if (error) { toast("Erro ao atribuir: " + error.message, "err"); return; }
    setDenuncias(x => x.map(i => i.id === d.id ? { ...i, responsavel_user_id: valor } : i));
    setDetalhe(x => x && x.id === d.id ? { ...x, responsavel_user_id: valor } : x);
    toast(valor ? `Denúncia atribuída a ${nome(valor)}.` : "Atribuição removida.", "ok");
  };

  const categorias = [...new Set(denuncias.map(d => d.categoria).filter(Boolean))] as string[];
  const statuses = [...new Set(denuncias.map(d => d.status).filter(Boolean))] as string[];
  const filtradas = denuncias.filter(d => {
    if (fStatus && d.status !== fStatus) return false;
    if (fCat && d.categoria !== fCat) return false;
    if (busca) { const q = busca.toLowerCase(); return [d.protocolo, d.assunto, d.relato, d.categoria, d.empresa, d.area, nome(d.responsavel_user_id)].some(x => (x || "").toLowerCase().includes(q)); }
    return true;
  });
  const abertas = denuncias.filter(d => !/(conclu|encerr|fechad|resolvid)/.test((d.status || "").toLowerCase())).length;
  const semResponsavel = denuncias.filter(d => !d.responsavel_user_id).length;

  const card = (label: string, valor: number | string, cor: string) => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "12px 18px", flex: 1, minWidth: 130, boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: cor, marginTop: 2 }}>{valor}</div>
    </div>
  );

  // Sem regra de permissão no front: a confidencialidade é garantida pela RLS
  // do banco — para quem não é admin, o select de CS_DENUNCIAS volta vazio.
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <style>{`
        .dn-fi{height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;font-size:13px;background:#fff;box-sizing:border-box}
        .dn-fi:focus{outline:none;border-color:#0f3171;box-shadow:0 0 0 3px rgba(15,49,113,.1)}
        .dn-btn{border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:12px;padding:9px 15px}
        .dn-btn:disabled{opacity:.6;cursor:not-allowed}
        .dn-ov{position:fixed;inset:0;z-index:700;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
        .dn-modal{background:#fff;border-radius:16px;padding:22px;width:100%;max-width:680px;max-height:92vh;overflow-y:auto;position:relative;box-shadow:0 16px 40px rgba(15,23,42,.18)}
        .dn-row:hover{background:#f8fafc}
        .dn-user:hover{background:#f1f5f9}
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 16, background: "linear-gradient(135deg,#fff,#fff8f8)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f3171" }}>🛡️ Denúncias — Canal de Ética</div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
            Denúncias anônimas da plataforma Contato Seguro. Conteúdo confidencial — acesso exclusivo de administradores.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
            Último sync: {ultimoSync ? `${fmtDt(ultimoSync.executado_em)} ${ultimoSync.sucesso ? "✓" : "✗"}` : "nunca"}
          </div>
          <button className="dn-btn" onClick={() => setRespModal(true)} style={{ background: "#fff", color: "#0f3171", border: "1px solid #0f3171" }}>
            👥 Responsáveis ({responsaveis.length})
          </button>
          <button className="dn-btn" onClick={sincronizar} disabled={sincronizando} style={{ background: "#0f3171", color: "#fff", boxShadow: "0 10px 22px rgba(15,49,113,.18)" }}>
            {sincronizando ? "Sincronizando…" : "⟳ Sincronizar agora"}
          </button>
        </div>
      </div>

      {ultimoSync && !ultimoSync.sucesso && (
        <div style={{ margin: "10px 24px 0", padding: "10px 14px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 12.5 }}>
          ⚠️ Última sincronização falhou: {ultimoSync.mensagem}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 28px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          {card("Total de denúncias", denuncias.length, "#0f3171")}
          {card("Em aberto", abertas, "#ea580c")}
          {card("Concluídas", denuncias.length - abertas, "#15803d")}
          {card("Sem responsável", semResponsavel, "#b91c1c")}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input className="dn-fi" style={{ width: "100%", maxWidth: 380 }} placeholder="🔎 Pesquisar (protocolo, assunto, relato, responsável…)" value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="dn-fi" style={{ maxWidth: 190 }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">Todos os status</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="dn-fi" style={{ maxWidth: 210 }} value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="">Todas as categorias</option>{categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? <div style={{ padding: 50, textAlign: "center", color: "#94a3b8" }}>Carregando…</div>
          : filtradas.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 46, textAlign: "center", color: "#94a3b8", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
              {denuncias.length === 0
                ? <>Nenhuma denúncia sincronizada ainda. Use “Sincronizar agora” — se a integração ainda não estiver liberada pela Contato Seguro, a mensagem de pendência aparece aqui.</>
                : "Nenhuma denúncia encontrada com os filtros atuais."}
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      {["Protocolo", "Data", "Categoria", "Assunto", "Status", "Responsável"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".4px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map(d => {
                      const sc = statusCor(d.status);
                      return (
                        <tr key={d.id} className="dn-row" style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => setDetalhe(d)}>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0f3171", whiteSpace: "nowrap" }}>{d.protocolo || d.cs_id}</td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#475569" }}>{fmtDt(d.criado_na_origem)}</td>
                          <td style={{ padding: "10px 14px", color: "#475569" }}>{d.categoria || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "#0f172a", maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.assunto || (d.relato || "").slice(0, 80) || "—"}</td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <span style={{ background: sc.bg, color: sc.c, borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 700 }}>{d.status || "—"}</span>
                          </td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: d.responsavel_user_id ? "#0f172a" : "#b91c1c", fontWeight: d.responsavel_user_id ? 600 : 700 }}>
                            {d.responsavel_user_id ? nome(d.responsavel_user_id) : "Sem responsável"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>

      {detalhe && (
        <div className="dn-ov" onClick={() => setDetalhe(null)}>
          <div className="dn-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setDetalhe(null)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171", marginBottom: 2 }}>Denúncia {detalhe.protocolo || detalhe.cs_id}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>Recebida em {fmtDt(detalhe.criado_na_origem)} · Sincronizada em {fmtDt(detalhe.sincronizado_em)}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {[["Status", detalhe.status], ["Categoria", detalhe.categoria], ["Canal", detalhe.canal], ["Empresa", detalhe.empresa], ["Área", detalhe.area]].map(([k, v]) => v ? (
                <div key={k} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "6px 12px", fontSize: 12 }}>
                  <span style={{ color: "#94a3b8", fontWeight: 700 }}>{k}: </span><span style={{ color: "#0f172a", fontWeight: 600 }}>{v}</span>
                </div>
              ) : null)}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, background: "#f0f5ff", border: "1px solid #dbe7ff", borderRadius: 12, padding: "10px 14px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f3171", whiteSpace: "nowrap" }}>👥 Responsável:</span>
              <select className="dn-fi" style={{ flex: 1, height: 36 }} value={detalhe.responsavel_user_id ?? ""} onChange={e => atribuir(detalhe, e.target.value)}>
                <option value="">— Sem responsável —</option>
                {responsaveis.map(r => <option key={r.user_id} value={r.user_id}>{nome(r.user_id)}</option>)}
              </select>
            </div>
            {responsaveis.length === 0 && (
              <div style={{ fontSize: 12, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
                Nenhum responsável cadastrado ainda — use o botão "Responsáveis" no topo da tela para definir quem cuida das denúncias.
              </div>
            )}

            {detalhe.assunto && <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{detalhe.assunto}</div>}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, fontSize: 13.5, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {detalhe.relato || "Sem texto de relato no payload — veja os dados completos abaixo."}
            </div>
            <details style={{ marginTop: 14 }}>
              <summary style={{ fontSize: 12, fontWeight: 700, color: "#64748b", cursor: "pointer" }}>Dados completos recebidos da Contato Seguro (JSON)</summary>
              <pre style={{ background: "#0f172a", color: "#e2e8f0", borderRadius: 10, padding: 12, fontSize: 11.5, overflowX: "auto", marginTop: 8 }}>{JSON.stringify(detalhe.raw ?? {}, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}

      {respModal && (
        <div className="dn-ov" onClick={() => { setRespModal(false); setBuscaUser(""); setResultUsers([]); }}>
          <div className="dn-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { setRespModal(false); setBuscaUser(""); setResultUsers([]); }} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171", marginBottom: 2 }}>👥 Responsáveis pelas denúncias</div>
            <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
              Quem cuida do tratamento das denúncias do Canal de Ética. A visualização do módulo continua exclusiva de administradores.
            </div>

            <div style={{ position: "relative", marginBottom: 16 }}>
              <input className="dn-fi" style={{ width: "100%" }} placeholder="🔎 Buscar usuário por nome ou e-mail para adicionar…" value={buscaUser} onChange={e => buscarUsuarios(e.target.value)} />
              {resultUsers.length > 0 && (
                <div style={{ position: "absolute", top: 46, left: 0, right: 0, zIndex: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 16px 40px rgba(15,23,42,.15)", overflow: "hidden" }}>
                  {resultUsers.map(p => (
                    <div key={p.id} className="dn-user" style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }} onClick={() => addResponsavel(p)}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{p.display_name || "(sem nome)"}</div>
                      <div style={{ fontSize: 11.5, color: "#94a3b8" }}>{p.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {responsaveis.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 13, background: "#f8fafc", borderRadius: 12 }}>
                Nenhum responsável cadastrado. Busque um usuário acima para adicionar.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {responsaveis.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{nome(r.user_id)}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{perfis[r.user_id]?.email} · desde {fmtDt(r.created_at)}</div>
                    </div>
                    <button className="dn-btn" onClick={() => removeResponsavel(r)} style={{ background: "#fee2e2", color: "#b91c1c" }}>Remover</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 18, right: 18, zIndex: 800, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.t === "err" ? "#fee2e2" : t.t === "ok" ? "#dcfce7" : "#e0f2fe", color: t.t === "err" ? "#b91c1c" : t.t === "ok" ? "#15803d" : "#0369a1", border: "1px solid rgba(0,0,0,.06)", borderRadius: 12, padding: "10px 16px", fontSize: 12.5, fontWeight: 600, maxWidth: 420, boxShadow: "0 10px 24px rgba(15,23,42,.15)" }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
