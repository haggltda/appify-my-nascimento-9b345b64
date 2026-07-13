import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useVinculoEmpregado } from "@/hooks/useVinculoEmpregado";

// =====================================================================
// NASCIMENTO FORMULÁRIOS — página PÚBLICA de resposta (/formularios/:slug)
// Sem login. A RLS só entrega formulário PUBLICADO; janela de vigência e
// limite de respostas são validados aqui (UX) e reforçados na policy do
// INSERT (autoridade final — fora da regra o insert é rejeitado).
// =====================================================================

interface Form {
  id: string; titulo: string; descricao?: string | null; slug: string;
  status: string; inicia_em?: string | null; encerra_em?: string | null;
  coleta_identificacao: boolean; imagem_capa_url?: string | null;
  pergunta_setor_id?: string | null; setores_acesso?: string[] | null;
}
interface Perg {
  id: string; tipo: string; titulo: string; descricao?: string | null;
  obrigatoria: boolean; imagem_url?: string | null; opcoes: string[]; config: Record<string, any>;
}

const fmtDt = (s?: string | null) => { if (!s) return ""; const d = new Date(s); return isNaN(+d) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px", boxShadow: "0 8px 24px rgba(15,23,42,.06)" };
const inp: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 9, padding: "9px 11px", fontSize: 14, outline: "none", fontFamily: "inherit", width: "100%", background: "#fff" };

function Aviso({ emoji, titulo, texto }: { emoji: string; titulo: string; texto: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...card, maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>{emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginTop: 8 }}>{titulo}</div>
        <div style={{ fontSize: 13.5, color: "#64748b", marginTop: 6 }}>{texto}</div>
      </div>
    </div>
  );
}

