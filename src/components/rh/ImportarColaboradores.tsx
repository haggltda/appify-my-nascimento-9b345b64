import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, UserPlus, RefreshCw, CheckCircle2, AlertTriangle, X } from "lucide-react";

// =========================================================================
// RH — Colaboradores: importar EMPREGADOS por planilha (export do sistema de
// folha). Regras pedidas:
//   • CPF novo → INSERT de linha nova.
//   • CPF que já existe e está com vínculo ABERTO → atualiza a "Situação".
//   • CPF que já existe, está ABERTO e a planilha diz TRABALHANDO → além da
//     situação, atualiza os dados cadastrais (salário, cargo, admissão,
//     lotação, PIS…) quando houver diferença. Planilha vazia num campo nunca
//     apaga o que já está no banco.
// Casamento por CPF normalizado (só dígitos, 11 casas). A planilha traz o
// mesmo CPF em várias linhas (postos diferentes); consolidamos por CPF
// mantendo a situação "mais ativa" (Trabalhando > Férias > Afastado >
// Aposentadoria > Demitido).
// =========================================================================

// Colunas da planilha → colunas da EMPREGADOS (para linhas NOVAS).
const COL = {
  cpf: "CPF",
  nome: "Nome",
  situ: "Descrição (Situação)",
  cargo: "Título Reduzido (Cargo)",
  cargoAlt: "Cargo",
  admissao: "Admissão",
  afastamento: "Data Afastamento",
  salario: "Valor Salário",
  empresa: "Empresa",
  nomeEmpresa: "Nome (Empresa)",
  filial: "Filial",
  apelidoFilial: "Apelido (Filial)",
  pis: "PIS",
  ccusto: "C.Custo",
  local: "Descrição do Local",
} as const;

// Colunas onde o "tipo de contrato" pode aparecer (varia entre exports).
// Regra: quem é MEI não é tocado — nem insert, nem update.
const COLS_TIPO_CONTRATO = ["Descrição (T. Contrato)", "Descrição (Tipo)", "Descrição (Categoria Contribuinte)", "Descrição (Cat. eSocial)", "Descrição (Categoria Sefip)"];
const ehMEI = (r: any): boolean =>
  COLS_TIPO_CONTRATO.some(c => { const v = r[c]; return typeof v === "string" && (/\bMEI\b/i.test(v) || /MICROEMPREEND/i.test(v)); });

// Ranking de "atual" para consolidar múltiplas linhas do mesmo CPF.
const rankSituacao = (s: string): number => {
  const u = (s || "").toUpperCase();
  if (u.startsWith("TRABALH")) return 6;
  if (u.includes("FÉRIAS") || u.includes("FERIAS")) return 5;
  if (u.includes("ATEST") || u.includes("AUXÍLIO") || u.includes("AUXILIO") || u.includes("LICEN") || u.includes("ABONO")) return 4;
  if (u.includes("APOSENT")) return 2;
  if (u.includes("DEMIT") || u.includes("DESLIG") || u.includes("RESCIS")) return 1;
  return 3; // desconhecido → meio-termo
};

// Situação "terminal" = vínculo encerrado. Nunca é reativada: se a pessoa
// reaparecer ativa na planilha, é readmissão (linha nova), não update.
const ehTerminal = (s: string): boolean => {
  const u = (s || "").toUpperCase();
  return u.includes("DEMIT") || u.includes("DESLIG") || u.includes("RESCIS") || u.includes("APOSENT");
};

const soDigitos = (v: any) => String(v ?? "").replace(/\D/g, "");
const normCpf = (v: any) => { const d = soDigitos(v); return d ? d.padStart(11, "0") : ""; };

// "Trabalhando" (a única situação que dispara atualização cadastral).
const ehTrabalhandoSitu = (s: string): boolean => (s || "").trim().toUpperCase().startsWith("TRABALH");

