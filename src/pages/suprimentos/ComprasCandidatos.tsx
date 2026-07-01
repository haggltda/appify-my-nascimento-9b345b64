import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";
import { CandidatoInfo, baixarCurriculoCand, Modal, Campo, Acoes, Toasts, btnStyle, PendToggle, EtapaChip, HistoricoCandidato } from "@/components/recrutamento/CandidatoInfo";

// =====================================================================
// SUPRIMENTOS — EPIs / Uniforme dos candidatos aprovados
// Candidatos na etapa "Compras" (após o Exame Médico do SST). O Compras
// confirma os EPIs/equipamentos/uniforme que o Recrutamento solicitou e
// envia para a Admissão (RH), ou reprova. Fonte: VW_RECRUTAMENTO_CANDIDATOS.
// =====================================================================

export default function ComprasCandidatos() {
  const { user } = useAuth();
  const { roles } = usePermissoes();
  const podeAgir = roles.includes("comprador") || roles.includes("almoxarife") || roles.includes("admin");
  const nome = user?.user_metadata?.nome ?? user?.email ?? "";

  const [rows, setRows] = useState<any[]>([]);
  const [epis, setEpis] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const [acao, setAcao] = useState<{ cand: any; tipo: "ok" | "reprovar" } | null>(null);
  const [obs, setObs] = useState("");
  const [dataChegada, setDataChegada] = useState("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  const toast = (msg: string, t = "info") => {
    const id = Date.now() + Math.random();
    setToasts(x => [...x, { id, msg, t }]);
    setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 3600);
  };

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("VW_RECRUTAMENTO_CANDIDATOS").select("*");
    q = verTodos ? q.or("etapa_processo.eq.COMPRAS,compras_em.not.is.null") : q.eq("etapa_processo", "COMPRAS").eq("epis_informados", true);
    const { data, error } = await q.order("etapa_changed_at", { ascending: true });
    setLoading(false);
    if (error) { toast("Erro ao carregar: " + error.message, "err"); return; }
    setRows(data ?? []);
    // Carrega a tabela TR de EPIs dos candidatos listados.
    const ids = (data ?? []).map((c: any) => c.candidato_id);
    if (ids.length) {
      const { data: tr } = await (supabase as any).from("RECRUTAMENTO_EPIS").select("*").in("candidato_id", ids).order("id");
      const map: Record<number, any[]> = {};
      (tr ?? []).forEach((r: any) => { (map[r.candidato_id] = map[r.candidato_id] || []).push(r); });
      setEpis(map);
    } else setEpis({});
  }, [verTodos]);

  useEffect(() => { load(); }, [load]);

  const baixarCv = async (c: any) => { const err = await baixarCurriculoCand(c.storage_path); if (err) toast(err, "info"); };

  const confirmar = async () => {
    if (!acao) return;
    if (acao.tipo === "reprovar" && !obs.trim()) { toast("Informe o motivo.", "err"); return; }
    const nowIso = new Date().toISOString();
    const payload: Record<string, any> = acao.tipo === "ok"
      ? { etapa_processo: "DOCUMENTAÇÃO", etapa_changed_at: nowIso, compras_por: nome, compras_em: nowIso, compras_obs: obs.trim() || null, compras_data_chegada: dataChegada || null }
      : { etapa_processo: "Reprovado", etapa_changed_at: nowIso, compras_por: nome, compras_em: nowIso, motivo_reprovacao: obs.trim() };
    const { error } = await (supabase as any).from("WA_CURRICULOS").update(payload).eq("id", acao.cand.candidato_id);
    if (error) { toast("Erro ao salvar: " + error.message, "err"); return; }
    try {
      await (supabase as any).from("RECRUTAMENTO_HISTORICO").insert({
        solicitacao_id: acao.cand.vaga_id, candidato_id: acao.cand.candidato_id, candidato_nome: acao.cand.nome,
        evento: acao.tipo === "ok" ? "EPIs/Uniforme confirmados → Documentação" : "Candidato reprovado",
        de_status: "COMPRAS", para_status: acao.tipo === "ok" ? "DOCUMENTAÇÃO" : "Reprovado",
        papel: "Suprimentos", usuario_nome: nome, usuario_email: user?.email ?? "", detalhe: obs.trim() || null,
      });
    } catch { /* noop */ }
    toast(acao.tipo === "ok" ? "EPIs/Uniforme confirmados — segue para Documentação." : "Candidato reprovado.", "ok");
    setAcao(null); setObs("");
    load();
  };

  const termo = busca.trim().toLowerCase();
  const filtrados = !termo ? rows : rows.filter(c => [c.nome, c.cpf, c.cargo, c.contrato, c.cidade].some(v => String(v ?? "").toLowerCase().includes(termo)));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "linear-gradient(135deg,#fff 0%,#f8fbff 100%)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#0f3171" }}>🛒 EPIs / Uniforme — Novos Colaboradores</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Confirme os EPIs/equipamentos/uniforme solicitados pelo Recrutamento e envie à Admissão.</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, background: "#ffedd5", color: "#ea580c", border: "1px solid #fed7aa", borderRadius: 20, padding: "4px 12px" }}>{rows.length} pendente(s)</span>
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
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>{verTodos ? "Nenhum candidato passou pelo Compras." : "Nenhum candidato aguardando EPIs/uniforme."}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 14, alignItems: "start" }}>
            {filtrados.map(c => (
              <div key={c.candidato_id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
                <div style={{ height: 3, background: "#f97316" }} />
                <div style={{ padding: "14px 16px" }}>
                  <CandidatoInfo cand={c} hideCurriculo />
                  {/* Tabela TR de EPIs informada pelo Recrutamento */}
                  {(epis[c.candidato_id]?.length ?? 0) > 0 ? (
                    <div style={{ marginTop: 10, border: "1px solid #fed7aa", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9a3412", background: "#fff7ed", padding: "6px 10px", textTransform: "uppercase", letterSpacing: ".4px" }}>🦺 Itens do TR</div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                          <thead><tr style={{ background: "#fffdf8" }}>
                            {["Item", "Tam.", "Qtd.", "Period.", "Obs.", "Resp."].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 8px", fontSize: 9.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", borderBottom: "1px solid #fde68a" }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {epis[c.candidato_id].map((r: any) => (
                              <tr key={r.id}>
                                <td style={{ padding: "5px 8px", borderBottom: "1px solid #fef3e2", fontWeight: 600, color: "#0f172a" }}>{r.item}{r.obrigatorio && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 20, background: "#fee2e2", color: "#b91c1c" }}>OBRIGATÓRIO</span>}</td>
                                <td style={{ padding: "5px 8px", borderBottom: "1px solid #fef3e2", color: "#475569" }}>{r.tamanho || "—"}</td>
                                <td style={{ padding: "5px 8px", borderBottom: "1px solid #fef3e2", color: "#475569" }}>{r.quantidade || "—"}</td>
                                <td style={{ padding: "5px 8px", borderBottom: "1px solid #fef3e2", color: "#475569" }}>{r.periodicidade || "—"}</td>
                                <td style={{ padding: "5px 8px", borderBottom: "1px solid #fef3e2", color: "#475569" }}>{r.observacoes || "—"}</td>
                                <td style={{ padding: "5px 8px", borderBottom: "1px solid #fef3e2", color: "#94a3b8" }}>{r.responsavel || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px" }}>⚠️ Sem itens do TR informados.</div>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                    {c.etapa_processo !== "COMPRAS" && <span style={{ fontSize: 11, color: "#94a3b8" }}>Situação atual: <EtapaChip etapa={c.etapa_processo} /></span>}
                    <HistoricoCandidato candidatoId={c.candidato_id} nome={c.nome} />
                    {podeAgir && c.etapa_processo === "COMPRAS" && <>
                      <button onClick={() => { setObs(""); setDataChegada(""); setAcao({ cand: c, tipo: "ok" }); }} style={btnStyle("#16a34a", "none", "#fff")}>✓ Confirmar EPIs → Documentação</button>
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
        <Modal onClose={() => { setAcao(null); setObs(""); setDataChegada(""); }}
          title={acao.tipo === "ok" ? "Confirmar EPIs / Uniforme" : "Reprovar candidato"}
          sub={`${acao.cand.nome} · ${acao.cand.cargo || ""}`}>
          {acao.tipo === "ok" && (epis[acao.cand.candidato_id]?.length ?? 0) > 0 && (
            <div style={{ fontSize: 12, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 10px", color: "#9a3412", marginBottom: 12 }}>
              <b>{epis[acao.cand.candidato_id].length} item(ns) do TR</b> serão confirmados{(epis[acao.cand.candidato_id] || []).some((r: any) => r.obrigatorio) ? " (há itens obrigatórios para início)" : ""}.
            </div>
          )}
          {acao.tipo === "ok" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Data de chegada dos itens obrigatórios</label>
              <input type="date" value={dataChegada} onChange={e => setDataChegada(e.target.value)} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
          )}
          <Campo label={acao.tipo === "ok" ? "Observação (opcional)" : "Motivo *"} value={obs} onChange={setObs}
            placeholder={acao.tipo === "ok" ? "Ex.: tudo OK, itens separados." : "Descreva o motivo..."} />
          <Acoes onCancel={() => { setAcao(null); setObs(""); setDataChegada(""); }} onConfirm={confirmar} cor={acao.tipo === "ok" ? "#16a34a" : "#dc2626"} />
        </Modal>
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}
