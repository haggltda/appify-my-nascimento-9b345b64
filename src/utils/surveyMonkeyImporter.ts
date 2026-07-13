import * as XLSX from "xlsx";

// =====================================================================
// NASCIMENTO FORMULÁRIOS — importador de exports do SurveyMonkey
//
// Suporta os dois formatos de exportação (.xlsx) do SurveyMonkey:
//
// 1. "Question Summaries" (resumo por pergunta): uma aba "Question N" por
//    pergunta, com título e "Answer Choices". Replica o FORMULÁRIO
//    (perguntas + opções); não tem respostas individuais (só agregados).
//
// 2. "All Responses Data" (respostas individuais): uma aba única, linha 1
//    com os títulos das perguntas (colunas em branco = continuação da
//    pergunta anterior), linha 2 com sub-rótulos (opções / "Response" /
//    "Open-Ended Response") e uma linha por respondente. Replica o
//    formulário E importa todas as respostas.
// =====================================================================

export interface ImportPergunta {
  tipo: string;
  titulo: string;
  descricao?: string | null;
  opcoes: string[];
  config: Record<string, unknown>;
}
export interface ImportResposta {
  enviado_em?: string;
  respondente_nome?: string;
  respondente_email?: string;
  /** valores por ÍNDICE da pergunta (vira id real depois do insert) */
  itens: Record<number, unknown>;
}
export interface ImportResultado {
  formato: "resumo" | "respostas";
  titulo: string;
  perguntas: ImportPergunta[];
  respostas: ImportResposta[];
  avisos: string[];
}

type Linha = (string | number)[];
const s = (v: unknown) => String(v ?? "").trim();
const norm = (v: unknown) => s(v).toLowerCase();

/** Rótulos de campos de contato do SurveyMonkey (viram texto_curto). */
const CONTATO = /^(first name|last name|name|company|address|address 2|city\/town|state\/province|zip\/postal code|country|email address|phone number)?:$/i;
const META_COLS = /^(respondent id|collector id|start date|end date|ip address|email address|first name|last name|custom data( \d+)?)$/i;

function limpaOpcao(o: string) {
  return o.replace(/^✓\s*/, "").replace(/:\s*$/, "").trim();
}

export function parseSurveyMonkey(dados: ArrayBuffer): ImportResultado {
  const wb = XLSX.read(dados, { type: "array", cellDates: true });
  const qSheets = wb.SheetNames.filter((n) => /^question\s*\d+/i.test(n))
    .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
  if (qSheets.length) return parseResumo(wb, qSheets);
  return parseRespostas(wb);
}

