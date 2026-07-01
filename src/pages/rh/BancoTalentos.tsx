import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";
import { Toasts, btnStyle, EtapaChip } from "@/components/recrutamento/CandidatoInfo";

// =====================================================================
// RH / RECRUTAMENTO — Banco de Talentos
// Pool central de candidatos: candidaturas gerais (sem vaga) + candidaturas
// a vagas específicas. Abas: Favoritos, Banco geral, Por vaga, Todos.
// Fonte: WA_CURRICULOS + RECRUTAMENTO_CANDIDATO_ARQUIVOS.
// =====================================================================

const fmtDt = (s?: string) => (!s ? "—" : String(s).replace("T", " ").slice(0, 10));
const simNao = (b: any) => (b === true ? "Sim" : b === false ? "Não" : "—");
type Aba = "favoritos" | "banco" | "vaga" | "todos";

export default function BancoTalentos() {
  const { user } = useAuth();
  const { roles } = usePermissoes();
  const podeAgir = roles.includes("treinamentos") || roles.includes("admin");
  const nome = user?.user_metadata?.nome ?? user?.email ?? "";

  const [aba, setAba] = useState<Aba>("banco");
  const [cargoFiltro, setCargoFiltro] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [arquivos, setArquivos] = useState<Record<number, any[]>>({});
  const [sols, setSols] = useState<any[]>([]);                 // solicitações (cargo/status)
  const [vagasComCand, setVagasComCand] = useState<{ vaga_id: number; n: number }[]>([]);
  const [contadores, setContadores] = useState({ banco: 0, favoritos: 0, todos: 0 });
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [puxar, setPuxar] = useState<any | null>(null);
  const [vagaSel, setVagaSel] = useState<string>("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  const toast = (msg: string, t = "info") => {
    const id = Date.now() + Math.random();
    setToasts(x => [...x, { id, msg, t }]);
    setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 3600);
  };

  const cargoDe = (id?: number | null) => sols.find(s => s.id === id)?.cargo || (id ? `#${id}` : "—");
  const vagasAbertas = sols.filter(s => s.status === "Vaga aberta - Seleção de Currículos");

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("WA_CURRICULOS").select("*");
    if (aba === "favoritos") q = q.eq("favorito", true);
    else if (aba === "banco") q = q.eq("tipo_candidatura", "geral").is("vaga_id", null).is("etapa_processo", null);
    else if (aba === "vaga") q = q.not("vaga_id", "is", null);
    const { data, error } = await q.order("created_at", { ascending: false });
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
  }, [aba]);

  // Metadados (uma vez): solicitações + contadores + vagas com candidatura.
  const loadMeta = useCallback(async () => {
    const [{ data: s }, { data: all }] = await Promise.all([
      (supabase as any).from("SISTEMA_RECRUTAMENTO").select("id,cargo,cidade,status"),
      (supabase as any).from("WA_CURRICULOS").select("id,vaga_id,favorito,tipo_candidatura,etapa_processo"),
    ]);
    setSols(s ?? []);
    const rows = all ?? [];
    const porVaga = new Map<number, number>();
    rows.forEach((c: any) => { if (c.vaga_id) porVaga.set(c.vaga_id, (porVaga.get(c.vaga_id) || 0) + 1); });
    setVagasComCand(Array.from(porVaga, ([vaga_id, n]) => ({ vaga_id, n })).sort((a, b) => b.n - a.n));
    setContadores({
      todos: rows.length,
      favoritos: rows.filter((c: any) => c.favorito).length,
      banco: rows.filter((c: any) => c.tipo_candidatura === "geral" && !c.vaga_id && !c.etapa_processo).length,
    });
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { load(); }, [load]);

  const baixar = async (a: any) => {
    if (!a.storage_path) { toast("Sem arquivo.", "info"); return; }
    const { data, error } = await supabase.storage.from("curriculos").createSignedUrl(a.storage_path, 3600);
    if (error || !data?.signedUrl) { toast("Não foi possível abrir o arquivo.", "err"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const favoritar = async (c: any) => {
    const novo = !c.favorito;
    const { error } = await (supabase as any).from("WA_CURRICULOS").update({ favorito: novo }).eq("id", c.id);
    if (error) { toast("Erro: " + error.message, "err"); return; }
    setRows(rs => rs.map(x => x.id === c.id ? { ...x, favorito: novo } : x).filter(x => aba !== "favoritos" || x.favorito));
    setContadores(cn => ({ ...cn, favoritos: cn.favoritos + (novo ? 1 : -1) }));
    toast(novo ? "⭐ Favoritado." : "Removido dos favoritos.", "ok");
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

  const digitsOf = (s?: string) => String(s ?? "").replace(/\D/g, "");
  // Vagas que receberam currículo agrupadas por CARGO.
  const cargosComCand = (() => {
    const m = new Map<string, number>();
    vagasComCand.forEach(v => { const c = cargoDe(v.vaga_id); m.set(c, (m.get(c) || 0) + v.n); });
    return Array.from(m, ([cargo, n]) => ({ cargo, n })).sort((a, b) => b.n - a.n);
  })();

  const termo = busca.trim().toLowerCase();
  const filtrados = rows.filter((c: any) => {
    if (aba === "vaga" && cargoFiltro && cargoDe(c.vaga_id) !== cargoFiltro) return false;
    if (!termo) return true;
    return [c.nome, c.cpf, c.cargos_interesse, c.cidade_desejada, c.cidade_residencia, c.escolaridade, cargoDe(c.vaga_id)]
      .some(v => String(v ?? "").toLowerCase().includes(termo));
  });

  // Junta candidaturas do MESMO CPF num só card (informa a quantidade).
  const agrupados = (() => {
    const m = new Map<string, any[]>();
    filtrados.forEach((c: any) => {
      const d = digitsOf(c.cpf);
      const k = d.length === 11 ? d : `id:${c.id}`;
      const arr = m.get(k); if (arr) arr.push(c); else m.set(k, [c]);
    });
    return Array.from(m.values()).map(items => ({ latest: items[0], items, n: items.length }));
  })();

  const info = (label: string, val: any) => (val || val === false ? (
    <div style={{ fontSize: 12, color: "#475569" }}><span style={{ color: "#94a3b8", fontWeight: 700 }}>{label}: </span>{typeof val === "boolean" ? simNao(val) : val}</div>
  ) : null);

  const tabBtn = (id: Aba, label: string, count?: number) => (
    <button onClick={() => { setAba(id); if (id !== "vaga") setCargoFiltro(""); }} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: aba === id ? "#0f3171" : "transparent", color: aba === id ? "#fff" : "#94a3b8", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
      {label}{count != null ? ` (${count})` : ""}
    </button>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "linear-gradient(135deg,#fff 0%,#f8fbff 100%)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#0f3171" }}>💼 Banco de Talentos</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Todos os candidatos e candidaturas. Favorite ⭐, filtre por vaga e puxe para uma vaga aberta.</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px" }}>
        {/* Abas */}
        <div style={{ display: "inline-flex", gap: 2, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 4, marginBottom: 14, boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexWrap: "wrap" }}>
          {tabBtn("favoritos", "⭐ Favoritos", contadores.favoritos)}
          {tabBtn("banco", "Banco geral", contadores.banco)}
          {tabBtn("vaga", "Por vaga")}
          {tabBtn("todos", "Todos", contadores.todos)}
        </div>

        {/* Card: cargos que receberam currículo */}
        {aba === "vaga" && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "12px 14px", marginBottom: 14, boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f3171", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".4px" }}>Cargos que receberam candidatura</div>
            {cargosComCand.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Nenhuma candidatura a vaga ainda.</div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {cargosComCand.map(v => (
                  <button key={v.cargo} onClick={() => { setAba("vaga"); setCargoFiltro(cargoFiltro === v.cargo ? "" : v.cargo); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 10, border: `1px solid ${cargoFiltro === v.cargo ? "#0f3171" : "#e2e8f0"}`, background: cargoFiltro === v.cargo ? "#eef4ff" : "#fff", cursor: "pointer" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{v.cargo}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#0f3171", background: "#fff", border: "1px solid #dbe4f0", borderRadius: 20, padding: "1px 8px" }}>{v.n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Busca + filtro cargo */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <input placeholder="Buscar por nome, CPF, cargo, cidade..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: 12, padding: "9px 12px", outline: "none", flex: 1, minWidth: 260, boxShadow: "0 8px 24px rgba(15,23,42,.06)" }} />
          {cargosOpc.length > 0 && (
            <select value="" onChange={e => e.target.value && setBusca(e.target.value)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#475569", fontSize: 12, padding: "9px 12px", outline: "none", minWidth: 200 }}>
              <option value="">Filtrar por cargo de interesse…</option>
              {cargosOpc.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Carregando...</div>
        ) : aba === "vaga" && !cargoFiltro ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8" }}>Selecione um cargo acima para ver os candidatos.</div>
        ) : agrupados.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Nenhum candidato.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(380px,1fr))", gap: 14, alignItems: "start" }}>
            {agrupados.map(g => {
              const c = g.latest;
              const arqsG = g.items.flatMap((it: any) => arquivos[it.id] || []);
              const semVaga = g.items.find((it: any) => !it.vaga_id);
              return (
              <div key={c.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.06)", position: "relative" }}>
                <div style={{ height: 3, background: "#0f3171" }} />
                <button onClick={() => favoritar(c)} title={c.favorito ? "Remover dos favoritos" : "Favoritar"} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, filter: c.favorito ? "none" : "grayscale(1) opacity(.4)" }}>⭐</button>
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", paddingRight: 28, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {c.nome || "Sem nome"}
                    {g.n > 1 && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 9px", borderRadius: 20, background: "#eef4ff", border: "1px solid #dbe4f0", color: "#0f3171" }}>📩 {g.n} candidaturas</span>}
                  </div>
                  {c.vaga_id && <div style={{ fontSize: 11.5, color: "#0369a1" }}>Candidatou-se: <b>{cargoDe(c.vaga_id)}</b> {c.etapa_processo && <EtapaChip etapa={c.etapa_processo} />}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 14px" }}>
                    {info("CPF", c.cpf)}
                    {info("Nasc.", fmtDt(c.data_nascimento))}
                    {info("Fone", c.telefone)}
                    {info("Email", c.email)}
                    {info("Escolaridade", c.escolaridade)}
                    {info("Reside", c.cidade_residencia)}
                    {info("Deseja", [c.cidade_desejada, c.estado_desejado].filter(Boolean).join("/"))}
                    {info("CNH", c.possui_cnh)}
                    {info("Horários", c.disponibilidade_horarios)}
                    {info("Experiência", c.experiencia_previa)}
                  </div>
                  {c.cargos_interesse && <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 9px" }}><b style={{ color: "#0f3171" }}>Interesse:</b> {c.cargos_interesse}</div>}
                  {arqsG.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {arqsG.map((a: any) => (
                        <button key={a.id} onClick={() => baixar(a)} style={btnStyle(a.tipo === "ctps" ? "rgba(139,92,246,.12)" : "rgba(249,115,22,.12)", `1px solid ${a.tipo === "ctps" ? "rgba(139,92,246,.3)" : "rgba(249,115,22,.3)"}`, a.tipo === "ctps" ? "#7c3aed" : "#ea580c")}>↓ {a.tipo === "ctps" ? "CTPS" : "Currículo"}</button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 10.5, color: "#94a3b8" }}>Cadastro em {fmtDt(c.created_at)}</span>
                    {podeAgir && semVaga && <button onClick={() => { setVagaSel(""); setPuxar(semVaga); }} style={btnStyle("#16a34a", "none", "#fff")}>✓ Puxar para vaga</button>}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {puxar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(15,23,42,.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 24, width: "100%", maxWidth: 460, position: "relative", boxShadow: "0 16px 40px rgba(15,23,42,.1)" }}>
            <button onClick={() => { setPuxar(null); setVagaSel(""); }} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Puxar para uma vaga</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>{puxar.nome} entrará no kanban da vaga em ENTRADA.</div>
            {vagasAbertas.length === 0 ? (
              <div style={{ fontSize: 13, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>Nenhuma vaga aberta no momento.</div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Vaga *</label>
                <select value={vagaSel} onChange={e => setVagaSel(e.target.value)} style={{ width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: 13, padding: "9px 12px", outline: "none" }}>
                  <option value="">— Selecione a vaga —</option>
                  {vagasAbertas.map(v => <option key={v.id} value={v.id}>#{v.id} · {v.cargo} · {v.cidade || ""}</option>)}
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
