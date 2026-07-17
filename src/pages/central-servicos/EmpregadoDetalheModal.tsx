import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// =====================================================================
// NASCIMENTO FORMULÁRIOS - Ficha do empregado (a partir de um nome citado
// numa resposta). Puxa os dados AO VIVO da tabela EMPREGADOS (cadastro,
// líder) e cruza TODOS os formulários em que a pessoa participou - como
// respondente ou citada numa resposta (colaborador/líder).
//
// Escreve em dois pontos, ambos por ação explícita do usuário:
//   • CS_FORM_VINCULOS - de-para "nome citado" → empregado, p/ quem o nome
//     da resposta não bate com o cadastro (ex.: falta um sobrenome).
//   • EMPREGADOS.LIDER - define/troca o líder do colaborador.
// =====================================================================

// Normaliza nome p/ casar respostas (texto livre) com o cadastro:
// sem acento, espaços colapsados, maiúsculas.
export const normNome = (s: any) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

// De-para dos apelidos vinculados à mão: nome_norm → nome completo do empregado.
// A tela de Respostas usa p/ saber quais textos viram link de ficha e p/ exibir
// o nome do cadastro no lugar do texto que veio na resposta.
export const carregarVinculos = async (): Promise<Map<string, string>> => {
  try {
    const { data } = await (supabase as any).from("CS_FORM_VINCULOS").select("nome_norm,empregado_nome");
    return new Map((data ?? [])
      .filter((v: any) => v.nome_norm)
      .map((v: any) => [v.nome_norm as string, String(v.empregado_nome ?? "").trim()]));
  } catch { return new Map(); }
};

const parseData = (v: any): Date | null => {
  if (!v) return null;
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const d = br ? new Date(+br[3], +br[2] - 1, +br[1]) : new Date(s);
  // 30/11/1899 é o "vazio" do sistema legado (serial 0) - trata como sem data.
  return isNaN(d.getTime()) || d.getFullYear() < 1900 ? null : d;
};
const fmtData = (v: any) => { const d = parseData(v); return d ? d.toLocaleDateString("pt-BR") : "—"; };
const tempoDeCasa = (v: any): string | null => {
  const d = parseData(v); if (!d) return null;
  let meses = (Date.now() - d.getTime()) / (365.25 / 12 * 864e5);
  if (meses < 0) meses = 0;
  const anos = Math.floor(meses / 12), m = Math.floor(meses % 12);
  const pa = anos ? `${anos} ano${anos > 1 ? "s" : ""}` : "";
  const pm = m ? `${m} ${m > 1 ? "meses" : "mês"}` : "";
  return [pa, pm].filter(Boolean).join(" e ") || "menos de 1 mês";
};
const nomeCargoDe = (e: any): string =>
  String(e?.["Nome do Cargo"] ?? "").trim() || String(e?.["Título do Cargo"] ?? "").trim() || String(e?.["Cargo"] ?? "").trim() || "—";
const val = (v: any) => { const s = v == null ? "" : String(v).trim(); return s || "—"; };
const resumoDe = (e: any) => `${nomeCargoDe(e)}${e?.["Setor_ERP"] ? " · " + e["Setor_ERP"] : ""}`;
// "Trabalhando" e afins = vínculo ativo; o resto (Demitido/Rescisão) é terminal.
const ehAtivo = (e: any) => String(e?.["Situação"] ?? "").trim().toUpperCase().startsWith("TRABALH");

// Busca 1 empregado pelo nome (ilike exato pega diferença de caixa; fallback por trecho).
// Homônimo é comum no cadastro (a mesma pessoa readmitida vira 2+ linhas, uma
// Demitida): entre os candidatos, ATIVO ganha, e depois a admissão mais recente
// — senão a ficha abre no cadastro velho/demitido.
const buscaEmpregado = async (n: string) => {
  let { data } = await (supabase as any).from("EMPREGADOS").select("*").ilike("Nome", n).limit(50);
  if (!data?.length) ({ data } = await (supabase as any).from("EMPREGADOS").select("*").ilike("Nome", "%" + n + "%").limit(50));
  const arr: any[] = data ?? [];
  if (!arr.length) return null;
  const exatos = arr.filter((e) => normNome(e["Nome"]) === normNome(n));
  const pool = exatos.length ? exatos : arr;
  const admissao = (e: any) => { const d = parseData(e?.["Admissão"]); return d ? d.getTime() : 0; };
  return [...pool].sort((a, b) =>
    (ehAtivo(b) ? 1 : 0) - (ehAtivo(a) ? 1 : 0) || admissao(b) - admissao(a))[0] ?? null;
};