// Salário pt-BR ("1.605,33"), "1605.33" ou número → Number (NaN se não der).
const numSal = (v: any): number => {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s); return isNaN(n) ? NaN : n;
};
// "DD/MM/AAAA", ISO ou "AAAA-MM-DD" → "AAAA-MM-DD" (ou null).
const dataISO = (v: any): string | null => {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m && m[3] !== "0000") return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
};
// Há diferença real entre o valor da planilha (novo) e o do banco (atual)?
const difere = (cmp: "num" | "data" | "txt", novo: any, atual: any): boolean => {
  if (cmp === "num") { const a = numSal(novo); if (isNaN(a)) return false; const b = numSal(atual); return isNaN(b) || Math.abs(a - b) > 0.005; }
  if (cmp === "data") { const a = dataISO(novo); if (!a) return false; return a !== dataISO(atual); }
  return String(novo).trim().toUpperCase() !== String(atual ?? "").trim().toUpperCase();
};

// Campos cadastrais atualizados SÓ para quem está TRABALHANDO e já existe.
// Alinhados aos campos que o INSERT (montarPayload) grava numa linha nova, para
// que um update apenas traga a linha existente ao mesmo estado da planilha.
// `val` devolve null quando a planilha não traz o dado → nesse caso não mexe.
const CAMPOS_CAD: { col: string; label: string; cmp: "num" | "data" | "txt"; val: (r: any, iso: (v: any) => string | null) => any }[] = [
  { col: "Valor Salário",      label: "Salário",         cmp: "num",  val: r => { const v = r[COL.salario]; return v != null && v !== "" ? v : null; } },
  { col: "Título do Cargo",    label: "Cargo",           cmp: "txt",  val: r => { const c = r[COL.cargo] || r[COL.cargoAlt]; return c ? String(c).trim() : null; } },
  { col: "Nome",               label: "Nome",            cmp: "txt",  val: r => { const v = r[COL.nome]; return v ? String(v).trim() : null; } },
  { col: "Admissão",           label: "Admissão",        cmp: "data", val: (r, iso) => iso(r[COL.admissao]) },
  { col: "Nome da Empresa",    label: "Empresa",         cmp: "txt",  val: r => { const v = r[COL.nomeEmpresa]; return v ? String(v).trim() : null; } },
  { col: "Empresa",            label: "Cód. empresa",    cmp: "txt",  val: r => { const v = r[COL.empresa]; return v != null && v !== "" ? String(v).trim() : null; } },
  { col: "Nome Filial",        label: "Filial",          cmp: "txt",  val: r => { const v = r[COL.apelidoFilial]; return v ? String(v).trim() : null; } },
  { col: "Filial",             label: "Cód. filial",     cmp: "txt",  val: r => { const v = r[COL.filial]; return v != null && v !== "" ? String(v).trim() : null; } },
  { col: "C.Custo",            label: "Centro de custo", cmp: "txt",  val: r => { const v = r[COL.ccusto]; return v != null && v !== "" ? String(v).trim() : null; } },
  { col: "Descrição do Local", label: "Local",           cmp: "txt",  val: r => { const v = r[COL.local]; return v ? String(v).trim() : null; } },
  { col: "PIS",                label: "PIS",             cmp: "txt",  val: r => { const v = r[COL.pis]; return v != null && v !== "" ? soDigitos(v) : null; } },
];

type Previa = {
  totalLinhas: number;
  totalCpfs: number;
  inserts: Record<string, any>[];
  novosCpf: number;
  readmissoes: number;
  updates: { id: any; patch: Record<string, any> }[]; // um patch por registro (situação e/ou cadastro)
  totalUpdates: number;                                // registros com qualquer mudança
  totalSituacao: number;                               // registros com mudança de situação
  totalCadastro: number;                               // registros com mudança cadastral
  semMudanca: number;
  mudaResumo: Record<string, number>;                  // "de → para" (situação) → nº
  cadastroResumo: Record<string, number>;              // campo cadastral → nº de registros alterados
  ignorados: number;
  mei: number;
};

