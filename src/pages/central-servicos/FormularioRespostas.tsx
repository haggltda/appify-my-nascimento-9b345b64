import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFormPerms } from "@/hooks/useFormPerms";
import { useVinculoEmpregado } from "@/hooks/useVinculoEmpregado";
import { Formulario, Pergunta, fmtDt, situacao, normalizaPerguntas } from "./Formularios";
import EmpregadoDetalheModal, { normNome, carregarVinculos, prewarmFichas, invalidarFichas, nomesDoCadastro, resolveCadastro } from "./EmpregadoDetalheModal";

// =====================================================================
// NASCIMENTO FORMULÁRIOS - Respostas
// Resumo agregado por pergunta (contagem/percentual em barras para
// escolhas/escala; média para número; lista para texto), tabela de
// respostas individuais e exportação CSV.
// =====================================================================

interface Resposta {
  id: string; enviado_em: string;
  respondente_nome?: string | null; respondente_email?: string | null;
  setor?: string | null; respondente_cadastro?: Record<string, any> | null;
  duracao_seg?: number | null; criado_por?: string | null;
  itens: Record<string, any>;
}

const fmtDur = (s?: number | null) => { if (s == null) return "-"; const m = Math.floor(s / 60), ss = s % 60; return m ? `${m}m ${ss}s` : `${ss}s`; };

// Rótulos amigáveis do snapshot de cadastro (respondente_cadastro).
const CADASTRO_CAMPOS: { k: string; rotulo: string }[] = [
  { k: "nome", rotulo: "Nome" }, { k: "cpf", rotulo: "CPF" }, { k: "cargo", rotulo: "Cargo" },
  { k: "setor", rotulo: "Setor" }, { k: "perfil", rotulo: "Perfil" }, { k: "lider", rotulo: "Líder" },
  { k: "situacao", rotulo: "Situação" }, { k: "admissao", rotulo: "Admissão" },
  { k: "empresa", rotulo: "Empresa" }, { k: "filial", rotulo: "Filial" }, { k: "email", rotulo: "E-mail" },
];

const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "6px 12px", borderRadius: 9, border, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" });
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "15px 17px", boxShadow: "0 8px 24px rgba(15,23,42,.06)" };
const valorTexto = (v: any) => v == null || v === "" ? "-" : Array.isArray(v) ? v.join("; ") : String(v);

// Texto solto de resposta: itálico, peso normal.
const valorFonte: React.CSSProperties = { fontSize: 12.5, fontStyle: "italic", fontWeight: 500, color: "#0f172a" };
// Nome de gente casado com o cadastro: destaca do texto comum - reto, negrito
// e caixa alta (é assim que o nome vive na EMPREGADOS).
const nomeFonte: React.CSSProperties = { fontSize: 12.5, fontStyle: "normal", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" };
const btnMini = (bg: string, c: string, border: string): React.CSSProperties =>
  ({ padding: "3px 9px", borderRadius: 7, border, background: bg, color: c, fontSize: 10.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 });
const rotFiltro: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "#94a3b8", marginBottom: 4 };
const selFiltro: React.CSSProperties = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 10px", fontSize: 12.5, outline: "none", fontFamily: "inherit", background: "#fff", color: "#0f172a" };

// Como um texto de resposta deve aparecer: se é pessoa (bate com o cadastro ou
// foi vinculado à mão) e sob que nome. O vínculo manual troca o texto da
// resposta pelo nome completo do empregado ("Gerência Sistemas" vira
// "IURY DE JESUS SILVA"); `original` é sempre o que veio na resposta e é ele
// que abre a ficha (a ficha resolve o vínculo pelo texto original).
// `pendente`: o cadastro ainda está carregando, então NÃO dá p/ afirmar que o
// texto não é gente - a tela mostra "Verificando…" no lugar de "Vincular".
interface Pessoa { ehPessoa: boolean; exibir: string; original: string; pendente?: boolean }
type Resolver = (v: any) => Pessoa;