interface Participacao {
  formId: string; titulo: string;
  comoRespondente: boolean; perguntas: string[]; total: number;
}

const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "6px 12px", borderRadius: 9, border, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" });
const btnGhost = btn("rgba(15,49,113,.08)", "#0f3171", "1px solid rgba(15,49,113,.2)");
const rotuloSecao: React.CSSProperties =
  { fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", margin: "16px 0 8px" };

function Campo({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "8px 11px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px" }}>{rotulo}</div>
      <div style={{ fontSize: 12.5, color: cor || "#0f172a", fontWeight: 600, marginTop: 2, wordBreak: "break-word" }}>{valor}</div>
    </div>
  );
}

// Busca por nome na EMPREGADOS. Serve p/ vincular um nome solto e p/ escolher
// o líder de um colaborador.
function BuscaEmpregado({ titulo, ajuda, ignorarId, onEscolher, onCancelar }: {
  titulo: string; ajuda: string; ignorarId?: any;
  onEscolher: (e: any) => void; onCancelar: () => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) { setRows([]); setBuscando(false); return; }
    setBuscando(true);
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await (supabase as any).from("EMPREGADOS").select("*")
          .ilike("Nome", `%${termo}%`).order('"Nome"').limit(25);
        if (!cancel) setRows((data ?? []).filter((e: any) => String(e["ID"]) !== String(ignorarId)));
      } catch { if (!cancel) setRows([]); }
      if (!cancel) setBuscando(false);
    }, 300);
    return () => { cancel = true; clearTimeout(t); };
  }, [q, ignorarId]);

  return (
    <div style={{ border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f3171" }}>{titulo}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>{ajuda}</div>
        </div>
        <button onClick={onCancelar} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>Cancelar</button>
      </div>
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Digite parte do nome…"
        style={{ width: "100%", padding: "8px 11px", borderRadius: 9, border: "1px solid #dbeafe", fontSize: 12.5, outline: "none", boxSizing: "border-box" }} />
      <div style={{ marginTop: 8, maxHeight: 230, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
        {q.trim().length < 2 ? (
          <div style={{ fontSize: 11.5, color: "#94a3b8", padding: "6px 2px" }}>Digite ao menos 2 letras.</div>
        ) : buscando ? (
          <div style={{ fontSize: 11.5, color: "#94a3b8", padding: "6px 2px" }}>Buscando…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 11.5, color: "#94a3b8", padding: "6px 2px" }}>Ninguém encontrado com esse trecho de nome.</div>
        ) : rows.map((e: any) => (
          <button key={String(e["ID"])} onClick={() => onEscolher(e)}
            style={{ textAlign: "left", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, padding: "7px 10px", cursor: "pointer" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{e["Nome"]}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {resumoDe(e)} · <span style={{ color: ehAtivo(e) ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{val(e["Situação"])}</span>
              {e["CPF"] ? ` · CPF ${e["CPF"]}` : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EmpregadoDetalheModal({ nome, onClose, onVinculado }: {
  nome: string; onClose: () => void; onVinculado?: () => void;
}) {
  const nav = useNavigate();
  const [alvoNome, setAlvoNome] = useState(nome);           // pessoa exibida (troca ao clicar no líder)
  const [aba, setAba] = useState<"cadastro" | "formularios">("cadastro");
  const [emp, setEmp] = useState<any | null>(null);
  const [lider, setLider] = useState<any | null>(null);
  const [vinculo, setVinculo] = useState<any | null>(null); // de-para manual que resolveu este nome
  const [parts, setParts] = useState<Participacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<null | "vincular" | "lider">(null); // qual busca está aberta
  const [filtro, setFiltro] = useState<string>("todos");   // aba Formulários: "todos" | "respondeu" | <pergunta>

  useEffect(() => { setAlvoNome(nome); setAba("cadastro"); }, [nome]);
  useEffect(() => { setModo(null); setErro(null); setFiltro("todos"); }, [alvoNome]);

  const carregar = useCallback(async (cancelado?: () => boolean) => {
    setLoading(true);
    const alvo = normNome(alvoNome);

    // 1. Vínculo manual tem prioridade sobre o casamento por nome.
    let empRow: any = null, vinc: any = null;
    try {
      const { data } = await (supabase as any).from("CS_FORM_VINCULOS").select("*").eq("nome_norm", alvo).maybeSingle();
      vinc = data ?? null;
    } catch { /* tabela nova ainda não aplicada: degrada p/ busca por nome */ }
    if (vinc?.empregado_id != null) {
      try {
        const { data } = await (supabase as any).from("EMPREGADOS").select("*").eq("ID", vinc.empregado_id).maybeSingle();
        empRow = data ?? null;
      } catch { /* ignore */ }
    }
    if (!empRow) { try { empRow = await buscaEmpregado(alvoNome); } catch { /* RLS/coluna ausente: degrada */ } }

    // 2. Líder dele (coluna LIDER guarda o nome)
    let liderRow: any = null;
    const liderNome = empRow?.["LIDER"];
    if (liderNome && normNome(liderNome) !== normNome(empRow?.["Nome"])) {
      try { liderRow = await buscaEmpregado(String(liderNome)); } catch { /* ignore */ }
    }

    // 3. Nomes que representam esta pessoa: o do cadastro, o texto clicado e
    //    todo apelido vinculado à mão. Sem isso, um formulário que cita
    //    "João Peretti" não entraria na ficha do "João Pedro Peretti".
    const alvos = new Set<string>([alvo]);
    if (empRow?.["Nome"]) alvos.add(normNome(empRow["Nome"]));
    if (empRow?.["ID"] != null) {
      try {
        const { data } = await (supabase as any).from("CS_FORM_VINCULOS").select("nome_norm").eq("empregado_id", empRow["ID"]);
        (data ?? []).forEach((v: any) => v.nome_norm && alvos.add(v.nome_norm));
      } catch { /* ignore */ }
    }

    // 4. Participação em formulários (respondente OU citado numa resposta)
    let participacoes: Participacao[] = [];
    try {
      const [fRes, rRes] = await Promise.all([
        (supabase as any).from("CS_FORMULARIOS").select("id,titulo,perguntas"),
        (supabase as any).from("CS_FORM_RESPOSTAS").select("id,formulario_id,respondente_nome,respondente_cadastro,itens"),
      ]);
      const forms = fRes.data ?? [];
      const titPorId: Record<string, string> = {};
      const pergsPorForm: Record<string, Record<string, string>> = {};
      forms.forEach((f: any) => {
        titPorId[f.id] = f.titulo;
        const m: Record<string, string> = {};
        (Array.isArray(f.perguntas) ? f.perguntas : []).forEach((p: any) => { if (p?.id) m[p.id] = p.titulo; });
        pergsPorForm[f.id] = m;
      });
      const acc: Record<string, Participacao> = {};
      (rRes.data ?? []).forEach((r: any) => {
        const fid = r.formulario_id;
        let hit = false, comoResp = false;
        const perguntas = new Set<string>();
        if (alvos.has(normNome(r.respondente_nome)) || alvos.has(normNome(r.respondente_cadastro?.nome))) { hit = true; comoResp = true; }
        Object.entries(r.itens ?? {}).forEach(([pid, v]) => {
          const arr = Array.isArray(v) ? v : [v];
          if (arr.some(x => alvos.has(normNome(x)))) { hit = true; perguntas.add(pergsPorForm[fid]?.[pid] ?? "Resposta"); }
        });
        if (!hit) return;
        const p = acc[fid] ?? (acc[fid] = { formId: fid, titulo: titPorId[fid] ?? "Formulário", comoRespondente: false, perguntas: [], total: 0 });
        p.total++;
        if (comoResp) p.comoRespondente = true;
        perguntas.forEach(q => { if (!p.perguntas.includes(q)) p.perguntas.push(q); });
      });
      participacoes = Object.values(acc).sort((a, b) => b.total - a.total);
    } catch { /* ignore */ }

    if (cancelado?.()) return;
    setEmp(empRow); setLider(liderRow); setVinculo(vinc); setParts(participacoes); setLoading(false);
  }, [alvoNome]);

  useEffect(() => {
    let cancel = false;
    carregar(() => cancel);
    return () => { cancel = true; };
  }, [carregar]);

  // --- Ações de escrita -------------------------------------------------
  const vincularA = async (escolhido: any) => {
    setSalvando(true); setErro(null);
    const { error } = await (supabase as any).from("CS_FORM_VINCULOS").upsert({
      nome_norm: normNome(alvoNome), nome_texto: alvoNome,
      empregado_id: escolhido["ID"], empregado_nome: escolhido["Nome"],
    }, { onConflict: "nome_norm" });
    setSalvando(false);
    if (error) { setErro(`Não deu p/ vincular: ${error.message}`); return; }
    setModo(null); onVinculado?.(); carregar();
  };

  const desvincular = async () => {
    if (!vinculo || !confirm(`Desfazer o vínculo de "${alvoNome}" com ${vinculo.empregado_nome}?`)) return;
    setSalvando(true); setErro(null);
    const { error } = await (supabase as any).from("CS_FORM_VINCULOS").delete().eq("id", vinculo.id);
    setSalvando(false);
    if (error) { setErro(`Não deu p/ desvincular: ${error.message}`); return; }
    onVinculado?.(); carregar();
  };

  const definirLider = async (escolhido: any) => {
    if (!emp) return;
    setSalvando(true); setErro(null);
    // .select() devolve as linhas afetadas: sem privilégio/RLS o update não
    // levanta erro, só não casa nada — sem isso a tela "não fazia nada".
    const { data, error } = await (supabase as any).from("EMPREGADOS")
      .update({ LIDER: escolhido["Nome"] }).eq("ID", emp["ID"]).select('"ID"');
    setSalvando(false);
    if (error) { setErro(`Não deu p/ salvar o líder: ${error.message}`); return; }
    if (!data?.length) { setErro("Sem permissão para alterar o cadastro (EMPREGADOS). Avise o RH/TI."); return; }
    setModo(null); carregar();
  };

  const removerLider = async () => {
    if (!emp || !confirm(`Remover ${emp["LIDER"]} como líder de ${emp["Nome"]}?`)) return;
    setSalvando(true); setErro(null);
    const { data, error } = await (supabase as any).from("EMPREGADOS")
      .update({ LIDER: null }).eq("ID", emp["ID"]).select('"ID"');
    setSalvando(false);
    if (error) { setErro(`Não deu p/ remover o líder: ${error.message}`); return; }
    if (!data?.length) { setErro("Sem permissão para alterar o cadastro (EMPREGADOS). Avise o RH/TI."); return; }
    carregar();
  };

  const irParaForm = (formId: string) => { onClose(); nav(`/app/central-servicos/formularios/${formId}/respostas`); };

  // Filtros da aba Formulários: "Respondeu" + uma opção por pergunta em que a
  // pessoa foi citada (é assim que se vê "todo formulário que ela participou
  // como líder" vs. "como colaborador" - a pergunta é que diz o papel).
  const perguntasFiltro = useMemo(() => {
    const s = new Set<string>();
    parts.forEach(p => p.perguntas.forEach(q => s.add(q)));
    return [...s];
  }, [parts]);
  const partsFiltradas = useMemo(() => (
    filtro === "todos" ? parts
      : filtro === "respondeu" ? parts.filter(p => p.comoRespondente)
        : parts.filter(p => p.perguntas.includes(filtro))
  ), [parts, filtro]);

  const sit = val(emp?.["Situação"]);
  const ativo = ehAtivo(emp);
  const demissao = fmtData(emp?.["Data Afastamento"]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 950, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: 640, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 14, border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8", zIndex: 2 }}>×</button>

        {/* Cabeçalho */}
        <div style={{ padding: "18px 22px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0f3171", paddingRight: 24 }}>👤 {emp?.["Nome"] || alvoNome}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            {loading ? "Carregando ficha…" : emp ? resumoDe(emp) : "Não localizado no cadastro de empregados"}
          </div>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3, marginTop: 12, width: "fit-content" }}>
            {(["cadastro", "formularios"] as const).map(a => (
              <button key={a} onClick={() => setAba(a)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: aba === a ? "#fff" : "transparent", color: aba === a ? "#0f3171" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: aba === a ? "0 2px 6px rgba(15,23,42,.08)" : "none" }}>
                {a === "cadastro" ? "Cadastro" : `Formulários${parts.length ? ` (${parts.length})` : ""}`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px 22px" }}>
          {erro && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "9px 12px", fontSize: 12, color: "#b91c1c", marginBottom: 10 }}>{erro}</div>
          )}

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Carregando…</div>
          ) : aba === "cadastro" ? (
            !emp ? (
              // Nome que não casa com o cadastro: oferece vincular à mão.
              <>
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "14px 16px", fontSize: 12.5, color: "#9a3412", marginBottom: 12 }}>
                  Não encontramos <b>{alvoNome}</b> no cadastro de empregados. Pode ser um nome incompleto (ex.: falta um sobrenome), grafia diferente, ou não ser uma pessoa (ex.: um setor/gerência).
                </div>
                {modo === "vincular" ? (
                  <BuscaEmpregado titulo={`Vincular "${alvoNome}" a um empregado`}
                    ajuda="A ficha e os formulários passam a apontar p/ o cadastro escolhido."
                    onEscolher={vincularA} onCancelar={() => setModo(null)} />
                ) : (
                  <button onClick={() => setModo("vincular")} disabled={salvando} style={btn("#0f3171")}>🔗 Vincular a um empregado</button>
                )}
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: ativo ? "#dcfce7" : "#fee2e2", color: ativo ? "#15803d" : "#b91c1c" }}>{sit}</span>
                  {emp["Nome da Empresa"] && <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: "#eef2ff", color: "#4338ca" }}>{emp["Nome da Empresa"]}</span>}
                  {vinculo && (
                    <span title={`A resposta diz "${vinculo.nome_texto}" e foi vinculada à mão a ${vinculo.empregado_nome}.`}
                      style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: "#fef9c3", color: "#a16207" }}>
                      🔗 Vinculado de “{vinculo.nome_texto}”
                    </span>
                  )}
                  {vinculo && <button onClick={desvincular} disabled={salvando} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>Desvincular</button>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Campo rotulo="CPF" valor={val(emp["CPF"])} />
                  <Campo rotulo="Admissão" valor={fmtData(emp["Admissão"])} />
                  <Campo rotulo="Tempo de casa" valor={tempoDeCasa(emp["Admissão"]) ?? "—"} cor="#0f3171" />
                  <Campo rotulo="Cargo" valor={nomeCargoDe(emp)} />
                  <Campo rotulo="Setor" valor={val(emp["Setor_ERP"])} />
                  <Campo rotulo="Perfil" valor={val(emp["Perfil_ERP"])} />
                  <Campo rotulo="Filial" valor={val(emp["Nome Filial"])} />
                  <Campo rotulo="Centro de custo" valor={[emp["C.Custo"], emp["Titulo C.Custo"]].filter(Boolean).join(" — ") || "—"} />
                  <Campo rotulo="Situação" valor={sit} cor={ativo ? "#15803d" : "#b91c1c"} />
                  {/* Data de saída só faz sentido p/ quem não está mais ativo. */}
                  {!ativo && demissao !== "—" && <Campo rotulo="Saída" valor={demissao} cor="#b91c1c" />}
                  <Campo rotulo="E-mail" valor={val(emp["email"])} />
                </div>

                {/* Líder - dá p/ definir/trocar direto aqui */}
                <div style={{ ...rotuloSecao, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>Líder</span>
                  <div style={{ flex: 1 }} />
                  {modo !== "lider" && (
                    <button onClick={() => setModo("lider")} disabled={salvando}
                      style={{ ...btnGhost, padding: "4px 10px", fontSize: 11, textTransform: "none", letterSpacing: 0 }}>
                      {emp["LIDER"] ? "Trocar líder" : "Definir líder"}
                    </button>
                  )}
                </div>

                {modo === "lider" ? (
                  <BuscaEmpregado titulo={`Escolher o líder de ${emp["Nome"]}`}
                    ajuda="Grava na coluna LIDER do cadastro (EMPREGADOS) — vale p/ todo o ERP."
                    ignorarId={emp["ID"]} onEscolher={definirLider} onCancelar={() => setModo(null)} />
                ) : emp["LIDER"] ? (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "11px 13px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#0f3171", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>
                      {String(emp["LIDER"]).trim().charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 140, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{lider?.["Nome"] ?? emp["LIDER"]}</div>
                      <div style={{ fontSize: 11.5, color: "#64748b" }}>{lider ? resumoDe(lider) : "Não localizado no cadastro"}</div>
                      {lider && (
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                          <span style={{ color: ehAtivo(lider) ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{val(lider["Situação"])}</span>
                          {lider["Nome Filial"] ? ` · ${lider["Nome Filial"]}` : ""}
                          {lider["email"] ? ` · ${lider["email"]}` : ""}
                        </div>
                      )}
                    </div>
                    {lider && <button onClick={() => setAlvoNome(lider["Nome"])} style={btnGhost}>Ver ficha</button>}
                    <button onClick={removerLider} disabled={salvando} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>Remover</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>Sem líder no cadastro.</div>
                )}
              </>
            )
          ) : (
            // Aba Formulários
            parts.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 12.5 }}>
                Nenhum formulário encontrado com <b>{alvoNome}</b> (como respondente ou citado numa resposta).
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Filtro por papel: a pergunta em que a pessoa foi citada diz se
                    ela entrou como líder, como colaborador, etc. */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { k: "todos", r: `Todos (${parts.length})` },
                    ...(parts.some(p => p.comoRespondente) ? [{ k: "respondeu", r: `Respondeu (${parts.filter(p => p.comoRespondente).length})` }] : []),
                    ...perguntasFiltro.map(q => ({ k: q, r: `${q} (${parts.filter(p => p.perguntas.includes(q)).length})` })),
                  ].map(({ k, r }) => (
                    <button key={k} onClick={() => setFiltro(k)} title={r}
                      style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, cursor: "pointer", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        border: filtro === k ? "1px solid #0f3171" : "1px solid #e2e8f0",
                        background: filtro === k ? "#0f3171" : "#fff", color: filtro === k ? "#fff" : "#475569" }}>
                      {r}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {filtro === "todos"
                    ? <>Participou de <b style={{ color: "#0f172a" }}>{parts.length}</b> formulário(s):</>
                    : <><b style={{ color: "#0f172a" }}>{partsFiltradas.length}</b> formulário(s) neste filtro:</>}
                </div>
                {partsFiltradas.map(p => (
                  <div key={p.formId} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "11px 13px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{p.titulo}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                        {p.comoRespondente && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#dcfce7", color: "#15803d" }}>Respondeu</span>}
                        {p.perguntas.map((q, i) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#eef2ff", color: "#4338ca" }}>Citado em: {q}</span>
                        ))}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f1f5f9", color: "#64748b" }}>{p.total} resposta(s)</span>
                      </div>
                    </div>
                    <button onClick={() => irParaForm(p.formId)} style={btn("rgba(59,130,246,.1)", "#2563eb", "1px solid rgba(59,130,246,.3)")}>📊 Ver respostas</button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