export default function ImportarColaboradores({ rows, onImported }: { rows: any[]; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fase, setFase] = useState<"idle" | "lendo" | "previa" | "aplicando" | "fim">("idle");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [prog, setProg] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const abrir = () => { setOpen(true); setFase("idle"); setPrevia(null); setErro(null); setProg(""); };
  const fechar = () => { if (fase === "aplicando" || fase === "lendo") return; setOpen(false); };

  const escolher = () => fileRef.current?.click();

  const lerArquivo = async (file: File) => {
    setErro(null); setFase("lendo");
    try {
      const XLSX: any = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

      // Serial do Excel (ou "DD/MM/AAAA") → ISO "AAAA-MM-DD" (ou null).
      // Base 1899-12-30 (UTC) já compensa o bug do ano bissexto de 1900 do Excel.
      const serialISO = (v: any): string | null => {
        if (v == null || v === "") return null;
        if (typeof v === "number" && v > 0) {
          const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
          if (isNaN(d.getTime())) return null;
          const y = d.getUTCFullYear();
          if (y < 1950 || y > 2100) return null;
          return `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        }
        const m = String(v).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (m && m[3] !== "0000") return `${m[3]}-${m[2]}-${m[1]}`;
        return null;
      };

      // 1ª passada: CPFs que são MEI (em qualquer linha) ficam de fora por completo.
      const meiCpfs = new Set<string>();
      for (const r of raw) { if (ehMEI(r)) { const cpf = normCpf(r[COL.cpf]); if (cpf) meiCpfs.add(cpf); } }

      // Consolida a planilha por CPF (situação mais ativa vence). MEI é ignorado.
      const porCpf = new Map<string, { cpf: string; nome: string; situ: string; raw: any }>();
      let ignorados = 0;
      for (const r of raw) {
        const cpf = normCpf(r[COL.cpf]);
        const nome = String(r[COL.nome] ?? "").trim();
        if (!cpf || cpf === "00000000000" || soDigitos(r[COL.cpf]).length > 11 || !nome) { ignorados++; continue; }
        if (meiCpfs.has(cpf)) continue; // MEI: não altera nada
        const situ = String(r[COL.situ] ?? "").trim();
        const ex = porCpf.get(cpf);
        if (!ex || rankSituacao(situ) > rankSituacao(ex.situ)) porCpf.set(cpf, { cpf, nome, situ, raw: r });
      }

      // Índice dos existentes (banco): CPF → linhas (pode haver duplicadas).
      const existByCpf = new Map<string, any[]>();
      for (const e of rows) {
        const cpf = normCpf(e["CPF"]);
        if (!cpf || cpf === "00000000000") continue;
        const g = existByCpf.get(cpf); if (g) g.push(e); else existByCpf.set(cpf, [e]);
      }

      const inserts: Record<string, any>[] = [];
      const updates: { id: any; patch: Record<string, any> }[] = [];
      const mudaResumo: Record<string, number> = {};
      const cadastroResumo: Record<string, number> = {};
      let semMudanca = 0, novosCpf = 0, readmissoes = 0, totalSituacao = 0, totalCadastro = 0;

      for (const [cpf, c] of porCpf) {
        const existentes = existByCpf.get(cpf);
        if (!existentes) { inserts.push(montarPayload(c, serialISO)); novosCpf++; continue; }
        if (!c.situ) { semMudanca++; continue; }

        // Só vínculos ABERTOS (não-demitido) podem ter a situação alterada.
        const abertas = existentes.filter(e => !ehTerminal(String(e["Situação"] ?? "")));

        // Planilha diz que está ativo, mas no banco só há vínculo encerrado
        // (Demitido) → readmissão: entra como linha nova, sem tocar o antigo.
        if (!ehTerminal(c.situ) && abertas.length === 0) {
          inserts.push(montarPayload(c, serialISO)); readmissoes++; continue;
        }

        // Dados cadastrais só são atualizados quando a planilha diz TRABALHANDO.
        const trabalhando = ehTrabalhandoSitu(c.situ);
        let mexeu = false;
        for (const e of abertas) {
          const patch: Record<string, any> = {};

          // 1) Situação (sempre que abrir e divergir).
          const atual = String(e["Situação"] ?? "").trim();
          if (atual.toUpperCase() !== c.situ.toUpperCase()) {
            patch["Situação"] = c.situ;
            const k = `${atual || "(vazio)"}  →  ${c.situ}`;
            mudaResumo[k] = (mudaResumo[k] || 0) + 1;
            totalSituacao++;
          }

          // 2) Cadastro (só TRABALHANDO). Planilha vazia num campo não apaga.
          let mexeuCad = false;
          if (trabalhando) {
            for (const campo of CAMPOS_CAD) {
              if (!(campo.col in e)) continue; // coluna não carregada no recorte → não toca
              const novo = campo.val(c.raw, serialISO);
              if (novo == null || novo === "") continue;
              if (difere(campo.cmp, novo, e[campo.col])) {
                patch[campo.col] = novo;
                cadastroResumo[campo.label] = (cadastroResumo[campo.label] || 0) + 1;
                mexeuCad = true;
              }
            }
          }
          if (mexeuCad) totalCadastro++;

          if (Object.keys(patch).length) { updates.push({ id: e["ID"], patch }); mexeu = true; }
        }
        if (!mexeu) semMudanca++;
      }

      setPrevia({
        totalLinhas: raw.length,
        totalCpfs: porCpf.size,
        inserts,
        novosCpf,
        readmissoes,
        updates,
        totalUpdates: updates.length,
        totalSituacao,
        totalCadastro,
        semMudanca,
        mudaResumo,
        cadastroResumo,
        ignorados,
        mei: meiCpfs.size,
      });
      setFase("previa");
    } catch (e: any) {
      setErro(e?.message || String(e)); setFase("idle");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const montarPayload = (c: { cpf: string; nome: string; situ: string; raw: any }, serialISO: (v: any) => string | null) => {
    const r = c.raw;
    const p: Record<string, any> = { Nome: c.nome, CPF: c.cpf, Setor_ERP: "PADRAO", Perfil_ERP: "PADRAO" };
    const cargo = r[COL.cargo] || r[COL.cargoAlt];
    if (cargo) p["Título do Cargo"] = String(cargo).trim();
    if (c.situ) p["Situação"] = c.situ;
    const adm = serialISO(r[COL.admissao]); if (adm) p["Admissão"] = adm;
    const afa = serialISO(r[COL.afastamento]); if (afa) p["Data Afastamento"] = afa;
    const sal = r[COL.salario]; if (sal != null && sal !== "") p["Valor Salário"] = sal;
    if (r[COL.empresa] != null && r[COL.empresa] !== "") p["Empresa"] = String(r[COL.empresa]).trim();
    const ne = r[COL.nomeEmpresa]; if (ne) p["Nome da Empresa"] = String(ne).trim();
    if (r[COL.filial] != null && r[COL.filial] !== "") p["Filial"] = String(r[COL.filial]).trim();
    const af = r[COL.apelidoFilial]; if (af) p["Nome Filial"] = String(af).trim();
    const pis = r[COL.pis]; if (pis != null && pis !== "") p["PIS"] = soDigitos(pis);
    const cc = r[COL.ccusto]; if (cc != null && cc !== "") p["C.Custo"] = String(cc).trim();
    const loc = r[COL.local]; if (loc) p["Descrição do Local"] = String(loc).trim();
    return p;
  };

  const aplicar = async () => {
    if (!previa) return;
    setFase("aplicando"); setErro(null);
    try {
      // A coluna "ID" da EMPREGADOS não tem auto-incremento: geramos IDs
      // sequenciais a partir do maior ID atual (banco + linhas carregadas).
      let base = 0;
      if (previa.inserts.length > 0) {
        const { data: mx } = await (supabase as any).from("EMPREGADOS").select("ID").order("ID", { ascending: false }).limit(1);
        base = Number(mx?.[0]?.["ID"]) || 0;
        for (const e of rows) { const n = Number(e["ID"]); if (!isNaN(n) && n > base) base = n; }
      }

      let insOk = 0;
      for (let i = 0; i < previa.inserts.length; i += 200) {
        const chunk = previa.inserts.slice(i, i + 200).map((p, j) => ({ ...p, ID: base + i + j + 1 }));
        const { error } = await (supabase as any).from("EMPREGADOS").insert(chunk);
        if (error) throw new Error("Inserção de novos: " + error.message);
        insOk += chunk.length; setProg(`Inserindo colaboradores novos… ${insOk}/${previa.inserts.length}`);
      }

      // Agrupa registros que compartilham EXATAMENTE o mesmo patch (ex.: vários
      // "Trabalhando → Demitido") para minimizar chamadas; patches únicos
      // (salário individual etc.) caem em grupos de 1.
      const grupos = new Map<string, { patch: Record<string, any>; ids: any[] }>();
      for (const u of previa.updates) {
        const key = JSON.stringify(u.patch);
        const g = grupos.get(key) || { patch: u.patch, ids: [] };
        g.ids.push(u.id); grupos.set(key, g);
      }
      let upOk = 0;
      for (const { patch, ids } of grupos.values()) {
        for (let i = 0; i < ids.length; i += 300) {
          const chunk = ids.slice(i, i + 300);
          const { error } = await (supabase as any).from("EMPREGADOS").update(patch).in("ID", chunk);
          if (error) throw new Error("Atualização de colaboradores: " + error.message);
          upOk += chunk.length; setProg(`Atualizando colaboradores… ${upOk}/${previa.totalUpdates}`);
        }
      }

      setProg(`${insOk} novo(s) inserido(s) · ${upOk} colaborador(es) atualizado(s).`);
      setFase("fim");
      onImported();
    } catch (e: any) {
      setErro(e?.message || String(e)); setFase("previa");
    }
  };

  return (
    <>
      <button className="col-btn" onClick={abrir} style={{ background: "#0f3171", color: "#fff", borderColor: "#0f3171", display: "inline-flex", alignItems: "center", gap: 7 }}>
        <Upload size={15} /> Importar Excel
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) lerArquivo(f); }} />

      {open && (
        <div onClick={ev => { if (ev.target === ev.currentTarget) fechar(); }}
          style={{ position: "fixed", inset: 0, zIndex: 800, background: "rgba(15,23,42,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "90vh", display: "flex", flexDirection: "column", position: "relative" }}>
            {fase !== "aplicando" && fase !== "lendo" && (
              <button onClick={fechar} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", color: "#94a3b8", cursor: "pointer", zIndex: 1 }}><X size={20} /></button>
            )}
            <div style={{ padding: "20px 22px 12px" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 9 }}>
                <FileSpreadsheet size={20} color="#0f3171" /> Importar colaboradores
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                Vínculo ativo atualiza a <b>Situação</b>; quem está <b>Trabalhando</b> também tem os <b>dados cadastrais</b> (salário, cargo, admissão, lotação…) atualizados quando mudam. Quem está <b>demitido</b> não é reativado: se voltar ativo na planilha, entra como <b>linha nova</b> (readmissão).
              </div>
            </div>

            <div style={{ padding: "0 22px 4px", overflowY: "auto", flex: 1 }}>
              {erro && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, marginBottom: 12 }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{erro}</span>
                </div>
              )}

              {fase === "idle" && (
                <button onClick={escolher} style={{ width: "100%", border: "2px dashed #c7d2e5", background: "#f8fbff", borderRadius: 14, padding: "34px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#0f3171" }}>
                  <Upload size={30} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Selecionar planilha (.xlsx)</div>
                  <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", maxWidth: 400 }}>
                    Use o export do sistema de folha. O casamento é por CPF; a mesma pessoa em vários postos é consolidada em um cadastro.
                  </div>
                </button>
              )}

              {fase === "lendo" && <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b", fontSize: 13.5 }}>Lendo planilha…</div>}

              {(fase === "previa" || fase === "fim") && previa && (
                <>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <ResumoCard icon={<UserPlus size={16} />} cor="#15803d" n={previa.inserts.length} label="novos (insert)"
                      sub={previa.readmissoes > 0 ? `${previa.novosCpf} novo(s) + ${previa.readmissoes} readmissão(ões)` : undefined} />
                    <ResumoCard icon={<RefreshCw size={16} />} cor="#2563eb" n={previa.totalUpdates} label="a atualizar"
                      sub={`${previa.totalSituacao} situação · ${previa.totalCadastro} cadastro`} />
                    <ResumoCard icon={<CheckCircle2 size={16} />} cor="#64748b" n={previa.semMudanca} label="sem mudança" />
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 12 }}>
                    {previa.totalLinhas.toLocaleString("pt-BR")} linha(s) lida(s) · {previa.totalCpfs.toLocaleString("pt-BR")} CPF(s) distinto(s)
                    {previa.mei > 0 && ` · ${previa.mei} MEI ignorado(s)`}
                    {previa.ignorados > 0 && ` · ${previa.ignorados} sem CPF/nome`}
                  </div>

                  {Object.keys(previa.mudaResumo).length > 0 && (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".4px", padding: "9px 12px", background: "#f8fafc", borderBottom: "1px solid #eef2f7" }}>
                        Mudanças de situação
                      </div>
                      <div style={{ maxHeight: 210, overflowY: "auto" }}>
                        {Object.entries(previa.mudaResumo).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 12px", fontSize: 12.5, borderTop: "1px solid #f1f5f9", color: "#334155" }}>
                            <span>{k}</span><span style={{ fontWeight: 800, color: "#0f172a" }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(previa.cadastroResumo).length > 0 && (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".4px", padding: "9px 12px", background: "#f8fafc", borderBottom: "1px solid #eef2f7" }}>
                        Dados cadastrais a atualizar (só Trabalhando)
                      </div>
                      <div style={{ maxHeight: 210, overflowY: "auto" }}>
                        {Object.entries(previa.cadastroResumo).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 12px", fontSize: 12.5, borderTop: "1px solid #f1f5f9", color: "#334155" }}>
                            <span>{k}</span><span style={{ fontWeight: 800, color: "#0f172a" }}>{v} colaborador(es)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {fase === "fim" && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#ecfdf3", border: "1px solid #86efac", color: "#15803d", borderRadius: 10, padding: "12px 14px", fontSize: 13, fontWeight: 600, margin: "12px 0" }}>
                      <CheckCircle2 size={18} /> {prog || "Importação concluída."}
                    </div>
                  )}
                </>
              )}

              {fase === "aplicando" && (
                <div style={{ padding: "34px 0", textAlign: "center" }}>
                  <RefreshCw size={26} color="#0f3171" style={{ animation: "spin 1s linear infinite" }} />
                  <div style={{ fontSize: 13.5, color: "#334155", marginTop: 12, fontWeight: 600 }}>{prog || "Aplicando…"}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Não feche esta janela.</div>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px", borderTop: "1px solid #e2e8f0" }}>
              {fase === "previa" && (
                <>
                  <button className="col-btn" onClick={fechar}>Cancelar</button>
                  <button className="col-btn" onClick={aplicar} disabled={previa != null && previa.inserts.length === 0 && previa.totalUpdates === 0}
                    style={{ background: "#0f3171", color: "#fff", borderColor: "#0f3171", opacity: previa != null && previa.inserts.length === 0 && previa.totalUpdates === 0 ? .5 : 1 }}>
                    Aplicar importação
                  </button>
                </>
              )}
              {fase === "idle" && <button className="col-btn" onClick={fechar}>Fechar</button>}
              {fase === "fim" && <button className="col-btn" onClick={fechar} style={{ background: "#0f3171", color: "#fff", borderColor: "#0f3171" }}>Fechar</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResumoCard({ icon, cor, n, label, sub }: { icon: any; cor: string; n: number; label: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 150, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: cor, fontSize: 12, fontWeight: 700 }}>{icon}<span>{label}</span></div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{n.toLocaleString("pt-BR")}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