// ── Formato 1: Question Summaries ────────────────────────────────────────
function parseResumo(wb: XLSX.WorkBook, qSheets: string[]): ImportResultado {
  const avisos: string[] = [];
  let titulo = "Formulário importado";
  const perguntas: ImportPergunta[] = [];

  for (const nome of qSheets) {
    const rows: Linha[] = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: "" });
    if (s(rows[0]?.[0])) titulo = s(rows[0][0]);
    const tituloPerg = s(rows[1]?.[0]) || s(rows[0]?.[0]) || nome;

    // Coleta as opções entre "Answer Choices" e "Answered/Skipped".
    // Perguntas de quiz têm coluna extra "Score" — o percentual fica na
    // coluna do cabeçalho "Responses" (posição varia).
    const opcoes: string[] = [];
    const percentuais: number[] = [];
    let dentro = false;
    let idxResp = 1;
    for (const r of rows) {
      const c0 = s(r[0]);
      if (/^answer choices$/i.test(c0)) {
        dentro = true;
        const i = r.findIndex((c) => /^responses$/i.test(s(c)));
        if (i > 0) idxResp = i;
        continue;
      }
      if (dentro) {
        if (r.slice(0, 5).some((c) => /^(answered|skipped)$/i.test(s(c)))) break;
        if (!c0) continue;
        opcoes.push(c0);
        const pct = r[idxResp];
        percentuais.push(typeof pct === "number" ? pct : parseFloat(s(pct)) || 0);
      }
    }

    const limpas = opcoes.map(limpaOpcao).filter((o) => o && !/^(answered|skipped)$/i.test(o));

    // Inferência de tipo
    let tipo = "texto_longo";
    let opcoesFinais: string[] = [];
    if (limpas.length === 0) {
      tipo = "texto_longo"; // pergunta aberta (no resumo só aparece Answered/Skipped)
    } else if (opcoes.every((o) => CONTATO.test(s(o)) || s(o) === ":")) {
      tipo = "texto_curto"; // campo de contato/identificação (First name/Last name/...)
    } else if (limpas.length === 1 && /(data|date|hora)/i.test(limpas[0])) {
      tipo = "data"; // campo de data ("Data/hora", "DATA PRAZO"...)
    } else {
      const somaPct = percentuais.reduce((t, p) => t + (p || 0), 0);
      tipo = somaPct > 1.05 ? "caixas_selecao" : "multipla_escolha"; // >100% = múltiplas marcações
      opcoesFinais = limpas;
    }

    perguntas.push({ tipo, titulo: tituloPerg, opcoes: opcoesFinais, config: {} });
  }

  avisos.push(
    "Export \"Resumo por pergunta\": replica o formulário (perguntas e opções), mas não contém respostas individuais. " +
    "Para importar as respostas, exporte no SurveyMonkey como \"All Responses Data\" e importe o arquivo aqui também.",
  );
  return { formato: "resumo", titulo, perguntas, respostas: [], avisos };
}