// Só a pergunta de IDENTIFICAÇÃO traz gente na resposta. Em toda outra, o que
// existe é alternativa ("Alto", "Muito comprometido") — tratar isso como nome
// fazia alternativa virar link de ficha e, pior, casar com lixo do cadastro
// (nomes de uma letra), trocando o rótulo da opção pelo nome de um empregado.
const SEM_PESSOA = (v: any): Pessoa => { const t = valorTexto(v); return { ehPessoa: false, exibir: t, original: t }; };
const resolverDaPergunta = (p: Pergunta, resolve: Resolver): Resolver =>
  p.tipo === "colaborador" ? resolve : SEM_PESSOA;

// Nome de empregado citado numa resposta: vira link p/ a ficha (👤). Se não
// bater com o cadastro, renderiza texto normal (mesma fonte).
function NomeLink({ texto, resolve, onPessoa }: { texto: string; resolve: Resolver; onPessoa: (n: string) => void }) {
  const { ehPessoa, exibir, original } = resolve(texto);
  if (!ehPessoa) return <span style={valorFonte}>{texto}</span>;
  return (
    <button onClick={() => onPessoa(original)}
      title={exibir !== original ? `Respondeu "${original}" — vinculado a ${exibir}` : "Ver ficha do colaborador"}
      style={{ ...nomeFonte, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 2 }}>
      👤 {exibir}
    </button>
  );
}

// Bloco pergunta → resposta da aba Individuais. Enunciado em cima como rótulo
// discreto, resposta embaixo com destaque: na mesma linha (o formato antigo),
// pergunta e resposta viravam um parágrafo só - os enunciados daqui têm
// parágrafos inteiros de instrução.
function BlocoResposta({ titulo, valor, resolve, onPessoa }: {
  titulo: string; valor: any; resolve: Resolver; onPessoa: (n: string) => void;
}) {
  const itens = Array.isArray(valor) ? valor.filter(v => v != null && v !== "") : [];
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 10, padding: "9px 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", lineHeight: 1.45, marginBottom: 4 }}>{titulo}</div>
      {itens.length > 1 ? (
        // Caixas de seleção: um item por linha, senão vira uma parede de ";".
        <ul style={{ margin: 0, paddingLeft: 15, display: "flex", flexDirection: "column", gap: 3 }}>
          {itens.map((v, i) => <li key={i} style={{ color: "#cbd5e1" }}><NomeLink texto={valorTexto(v)} resolve={resolve} onPessoa={onPessoa} /></li>)}
        </ul>
      ) : (
        <NomeLink texto={valorTexto(itens.length === 1 ? itens[0] : valor)} resolve={resolve} onPessoa={onPessoa} />
      )}
    </div>
  );
}

// Ação da linha: "Detalhes" abre a ficha de quem já casa com o cadastro;
// "Vincular" abre a mesma ficha no modo de amarrar o texto a um empregado
// (nome incompleto, grafia diferente...). Enquanto o cadastro não terminou de
// carregar não existe "não é gente": aí o rótulo é "Verificando…" — antes a
// tela abria dizendo "Vincular" p/ todo mundo e só corrigia depois do clique.
function BotaoFicha({ p, onPessoa }: { p: Pessoa; onPessoa: (n: string) => void }) {
  const rotulo = p.pendente ? "Verificando…" : p.ehPessoa ? "Detalhes" : "Vincular";
  return (
    <button onClick={() => onPessoa(p.original)}
      title={p.pendente ? "Conferindo o cadastro de empregados…" : p.ehPessoa ? "Ver ficha completa" : "Vincular este nome a um empregado"}
      style={p.ehPessoa
        ? btnMini("rgba(15,49,113,.08)", "#0f3171", "1px solid rgba(15,49,113,.2)")
        : btnMini("#fff", "#94a3b8", "1px solid #e2e8f0")}>
      {rotulo}
    </button>
  );
}

function LinhaValor({ texto, resolve, onPessoa }: { texto: string; resolve: Resolver; onPessoa: (n: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 8, padding: "6px 10px" }}>
      <div style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>
        <NomeLink texto={texto} resolve={resolve} onPessoa={onPessoa} />
      </div>
      <BotaoFicha p={resolve(texto)} onPessoa={onPessoa} />
    </div>
  );
}

