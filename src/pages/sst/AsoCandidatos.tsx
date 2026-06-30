import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";

// =====================================================================
// SST — ASO / Admissão (fila do Recrutamento)
// Candidatos já liberados pelo Jurídico, na etapa "ASO". O SST confirma o
// exame admissional (ASO) e libera a Admissão, ou reprova.
// Fonte: VW_RECRUTAMENTO_CANDIDATOS (join WA_CURRICULOS × SISTEMA_RECRUTAMENTO).
// =====================================================================

interface Cand {
  candidato_id: number;
  vaga_id: number;
  nome?: string;
  telefone?: string;
  email?: string;
  cpf?: string;
  storage_path?: string;
  etapa_processo?: string;
  juridico_por?: string;
  juridico_em?: string;
  juridico_obs?: string;
  cargo?: string;
  contrato?: string;
  cidade?: string;
}

const fmtDt = (s?: string) => (!s ? "—" : String(s).replace("T", " ").slice(0, 10));

export default function AsoCandidatos() {
  const { user } = useAuth();
  const { roles } = usePermissoes();
  const podeAgir = roles.includes("sst") || roles.includes("admin");

  const [rows, setRows] = useState<Cand[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [acao, setAcao] = useState<{ cand: Cand; tipo: "ok" | "reprovar" } | null>(null);
  const [obs, setObs] = useState("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  const toast = (msg: string, t = "info") => {
    const id = Date.now() + Math.random();
    setToasts(x => [...x, { id, msg, t }]);
    setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 3600);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("VW_RECRUTAMENTO_CANDIDATOS")
      .select("*")
      .eq("etapa_processo", "ASO")
      .order("juridico_em", { ascending: true });
    setLoading(false);
    if (error) { toast("Erro ao carregar: " + error.message, "err"); return; }
    setRows(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const baixarCv = async (c: Cand) => {
    if (!c.storage_path) { toast("Sem arquivo de currículo.", "info"); return; }
    const { data, error } = await supabase.storage.from("curriculos").createSignedUrl(c.storage_path, 3600);
    if (error || !data?.signedUrl) { toast("Não foi possível abrir o arquivo.", "err"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const confirmar = async () => {
    if (!acao) return;
    if (acao.tipo === "reprovar" && !obs.trim()) { toast("Informe o motivo.", "err"); return; }
    const nome = user?.user_metadata?.nome ?? user?.email ?? "";
    const nowIso = new Date().toISOString();
    const payload: Record<string, any> = acao.tipo === "ok"
      ? { etapa_processo: "Admissão", etapa_changed_at: nowIso, sst_ok: true, sst_por: nome, sst_em: nowIso, admitido_em: nowIso, sst_obs: obs.trim() || null }
      : { etapa_processo: "Reprovado", etapa_changed_at: nowIso, sst_ok: false, sst_por: nome, sst_em: nowIso, motivo_reprovacao: obs.trim() };
    const { error } = await (supabase as any).from("WA_CURRICULOS").update(payload).eq("id", acao.cand.candidato_id);
    if (error) { toast("Erro ao salvar: " + error.message, "err"); return; }
    toast(acao.tipo === "ok" ? "ASO confirmado — admissão liberada." : "Candidato reprovado.", "ok");
    setAcao(null); setObs("");
    load();
  };

  const termo = busca.trim().toLowerCase();
  const filtrados = !termo ? rows : rows.filter(c =>
    [c.nome, c.cpf, c.cargo, c.contrato, c.cidade].some(v => String(v ?? "").toLowerCase().includes(termo))
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "linear-gradient(135deg,#fff 0%,#f8fbff 100%)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#0f3171" }}>🦺 ASO / Admissão</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Candidatos liberados pelo Jurídico, aguardando exame admissional (ASO).</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", borderRadius: 20, padding: "4px 12px" }}>{rows.length} pendente(s)</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px" }}>
        <input
          placeholder="Buscar por nome, CPF, cargo, contrato, cidade..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: 12, padding: "9px 12px", outline: "none", width: "100%", maxWidth: 420, marginBottom: 14, boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}
        />

        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Nenhum candidato aguardando ASO.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
            {filtrados.map(c => (
              <div key={c.candidato_id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
                <div style={{ height: 3, background: "#f59e0b" }} />
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{c.nome || "Sem nome"}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569" }}>
                    {c.cpf && <div><b style={{ color: "#94a3b8" }}>CPF:</b> {c.cpf}</div>}
                    {c.telefone && <div><b style={{ color: "#94a3b8" }}>Fone:</b> {c.telefone}</div>}
                    {c.email && <div><b style={{ color: "#94a3b8" }}>Email:</b> {c.email}</div>}
                  </div>
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", fontSize: 12, color: "#475569" }}>
                    <div><b style={{ color: "#0f3171" }}>{c.cargo || "Cargo —"}</b></div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{[c.contrato, c.cidade].filter(Boolean).join(" · ") || "—"} · vaga #{c.vaga_id}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#16a34a" }}>✓ Jurídico OK por {c.juridico_por || "—"} em {fmtDt(c.juridico_em)}</div>
                  {c.juridico_obs && <div style={{ fontSize: 11.5, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px" }}>Jurídico: {c.juridico_obs}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {c.storage_path && <button onClick={() => baixarCv(c)} style={{ padding: "6px 11px", borderRadius: 8, background: "rgba(249,115,22,.12)", border: "1px solid rgba(249,115,22,.25)", color: "#f97316", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↓ Currículo</button>}
                    {podeAgir && <>
                      <button onClick={() => { setObs(""); setAcao({ cand: c, tipo: "ok" }); }} style={{ padding: "6px 11px", borderRadius: 8, background: "#16a34a", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ Confirmar ASO</button>
                      <button onClick={() => { setObs(""); setAcao({ cand: c, tipo: "reprovar" }); }} style={{ padding: "6px 11px", borderRadius: 8, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Reprovar</button>
                    </>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {acao && (
        <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(15,23,42,.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 24, width: "100%", maxWidth: 440, position: "relative", boxShadow: "0 16px 40px rgba(15,23,42,.1)" }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{acao.tipo === "ok" ? "Confirmar ASO e liberar admissão" : "Reprovar candidato"}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>{acao.cand.nome} · {acao.cand.cargo}</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>{acao.tipo === "ok" ? "Observação (opcional)" : "Motivo *"}</label>
              <textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder={acao.tipo === "ok" ? "Ex.: apto no ASO." : "Descreva o motivo..."} style={{ width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: 13, padding: "8px 12px", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setAcao(null); setObs(""); }} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmar} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: acao.tipo === "ok" ? "#16a34a" : "#dc2626", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            display: "inline-block", padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, boxShadow: "0 16px 40px rgba(15,23,42,.1)",
            background: t.t === "ok" ? "#ecfdf3" : t.t === "err" ? "#fef2f2" : "#eff6ff",
            color: t.t === "ok" ? "#15803d" : t.t === "err" ? "#b91c1c" : "#1d4ed8",
            border: `1px solid ${t.t === "ok" ? "#86efac" : t.t === "err" ? "#fecaca" : "#bfdbfe"}`,
          }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
