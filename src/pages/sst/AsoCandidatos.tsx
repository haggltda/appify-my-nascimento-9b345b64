import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";
import { CandidatoInfo, baixarCurriculoCand, Modal, Campo, Acoes, Toasts, btnStyle, PendToggle, EtapaChip } from "@/components/recrutamento/CandidatoInfo";

// =====================================================================
// SST — Exame Médico (fila do Recrutamento)
// Candidatos na etapa "Exame Médico" (liberados pelo Jurídico e pelas
// entrevistas). O SST confirma o exame admissional e envia para o Compras
// (EPIs/Uniforme), ou reprova. Fonte: VW_RECRUTAMENTO_CANDIDATOS.
// =====================================================================

export default function AsoCandidatos() {
  const { user } = useAuth();
  const { roles } = usePermissoes();
  const podeAgir = roles.includes("sst") || roles.includes("admin");
  const nome = user?.user_metadata?.nome ?? user?.email ?? "";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const [acao, setAcao] = useState<{ cand: any; tipo: "agendar" | "realizar" | "reprovar" } | null>(null);
  const [obs, setObs] = useState("");
  const [ag, setAg] = useState({ data: "", hora: "", local: "" });
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  const fmtD = (s?: string) => (!s ? "—" : String(s).slice(0, 10).split("-").reverse().join("/"));
  const logHist = async (c: any, evento: string, de: string, para: string, detalhe: string | null) => {
    try { await (supabase as any).from("RECRUTAMENTO_HISTORICO").insert({ solicitacao_id: c.vaga_id, candidato_id: c.candidato_id, candidato_nome: c.nome, evento, de_status: de, para_status: para, papel: "SST", usuario_nome: nome, usuario_email: user?.email ?? "", detalhe }); } catch { /* noop */ }
  };

  const toast = (msg: string, t = "info") => {
    const id = Date.now() + Math.random();
    setToasts(x => [...x, { id, msg, t }]);
    setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 3600);
  };

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("VW_RECRUTAMENTO_CANDIDATOS").select("*");
    q = verTodos ? q.or('etapa_processo.eq."EXAME SST",sst_em.not.is.null,sst_agendado_em.not.is.null') : q.eq("etapa_processo", "EXAME SST");
    const { data, error } = await q.order("etapa_changed_at", { ascending: true });
    setLoading(false);
    if (error) { toast("Erro ao carregar: " + error.message, "err"); return; }
    setRows(data ?? []);
  }, [verTodos]);

  useEffect(() => { load(); }, [load]);

  const baixarCv = async (c: any) => { const err = await baixarCurriculoCand(c.storage_path); if (err) toast(err, "info"); };

  const confirmar = async () => {
    if (!acao) return;
    const nowIso = new Date().toISOString();
    const c = acao.cand;
    if (acao.tipo === "agendar") {
      if (!ag.data) { toast("Informe a data do exame.", "err"); return; }
      const { error } = await (supabase as any).from("WA_CURRICULOS").update({
        sst_data_exame: ag.data, sst_hora_exame: ag.hora.trim() || null, sst_local_exame: ag.local.trim() || null,
        sst_agendado_por: nome, sst_agendado_em: nowIso,
      }).eq("id", c.candidato_id);
      if (error) { toast("Erro: " + error.message, "err"); return; }
      await logHist(c, "Exame agendado", "EXAME SST", "EXAME SST", `${fmtD(ag.data)} ${ag.hora} · ${ag.local}`.trim());
      toast("Exame agendado.", "ok");
    } else if (acao.tipo === "realizar") {
      const { error } = await (supabase as any).from("WA_CURRICULOS").update({
        etapa_processo: "COMPRAS", etapa_changed_at: nowIso, sst_ok: true, sst_por: nome, sst_em: nowIso, sst_obs: obs.trim() || null,
      }).eq("id", c.candidato_id);
      if (error) { toast("Erro: " + error.message, "err"); return; }
      await logHist(c, "Exame (ASO) realizado → Compras", "EXAME SST", "COMPRAS", obs.trim() || null);
      toast("Exame realizado — enviado ao Compras.", "ok");
    } else {
      if (!obs.trim()) { toast("Informe o motivo.", "err"); return; }
      const { error } = await (supabase as any).from("WA_CURRICULOS").update({
        etapa_processo: "Reprovado", etapa_changed_at: nowIso, sst_ok: false, sst_por: nome, sst_em: nowIso, motivo_reprovacao: obs.trim(),
      }).eq("id", c.candidato_id);
      if (error) { toast("Erro: " + error.message, "err"); return; }
      await logHist(c, "Candidato reprovado", "EXAME SST", "Reprovado", obs.trim());
      toast("Candidato reprovado.", "ok");
    }
    setAcao(null); setObs(""); setAg({ data: "", hora: "", local: "" });
    load();
  };

  const termo = busca.trim().toLowerCase();
  const filtrados = !termo ? rows : rows.filter(c => [c.nome, c.cpf, c.cargo, c.contrato, c.cidade].some(v => String(v ?? "").toLowerCase().includes(termo)));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "linear-gradient(135deg,#fff 0%,#f8fbff 100%)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#0f3171" }}>🦺 Exame Médico (SST)</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>1) Agende o exame (data/hora/local). 2) Após realizado, marque como apto para enviar ao Compras.</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", borderRadius: 20, padding: "4px 12px" }}>{rows.length} pendente(s)</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <input placeholder="Buscar por nome, CPF, cargo, contrato, cidade..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: 12, padding: "9px 12px", outline: "none", flex: 1, minWidth: 240, boxShadow: "0 8px 24px rgba(15,23,42,.06)" }} />
          <PendToggle verTodos={verTodos} setVerTodos={setVerTodos} />
        </div>

        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>{verTodos ? "Nenhum candidato passou pelo SST." : "Nenhum candidato aguardando exame médico."}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 14 }}>
            {filtrados.map(c => (
              <div key={c.candidato_id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
                <div style={{ height: 3, background: "#f59e0b" }} />
                <div style={{ padding: "14px 16px" }}>
                  <CandidatoInfo cand={c} />
                  {c.sst_agendado_em && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#15803d", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "7px 10px" }}>
                      🗓 <b>Exame agendado:</b> {fmtD(c.sst_data_exame)}{c.sst_hora_exame ? ` às ${c.sst_hora_exame}` : ""}{c.sst_local_exame ? ` · ${c.sst_local_exame}` : ""}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                    {c.etapa_processo !== "EXAME SST" && <span style={{ fontSize: 11, color: "#94a3b8" }}>Situação atual: <EtapaChip etapa={c.etapa_processo} /></span>}
                    {c.storage_path && <button onClick={() => baixarCv(c)} style={btnStyle("rgba(249,115,22,.12)", "1px solid rgba(249,115,22,.25)", "#f97316")}>↓ Currículo</button>}
                    {podeAgir && c.etapa_processo === "EXAME SST" && <>
                      {!c.sst_agendado_em
                        ? <button onClick={() => { setAg({ data: "", hora: "", local: c.local_exato || c.cidade || "" }); setAcao({ cand: c, tipo: "agendar" }); }} style={btnStyle("#0ea5e9", "none", "#fff")}>🗓 Agendar exame</button>
                        : <button onClick={() => { setObs(""); setAcao({ cand: c, tipo: "realizar" }); }} style={btnStyle("#16a34a", "none", "#fff")}>✓ Realizar (apto) → Compras</button>}
                      <button onClick={() => { setObs(""); setAcao({ cand: c, tipo: "reprovar" }); }} style={btnStyle("rgba(220,38,38,.08)", "1px solid rgba(220,38,38,.25)", "#dc2626")}>Reprovar</button>
                    </>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {acao && (
        <Modal onClose={() => { setAcao(null); setObs(""); setAg({ data: "", hora: "", local: "" }); }}
          title={acao.tipo === "agendar" ? "Agendar exame (ASO)" : acao.tipo === "realizar" ? "Realizar exame — apto" : "Reprovar candidato"}
          sub={`${acao.cand.nome} · ${acao.cand.cargo || ""}${acao.cand.cidade ? " · " + acao.cand.cidade : ""}`}>
          {acao.tipo === "agendar" ? (<>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Data *</label>
                <input type="date" value={ag.data} onChange={e => setAg(s => ({ ...s, data: e.target.value }))} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 10px", fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Horário</label>
                <input value={ag.hora} onChange={e => setAg(s => ({ ...s, hora: e.target.value }))} placeholder="Ex.: 09:00" style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 10px", fontSize: 13, outline: "none" }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Local do exame</label>
              <input value={ag.local} onChange={e => setAg(s => ({ ...s, local: e.target.value }))} placeholder="Clínica / endereço" style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
          </>) : (
            <Campo label={acao.tipo === "realizar" ? "Observação (opcional)" : "Motivo *"} value={obs} onChange={setObs}
              placeholder={acao.tipo === "realizar" ? "Ex.: apto no exame admissional." : "Descreva o motivo..."} />
          )}
          <Acoes onCancel={() => { setAcao(null); setObs(""); setAg({ data: "", hora: "", local: "" }); }} onConfirm={confirmar} cor={acao.tipo === "reprovar" ? "#dc2626" : "#16a34a"} />
        </Modal>
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}
