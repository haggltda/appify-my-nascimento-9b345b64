import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVinculoEmpregado } from "@/hooks/useVinculoEmpregado";

// =====================================================================
// JURÍDICO — Central de Dúvidas Jurídicas
// Base de conhecimento (Q&A): qualquer colaborador pergunta e PESQUISA a
// biblioteca; somente o setor Jurídico (Situação = Trabalhando) RESPONDE.
// O controle real é por RLS (is_juridico_ativo); a UI só esconde os botões.
// =====================================================================

interface Duvida {
  id: number; created_at?: string; autor_id?: string; autor_nome?: string;
  titulo: string; pergunta: string; categoria?: string; status: string;
  resposta?: string; respondido_por?: string; respondido_em?: string; publicada?: boolean;
}

const CATEGORIAS = ["Trabalhista", "Contratos", "Processos", "Tributário", "Cível", "Administrativo", "Compliance", "LGPD", "Outros"];

const fmtDt = (s?: string) => { if (!s) return "—"; const d = new Date(s); return isNaN(+d) ? s : d.toLocaleDateString("pt-BR"); };
const ASK_RESET = { titulo: "", categoria: "", pergunta: "" };

export default function CentralDuvidas() {
  const { user } = useAuth();
  const { empregado } = useVinculoEmpregado();
  const autor = empregado?.nome || user?.user_metadata?.nome || user?.email || "Usuário";
  // Só do Jurídico (Trabalhando) pode responder. RLS reforça no servidor.
  const podeResponder = empregado?.setor === "JURIDICO" && empregado?.situacao === "Trabalhando";

  const [duvidas, setDuvidas] = useState<Duvida[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<"todas" | "respondidas" | "abertas" | "minhas">("todas");
  const [fCat, setFCat] = useState("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  const [askModal, setAskModal] = useState(false);
  const [ask, setAsk] = useState({ ...ASK_RESET });

  const [respAlvo, setRespAlvo] = useState<Duvida | null>(null);
  const [resp, setResp] = useState("");

  const toast = (msg: string, t = "info") => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, t }]); setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 3600); };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("JUR_DUVIDAS").select("*").order("created_at", { ascending: false }).limit(1000);
    setDuvidas(data ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const enviarPergunta = async () => {
    if (!ask.titulo.trim() || !ask.pergunta.trim()) { toast("Preencha o título e a pergunta.", "err"); return; }
    const { error } = await (supabase as any).from("JUR_DUVIDAS").insert({
      titulo: ask.titulo.trim(), pergunta: ask.pergunta.trim(), categoria: ask.categoria || null,
      autor_id: user?.id ?? null, autor_nome: autor, status: "Aberta",
    });
    if (error) { toast("Erro ao enviar: " + error.message, "err"); return; }
    setAskModal(false); setAsk({ ...ASK_RESET }); toast("Dúvida enviada ao Jurídico.", "ok"); load();
  };

  const abrirResponder = (d: Duvida) => { setRespAlvo(d); setResp(d.resposta ?? ""); };
  const responder = async () => {
    if (!respAlvo) return;
    if (!resp.trim()) { toast("Escreva a resposta.", "err"); return; }
    const { error } = await (supabase as any).from("JUR_DUVIDAS").update({
      resposta: resp.trim(), status: "Respondida", respondido_por: autor,
      respondido_em: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", respAlvo.id);
    if (error) { toast("Erro ao responder: " + error.message, "err"); return; }
    setRespAlvo(null); setResp(""); toast("Resposta publicada na biblioteca.", "ok"); load();
  };
  const excluir = async (d: Duvida) => {
    if (!confirm(`Excluir a dúvida "${d.titulo}"?`)) return;
    const { error } = await (supabase as any).from("JUR_DUVIDAS").delete().eq("id", d.id);
    if (error) { toast("Erro ao excluir: " + error.message, "err"); return; }
    setDuvidas(x => x.filter(i => i.id !== d.id)); toast("Dúvida excluída.", "ok");
  };

  const total = duvidas.length;
  const nResp = duvidas.filter(d => d.status === "Respondida").length;
  const nAbertas = total - nResp;

  const filtradas = duvidas.filter(d => {
    if (fStatus === "respondidas" && d.status !== "Respondida") return false;
    if (fStatus === "abertas" && d.status !== "Aberta") return false;
    if (fStatus === "minhas" && d.autor_id !== user?.id) return false;
    if (fCat && d.categoria !== fCat) return false;
    if (busca) { const q = busca.toLowerCase(); return [d.titulo, d.pergunta, d.resposta, d.categoria, d.autor_nome, d.respondido_por].some(x => (x || "").toLowerCase().includes(q)); }
    return true;
  });

  const chip = (k: typeof fStatus, label: string) => (
    <button className="jd-chip" onClick={() => setFStatus(k)} style={{ background: fStatus === k ? "#0f3171" : "#fff", color: fStatus === k ? "#fff" : "#475569", borderColor: fStatus === k ? "#0f3171" : "#e2e8f0" }}>{label}</button>
  );
  const card = (label: string, valor: number, cor: string) => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "12px 18px", flex: 1, minWidth: 130, boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: cor, marginTop: 2 }}>{valor}</div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <style>{`
        .jd-fi{width:100%;height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;font-size:13px;background:#fff;box-sizing:border-box}
        textarea.jd-fi{height:auto;padding:10px 12px;resize:vertical}
        .jd-fi:focus{outline:none;border-color:#0f3171;box-shadow:0 0 0 3px rgba(15,49,113,.1)}
        .jd-fg{margin-bottom:12px}
        .jd-fg label{display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px}
        .jd-btn{border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:12px;padding:9px 15px}
        .jd-chip{border:1px solid #e2e8f0;border-radius:20px;font-size:12px;font-weight:700;padding:6px 13px;cursor:pointer}
        .jd-ov{position:fixed;inset:0;z-index:700;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
        .jd-modal{background:#fff;border-radius:16px;padding:22px;width:100%;max-width:600px;max-height:92vh;overflow-y:auto;position:relative;box-shadow:0 16px 40px rgba(15,23,42,.18)}
      `}</style>

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 16, background: "linear-gradient(135deg,#fff,#f8fbff)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f3171" }}>📚 Central de Dúvidas Jurídicas</div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>Pesquise antes de perguntar — talvez sua dúvida já tenha sido respondida pelo Jurídico.</div>
        </div>
        <button className="jd-btn" onClick={() => { setAsk({ ...ASK_RESET }); setAskModal(true); }} style={{ background: "#0f3171", color: "#fff", boxShadow: "0 10px 22px rgba(15,49,113,.18)" }}>+ Nova dúvida</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 28px" }}>
        {/* Indicadores */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          {card("Dúvidas na biblioteca", total, "#0f3171")}
          {card("Respondidas", nResp, "#15803d")}
          {card("Aguardando resposta", nAbertas, nAbertas > 0 ? "#ea580c" : "#16a34a")}
        </div>

        {/* Busca + filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input className="jd-fi" style={{ maxWidth: 380 }} placeholder="🔎 Pesquisar na biblioteca (assunto, palavra-chave, resposta…)" value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="jd-fi" style={{ maxWidth: 200 }} value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
          {chip("todas", "Todas")}
          {chip("respondidas", "Respondidas")}
          {chip("abertas", "Aguardando")}
          {chip("minhas", "Minhas dúvidas")}
        </div>

        {!podeResponder && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#1d4ed8", marginBottom: 14 }}>
            ℹ️ Você pode pesquisar e ler todas as respostas. <b>Apenas o setor Jurídico</b> responde às dúvidas. Não achou? Clique em <b>“+ Nova dúvida”</b>.
          </div>
        )}

        {/* Lista */}
        {loading ? <div style={{ padding: 50, textAlign: "center", color: "#94a3b8" }}>Carregando…</div>
          : filtradas.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 46, textAlign: "center", color: "#94a3b8", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
              {busca || fCat || fStatus !== "todas" ? "Nenhuma dúvida encontrada com esse filtro." : "Ainda não há dúvidas. Seja o primeiro a perguntar."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtradas.map(d => {
                const respondida = d.status === "Respondida";
                return (
                  <div key={d.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14.5 }}>{d.titulo}</div>
                          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
                            {d.categoria ? <span style={{ fontWeight: 700, color: "#0f3171" }}>{d.categoria}</span> : null}
                            {d.categoria ? " · " : ""}por {d.autor_nome || "—"} · {fmtDt(d.created_at)}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 11px", borderRadius: 20, whiteSpace: "nowrap", background: respondida ? "#dcfce7" : "#fff7ed", color: respondida ? "#15803d" : "#ea580c" }}>{respondida ? "Respondida" : "Aguardando"}</span>
                      </div>

                      <div style={{ marginTop: 10, fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{d.pergunta}</div>

                      {respondida && (
                        <div style={{ marginTop: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 11, padding: "11px 13px" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#15803d", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>✅ Resposta do Jurídico</div>
                          <div style={{ fontSize: 13, color: "#0f172a", whiteSpace: "pre-wrap" }}>{d.resposta}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>{d.respondido_por || "Jurídico"}{d.respondido_em ? " · " + fmtDt(d.respondido_em) : ""}</div>
                        </div>
                      )}

                      {podeResponder && (
                        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                          <button className="jd-btn" onClick={() => abrirResponder(d)} style={{ background: respondida ? "#f1f5f9" : "rgba(22,163,74,.12)", color: respondida ? "#475569" : "#15803d", border: respondida ? "1px solid #e2e8f0" : "1px solid rgba(22,163,74,.25)", padding: "6px 12px" }}>{respondida ? "Editar resposta" : "✓ Responder"}</button>
                          <button className="jd-btn" onClick={() => excluir(d)} style={{ background: "none", color: "#dc2626", padding: "6px 8px" }}>Excluir</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* ── Modal: Nova dúvida ── */}
      {askModal && (
        <div className="jd-ov" onClick={e => { if (e.target === e.currentTarget) setAskModal(false); }}>
          <div className="jd-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setAskModal(false)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Nova dúvida ao Jurídico</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>O Jurídico responde e a resposta fica guardada na biblioteca para todos.</div>
            <div className="jd-fg"><label>Assunto / título *</label><input className="jd-fi" value={ask.titulo} onChange={e => setAsk(v => ({ ...v, titulo: e.target.value }))} placeholder="Ex.: Prazo para resposta de notificação extrajudicial" /></div>
            <div className="jd-fg"><label>Categoria</label><select className="jd-fi" value={ask.categoria} onChange={e => setAsk(v => ({ ...v, categoria: e.target.value }))}><option value="">— Selecione —</option>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="jd-fg"><label>Sua dúvida *</label><textarea className="jd-fi" rows={5} value={ask.pergunta} onChange={e => setAsk(v => ({ ...v, pergunta: e.target.value }))} placeholder="Descreva sua dúvida sobre o processo, lei, contrato…" /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button className="jd-btn" onClick={() => setAskModal(false)} style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>Cancelar</button>
              <button className="jd-btn" onClick={enviarPergunta} style={{ background: "#0f3171", color: "#fff" }}>Enviar dúvida</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Responder (só Jurídico) ── */}
      {respAlvo && (
        <div className="jd-ov" onClick={e => { if (e.target === e.currentTarget) setRespAlvo(null); }}>
          <div className="jd-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setRespAlvo(null)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Responder dúvida</div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 11, padding: "11px 13px", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 13.5 }}>{respAlvo.titulo}</div>
              <div style={{ fontSize: 12.5, color: "#475569", marginTop: 5, whiteSpace: "pre-wrap" }}>{respAlvo.pergunta}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>{respAlvo.categoria ? respAlvo.categoria + " · " : ""}por {respAlvo.autor_nome || "—"} · {fmtDt(respAlvo.created_at)}</div>
            </div>
            <div className="jd-fg"><label>Resposta do Jurídico *</label><textarea className="jd-fi" rows={6} value={resp} onChange={e => setResp(e.target.value)} placeholder="Escreva a resposta. Ela ficará pública na biblioteca." /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button className="jd-btn" onClick={() => setRespAlvo(null)} style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>Cancelar</button>
              <button className="jd-btn" onClick={responder} style={{ background: "#15803d", color: "#fff" }}>Publicar resposta</button>
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
