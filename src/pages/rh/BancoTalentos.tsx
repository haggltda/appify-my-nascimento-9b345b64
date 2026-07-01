import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";
import { Toasts, btnStyle } from "@/components/recrutamento/CandidatoInfo";

// =====================================================================
// RH / RECRUTAMENTO — Banco de Talentos
// Candidaturas GERAIS do portal (tipo_candidatura='geral', sem vaga). O
// recrutador busca por perfil e "puxa para uma vaga" (entra no kanban em ENTRADA).
// Fonte: WA_CURRICULOS + RECRUTAMENTO_CANDIDATO_ARQUIVOS.
// =====================================================================

const fmtDt = (s?: string) => (!s ? "—" : String(s).replace("T", " ").slice(0, 10));
const simNao = (b: any) => (b === true ? "Sim" : b === false ? "Não" : "—");

export default function BancoTalentos() {
  const { user } = useAuth();
  const { roles } = usePermissoes();
  const podeAgir = roles.includes("treinamentos") || roles.includes("admin");
  const nome = user?.user_metadata?.nome ?? user?.email ?? "";

  const [rows, setRows] = useState<any[]>([]);
  const [arquivos, setArquivos] = useState<Record<number, any[]>>({});
  const [vagas, setVagas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fCargo, setFCargo] = useState("");
  const [puxar, setPuxar] = useState<any | null>(null);   // candidato p/ puxar
  const [vagaSel, setVagaSel] = useState<string>("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  const toast = (msg: string, t = "info") => {
    const id = Date.now() + Math.random();
    setToasts(x => [...x, { id, msg, t }]);
    setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 3600);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("WA_CURRICULOS").select("*")
      .eq("tipo_candidatura", "geral")
      .is("vaga_id", null)
      .is("etapa_processo", null)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast("Erro ao carregar: " + error.message, "err"); return; }
    const list = data ?? [];
    setRows(list);
    const ids = list.map((c: any) => c.id);
    if (ids.length) {
      const { data: arq } = await (supabase as any).from("RECRUTAMENTO_CANDIDATO_ARQUIVOS").select("*").in("candidato_id", ids).order("id");
      const map: Record<number, any[]> = {};
      (arq ?? []).forEach((a: any) => { (map[a.candidato_id] = map[a.candidato_id] || []).push(a); });
      setArquivos(map);
    } else setArquivos({});
    // Vagas abertas para o "puxar".
    const { data: vg } = await (supabase as any)
      .from("SISTEMA_RECRUTAMENTO").select("id,cargo,contrato,cidade")
      .eq("status", "Vaga aberta - Seleção de Currículos").order("cargo");
    setVagas(vg ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const baixar = async (a: any) => {
    if (!a.storage_path) { toast("Sem arquivo.", "info"); return; }
    const { data, error } = await supabase.storage.from("curriculos").createSignedUrl(a.storage_path, 3600);
    if (error || !data?.signedUrl) { toast("Não foi possível abrir o arquivo.", "err"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const confirmarPuxar = async () => {
    if (!puxar || !vagaSel) { toast("Selecione a vaga.", "err"); return; }
    const nowIso = new Date().toISOString();
    const { error } = await (supabase as any).from("WA_CURRICULOS").update({
      vaga_id: Number(vagaSel), etapa_processo: "ENTRADA", etapa_changed_at: nowIso,
      selecionado_por: nome, selecionado_em: nowIso,
    }).eq("id", puxar.id);
    if (error) { toast("Erro ao puxar: " + error.message, "err"); return; }
    try {
      await (supabase as any).from("RECRUTAMENTO_HISTORICO").insert({
        solicitacao_id: Number(vagaSel), candidato_id: puxar.id, candidato_nome: puxar.nome,
        evento: "Puxado do Banco de Talentos → ENTRADA", para_status: "ENTRADA",
        papel: "Recrutamento", usuario_nome: nome, usuario_email: user?.email ?? "",
      });
    } catch { /* noop */ }
    toast(`${puxar.nome || "Candidato"} enviado para a vaga.`, "ok");
    setPuxar(null); setVagaSel("");
    load();
  };

  const cargosOpc = Array.from(new Set(rows.flatMap((c: any) => String(c.cargos_interesse ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)))).sort();
  const termo = busca.trim().toLowerCase();
  const filtrados = rows.filter((c: any) => {
    if (fCargo && !String(c.cargos_interesse ?? "").toLowerCase().includes(fCargo.toLowerCase())) return false;
    if (!termo) return true;
    return [c.nome, c.cpf, c.cargos_interesse, c.cidade_desejada, c.cidade_residencia, c.escolaridade]
      .some(v => String(v ?? "").toLowerCase().includes(termo));
  });

  const info = (label: string, val: any) => (val || val === false ? (
    <div style={{ fontSize: 12, color: "#475569" }}><span style={{ color: "#94a3b8", fontWeight: 700 }}>{label}: </span>{typeof val === "boolean" ? simNao(val) : val}</div>
  ) : null);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "linear-gradient(135deg,#fff 0%,#f8fbff 100%)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#0f3171" }}>💼 Banco de Talentos</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Candidaturas gerais do portal. Busque por perfil e puxe para uma vaga aberta.</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, background: "#eef4ff", color: "#0f3171", border: "1px solid #dbe4f0", borderRadius: 20, padding: "4px 12px" }}>{rows.length} candidato(s)</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <input placeholder="Buscar por nome, CPF, cargo, cidade, escolaridade..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: 12, padding: "9px 12px", outline: "none", flex: 1, minWidth: 260, boxShadow: "0 8px 24px rgba(15,23,42,.06)" }} />
          <select value={fCargo} onChange={e => setFCargo(e.target.value)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#475569", fontSize: 12, padding: "9px 12px", outline: "none", minWidth: 200 }}>
            <option value="">Todos os cargos de interesse</option>
            {cargosOpc.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Nenhum candidato no banco de talentos.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(380px,1fr))", gap: 14 }}>
            {filtrados.map((c: any) => (
              <div key={c.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
                <div style={{ height: 3, background: "#0f3171" }} />
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{c.nome || "Sem nome"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 14px" }}>
                    {info("CPF", c.cpf)}
                    {info("Nasc.", fmtDt(c.data_nascimento))}
                    {info("Fone", c.telefone)}
                    {info("Email", c.email)}
                    {info("RG", c.rg)}
                    {info("Sexo", c.sexo)}
                    {info("Mãe", c.nome_mae)}
                    {info("Pai", c.nome_pai)}
                    {info("Escolaridade", c.escolaridade)}
                    {info("Reside", c.cidade_residencia)}
                    {info("Deseja", [c.cidade_desejada, c.estado_desejado].filter(Boolean).join("/"))}
                    {info("Horários", c.disponibilidade_horarios)}
                    {info("Fim de semana", c.disp_fim_semana)}
                    {info("CNH", c.possui_cnh)}
                    {info("Experiência", c.experiencia_previa)}
                    {info("Estrangeiro", c.estrangeiro)}
                  </div>
                  {c.cargos_interesse && <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 9px" }}><b style={{ color: "#0f3171" }}>Interesse:</b> {c.cargos_interesse}</div>}
                  {(arquivos[c.id]?.length ?? 0) > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {arquivos[c.id].map((a: any) => (
                        <button key={a.id} onClick={() => baixar(a)} style={btnStyle(a.tipo === "ctps" ? "rgba(139,92,246,.12)" : "rgba(249,115,22,.12)", `1px solid ${a.tipo === "ctps" ? "rgba(139,92,246,.3)" : "rgba(249,115,22,.3)"}`, a.tipo === "ctps" ? "#7c3aed" : "#ea580c")}>↓ {a.tipo === "ctps" ? "CTPS" : "Currículo"}</button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 10.5, color: "#94a3b8" }}>Cadastro em {fmtDt(c.created_at)}</span>
                    {podeAgir && <button onClick={() => { setVagaSel(""); setPuxar(c); }} style={btnStyle("#16a34a", "none", "#fff")}>✓ Puxar para vaga</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {puxar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(15,23,42,.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 24, width: "100%", maxWidth: 460, position: "relative", boxShadow: "0 16px 40px rgba(15,23,42,.1)" }}>
            <button onClick={() => { setPuxar(null); setVagaSel(""); }} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Puxar para uma vaga</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>{puxar.nome} entrará no kanban da vaga em ENTRADA.</div>
            {vagas.length === 0 ? (
              <div style={{ fontSize: 13, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>Nenhuma vaga aberta (status "Vaga aberta - Seleção de Currículos") no momento.</div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Vaga *</label>
                <select value={vagaSel} onChange={e => setVagaSel(e.target.value)} style={{ width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: 13, padding: "9px 12px", outline: "none" }}>
                  <option value="">— Selecione a vaga —</option>
                  {vagas.map(v => <option key={v.id} value={v.id}>#{v.id} · {v.cargo} · {v.cidade || v.contrato}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setPuxar(null); setVagaSel(""); }} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmarPuxar} disabled={!vagaSel} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: vagaSel ? "#16a34a" : "#cbd5e1", color: "#fff", fontSize: 12, fontWeight: 700, cursor: vagaSel ? "pointer" : "default" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}