// Pergunta "colaborador": busca um empregado no cadastro (EMPREGADOS) e o valor
// da resposta é o nome escolhido.
function ColaboradorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<{ id: number; nome: string; setor?: string; cargo?: string }[]>([]);
  const [aberto, setAberto] = useState(false);
  const buscar = async (q: string) => {
    setBusca(q); setAberto(true);
    if (q.trim().length < 2) { setResultados([]); return; }
    const { data } = await (supabase as any).from("EMPREGADOS")
      .select('"ID","Nome","Setor_ERP","Título do Cargo"').ilike("Nome", `%${q.trim()}%`).limit(12);
    setResultados((data ?? []).map((r: any) => ({ id: r["ID"], nome: r["Nome"] ?? "", setor: r["Setor_ERP"], cargo: r["Título do Cargo"] })));
  };
  return (
    <div style={{ position: "relative", maxWidth: 420 }}>
      <input value={aberto ? busca : (value || "")} onChange={e => buscar(e.target.value)} onFocus={() => { setAberto(true); setBusca(value || ""); }}
        placeholder="Buscar colaborador pelo nome…" style={inp} />
      {aberto && resultados.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, marginTop: 4, boxShadow: "0 12px 28px rgba(15,23,42,.14)", zIndex: 20, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
          {resultados.map(r => (
            <div key={r.id} onClick={() => { onChange(r.nome); setAberto(false); setResultados([]); }} style={{ padding: "8px 11px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{r.nome}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{[r.setor, r.cargo].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FormularioPublico() {
  const { slug } = useParams();
  const { empregado, loading: vinculoLoading } = useVinculoEmpregado();  // cadastro do respondente logado (null se anônimo)
  const abertoEm = useRef(Date.now());  // p/ tempo de conclusão
  const [form, setForm] = useState<Form | null>(null);
  const [pergs, setPergs] = useState<Perg[]>([]);
  const [loading, setLoading] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [valores, setValores] = useState<Record<string, any>>({});
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // "Outro": quando o respondente escolhe Outro, descreve num texto livre.
  const [outroOn, setOutroOn] = useState<Record<string, boolean>>({});
  const [outroTxt, setOutroTxt] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: f } = await (supabase as any).from("CS_FORMULARIOS").select("*").eq("slug", slug).maybeSingle();
    if (!f) { setLoading(false); setNaoEncontrado(true); return; }
    setForm(f);
    setPergs((Array.isArray(f.perguntas) ? f.perguntas : []).map((p: any) => ({ ...p, opcoes: Array.isArray(p.opcoes) ? p.opcoes : [], config: p.config ?? {} })));
    setLoading(false);
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  if (loading || vinculoLoading) return <Aviso emoji="⏳" titulo="Carregando..." texto="Um instante." />;
  if (naoEncontrado || !form) return <Aviso emoji="🔍" titulo="Formulário não encontrado" texto="O link pode estar errado ou o formulário não está mais disponível." />;

  const now = Date.now();
  if (form.inicia_em && now < +new Date(form.inicia_em))
    return <Aviso emoji="🗓" titulo="Ainda não abriu" texto={`Este formulário abre em ${fmtDt(form.inicia_em)}. Volte depois!`} />;
  if (form.encerra_em && now > +new Date(form.encerra_em))
    return <Aviso emoji="⛔" titulo="Formulário encerrado" texto={`O prazo para responder terminou em ${fmtDt(form.encerra_em)}.`} />;
  // Acesso por setor: se restrito, só quem é dos setores liberados responde.
  const acesso = form.setores_acesso ?? [];
  if (acesso.length > 0) {
    if (!empregado) return <Aviso emoji="🔒" titulo="Formulário restrito" texto="Este formulário é restrito a setores específicos. Entre com seu usuário do ERP para responder." />;
    if (!acesso.includes(empregado.setor)) return <Aviso emoji="🔒" titulo="Sem acesso" texto={`Este formulário é só para os setores: ${acesso.join(", ")}. O seu (${empregado.setor || "—"}) não está liberado.`} />;
  }
  if (enviado)
    return <Aviso emoji="✅" titulo="Resposta enviada!" texto="Obrigado por responder. Você já pode fechar esta página." />;

  const setVal = (pid: string, v: any) => { setValores(x => ({ ...x, [pid]: v })); setErro(""); };

  // Perguntas visíveis ao respondente: uma pergunta pode ser limitada a setores
  // (config.setores). Sem cadastro (anônimo), perguntas restritas ficam ocultas.
  const perguntaVisivel = (p: Perg) => {
    const s: string[] = Array.isArray(p.config?.setores) ? p.config.setores : [];
    return s.length === 0 || (!!empregado && s.includes(empregado.setor));
  };
  const pergsVisiveis = pergs.filter(perguntaVisivel);

  const enviar = async () => {
    for (const p of pergsVisiveis) {
      if (!p.obrigatoria) continue;
      const v = valores[p.id];
      const vazio = v == null || v === "" || (Array.isArray(v) && v.length === 0);
      if (vazio) { setErro(`Responda a pergunta obrigatória: "${p.titulo}"`); document.getElementById(`perg-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    }
    if (form.coleta_identificacao && !empregado && !nome.trim()) { setErro("Informe seu nome."); return; }
    setEnviando(true);
    // Cadastro do respondente (logado): puxa nome/setor/cargo/... do EMPREGADOS
    // e anexa como snapshot — o botão "Detalhes" na tela de respostas mostra tudo.
    const cadastro = empregado ? {
      id: empregado.id, nome: empregado.nome, cpf: empregado.cpf, cargo: empregado.cargo,
      setor: empregado.setor, perfil: empregado.perfil, lider: empregado.lider,
      situacao: empregado.situacao, admissao: empregado.admissao,
      empresa: empregado.empresa, filial: empregado.filial, email: empregado.email,
    } : null;
    // Setor (p/ Administrativo × Operacional): cadastro tem prioridade; senão o
    // valor da pergunta de setor indicada no formulário.
    const setorRaw = form.pergunta_setor_id ? valores[form.pergunta_setor_id] : null;
    const setorPergunta = Array.isArray(setorRaw) ? (setorRaw[0] ? String(setorRaw[0]).trim() : null) : (setorRaw != null && setorRaw !== "" ? String(setorRaw).trim() : null);
    const setor = (cadastro?.setor?.trim() || setorPergunta) || null;
    const nomeResp = cadastro?.nome?.trim() || (form.coleta_identificacao ? nome.trim() : "") || null;
    const emailResp = cadastro?.email?.trim() || (form.coleta_identificacao ? email.trim() : "") || null;
    // criado_por é preenchido pelo default (auth.uid()) quando logado; anônimo sem dono.
    const duracao_seg = Math.max(0, Math.round((Date.now() - abertoEm.current) / 1000));  // tempo de conclusão
    const base = { formulario_id: form.id, respondente_nome: nomeResp, respondente_email: emailResp, itens: valores };
    let { error } = await (supabase as any).from("CS_FORM_RESPOSTAS").insert({ ...base, setor, respondente_cadastro: cadastro, duracao_seg });
    // Banco ainda sem as colunas novas (setor/cadastro/duração): reenvia só o básico.
    if (error && /column|schema cache/i.test(error.message)) ({ error } = await (supabase as any).from("CS_FORM_RESPOSTAS").insert(base));
    setEnviando(false);
    if (error) {
      setErro(/row-level security/i.test(error.message)
        ? "Este formulário não está mais aceitando respostas (prazo ou limite atingido)."
        : "Erro ao enviar: " + error.message);
      return;
    }
    setEnviado(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", padding: "28px 16px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Capa e cabeçalho */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {form.imagem_capa_url && <img src={form.imagem_capa_url} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} />}
          <div style={{ height: 5, background: "#0f3171" }} />
          <div style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{form.titulo}</div>
            {form.descricao && <div style={{ fontSize: 14, color: "#475569", marginTop: 6, whiteSpace: "pre-wrap" }}>{form.descricao}</div>}
            {form.encerra_em && <div style={{ fontSize: 12, color: "#a16207", marginTop: 8 }}>🗓 Aberto até {fmtDt(form.encerra_em)}</div>}
          </div>
        </div>

        {/* Identificação — cadastro puxado automaticamente quando logado */}
        {empregado ? (
          <div style={{ ...card, borderLeft: "4px solid #0f3171" }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f3171" }}>👤 Respondendo como {empregado.nome}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {[["Setor", empregado.setor], ["Cargo", empregado.cargo], ["Filial", empregado.filial]].map(([k, v]) => v ? (
                <span key={k} style={{ fontSize: 12, background: "#f1f5f9", borderRadius: 8, padding: "4px 10px", color: "#334155" }}>
                  <b style={{ color: "#94a3b8", fontWeight: 700 }}>{k}:</b> {v}
                </span>
              ) : null)}
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8 }}>Seus dados de cadastro são anexados automaticamente à resposta — não precisa preencher de novo.</div>
          </div>
        ) : form.coleta_identificacao ? (
          <div style={card}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Sua identificação <span style={{ color: "#dc2626" }}>*</span></div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input placeholder="Nome completo *" value={nome} onChange={e => setNome(e.target.value)} style={{ ...inp, flex: 1, minWidth: 200 }} />
              <input placeholder="E-mail (opcional)" type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inp, flex: 1, minWidth: 200 }} />
            </div>
          </div>
        ) : null}

        {/* Perguntas (só as visíveis para o setor do respondente) */}
        {pergsVisiveis.map((p, i) => (
          <div key={p.id} id={`perg-${p.id}`} style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
              {i + 1}. {p.titulo} {p.obrigatoria && <span style={{ color: "#dc2626" }}>*</span>}
            </div>
            {p.descricao && <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 3 }}>{p.descricao}</div>}
            {p.imagem_url && <img src={p.imagem_url} alt="" style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 10, marginTop: 10, border: "1px solid #f1f5f9" }} />}
            <div style={{ marginTop: 12 }}>
              {p.tipo === "texto_curto" && <input value={valores[p.id] ?? ""} onChange={e => setVal(p.id, e.target.value)} style={inp} placeholder="Sua resposta" />}
              {p.tipo === "texto_longo" && <textarea value={valores[p.id] ?? ""} onChange={e => setVal(p.id, e.target.value)} rows={4} style={{ ...inp, resize: "vertical" }} placeholder="Sua resposta" />}
              {p.tipo === "colaborador" && <ColaboradorSelect value={valores[p.id] ?? ""} onChange={v => setVal(p.id, v)} />}
              {p.tipo === "numero" && <input type="number" value={valores[p.id] ?? ""} onChange={e => setVal(p.id, e.target.value === "" ? "" : Number(e.target.value))} style={{ ...inp, maxWidth: 220 }} placeholder="0" />}
              {p.tipo === "data" && <input type="date" value={valores[p.id] ?? ""} onChange={e => setVal(p.id, e.target.value)} style={{ ...inp, maxWidth: 220 }} />}
              {p.tipo === "lista_suspensa" && (() => {
                const on = !!outroOn[p.id];
                return (
                  <div>
                    <select value={on ? "__outro__" : (valores[p.id] ?? "")}
                      onChange={e => { const v = e.target.value; if (v === "__outro__") { setOutroOn(x => ({ ...x, [p.id]: true })); setVal(p.id, outroTxt[p.id] ?? ""); } else { setOutroOn(x => ({ ...x, [p.id]: false })); setVal(p.id, v); } }}
                      style={{ ...inp, maxWidth: 380 }}>
                      <option value="">Selecione...</option>
                      {p.opcoes.map((o, oi) => <option key={oi} value={o}>{o}</option>)}
                      {p.config.outro && <option value="__outro__">Outro…</option>}
                    </select>
                    {on && <input value={outroTxt[p.id] ?? ""} onChange={e => { const t = e.target.value; setOutroTxt(x => ({ ...x, [p.id]: t })); setVal(p.id, t); }} placeholder="Descreva…" style={{ ...inp, maxWidth: 380, marginTop: 8 }} />}
                  </div>
                );
              })()}
              {p.tipo === "multipla_escolha" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.opcoes.map((o, oi) => (
                    <label key={oi} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "#0f172a", cursor: "pointer" }}>
                      <input type="radio" name={p.id} checked={!outroOn[p.id] && valores[p.id] === o} onChange={() => { setOutroOn(x => ({ ...x, [p.id]: false })); setVal(p.id, o); }} style={{ width: 16, height: 16 }} />
                      {o}
                    </label>
                  ))}
                  {p.config.outro && (
                    <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "#0f172a", cursor: "pointer", flexWrap: "wrap" }}>
                      <input type="radio" name={p.id} checked={!!outroOn[p.id]} onChange={() => { setOutroOn(x => ({ ...x, [p.id]: true })); setVal(p.id, outroTxt[p.id] ?? ""); }} style={{ width: 16, height: 16 }} />
                      Outro:
                      <input value={outroTxt[p.id] ?? ""} disabled={!outroOn[p.id]} onChange={e => { const t = e.target.value; setOutroTxt(x => ({ ...x, [p.id]: t })); setVal(p.id, t); }} placeholder="descreva…" style={{ ...inp, flex: 1, minWidth: 180, opacity: outroOn[p.id] ? 1 : .5 }} />
                    </label>
                  )}
                </div>
              )}
              {p.tipo === "caixas_selecao" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(() => {
                    const arr: string[] = Array.isArray(valores[p.id]) ? valores[p.id] : [];
                    const fixedSel = arr.filter(x => p.opcoes.includes(x));
                    const oOn = !!outroOn[p.id];
                    const oTxt = outroTxt[p.id] ?? "";
                    const rebuild = (fixed: string[], on: boolean, txt: string) => setVal(p.id, [...fixed, ...(on && txt.trim() ? [txt.trim()] : [])]);
                    return (
                      <>
                        {p.opcoes.map((o, oi) => (
                          <label key={oi} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "#0f172a", cursor: "pointer" }}>
                            <input type="checkbox" checked={fixedSel.includes(o)} onChange={e => rebuild(e.target.checked ? [...fixedSel, o] : fixedSel.filter(x => x !== o), oOn, oTxt)} style={{ width: 16, height: 16 }} />
                            {o}
                          </label>
                        ))}
                        {p.config.outro && (
                          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "#0f172a", cursor: "pointer", flexWrap: "wrap" }}>
                            <input type="checkbox" checked={oOn} onChange={e => { setOutroOn(x => ({ ...x, [p.id]: e.target.checked })); rebuild(fixedSel, e.target.checked, oTxt); }} style={{ width: 16, height: 16 }} />
                            Outro:
                            <input value={oTxt} disabled={!oOn} onChange={e => { const t = e.target.value; setOutroTxt(x => ({ ...x, [p.id]: t })); rebuild(fixedSel, oOn, t); }} placeholder="descreva…" style={{ ...inp, flex: 1, minWidth: 180, opacity: oOn ? 1 : .5 }} />
                          </label>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              {p.tipo === "escala" && (() => {
                const min = p.config.min ?? 1, max = p.config.max ?? 5;
                const ns: number[] = []; for (let n = min; n <= max; n++) ns.push(n);
                return (
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {ns.map(n => (
                        <button key={n} onClick={() => setVal(p.id, n)}
                          style={{ width: 42, height: 42, borderRadius: 10, border: valores[p.id] === n ? "2px solid #0f3171" : "1px solid #cbd5e1", background: valores[p.id] === n ? "#0f3171" : "#fff", color: valores[p.id] === n ? "#fff" : "#0f172a", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>{n}</button>
                      ))}
                    </div>
                    {(p.config.rotulo_min || p.config.rotulo_max) && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#94a3b8", marginTop: 6, maxWidth: (42 + 8) * ns.length }}>
                        <span>{p.config.rotulo_min ?? ""}</span><span>{p.config.rotulo_max ?? ""}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        ))}

        {erro && <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "11px 15px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>{erro}</div>}

        <button onClick={enviar} disabled={enviando}
          style={{ padding: "13px", borderRadius: 12, border: "none", background: enviando ? "#94a3b8" : "#0f3171", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 24px rgba(15,49,113,.3)" }}>
          {enviando ? "Enviando..." : "Enviar resposta"}
        </button>
        <div style={{ textAlign: "center", fontSize: 11.5, color: "#94a3b8" }}>Nascimento Formulários · Grupo Nascimento</div>
      </div>
    </div>
  );
}