// Um valor do resumo já agrupado: o mesmo nome citado por N respostas vira uma
// linha só com "(N respostas)". "Ver todos" abre as ocorrências mostrando QUEM
// respondeu e quando - o texto é igual, o que muda é a origem.
function GrupoValor({ texto, itens, resolve, onPessoa, quem, onVerRespostas }: {
  texto: string; itens: { v: any; r: Resposta }[];
  resolve: Resolver; onPessoa: (n: string) => void; quem: (r: Resposta) => string;
  onVerRespostas: (nome: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const n = itens.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 8, padding: "6px 10px" }}>
        <div style={{ flex: 1, minWidth: 0, wordBreak: "break-word", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <NomeLink texto={texto} resolve={resolve} onPessoa={onPessoa} />
          {n > 1 && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#eef2ff", color: "#4338ca", flexShrink: 0 }}>{n} respostas</span>}
        </div>
        {n > 1 && (
          <button onClick={() => setAberto(v => !v)} style={btnMini("#fff", "#0f3171", "1px solid rgba(15,49,113,.25)")}>
            {aberto ? "Ocultar" : "Ver todos"}
          </button>
        )}
        <BotaoFicha p={resolve(texto)} onPessoa={onPessoa} />
      </div>
      {aberto && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 12 }}>
          {itens.map((o, oi) => {
            const nomeQuem = quem(o.r);
            return (
              <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#64748b", background: "#fff", border: "1px solid #f1f5f9", borderRadius: 7, padding: "4px 9px" }}>
                {/* resolve: apelido vinculado ("Gerência X") vira o nome da pessoa e o link da ficha */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <NomeLink texto={nomeQuem} resolve={resolve} onPessoa={onPessoa} />
                  <span style={{ color: "#94a3b8" }}>{fmtDt(o.r.enviado_em)}</span>
                </div>
                {nomeQuem !== "Anônimo" && (
                  <button onClick={() => onVerRespostas(nomeQuem)} title="Abrir a aba Individuais filtrada neste participante"
                    style={btnMini("#fff", "#0f3171", "1px solid rgba(15,49,113,.25)")}>Ver respostas</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Barra de filtros - larga, alinhada com o cabeçalho (não com os cards, que
// são estreitos). Filtra Resumo, Individuais e o CSV de uma vez só.
export function FiltrosRespostas({ fResp, setFResp, opcoesResp, fSetor, setFSetor, opcoesSetor, fDe, setFDe, fAte, setFAte, filtrando, onLimpar }: {
  fResp: string; setFResp: (v: string) => void; opcoesResp: string[];
  fSetor: string; setFSetor: (v: string) => void; opcoesSetor: string[];
  fDe: string; setFDe: (v: string) => void; fAte: string; setFAte: (v: string) => void;
  filtrando: boolean; onLimpar: () => void;
}) {
  return (
    <div style={{ ...card, display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", padding: "12px 16px", margin: "14px 24px 0", borderRadius: 18, flexShrink: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", paddingBottom: 9 }}>Filtros:</span>
      <div style={{ flex: "1 1 190px", minWidth: 165 }}>
        <label style={rotFiltro}>Respondente</label>
        <select value={fResp} onChange={e => setFResp(e.target.value)} style={selFiltro}>
          <option value="">Todos os respondentes</option>
          {opcoesResp.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div style={{ flex: "1 1 190px", minWidth: 165 }}>
        <label style={rotFiltro}>Setor</label>
        <select value={fSetor} onChange={e => setFSetor(e.target.value)} style={selFiltro}>
          <option value="">Todos os setores</option>
          {opcoesSetor.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label style={rotFiltro}>Data de criação</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="date" value={fDe} max={fAte || undefined} onChange={e => setFDe(e.target.value)} style={{ ...selFiltro, width: 148 }} />
          <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>até</span>
          <input type="date" value={fAte} min={fDe || undefined} onChange={e => setFAte(e.target.value)} style={{ ...selFiltro, width: 148 }} />
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={onLimpar} disabled={!filtrando}
        style={{ ...btn("#fff", filtrando ? "#475569" : "#cbd5e1", "1px solid #e2e8f0"), cursor: filtrando ? "pointer" : "default", padding: "8px 14px" }}>
        ▽ Limpar filtros
      </button>
    </div>
  );
}

export default function FormularioRespostas() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { can, canVerSetor, canCriarSetor, soProprias, loading: permsLoading } = useFormPerms();
  const { empregado, loading: vincLoading } = useVinculoEmpregado();
  const [form, setForm] = useState<Formulario | null>(null);
  const [pergs, setPergs] = useState<Pergunta[]>([]);
  const [resps, setResps] = useState<Resposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"resumo" | "individuais">("resumo");
  const [fResp, setFResp] = useState("");    // filtro: respondente (nome exato)
  const [fSetor, setFSetor] = useState("");  // filtro: setor carimbado na resposta
  const [fDe, setFDe] = useState("");        // filtro: data de criação (yyyy-mm-dd)
  const [fAte, setFAte] = useState("");
  const [detalhe, setDetalhe] = useState<Resposta | null>(null);  // modal "Detalhes" do cadastro
  const [pessoa, setPessoa] = useState<string | null>(null);      // modal ficha do empregado (nome citado)
  const [nomesProntos, setNomesProntos] = useState(false);          // cadastro já veio inteiro? (antes disso não dá p/ dizer "Vincular")
  const [vinculos, setVinculos] = useState<Map<string, string>>(new Map()); // apelido -> nome do empregado (CS_FORM_VINCULOS)

  const load = useCallback(async () => {
    setLoading(true);
    const [fRes, rRes] = await Promise.all([
      (supabase as any).from("CS_FORMULARIOS").select("*").eq("id", id).single(),
      (supabase as any).from("CS_FORM_RESPOSTAS").select("*").eq("formulario_id", id).order("enviado_em", { ascending: false }),
    ]);
    setLoading(false);
    if (fRes.error) { nav("/app/central-servicos/formularios"); return; }
    setForm(fRes.data);
    setPergs(normalizaPerguntas(fRes.data.perguntas).filter(p => p.tipo !== "texto_info"));  // blocos de texto não são perguntas
    setResps((rRes.data ?? []).map((r: any) => ({ ...r, itens: r.itens ?? {} })));
  }, [id, nav]);
  useEffect(() => { load(); }, [load]);

  // Monta em segundo plano o índice que a ficha do empregado consome. Quem abre
  // esta tela vai clicar em nome — quando clicar, não deve haver nada a esperar.
  useEffect(() => { prewarmFichas(); }, []);

  // Nomes do cadastro só para saber quais valores de resposta são pessoas de
  // verdade (viram link p/ a ficha). Best-effort: se falhar, ninguém fica
  // clicável, mas a tela abre.
  //
  // Vem do MESMO cache que a ficha usa (`nomesDoCadastro`, via RPC). Antes esta
  // tela varria a EMPREGADOS inteira pelo PostgREST em blocos de 1000 — pagando
  // RLS por linha —, e era isso que deixava a lista inteira em "Verificando…"
  // por muito tempo, competindo com a consulta da própria ficha.
  const carregarNomes = useCallback(async () => {
    setNomesProntos(false);
    const [, vincs] = await Promise.all([nomesDoCadastro(), carregarVinculos()]);
    setVinculos(vincs);
    setNomesProntos(true);
  }, []);
  useEffect(() => { carregarNomes(); }, [carregarNomes]);

  // Pessoa = bate com o cadastro OU foi vinculada à mão (nome incompleto etc.).
  // O vínculo manual manda no nome exibido: quem vinculou "Gerência Sistemas" a
  // IURY DE JESUS SILVA quer ver o nome dele, não o texto que veio na resposta.
  //
  // O casamento usa a MESMA regra da ficha (`resolveCadastro`), incluindo nome
  // contido: "Mileny de oliveira" aparecia como "Vincular" na lista e abria a
  // ficha da MILENY DE OLIVEIRA DA ROSA — a lista exigia igualdade exata e a
  // ficha não. Nome ambíguo (casa com várias pessoas) continua pedindo vínculo
  // manual: melhor perguntar do que pôr em negrito o nome errado.
  const resolve = useCallback((v: any): Pessoa => {
    const original = v == null ? "" : String(v);
    const n = normNome(v);
    const vinculado = n ? vinculos.get(n) : undefined;
    if (vinculado !== undefined) return { ehPessoa: true, exibir: vinculado || original, original };
    if (n && nomesProntos) {
      const { hit, ambiguo } = resolveCadastro(n);
      if (hit && !ambiguo) return { ehPessoa: true, exibir: hit.nome, original };
    }
    return { ehPessoa: false, exibir: original, original, pendente: !nomesProntos };
  }, [vinculos, nomesProntos]);

  // Qual pergunta diz QUEM respondeu. A config do formulário manda; sem ela,
  // deduz pelo TÍTULO primeiro e só depois pelo tipo: um formulário costuma ter
  // várias perguntas do tipo "colaborador" (no Feedback Guiado, a #1 é a
  // liderança que conduz e a #2 é quem respondeu) — indo pelo tipo pegaríamos a
  // liderança. "Identificação..." é o sinal forte de quem respondeu.
  const perguntaNomeId = useMemo(() => {
    if (form?.pergunta_nome_id) return form.pergunta_nome_id;
    const porTitulo = pergs.find(p => /identifica[çc]|nome complet|^\s*nome\s*$/i.test(p.titulo || ""));
    if (porTitulo) return porTitulo.id;
    const porTipo = pergs.find(p => p.tipo === "colaborador");
    return porTipo?.id ?? null;
  }, [form?.pergunta_nome_id, pergs]);

  // Quem respondeu: o nome gravado na resposta ou, quando ela veio sem nome
  // (importada), o valor da pergunta que identifica o respondente.
  const nomeRespondente = useCallback((r: Resposta): string => {
    const gravado = (r.respondente_nome ?? "").trim();
    if (gravado) return gravado;
    const v = perguntaNomeId ? r.itens[perguntaNomeId] : null;
    const txt = Array.isArray(v) ? (v[0] != null ? String(v[0]) : "") : (v != null ? String(v) : "");
    return txt.trim() || "Anônimo";
  }, [perguntaNomeId]);

  // Nome do empregado vinculado ao login. É por ele que "só as próprias" casa as
  // MINHAS respostas: elas vêm do link público (sem criado_por), então quem
  // respondeu se identificou pelo nome do cadastro, não pelo dono da linha.
  const meuNome = useMemo(() => normNome(empregado?.nome ?? ""), [empregado]);

  // Recorte de visibilidade — espelha a RLS (cs_form_resp_select), como defesa
  // em profundidade: a RLS continua sendo a autoridade, mas a tela mostra só o
  // que a permissão do usuário libera, mesmo que a RLS devolva mais por estar
  // defasada (era isso que fazia "ver por setor = RH" mostrar todo mundo).
  //   • ver_tudo, ou dono do setor do formulário (criar_setor) → todas;
  //   • ver_proprias → as que EU enviei (criado_por meu OU eu sou o respondente
  //     vinculado);
  //   • ver_setor → só as carimbadas com um setor que me foi liberado (o
  //     Setor_ERP de quem respondeu, gravado em CS_FORM_RESPOSTAS.setor).
  const respsEscopo = useMemo(() => {
    if (!user) return [];
    if (can("ver_tudo") || (form && canCriarSetor((form as any).setor))) return resps;
    return resps.filter(r =>
      (can("ver_proprias") && (
        (!!r.criado_por && r.criado_por === user.id) ||
        (!!meuNome && normNome(nomeRespondente(r)) === meuNome)
      ))
      || canVerSetor(r.setor));
  }, [resps, user, form, can, canVerSetor, canCriarSetor, meuNome, nomeRespondente]);

  // Opções dos filtros: saem das próprias respostas (só o que existe aparece).
  const opcoesResp = useMemo(
    () => [...new Set(respsEscopo.map(r => nomeRespondente(r)).filter(n => n && n !== "Anônimo"))].sort(),
    [respsEscopo, nomeRespondente]);
  const opcoesSetor = useMemo(() => [...new Set(respsEscopo.map(r => (r.setor ?? "").trim()).filter(Boolean))].sort(), [respsEscopo]);
  // Respostas filtradas alimentam AS DUAS abas (resumo e individuais) e o CSV.
  // Data: intervalo fechado nas duas pontas - "até 31/05" inclui o dia 31
  // inteiro (por isso o fim do dia, não 00:00).
  const respsFiltradas = useMemo(() => {
    const de = fDe ? new Date(`${fDe}T00:00:00`).getTime() : null;
    const ate = fAte ? new Date(`${fAte}T23:59:59.999`).getTime() : null;
    return respsEscopo.filter(r => {
      if (fResp && nomeRespondente(r) !== fResp) return false;
      if (fSetor && (r.setor ?? "").trim() !== fSetor) return false;
      if (de != null || ate != null) {
        const t = new Date(r.enviado_em).getTime();
        if (isNaN(t)) return false;
        if (de != null && t < de) return false;
        if (ate != null && t > ate) return false;
      }
      return true;
    });
  }, [respsEscopo, fResp, fSetor, fDe, fAte, nomeRespondente]);
  const filtrando = !!(fResp || fSetor || fDe || fAte);
  const limparFiltros = () => { setFResp(""); setFSetor(""); setFDe(""); setFAte(""); };

  const exportCsv = () => {
    if (!form) return;
    const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const cab = ["Enviado em", "Nome", "E-mail", ...pergs.map(p => p.titulo)];
    const linhas = respsFiltradas.map(r => [
      fmtDt(r.enviado_em), nomeRespondente(r), r.respondente_email ?? "",
      ...pergs.map(p => valorTexto(r.itens[p.id])),
    ]);
    const csv = "﻿" + [cab, ...linhas].map(l => l.map(esc).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `respostas-${form.slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const excluirResp = async (r: Resposta) => {
    if (!confirm("Excluir esta resposta?")) return;
    await (supabase as any).from("CS_FORM_RESPOSTAS").delete().eq("id", r.id);
    invalidarFichas();   // a resposta some das participações da ficha
    load();
  };

  if (loading || !form || permsLoading || vincLoading) return <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Carregando...</div>;
  const sit = situacao(form, resps.length);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, flexWrap: "wrap" }}>
        <button onClick={() => nav("/app/central-servicos/formularios")} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>← Voltar</button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171" }}>📊 {form.titulo}</div>
          <div style={{ fontSize: 11.5, color: "#94a3b8" }}><b style={{ color: "#0f172a" }}>{respsEscopo.length}</b> resposta(s){form.max_respostas != null ? ` · limite ${form.max_respostas}` : ""} · <span style={{ color: sit.c, fontWeight: 700 }}>{sit.rotulo}</span></div>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
          {(["resumo", "individuais"] as const).map(a => (
            <button key={a} onClick={() => setAba(a)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: aba === a ? "#fff" : "transparent", color: aba === a ? "#0f3171" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: aba === a ? "0 2px 6px rgba(15,23,42,.08)" : "none" }}>
              {a === "resumo" ? "Resumo" : "Individuais"}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} disabled={!respsFiltradas.length} style={btn(respsFiltradas.length ? "#16a34a" : "#94a3b8")}>⬇ Exportar CSV</button>
      </div>

      {respsEscopo.length > 0 && (
        <FiltrosRespostas
          fResp={fResp} setFResp={setFResp} opcoesResp={opcoesResp}
          fSetor={fSetor} setFSetor={setFSetor} opcoesSetor={opcoesSetor}
          fDe={fDe} setFDe={setFDe} fAte={fAte} setFAte={setFAte}
          filtrando={filtrando} onLimpar={limparFiltros} />
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {respsEscopo.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#94a3b8", padding: 50 }}>{soProprias ? "Você ainda não enviou nenhuma resposta a este formulário." : "Nenhuma resposta ainda. Compartilhe a URL pública do formulário."}</div>
          ) : respsFiltradas.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#94a3b8", padding: 40 }}>
              Nenhuma resposta bate com o filtro. <button onClick={limparFiltros} style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}>Limpar filtros</button>
            </div>
          ) : aba === "resumo" ? (
            // resolverDaPergunta: só pergunta do tipo "colaborador" vira nome do
            // cadastro. Sem isso, rótulos curtos de opção casavam com empregado
            // ("Bom" virava "NATALEN SOARES BOM…", "N" virava gente).
            pergs.map((p, i) => <ResumoPergunta key={p.id} p={p} i={i} resps={respsFiltradas} resolve={resolverDaPergunta(p, resolve)} onPessoa={setPessoa} quem={nomeRespondente}
              onVerRespostas={(n) => { setFResp(n); setAba("individuais"); }} />)
          ) : (
            respsFiltradas.map(r => {
              const quem = nomeRespondente(r);
              return (
              <div key={r.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                    {quem !== "Anônimo" && resolve(quem).ehPessoa
                      ? <NomeLink texto={quem} resolve={resolve} onPessoa={setPessoa} />
                      : quem}
                  </span>
                  {r.respondente_email && <span style={{ fontSize: 11.5, color: "#64748b" }}>{r.respondente_email}</span>}
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDt(r.enviado_em)}</span>
                  {r.setor && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#eef2ff", color: "#4338ca" }}>{r.setor}</span>}
                  {r.duracao_seg != null && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f1f5f9", color: "#64748b" }}>⏱ {fmtDur(r.duracao_seg)}</span>}
                  <div style={{ flex: 1 }} />
                  {r.respondente_cadastro && <button onClick={() => setDetalhe(r)} style={btn("rgba(15,49,113,.08)", "#0f3171", "1px solid rgba(15,49,113,.2)")}>👤 Detalhes</button>}
                  <button onClick={() => excluirResp(r)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>Excluir</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pergs.map(p => {
                    const anexo = r.itens[`${p.id}__anexo`];
                    return (
                      <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <BlocoResposta titulo={p.titulo} valor={r.itens[p.id]} resolve={resolverDaPergunta(p, resolve)} onPessoa={setPessoa} />
                        {anexo && (
                          <a href={anexo} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "#0369a1", textDecoration: "none", background: "#f0f7ff", border: "1px solid #dbeafe", borderRadius: 8, padding: "5px 10px" }}>📎 Baixar anexo{r.itens[`${p.id}__anexo_nome`] ? ` — ${r.itens[`${p.id}__anexo_nome`]}` : ""}</a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Detalhes - cadastro do respondente (snapshot no momento da resposta) */}
      {detalhe && detalhe.respondente_cadastro && (
        <div onClick={() => setDetalhe(null)} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 22, width: 520, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setDetalhe(null)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171", marginBottom: 2 }}>👤 {detalhe.respondente_cadastro.nome || detalhe.respondente_nome || "Respondente"}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>Dados completos do cadastro no momento da resposta</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ background: "#eef6ff", border: "1px solid #dbeafe", borderRadius: 10, padding: "6px 11px", fontSize: 12 }}><span style={{ color: "#94a3b8", fontWeight: 700 }}>🕒 Respondido em: </span><span style={{ color: "#0f172a", fontWeight: 700 }}>{fmtDt(detalhe.enviado_em)}</span></div>
              <div style={{ background: "#eef6ff", border: "1px solid #dbeafe", borderRadius: 10, padding: "6px 11px", fontSize: 12 }}><span style={{ color: "#94a3b8", fontWeight: 700 }}>⏱ Tempo de resposta: </span><span style={{ color: "#0f172a", fontWeight: 700 }}>{fmtDur(detalhe.duracao_seg)}</span></div>
              {detalhe.setor && <div style={{ background: "#eef2ff", border: "1px solid #e0e7ff", borderRadius: 10, padding: "6px 11px", fontSize: 12 }}><span style={{ color: "#94a3b8", fontWeight: 700 }}>Setor: </span><span style={{ color: "#4338ca", fontWeight: 700 }}>{detalhe.setor}</span></div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CADASTRO_CAMPOS.map(({ k, rotulo }) => {
                const v = detalhe.respondente_cadastro?.[k];
                return v ? (
                  <div key={k} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "8px 11px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px" }}>{rotulo}</div>
                    <div style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 600, marginTop: 2, wordBreak: "break-word" }}>{String(v)}</div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ficha do empregado - dados AO VIVO da EMPREGADOS + formulários que participou.
          onVinculado: acabou de amarrar um nome solto a um empregado -> recarrega
          os nomes p/ o texto virar link aqui na hora. */}
      {pessoa && <EmpregadoDetalheModal nome={pessoa} onClose={() => setPessoa(null)} onVinculado={carregarNomes} />}
    </div>
  );
}

function ResumoPergunta({ p, i, resps, resolve, onPessoa, quem, onVerRespostas }: { p: Pergunta; i: number; resps: Resposta[]; resolve: Resolver; onPessoa: (n: string) => void; quem: (r: Resposta) => string; onVerRespostas: (nome: string) => void }) {
  const valores = useMemo(() => resps.map(r => r.itens[p.id]).filter(v => v != null && v !== "" && !(Array.isArray(v) && v.length === 0)), [resps, p.id]);

  // Ocorrências com a resposta de origem (o valor sozinho perde "quem disse").
  // Arrays (caixas de seleção) viram uma ocorrência por item.
  const ocorrencias = useMemo(() => {
    const out: { v: any; r: Resposta }[] = [];
    resps.forEach(r => {
      const v = r.itens[p.id];
      if (v == null || v === "") return;
      (Array.isArray(v) ? v : [v]).forEach(x => { if (x != null && x !== "") out.push({ v: x, r }); });
    });
    return out;
  }, [resps, p.id]);

  // Agrupa pela IDENTIDADE resolvida, não pelo texto cru: grafias diferentes
  // vinculadas à mesma pessoa ("Iury", "Gerência Sistemas") juntam-se ao nome
  // canônico numa linha só — antes cada grafia virava uma linha duplicada.
  const grupos = useMemo(() => {
    const m = new Map<string, { texto: string; itens: { v: any; r: Resposta }[] }>();
    ocorrencias.forEach(o => {
      const texto = valorTexto(o.v);
      const pess = resolve(texto);
      const rotulo = pess.ehPessoa ? pess.exibir : texto;   // mostra o nome do cadastro
      const chave = normNome(rotulo) || rotulo;
      const g = m.get(chave);
      if (g) g.itens.push(o); else m.set(chave, { texto: rotulo, itens: [o] });
    });
    return [...m.values()];
  }, [ocorrencias, resolve]);

  const conteudo = useMemo(() => {
    if (["multipla_escolha", "caixas_selecao", "lista_suspensa", "escala"].includes(p.tipo)) {
      const cont: Record<string, number> = {};
      let total = 0;
      valores.forEach(v => (Array.isArray(v) ? v : [v]).forEach(x => { cont[String(x)] = (cont[String(x)] || 0) + 1; total++; }));
      let chaves: string[];
      if (p.tipo === "escala") {
        const min = p.config?.min ?? 1, max = p.config?.max ?? 5;
        chaves = []; for (let n = min; n <= max; n++) chaves.push(String(n));
      } else chaves = p.opcoes.length ? p.opcoes : Object.keys(cont);
      const media = p.tipo === "escala" && valores.length
        ? (valores.reduce((s, v) => s + Number(v), 0) / valores.length).toFixed(1) : null;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {media && <div style={{ fontSize: 13, color: "#0f3171", fontWeight: 800 }}>Média: {media}</div>}
          {chaves.map(k => {
            const n = cont[k] || 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "#0f172a", width: 180, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={k}>
                  <NomeLink texto={k} resolve={resolve} onPessoa={onPessoa} />
                </span>
                <div style={{ flex: 1, height: 18, background: "#f1f5f9", borderRadius: 9, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "#0f3171", borderRadius: 9, transition: "width .3s" }} />
                </div>
                <span style={{ fontSize: 12, color: "#64748b", width: 76, textAlign: "right", flexShrink: 0 }}>{n} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      );
    }
    if (p.tipo === "numero") {
      const ns = valores.map(Number).filter(n => !isNaN(n));
      if (!ns.length) return <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Sem respostas numéricas.</div>;
      const soma = ns.reduce((s, n) => s + n, 0);
      return <div style={{ fontSize: 13, color: "#0f172a" }}>Média <b>{(soma / ns.length).toFixed(2)}</b> · Mín <b>{Math.min(...ns)}</b> · Máx <b>{Math.max(...ns)}</b> · Soma <b>{soma}</b></div>;
    }
    // texto/data: lista agrupada (nome repetido vira 1 linha + contagem)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 300, overflowY: "auto" }}>
        {grupos.map((g, gi) => (
          <GrupoValor key={gi} texto={g.texto} itens={g.itens} resolve={resolve} onPessoa={onPessoa} quem={quem} onVerRespostas={onVerRespostas} />
        ))}
      </div>
    );
  }, [p, valores, grupos, resolve, onPessoa, quem, onVerRespostas]);

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{i + 1}. {p.titulo}</div>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>{valores.length} de {resps.length} responderam</div>
      {conteudo}
    </div>
  );
}
