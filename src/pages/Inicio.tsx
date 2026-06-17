import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Helpers ────────────────────────────────────────────────────────
function fmtDt(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR");
}

function badgeStatusCls(st: string) {
  const m: Record<string, string> = {
    "Aguardando Aprovação": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "Aguardando Treinamentos": "bg-purple-100 text-purple-700 border-purple-200",
    Aprovada: "bg-green-100 text-green-700 border-green-200",
    Reprovada: "bg-red-100 text-red-700 border-red-200",
    Contratado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return m[st] ?? "bg-blue-100 text-blue-700 border-blue-200";
}

const VAGA_RESET = {
  motivo_vaga: "", nome_substituido: "", contrato: "", cargo: "",
  estado: "", cidade: "", quantidade_vagas: "1", data_inicio_prevista: "",
  escala: "", horario: "", salario: "", insalubridade_recebe: "Não",
  insalubridade_quanto: "", beneficios: "", local_exato: "",
  grau_urgencia: "", alta_rotatividade: "Não", req_obrigatorios: "",
  req_desejaveis: "", exp_minima: "Não", exp_minima_qual: "",
  motivos_saida: "", recomendacao: "", observacao_importante: "",
};

const QA = [
  { to: "/app/editais",               icon: "📋", label: "Licitações" },
  { to: "/app/contratos/ativos",      icon: "📄", label: "Contratos" },
  { to: "/app/controladoria",         icon: "📊", label: "Controladoria" },
  { to: "/app/financeiro/contas-pagar", icon: "💰", label: "Financeiro" },
  { to: "/app/rh/colaboradores",      icon: "👥", label: "RH" },
  { to: "/app/suprimentos/requisicoes", icon: "🛒", label: "Suprimentos" },
  { to: "/app/bi",                    icon: "📈", label: "BI" },
  { to: "/app/rh/recrutamento",       icon: "🎯", label: "Recrutamento" },
  { to: "/app/meu-perfil",            icon: "👤", label: "Meu Perfil" },
];

export default function Inicio() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");

  // ── Wizard nova vaga ──────────────────────────────────────────────
  const [modalVaga, setModalVaga] = useState(false);
  const [vagaStep, setVagaStep] = useState(1);
  const [vaga, setVaga] = useState({ ...VAGA_RESET });
  const [contratos, setContratos] = useState<string[]>([]);
  const [contratosFull, setContratosFull] = useState<any[]>([]);
  const [empregados, setEmpregados] = useState<any[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [showEmpDrop, setShowEmpDrop] = useState(false);
  const [loadingEmps, setLoadingEmps] = useState(false);

  // ── Minhas solicitações de vaga ───────────────────────────────────
  const [minhasSols, setMinhasSols] = useState<any[]>([]);
  const [loadingSols, setLoadingSols] = useState(false);

  // ── Toasts ───────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((msg: string, type = "info") => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  // ── Carregar nome ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("display_name, email").eq("id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name || data?.email || user.email || ""));
  }, [user?.id]);

  // ── Carregar minhas solicitações ──────────────────────────────────
  const carregarMinhasSols = useCallback(async () => {
    if (!user?.email) return;
    setLoadingSols(true);
    const { data } = await (supabase as any)
      .from("SISTEMA_RECRUTAMENTO")
      .select("id, cargo, contrato, cidade, status, created_at")
      .eq("solicitante_cpf", user.email)
      .order("created_at", { ascending: false })
      .limit(8);
    setLoadingSols(false);
    if (data) setMinhasSols(data);
  }, [user?.email]);

  useEffect(() => { carregarMinhasSols(); }, [carregarMinhasSols]);

  // ── Contratos ─────────────────────────────────────────────────────
  const carregarContratos = async () => {
    const { data } = await (supabase as any)
      .from("CONTRATOS")
      .select('"NOME CONTRATO", Filial')
      .eq("ATIVO", "SIM")
      .order('"NOME CONTRATO"');
    if (data) {
      setContratosFull(data);
      setContratos(data.map((c: any) => c["NOME CONTRATO"] ?? "").filter(Boolean));
    }
  };

  // ── Empregados ────────────────────────────────────────────────────
  const carregarEmpregados = async () => {
    if (empregados.length || loadingEmps) return;
    setLoadingEmps(true);
    const { data, error } = await (supabase as any)
      .from("EMPREGADOS")
      .select('"Nome", "Filial", "Nome Filial", "Título do Cargo", "Valor Salário", "% Insalubridade"')
      .eq("Situação", "Trabalhando")
      .order('"Nome"');
    setLoadingEmps(false);
    if (error) console.error("[EMPREGADOS] erro:", error.message, error.code);
    if (data?.length) setEmpregados(data);
  };

  const selecionarEmpregado = (emp: any) => {
    const contratoMatch = contratosFull.find((c: any) => c.Filial === emp.Filial);
    const insal = parseFloat(String(emp["% Insalubridade"] ?? "0").replace(",", ".")) || 0;
    setVaga(v => ({
      ...v,
      nome_substituido: emp.Nome,
      cargo: emp["Título do Cargo"] ?? "",
      salario: emp["Valor Salário"] ? `R$ ${String(emp["Valor Salário"]).replace(".", ",")}` : "",
      insalubridade_recebe: insal > 0 ? "Sim" : "Não",
      insalubridade_quanto: insal > 0 ? `${emp["% Insalubridade"]}%` : "",
      contrato: contratoMatch ? contratoMatch["NOME CONTRATO"] : v.contrato,
    }));
    setEmpSearch(emp.Nome);
    setShowEmpDrop(false);
  };

  // ── Abrir/fechar modal ────────────────────────────────────────────
  const abrirModalVaga = () => {
    setModalVaga(true);
    setVagaStep(1);
    setEmpSearch("");
    setShowEmpDrop(false);
    setVaga({ ...VAGA_RESET });
    if (!contratos.length) carregarContratos();
  };

  // ── Validar ───────────────────────────────────────────────────────
  const vagaValidar = (step: number) => {
    if (step === 1) {
      if (!vaga.motivo_vaga) { toast("Selecione o motivo da vaga.", "err"); return false; }
      if (!vaga.contrato)    { toast("Selecione o contrato.", "err"); return false; }
      if (!vaga.cargo.trim()) { toast("Informe o cargo.", "err"); return false; }
    }
    if (step === 3) {
      if (!vaga.req_obrigatorios.trim()) { toast("Informe os requisitos obrigatórios.", "err"); return false; }
    }
    return true;
  };

  // ── Submeter vaga ─────────────────────────────────────────────────
  const submitVaga = async () => {
    if (!vagaValidar(3)) return;
    const payload = {
      ...vaga,
      quantidade_vagas: parseInt(vaga.quantidade_vagas) || 1,
      status: "Aguardando Aprovação",
      solicitante_nome: user?.user_metadata?.nome ?? user?.email ?? "",
      solicitante_cpf: user?.email ?? "",
    };
    const { error, data } = await (supabase as any)
      .from("SISTEMA_RECRUTAMENTO").insert(payload).select("id").single();
    if (error) { toast("Erro ao solicitar vaga: " + error.message, "err"); return; }
    toast(`Solicitação #${data?.id} criada com sucesso!`, "ok");
    setModalVaga(false);
    setVaga({ ...VAGA_RESET });
    setVagaStep(1);
    setEmpSearch("");
    setShowEmpDrop(false);
    carregarMinhasSols();
  };

  const firstName = displayName.split(" ")[0] || "bem-vindo";

  // ── Estilos injetados ─────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "inicio-styles";
    style.textContent = `
      .ini-hero{background:linear-gradient(135deg,#0f3171 0%,#1e4a8a 55%,#2d5fa3 100%);border-radius:20px;padding:40px 48px;display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(15,49,113,.25);}
      .ini-hero::before{content:'';position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(249,115,22,.15) 0%,transparent 70%);pointer-events:none;}
      .ini-hero::after{content:'';position:absolute;bottom:-80px;left:30%;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 70%);pointer-events:none;}
      .ini-hero-title{font-size:2.1rem;font-weight:800;color:#fff;line-height:1.15;letter-spacing:-.02em;}
      .ini-hero-title span{color:#fbbf24;}
      .ini-hero-verse{font-size:.9rem;color:rgba(255,255,255,.72);margin-top:8px;font-style:italic;line-height:1.6;}
      .ini-hero-verse strong{color:rgba(255,255,255,.9);font-style:normal;}
      .ini-hero-badge{flex-shrink:0;text-align:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:18px 22px;backdrop-filter:blur(8px);}
      .ini-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 8px 24px rgba(15,23,42,.06);overflow:hidden;margin-bottom:20px;}
      .ini-card-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #e2e8f0;}
      .ini-card-hd h3{font-size:.94rem;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:7px;}
      .ini-card-body{padding:16px 20px;}
      .ini-qa{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;}
      .ini-qa-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:14px 10px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;text-decoration:none;color:#0f172a;transition:all .15s;text-align:center;box-shadow:0 1px 4px rgba(15,23,42,.04);}
      .ini-qa-btn:hover{border-color:#0f3171;background:#eef4ff;color:#0f3171;transform:translateY(-2px);box-shadow:0 6px 16px rgba(15,49,113,.1);}
      .ini-qa-btn .icon{font-size:1.3rem;}
      .ini-qa-btn span{font-size:.72rem;font-weight:600;line-height:1.2;}
      .ini-sol-create{display:flex;flex-direction:column;align-items:center;gap:7px;padding:14px 10px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;transition:all .15s;text-align:center;box-shadow:0 1px 4px rgba(15,23,42,.04);font-family:inherit;}
      .ini-sol-create:hover{border-color:#0f3171;background:#eef4ff;transform:translateY(-2px);box-shadow:0 6px 16px rgba(15,49,113,.1);}
      .ini-sol-create .icon{font-size:1.3rem;}
      .ini-sol-create span{font-size:.75rem;font-weight:600;color:#0f172a;line-height:1.2;}
      .ini-sol-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;}
      .ini-sol-item:last-child{border-bottom:none;}
      .ini-sol-icon{width:34px;height:34px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:15px;background:rgba(8,145,178,.1);}
      .ini-sol-info{flex:1;min-width:0;}
      .ini-sol-title{font-size:.85rem;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .ini-sol-meta{font-size:.72rem;color:#94a3b8;margin-top:2px;}
      .ini-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;border:1px solid transparent;}
      .ini-modal-ov{position:fixed;inset:0;z-index:700;background:rgba(15,23,42,.42);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;}
      .ini-modal{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;width:100%;max-width:600px;max-height:92vh;overflow-y:auto;position:relative;box-shadow:0 16px 40px rgba(15,23,42,.12);}
      .ini-fi{width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;color:#0f172a;font-size:13px;padding:8px 12px;outline:none;font-family:inherit;transition:.15s;}
      .ini-fi:focus{border-color:#0f3171;box-shadow:0 0 0 4px rgba(15,49,113,.08);}
      .ini-fg{margin-bottom:14px;}
      .ini-fg label{display:block;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;}
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("inicio-styles")?.remove(); };
  }, []);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 40px", background: "#f5f7fb" }}>

      {/* ── Hero ── */}
      <div className="ini-hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="ini-hero-title">
            Olá, <span>{firstName}</span>!<br />
            Consagre o seu trabalho.
          </div>
          <p className="ini-hero-verse">
            Consagre ao Senhor tudo o que você faz, e os seus planos serão bem-sucedidos.<br />
            <strong>(Provérbios 16:3)</strong>
          </p>
        </div>
        <div className="ini-hero-badge" style={{ position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", color: "rgba(255,255,255,.55)" }}>Versículo do dia</p>
          <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fbbf24", marginTop: 4 }}>Prov. 16:3</p>
        </div>
      </div>

      {/* ── Acesso Rápido ── */}
      <div className="ini-card">
        <div className="ini-card-hd">
          <h3>⚡ Acesso Rápido</h3>
        </div>
        <div className="ini-card-body">
          <div className="ini-qa">
            {QA.map(q => (
              <Link key={q.to} to={q.to} className="ini-qa-btn">
                <span className="icon">{q.icon}</span>
                <span>{q.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Minhas Solicitações ── */}
      <div className="ini-card">
        <div className="ini-card-hd">
          <h3>📤 Minhas Solicitações</h3>
          <Link to="/app/rh/recrutamento" style={{ fontSize: ".78rem", fontWeight: 600, color: "#0f3171", textDecoration: "none" }}>
            Ver todas →
          </Link>
        </div>
        <div className="ini-card-body">
          {/* Botões de criação */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10, marginBottom: 18 }}>
            <button onClick={abrirModalVaga} className="ini-sol-create">
              <span className="icon">🎯</span>
              <span>Solicitar Vaga</span>
            </button>
            <button className="ini-sol-create" style={{ opacity: .5, cursor: "not-allowed" }} disabled title="Disponível no sistema legado">
              <span className="icon">📅</span>
              <span>Solicitar Férias</span>
            </button>
            <button className="ini-sol-create" style={{ opacity: .5, cursor: "not-allowed" }} disabled title="Disponível no sistema legado">
              <span className="icon">⚠️</span>
              <span>Advertência</span>
            </button>
            <button className="ini-sol-create" style={{ opacity: .5, cursor: "not-allowed" }} disabled title="Disponível no sistema legado">
              <span className="icon">🚪</span>
              <span>Solicitar Demissão</span>
            </button>
          </div>

          <div style={{ borderTop: "1px solid #f1f5f9", marginBottom: 14 }} />

          {/* Lista de solicitações recentes */}
          {loadingSols ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Carregando...</div>
          ) : minhasSols.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              Nenhuma solicitação de vaga pendente.
            </div>
          ) : (
            <div>
              {minhasSols.map(s => (
                <div key={s.id} className="ini-sol-item">
                  <div className="ini-sol-icon">🎯</div>
                  <div className="ini-sol-info">
                    <div className="ini-sol-title">{s.cargo || "Vaga"}{s.contrato ? ` — ${s.contrato}` : ""}</div>
                    <div className="ini-sol-meta">#{s.id} · {s.cidade || ""} · {fmtDt(s.created_at)}</div>
                  </div>
                  <span className={`ini-badge ${badgeStatusCls(s.status)}`}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Nova Vaga (Wizard 3 etapas) ── */}
      {modalVaga && (
        <div className="ini-modal-ov">
          <div className="ini-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModalVaga(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Solicitar Nova Vaga</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
              {vagaStep === 1 ? "Etapa 1 de 3 — Identificação da Vaga" : vagaStep === 2 ? "Etapa 2 de 3 — Detalhes do Posto" : "Etapa 3 de 3 — Requisitos e Urgência"}
            </div>

            {/* Progress */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < vagaStep ? "#16a34a" : i === vagaStep ? "#0f3171" : "#dbe4f0", transition: "background .2s" }} />
              ))}
            </div>

            {/* Step 1 */}
            {vagaStep === 1 && (<>
              <div className="ini-fg">
                <label>Motivo da Vaga *</label>
                <select className="ini-fi" value={vaga.motivo_vaga} onChange={e => setVaga(v => ({ ...v, motivo_vaga: e.target.value }))}>
                  <option value="">— Selecione —</option>
                  {["Admissão", "Substituição", "Expansão", "Transferência", "Retorno"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              {vaga.motivo_vaga === "Substituição" && (
                <div className="ini-fg" style={{ position: "relative" }}
                  onBlur={() => setTimeout(() => setShowEmpDrop(false), 150)}>
                  <label>Colaborador a Substituir</label>
                  <input className="ini-fi" placeholder="Digite o nome do colaborador..." value={empSearch} autoComplete="off"
                    onChange={e => {
                      const v = e.target.value;
                      setEmpSearch(v);
                      setVaga(prev => ({ ...prev, nome_substituido: v }));
                      if (v.length >= 2) { setShowEmpDrop(true); carregarEmpregados(); }
                      else setShowEmpDrop(false);
                    }} />
                  {showEmpDrop && empSearch.length >= 2 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,.14)", maxHeight: 220, overflowY: "auto", marginTop: 2 }}>
                      {loadingEmps ? (
                        <div style={{ padding: "12px", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>Buscando...</div>
                      ) : (() => {
                        const filtrados = empregados.filter(e => e.Nome?.toLowerCase().includes(empSearch.toLowerCase())).slice(0, 40);
                        return filtrados.length === 0
                          ? <div style={{ padding: "12px", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>Nenhum colaborador encontrado.</div>
                          : filtrados.map((emp, i) => (
                            <div key={i} onMouseDown={() => selecionarEmpregado(emp)}
                              style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #f1f5f9", color: "#0f172a" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#f0f4ff")}
                              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                              <div style={{ fontWeight: 600 }}>{emp.Nome}</div>
                              <div style={{ fontSize: 11, color: "#94a3b8" }}>{emp["Título do Cargo"]}{emp["Nome Filial"] ? ` · ${emp["Nome Filial"]}` : ""}</div>
                            </div>
                          ));
                      })()}
                    </div>
                  )}
                </div>
              )}
              <div className="ini-fg">
                <label>Contrato *</label>
                <select className="ini-fi" value={vaga.contrato} onChange={e => setVaga(v => ({ ...v, contrato: e.target.value }))}>
                  <option value="">— Selecione —</option>
                  {contratos.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="ini-fg">
                <label>Cargo *</label>
                <input className="ini-fi" placeholder="Ex: Auxiliar de Limpeza, Vigilante..." value={vaga.cargo} onChange={e => setVaga(v => ({ ...v, cargo: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="ini-fg"><label>Estado (UF)</label><input className="ini-fi" placeholder="SP, RJ, MG..." maxLength={2} value={vaga.estado} onChange={e => setVaga(v => ({ ...v, estado: e.target.value.toUpperCase() }))} /></div>
                <div className="ini-fg"><label>Cidade</label><input className="ini-fi" placeholder="Nome da cidade..." value={vaga.cidade} onChange={e => setVaga(v => ({ ...v, cidade: e.target.value }))} /></div>
              </div>
            </>)}

            {/* Step 2 */}
            {vagaStep === 2 && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="ini-fg"><label>Quantidade de Vagas</label><input className="ini-fi" type="number" min={1} max={99} value={vaga.quantidade_vagas} onChange={e => setVaga(v => ({ ...v, quantidade_vagas: e.target.value }))} /></div>
                <div className="ini-fg"><label>Data de Início Prevista</label><input className="ini-fi" type="date" value={vaga.data_inicio_prevista} onChange={e => setVaga(v => ({ ...v, data_inicio_prevista: e.target.value }))} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="ini-fg"><label>Escala</label><input className="ini-fi" placeholder="Ex: 12x36, 5x2..." value={vaga.escala} onChange={e => setVaga(v => ({ ...v, escala: e.target.value }))} /></div>
                <div className="ini-fg"><label>Horário</label><input className="ini-fi" placeholder="Ex: 07h às 19h..." value={vaga.horario} onChange={e => setVaga(v => ({ ...v, horario: e.target.value }))} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="ini-fg"><label>Salário</label><input className="ini-fi" placeholder="Ex: R$ 1.412,00" value={vaga.salario} onChange={e => setVaga(v => ({ ...v, salario: e.target.value }))} /></div>
                <div className="ini-fg">
                  <label>Insalubridade</label>
                  <select className="ini-fi" value={vaga.insalubridade_recebe} onChange={e => setVaga(v => ({ ...v, insalubridade_recebe: e.target.value }))}>
                    <option>Não</option><option>Sim</option>
                  </select>
                </div>
              </div>
              {vaga.insalubridade_recebe === "Sim" && (
                <div className="ini-fg"><label>Percentual de Insalubridade</label><input className="ini-fi" placeholder="Ex: 20%, 40%" value={vaga.insalubridade_quanto} onChange={e => setVaga(v => ({ ...v, insalubridade_quanto: e.target.value }))} /></div>
              )}
              <div className="ini-fg"><label>Benefícios</label><textarea className="ini-fi" rows={2} placeholder="VT, VR, Plano de Saúde..." value={vaga.beneficios} onChange={e => setVaga(v => ({ ...v, beneficios: e.target.value }))} /></div>
              <div className="ini-fg"><label>Local Exato / Posto</label><input className="ini-fi" placeholder="Nome do posto ou endereço..." value={vaga.local_exato} onChange={e => setVaga(v => ({ ...v, local_exato: e.target.value }))} /></div>
            </>)}

            {/* Step 3 */}
            {vagaStep === 3 && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="ini-fg">
                  <label>Grau de Urgência</label>
                  <select className="ini-fi" value={vaga.grau_urgencia} onChange={e => setVaga(v => ({ ...v, grau_urgencia: e.target.value }))}>
                    <option value="">— Selecione —</option>
                    {["Baixa", "Média", "Alta — Urgente"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="ini-fg">
                  <label>Alta Rotatividade?</label>
                  <select className="ini-fi" value={vaga.alta_rotatividade} onChange={e => setVaga(v => ({ ...v, alta_rotatividade: e.target.value }))}>
                    <option>Não</option><option>Sim</option>
                  </select>
                </div>
              </div>
              <div className="ini-fg"><label>Requisitos Obrigatórios *</label><textarea className="ini-fi" rows={3} placeholder="Experiência comprovada, CNH B..." value={vaga.req_obrigatorios} onChange={e => setVaga(v => ({ ...v, req_obrigatorios: e.target.value }))} /></div>
              <div className="ini-fg"><label>Requisitos Desejáveis</label><textarea className="ini-fi" rows={2} placeholder="Inglês básico, curso técnico..." value={vaga.req_desejaveis} onChange={e => setVaga(v => ({ ...v, req_desejaveis: e.target.value }))} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="ini-fg">
                  <label>Experiência Mínima?</label>
                  <select className="ini-fi" value={vaga.exp_minima} onChange={e => setVaga(v => ({ ...v, exp_minima: e.target.value }))}>
                    <option>Não</option><option>Sim</option>
                  </select>
                </div>
                {vaga.exp_minima === "Sim" && (
                  <div className="ini-fg"><label>Qual experiência?</label><input className="ini-fi" placeholder="Ex: 6 meses em limpeza" value={vaga.exp_minima_qual} onChange={e => setVaga(v => ({ ...v, exp_minima_qual: e.target.value }))} /></div>
                )}
              </div>
              <div className="ini-fg"><label>Observação Importante</label><textarea className="ini-fi" rows={2} placeholder="Opcional..." value={vaga.observacao_importante} onChange={e => setVaga(v => ({ ...v, observacao_importante: e.target.value }))} /></div>
            </>)}

            {/* Navegação */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
              <div />
              <div style={{ display: "flex", gap: 8 }}>
                {vagaStep > 1 && (
                  <button onClick={() => setVagaStep(s => s - 1)} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← Anterior</button>
                )}
                {vagaStep < 3 && (
                  <button onClick={() => { if (vagaValidar(vagaStep)) setVagaStep(s => s + 1); }} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#0f3171", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Próximo →</button>
                )}
                {vagaStep === 3 && (
                  <button onClick={submitVaga} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ Solicitar Vaga</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            display: "inline-block", padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, boxShadow: "0 16px 40px rgba(15,23,42,.1)",
            background: t.type === "ok" ? "#ecfdf3" : t.type === "err" ? "#fef2f2" : "#eff6ff",
            color: t.type === "ok" ? "#15803d" : t.type === "err" ? "#b91c1c" : "#1d4ed8",
            border: `1px solid ${t.type === "ok" ? "#86efac" : t.type === "err" ? "#fecaca" : "#bfdbfe"}`,
          }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