// ── Formato 2: All Responses Data ────────────────────────────────────────
function parseRespostas(wb: XLSX.WorkBook): ImportResultado {
  // Acha a aba com "Respondent ID"/"Collector ID" na linha 1.
  let sheet: XLSX.WorkSheet | null = null;
  let nomeAba = "";
  for (const n of wb.SheetNames) {
    const rows: Linha[] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "", range: 0 });
    const linha0 = (rows[0] ?? []).map(norm);
    if (linha0.some((c) => c === "respondent id" || c === "collector id")) { sheet = wb.Sheets[n]; nomeAba = n; break; }
  }
  if (!sheet) {
    throw new Error(
      "Formato não reconhecido: o arquivo não parece um export do SurveyMonkey " +
      "(esperado abas \"Question N\" ou uma aba com coluna \"Respondent ID\").",
    );
  }

  const rows: Linha[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const cab = rows[0] ?? [];
  const sub = rows[1] ?? [];
  const avisos: string[] = [];

  // Classifica colunas: metadados vs. grupos de pergunta (coluna com título
  // inicia um grupo; colunas seguintes em branco continuam o grupo).
  interface Grupo { titulo: string; cols: number[]; subs: string[] }
  const grupos: Grupo[] = [];
  const meta: Record<string, number> = {};
  let grupoAtual: Grupo | null = null;
  for (let c = 0; c < cab.length; c++) {
    const h = s(cab[c]);
    if (h && META_COLS.test(h)) { meta[norm(h)] = c; grupoAtual = null; continue; }
    if (h) { grupoAtual = { titulo: h, cols: [c], subs: [s(sub[c])] }; grupos.push(grupoAtual); continue; }
    if (grupoAtual) { grupoAtual.cols.push(c); grupoAtual.subs.push(s(sub[c])); }
  }

  // Monta as perguntas com tipo inferido.
  const dados = rows.slice(2).filter((r) => r.some((v) => s(v) !== ""));
  const perguntas: ImportPergunta[] = [];
  const extratores: ((linha: Linha) => unknown)[] = [];

  for (const g of grupos) {
    // Classifica as colunas do grupo: coluna de VALOR (sub "Response"/
    // "Open-Ended Response" — a resposta está na célula), coluna "Other
    // (please specify)" (texto livre do "outro") e colunas de OPÇÃO
    // (sub = nome da opção; célula preenchida = marcada).
    const cls = g.cols.map((c, i) => {
      const sub = norm(g.subs[i]);
      if (/other .*specify|^outro/.test(sub)) return { c, tipo: "outro" as const, opt: "" };
      if (/open-ended/.test(sub)) return { c, tipo: "aberta" as const, opt: "" };
      if (sub === "response" || sub === "" || sub === "resposta") return { c, tipo: "valor" as const, opt: "" };
      return { c, tipo: "opcao" as const, opt: limpaOpcao(g.subs[i]) };
    });
    const valCols = cls.filter((x) => x.tipo === "valor" || x.tipo === "aberta");
    const optCols = cls.filter((x) => x.tipo === "opcao");
    const outroCols = cls.filter((x) => x.tipo === "outro");
    const textoOutro = (linha: Linha) => outroCols.map((x) => s(linha[x.c])).filter(Boolean).join(" ");

    if (optCols.length === 0) {
      // Resposta na própria célula (1 coluna de valor + talvez "Other")
      const col = valCols[0]?.c ?? g.cols[0];
      const aberta = cls.some((x) => x.tipo === "aberta");
      const valores = dados.map((r) => s(r[col])).filter(Boolean);
      const distintos = [...new Set(valores)];
      const curtos = distintos.length > 0 && distintos.length <= 12 && distintos.every((v) => v.length <= 60);
      const repetem = valores.length > distintos.length || distintos.length <= 6;
      if (aberta) {
        perguntas.push({ tipo: "texto_longo", titulo: g.titulo, opcoes: [], config: {} });
      } else if (valores.length > 1 && valores.every((v) => !isNaN(Number(v))) && distintos.length > 1) {
        perguntas.push({ tipo: "numero", titulo: g.titulo, opcoes: [], config: {} });
      } else if (curtos && repetem) {
        perguntas.push({ tipo: "multipla_escolha", titulo: g.titulo, opcoes: distintos, config: {} });
      } else {
        perguntas.push({ tipo: "texto_curto", titulo: g.titulo, opcoes: [], config: {} });
      }
      extratores.push((linha) => {
        const v = s(linha[col]);
        const o = textoOutro(linha);
        if (v && o) return `${v} — ${o}`;
        if (v) return v;
        return o ? `Outro: ${o}` : undefined;
      });
    } else {
      // Uma opção por coluna = caixas de seleção (multi-marcação)
      const opcoes = optCols.map((x) => x.opt);
      if (outroCols.length) opcoes.push("Outro");
      perguntas.push({ tipo: "caixas_selecao", titulo: g.titulo, opcoes, config: {} });
      extratores.push((linha) => {
        const marcadas = optCols.filter((x) => s(linha[x.c])).map((x) => x.opt || s(linha[x.c]));
        const o = textoOutro(linha);
        if (o) marcadas.push(`Outro: ${o}`);
        return marcadas.length ? marcadas : undefined;
      });
    }
  }

  // Monta as respostas.
  const dt = (v: unknown) => {
    if (v instanceof Date && !isNaN(+v)) return v.toISOString();
    const d = new Date(s(v));
    return isNaN(+d) ? undefined : d.toISOString();
  };
  const respostas: ImportResposta[] = dados.map((linha) => {
    const itens: Record<number, unknown> = {};
    extratores.forEach((ex, i) => { const v = ex(linha); if (v !== undefined) itens[i] = v; });
    const nome = [s(linha[meta["first name"]]), s(linha[meta["last name"]])].filter(Boolean).join(" ");
    return {
      enviado_em: meta["end date"] != null ? dt(linha[meta["end date"]]) : undefined,
      respondente_nome: nome || undefined,
      respondente_email: meta["email address"] != null ? (s(linha[meta["email address"]]) || undefined) : undefined,
      itens,
    };
  });

  return { formato: "respostas", titulo: nomeAba || "Formulário importado", perguntas, respostas, avisos };
}
