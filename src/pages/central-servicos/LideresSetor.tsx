import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// =====================================================================
// NASCIMENTO FORMULÁRIOS — LÍDERES POR SETOR
//
// Em EMPREGADOS a coluna LIDER guarda o NÍVEL HIERÁRQUICO da pessoa
// (CEO, DIREÇÃO, GERENTE, SUPERVISOR…) — NÃO o nome do líder dela.
// Então "Setor_ERP = COMPRAS" + "LIDER = GERENTE" quer dizer: essa pessoa
// é a gerente do Compras.
//
// O líder de um setor é quem tem o MAIOR nível dentro dele. Onde a regra
// não decide (empate, setor sem ninguém com nível), fixa-se à mão e o
// ajuste fica em CS_LIDERES_SETOR.
//
// ACIMA do setor ficam os diretores: quem cuida de quais setores NÃO está no
// cadastro (é decisão de gestão), então fica em RH_SETOR_DIRETOR.
// =====================================================================

// Do mais alto para o mais baixo. Ordem = hierarquia (confirmada pelo RH em
// jul/2026). ADMIN está acima de tudo; LÍDER fica no fim — se não existir de
// fato na coluna, é inofensivo (ninguém casa), e mantê-lo evita rebaixar
// alguém real por engano.
export const NIVEIS = ["ADMIN", "CEO", "DIREÇÃO", "PRESIDÊNCIA", "DIRETOR", "GERENTE", "COORDENADOR", "SUPERVISOR", "ENCARREGADO", "LÍDER"];

const semAcento = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const normNivel = (s: string) => semAcento(s).replace(/\s+/g, " ");
const NIVEIS_NORM = NIVEIS.map(normNivel);

/** Posição na hierarquia: 0 = mais alto. -1 quando o valor não é um nível conhecido. */
export function rankNivel(lider: string | null | undefined): number {
  const n = normNivel(lider ?? "");
  if (!n) return -1;
  return NIVEIS_NORM.indexOf(n);
}
export const ehNivel = (lider: string | null | undefined) => rankNivel(lider) >= 0;

export interface Empregado { id: number; nome: string; setor: string; nivel: string; cargo: string; situacao: string; perfil: string }
export interface LiderSetor {
  setor: string;
  lider: Empregado | null;
  origem: "manual" | "cadastro" | "nenhum";
  empatados: Empregado[];       // mesmo nível, quando o cadastro não desempata
  observacao?: string | null;
}

/**
 * Resolve o líder de cada setor: ajuste manual manda; senão, maior nível do
 * cadastro. Empate no topo NÃO escolhe sozinho — devolve os candidatos, para
 * a tela pedir decisão em vez de eleger alguém no desempate alfabético.
 */
export function resolveLideres(emps: Empregado[], overrides: Map<string, { id: number; obs?: string | null }>): LiderSetor[] {
  // Só setor de verdade tem líder — ver `ehSetorReal` (fora: PADRAO, níveis
  // como PRESIDÊNCIA/ENCARREGADO e cargos DIRETOR *).
  const setores = [...new Set(emps.map(e => e.setor).filter(Boolean))]
    .filter(ehSetorReal)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  return setores.map(setor => {
    const doSetor = emps.filter(e => e.setor === setor);
    const ov = overrides.get(setor);
    if (ov) {
      const alvo = emps.find(e => e.id === ov.id) ?? null;
      if (alvo) return { setor, lider: alvo, origem: "manual" as const, empatados: [], observacao: ov.obs };
      // Override apontando p/ alguém que saiu do cadastro: cai para a regra.
    }
    const comNivel = doSetor.filter(e => ehNivel(e.nivel));
    if (!comNivel.length) return { setor, lider: null, origem: "nenhum" as const, empatados: [] };
    const melhor = Math.min(...comNivel.map(e => rankNivel(e.nivel)));
    const topo = comNivel.filter(e => rankNivel(e.nivel) === melhor);
    return topo.length === 1
      ? { setor, lider: topo[0], origem: "cadastro" as const, empatados: [] }
      : { setor, lider: null, origem: "nenhum" as const, empatados: topo };
  });
}

// Linha crua da RPC rh_hierarquia_dados (inclui o contrato/local).
export interface HierRow { id: number; nome: string; setor: string; nivel: string; cargo: string; local: string; situacao: string; perfil: string }

// Faz uma promise (ex.: consulta) falhar com mensagem se passar do tempo, em
// vez de deixar a tela presa em "Carregando…" pra sempre.
function comTimeout<T>(p: PromiseLike<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms)),
  ]);
}

/**
 * Lê a hierarquia pela RPC rh_hierarquia_dados (server-side, SECURITY DEFINER —
 * sem custo de RLS por linha, que estourava o statement_timeout na leitura
 * direta). PAGINADO: o PostgREST deste app corta QUALQUER resposta em 1000
 * linhas — inclusive as de RPC —, então sem paginar metade do cadastro some
 * (foi o que sumiu o "YURI ROSA", gerente de Controladoria além da linha 1000).
 * Dedup por ID protege de sobreposição entre páginas.
 */
export async function carregaHierarquiaDados(): Promise<HierRow[]> {
  const bloco = 1000; const byId = new Map<number, HierRow>();
  for (let de = 0; ; de += bloco) {
    // .order("id"): pagina de forma determinística. Sem ordenar, um UPDATE no
    // cadastro (ex.: mudar o setor de alguém) reordena o heap entre as páginas
    // e a paginação por offset pula/repete linhas.
    const q = (supabase as any).rpc("rh_hierarquia_dados").order("id", { ascending: true }).range(de, de + bloco - 1);
    // <any>: o builder do supabase vem tipado como `any`, e sem a anotação o
    // genérico infere `{}` — data/error somem e o TS reclama.
    const { data, error } = await comTimeout<any>(q, 45000,
      "A leitura do cadastro demorou demais (timeout). Pode ser lentidão do banco — tente de novo.");
    if (error) throw error;
    const linhas: any[] = data ?? [];
    let novos = 0;
    for (const r of linhas) {
      const id = Number(r.id); if (byId.has(id)) continue;
      byId.set(id, {
        id,
        nome: String(r.nome ?? "").trim(),
        setor: String(r.setor ?? "").trim(),
        nivel: String(r.nivel ?? "").trim(),
        cargo: String(r.cargo ?? "").trim(),
        local: String(r.local_desc ?? "").trim(),
        situacao: String(r.situacao ?? "").trim(),
        // Vazio até a migration 20260724000001 rodar no banco do app — quem usa
        // o perfil trata a ausência, não quebra.
        perfil: String(r.perfil ?? "").trim(),
      });
      novos++;
    }
    if (linhas.length < bloco || novos === 0) break;
  }
  return [...byId.values()];
}

export async function carregaEmpregados(): Promise<Empregado[]> {
  return (await carregaHierarquiaDados()).map(({ local, ...e }) => e);
}

// Setor comparável entre cadastro (Setor_ERP) e resposta (que pode vir com
// caixa/acento diferente): normaliza dos dois lados.
export const normSetor = (s: string | null | undefined) => semAcento(s ?? "").replace(/\s+/g, " ");
// "Ativo" = ainda NA empresa, não necessariamente trabalhando hoje. Férias,
// atestado, licença, afastamento são temporários — a pessoa continua empregada
// e continua liderando o setor. Só saída de verdade (demissão, desligamento,
// rescisão, aposentadoria) tira da hierarquia. Mesma régua do `eh_saida` da
// v_rh_colaboradores. (Antes só valia TRABALHANDO/ATIVO, o que derrubava um
// gerente de férias — foi o caso da Carol em FINANCEIRO.)
export const ehAtivoSit = (situacao: string | null | undefined) => !/DEMIT|DESLIG|RESCIS|APOSENT/.test(semAcento(situacao ?? ""));

// Setor DE VERDADE. O Setor_ERP carrega valores que não são setor nenhum:
//   • "PADRAO" — placeholder de quem não tem setor;
//   • "PRESIDÊNCIA", "ENCARREGADO" — são NÍVEIS da hierarquia, não áreas;
//   • "DIRETOR ADMINISTRATIVO" / "DIRETOR OPERACIONAL" — são CARGOS.
// A presidente cuida da empresa toda e o diretor responde POR setores (RH,
// Financeiro…); nenhum dos dois É um setor. Em vez de listar exceção por
// exceção, a regra é: se o valor for um nível da hierarquia (ou um cargo de
// diretor), não é setor. Ficam fora das listas e dos rankings.
export const ehSetorReal = (setor: string | null | undefined) => {
  const s = normSetor(setor);
  if (!s || s === "PADRAO") return false;
  if (/^DIRETOR\b/.test(s)) return false;
  return !NIVEIS_NORM.includes(s);
};

// Nome comparável (sem acento, sem espaço duplo) — para saber se duas
// referências são a mesma pessoa.
export const normNome = (s: string | null | undefined) => semAcento(s ?? "").replace(/\s+/g, " ").trim();

// ── Quem é ESPERADO responder ao feedback ────────────────────────────
// Régua definida pelo RH (jul/2026): Perfil_ERP = ADMINISTRATIVO e Situação =
// Trabalhando. O resto do quadro não participa do ciclo.
//
// Repare que aqui a situação é ESTRITA, diferente de `ehAtivoSit`: para liderar
// um setor, quem está de férias continua valendo; para ser cobrado por um
// feedback no período, não — a pessoa não estava trabalhando.
export const PERFIL_ESPERADO = "ADMINISTRATIVO";
export const ehPerfilEsperado = (perfil: string | null | undefined) => semAcento(perfil ?? "") === PERFIL_ESPERADO;
export const ehTrabalhando = (situacao: string | null | undefined) => semAcento(situacao ?? "").startsWith("TRABALH");
const ativo = (e: Empregado) => ehAtivoSit(e.situacao);

/**
 * Mapa setor→nome do líder, para as telas de feedback puxarem o líder
 * automaticamente. Leve de propósito: só carrega quem TEM nível (a maioria
 * dos empregados tem LIDER vazio), não o cadastro inteiro — a aba precisa
 * abrir instantâneo.
 *
 * Regra igual à da tela: maior nível dentro do Setor_ERP; empate no topo não
 * elege ninguém (fica de fora até alguém fixar à mão); ajuste manual
 * (CS_LIDERES_SETOR) sobrepõe. Só gente ativa conta.
 */
export async function carregaLiderSetorMap(): Promise<Map<string, string>> {
  return (await carregaCadastro()).liderPorSetor;
}

/**
 * Uma leitura só do cadastro, com tudo que as telas gerenciais pedem: a lista
 * de empregados, quem lidera cada setor e qual diretor responde por ele.
 *
 * Junto de propósito: ler EMPREGADOS custa ~13 chamadas paginadas, e o Painel
 * Gerencial precisava dos três ao mesmo tempo — buscar separado dobrava a
 * espera da tela mais pesada do módulo.
 */
export async function carregaCadastro(): Promise<{
  emps: Empregado[];
  liderPorSetor: Map<string, string>;
  diretorPorSetor: Map<string, string>;
  ceo: string;
}> {
  const [emps, ovRes, dirRes] = await Promise.all([
    carregaEmpregados(),   // via RPC — não estoura o timeout
    (supabase as any).from("CS_LIDERES_SETOR").select("setor, empregado_nome"),
    (supabase as any).from("RH_SETOR_DIRETOR").select("setor, diretor_nome"),
  ]);
  const porSetor = new Map<string, { nome: string; rank: number; empate: boolean }>();
  emps.forEach(e => {
    if (!ehNivel(e.nivel) || !e.setor || !ehAtivoSit(e.situacao)) return;
    const rk = rankNivel(e.nivel), k = normSetor(e.setor), cur = porSetor.get(k);
    if (!cur || rk < cur.rank) porSetor.set(k, { nome: e.nome, rank: rk, empate: false });
    else if (rk === cur.rank) cur.empate = true;
  });
  const liderPorSetor = new Map<string, string>();
  porSetor.forEach((v, k) => { if (!v.empate && v.nome) liderPorSetor.set(k, v.nome); });
  // Ajuste manual manda: sobrepõe o automático (inclusive desempata).
  (ovRes.data ?? []).forEach((o: any) => { if (o?.empregado_nome) liderPorSetor.set(normSetor(o.setor), String(o.empregado_nome).trim()); });
  const diretorPorSetor = new Map<string, string>();
  (dirRes.data ?? []).forEach((d: any) => { if (d?.diretor_nome) diretorPorSetor.set(normSetor(d.setor), String(d.diretor_nome).trim()); });
  // Topo da casa (ADMIN/CEO): último degrau quando nem líder nem diretor servem.
  const ceo = emps
    .filter(e => ehAtivoSit(e.situacao) && rankNivel(e.nivel) >= 0 && rankNivel(e.nivel) <= rankNivel("CEO"))
    .sort((a, b) => rankNivel(a.nivel) - rankNivel(b.nivel))[0]?.nome ?? "";
  return { emps, liderPorSetor, diretorPorSetor, ceo };
}

export interface MapasHier {
  liderPorSetor: Map<string, string>;
  diretorPorSetor: Map<string, string>;
  ceo: string;
}

/**
 * Quem responde POR uma pessoa, subindo a hierarquia — NUNCA ela mesma.
 * Líder do setor → se for a própria pessoa, o diretor do setor → senão o CEO.
 * (O formulário tem uma pergunta de colaborador só; usá-la como "liderança"
 * fazia todo mundo virar líder de si próprio.)
 */
export function liderAcimaDe(nome: string, setor: string | null | undefined, m: MapasHier): string {
  const p = normNome(nome), k = normSetor(setor);
  const lider = m.liderPorSetor.get(k) ?? "";
  if (lider && normNome(lider) !== p) return lider;
  const diretor = m.diretorPorSetor.get(k) ?? "";
  if (diretor && normNome(diretor) !== p) return diretor;
  return m.ceo && normNome(m.ceo) !== p ? m.ceo : "";
}

// Traduz erros de gravação em algo acionável — os dois que mais aparecem aqui
// são "tabela ainda não existe" (migration não aplicada / schema cache velho) e
// "RLS bloqueou" (falta capacidade). Exportada para as duas telas usarem.
export function msgErroGravacao(e: any, tabela: string, migration: string): string {
  const m = String(e?.message ?? e ?? "");
  if (new RegExp(`${tabela}|schema cache|does not exist|could not find`, "i").test(m))
    return `Não consegui gravar em ${tabela}. Falta aplicar a migration ${migration} no banco do app (ou o PostgREST não recarregou o schema — rode NOTIFY pgrst, 'reload schema').`;
  if (/row-level security|violates row-level|permission denied/i.test(m))
    return "Sem permissão para gravar (RLS). Sua conta precisa da capacidade de administração do módulo.";
  if (/statement timeout|canceling statement/i.test(m))
    return "A gravação estourou o tempo limite do banco. Tente de novo.";
  return m || "Falha desconhecida ao gravar.";
}

// ── estilos ──────────────────────────────────────────────────────────
const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "7px 13px", borderRadius: 9, border, background: bg, color: c, fontSize: 12.5, fontWeight: 700, cursor: "pointer" });
const inp: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", color: "#0f172a", boxSizing: "border-box" };
const cardBox: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)" };
const th: React.CSSProperties = { padding: "8px 8px", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".4px", color: "#94a3b8", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #eef2f7" };
const td: React.CSSProperties = { padding: "9px 8px", fontSize: 12, color: "#475569", borderTop: "1px solid #f5f7fb" };
const nInt = (n: number) => n.toLocaleString("pt-BR");

function Chip({ texto, cor }: { texto: string; cor: string }) {
  return <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: cor + "1a", color: cor, whiteSpace: "nowrap" }}>{texto}</span>;
}
function Kpi({ titulo, valor, cor, sub }: { titulo: string; valor: string; cor: string; sub: string }) {
  return (
    <div style={cardBox}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{titulo}</div>
      <div style={{ fontSize: 25, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>{valor}</div>
      <div style={{ fontSize: 10.5, color: cor, fontWeight: 700 }}>{sub}</div>
    </div>
  );
}

// ── Modal: escolher o líder de um setor à mão ────────────────────────
function ModalEscolher({ alvo, emps, onFechar, onSalvo }: {
  alvo: LiderSetor; emps: Empregado[]; onFechar: () => void; onSalvo: () => void | Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<number | null>(alvo.lider?.id ?? null);
  const [obs, setObs] = useState(alvo.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Prioriza quem é do setor; a busca alcança o resto (líder de fora acontece).
  const lista = useMemo(() => {
    const q = semAcento(busca);
    const doSetor = emps.filter(e => e.setor === alvo.setor);
    const base = q ? emps.filter(e => semAcento(e.nome).includes(q)) : doSetor;
    return [...base].sort((a, b) =>
      (a.setor === alvo.setor ? 0 : 1) - (b.setor === alvo.setor ? 0 : 1) ||
      (rankNivel(a.nivel) < 0 ? 99 : rankNivel(a.nivel)) - (rankNivel(b.nivel) < 0 ? 99 : rankNivel(b.nivel)) ||
      a.nome.localeCompare(b.nome, "pt-BR")
    ).slice(0, 60);
  }, [busca, emps, alvo.setor]);

  const salvar = async () => {
    if (sel == null) { setErro("Escolha uma pessoa."); return; }
    setSalvando(true); setErro(null);
    try {
      const p = emps.find(e => e.id === sel);
      const { error } = await (supabase as any).from("CS_LIDERES_SETOR")
        .upsert({ setor: alvo.setor, empregado_id: sel, empregado_nome: p?.nome ?? null, observacao: obs.trim() || null }, { onConflict: "setor" });
      if (error) throw error;
      await onSalvo();
      onFechar();
    } catch (e: any) {
      console.error("Fixar líder falhou:", e);
      setErro(msgErroGravacao(e, "CS_LIDERES_SETOR", "20260721000003"));
    } finally {
      setSalvando(false);   // nunca deixa o botão travado em "Salvando…"
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
      style={{ position: "fixed", inset: 0, zIndex: 950, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 560, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid #eef2f7" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171" }}>Líder de {alvo.setor}</div>
          <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
            Fixar à mão sobrepõe o cadastro para este setor. Para voltar ao automático, use “Limpar ajuste”.
          </div>
        </div>
        <div style={{ padding: "12px 22px 0" }}>
          {erro && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 9, padding: "8px 11px", fontSize: 12, marginBottom: 10 }}>{erro}</div>}
          {alvo.empatados.length > 1 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fed7aa", color: "#78350f", borderRadius: 9, padding: "8px 11px", fontSize: 11.5, marginBottom: 10, lineHeight: 1.45 }}>
              {alvo.empatados.length} pessoas têm o mesmo nível ({alvo.empatados[0].nivel}) neste setor — por isso o cadastro não decide sozinho.
            </div>
          )}
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome…" style={inp} autoFocus />
        </div>
        <div style={{ padding: "10px 22px", overflowY: "auto", flex: 1 }}>
          {lista.length === 0 ? <div style={{ fontSize: 12, color: "#94a3b8", padding: "16px 0", textAlign: "center" }}>Ninguém encontrado.</div> : lista.map(e => (
            <div key={e.id} onClick={() => setSel(e.id)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, cursor: "pointer", marginBottom: 4, background: sel === e.id ? "#eef4ff" : "transparent", border: sel === e.id ? "1px solid #c7d2fe" : "1px solid transparent" }}>
              <span style={{ width: 15, height: 15, borderRadius: "50%", border: sel === e.id ? "5px solid #0f3171" : "2px solid #cbd5e1", flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nome}</div>
                <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{e.cargo || "—"} · {e.setor || "sem setor"}{!ativo(e) && " · inativo"}</div>
              </div>
              {ehNivel(e.nivel) && <Chip texto={e.nivel} cor="#0f3171" />}
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 22px 0" }}>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Por que fixou à mão? (opcional)" style={inp} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 22px" }}>
          <button onClick={onFechar} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={btn("#0f3171")}>{salvando ? "Salvando…" : "Fixar líder"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: marcar de quais setores um diretor cuida ──────────────────
// Visão pelo DIRETOR (o inverso da coluna da tabela, que é por setor). Como
// cada setor tem um único diretor, marcar aqui um setor que era de outro
// simplesmente transfere — por isso mostramos de quem é hoje.
function ModalDiretorSetores({ diretor, setores, diretorDe, onFechar, onSalvo }: {
  diretor: Empregado; setores: string[];
  diretorDe: Map<string, { id: number; nome: string }>;
  onFechar: () => void; onSalvo: () => void | Promise<void>;
}) {
  const [sel, setSel] = useState<Set<string>>(() =>
    new Set(setores.filter(s => diretorDe.get(normSetor(s))?.id === diretor.id)));
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vis = useMemo(() => {
    const q = semAcento(busca);
    return q ? setores.filter(s => semAcento(s).includes(q)) : setores;
  }, [busca, setores]);
  const alterna = (s: string) => setSel(x => { const n = new Set(x); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const salvar = async () => {
    setSalvando(true); setErro(null);
    try {
      const gravar = setores.filter(s => sel.has(s));
      // Só limpa o que ERA deste diretor e ele desmarcou — nunca mexe no de outro.
      const limpar = setores.filter(s => !sel.has(s) && diretorDe.get(normSetor(s))?.id === diretor.id);
      if (gravar.length) {
        const { error } = await (supabase as any).from("RH_SETOR_DIRETOR").upsert(
          gravar.map(s => ({ setor: s, diretor_id: diretor.id, diretor_nome: diretor.nome })),
          { onConflict: "setor" });
        if (error) throw error;
      }
      if (limpar.length) {
        const { error } = await (supabase as any).from("RH_SETOR_DIRETOR").delete().in("setor", limpar);
        if (error) throw error;
      }
      await onSalvo();
      onFechar();
    } catch (e: any) {
      console.error("Definir setores do diretor falhou:", e);
      setErro(msgErroGravacao(e, "RH_SETOR_DIRETOR", "20260723000001"));
    } finally { setSalvando(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
      style={{ position: "fixed", inset: 0, zIndex: 950, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 560, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid #eef2f7" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171" }}>Setores de {diretor.nome}</div>
          <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
            Marque os setores que este diretor cuida. Marcar um setor de outro diretor transfere para este.
          </div>
        </div>
        <div style={{ padding: "12px 22px 0" }}>
          {erro && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 9, padding: "8px 11px", fontSize: 12, marginBottom: 10 }}>{erro}</div>}
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar setor…" style={inp} autoFocus />
        </div>
        <div style={{ padding: "10px 22px", overflowY: "auto", flex: 1 }}>
          {vis.length === 0 ? <div style={{ fontSize: 12, color: "#94a3b8", padding: "16px 0", textAlign: "center" }}>Nenhum setor.</div> : vis.map(s => {
            const dono = diretorDe.get(normSetor(s));
            const deOutro = dono && dono.id !== diretor.id;
            return (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, cursor: "pointer", marginBottom: 4, background: sel.has(s) ? "#eef4ff" : "transparent", border: sel.has(s) ? "1px solid #c7d2fe" : "1px solid transparent" }}>
                <input type="checkbox" checked={sel.has(s)} onChange={() => alterna(s)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{s}</div>
                  {deOutro && <div style={{ fontSize: 10.5, color: "#b45309" }}>hoje é de {dono!.nome}</div>}
                </div>
              </label>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "12px 22px", borderTop: "1px solid #eef2f7" }}>
          <span style={{ fontSize: 11.5, color: "#64748b" }}>{nInt(sel.size)} setor(es) marcado(s)</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onFechar} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={btn("#0f3171")}>{salvando ? "Salvando…" : "Salvar setores"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Linhas de RH_SETOR_DIRETOR → mapa por setor normalizado (mesma chave usada
// na gravação, para leitura e escrita nunca divergirem).
const mapaDiretores = (rows: any[] | null | undefined) => {
  const d = new Map<string, { id: number; nome: string }>();
  (rows ?? []).forEach((r: any) => d.set(normSetor(r.setor), { id: Number(r.diretor_id), nome: String(r.diretor_nome ?? "").trim() }));
  return d;
};

// ── Tela ─────────────────────────────────────────────────────────────
// `embedded` = renderizado dentro da Administração (aba Acesso por Usuário), sem
// o cromo de página inteira: some o "← Voltar" e o container não força altura/
// scroll próprios (quem rola é o painel do admin).
export default function LideresSetor({ embedded = false }: { embedded?: boolean } = {}) {
  const nav = useNavigate();
  const [emps, setEmps] = useState<Empregado[]>([]);
  const [overrides, setOverrides] = useState<Map<string, { id: number; obs?: string | null }>>(new Map());
  // setor normalizado → diretor que responde por ele (RH_SETOR_DIRETOR).
  const [diretorDe, setDiretorDe] = useState<Map<string, { id: number; nome: string }>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);
  const [editando, setEditando] = useState<LiderSetor | null>(null);
  const [editandoDir, setEditandoDir] = useState<Empregado | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const [lista, ovRes, dirRes] = await Promise.all([
        carregaEmpregados(),
        (supabase as any).from("CS_LIDERES_SETOR").select("*"),
        (supabase as any).from("RH_SETOR_DIRETOR").select("*"),
      ]);
      setEmps(lista);
      const m = new Map<string, { id: number; obs?: string | null }>();
      (ovRes.data ?? []).forEach((r: any) => m.set(String(r.setor), { id: Number(r.empregado_id), obs: r.observacao }));
      setOverrides(m);
      setDiretorDe(mapaDiretores(dirRes.data));
    } catch (e: any) { setErro(e?.message ?? String(e)); }
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Recarrega SÓ os ajustes manuais (tabela pequena). Fixar/limpar um líder não
  // muda o cadastro, então re-ler os milhares de EMPREGADOS (agora paginado, 13+
  // chamadas) só faria a tela "travar em Carregando" a cada clique.
  const recarregarOverrides = useCallback(async () => {
    const { data } = await (supabase as any).from("CS_LIDERES_SETOR").select("*");
    const m = new Map<string, { id: number; obs?: string | null }>();
    (data ?? []).forEach((r: any) => m.set(String(r.setor), { id: Number(r.empregado_id), obs: r.observacao }));
    setOverrides(m);
  }, []);

  const recarregarDiretores = useCallback(async () => {
    const { data } = await (supabase as any).from("RH_SETOR_DIRETOR").select("*");
    setDiretorDe(mapaDiretores(data));
  }, []);

  // Grava (ou limpa, com diretorId nulo) quem cuida do setor. Recarrega só esta
  // tabela — o cadastro não mudou.
  const definirDiretor = async (setor: string, diretorId: number | null) => {
    try {
      if (diretorId) {
        const d = emps.find(e => e.id === diretorId);
        const { error } = await (supabase as any).from("RH_SETOR_DIRETOR")
          .upsert({ setor, diretor_id: diretorId, diretor_nome: d?.nome ?? null }, { onConflict: "setor" });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("RH_SETOR_DIRETOR").delete().eq("setor", setor);
        if (error) throw error;
      }
      await recarregarDiretores();
    } catch (e: any) { alert(msgErroGravacao(e, "RH_SETOR_DIRETOR", "20260723000001")); }
  };

  // Só gente ativa entra na regra: um gerente desligado continua no cadastro
  // e seguiria "liderando" o setor para sempre.
  const ativos = useMemo(() => emps.filter(ativo), [emps]);
  const setores = useMemo(() => resolveLideres(ativos, overrides), [ativos, overrides]);

  // Acima do setor: DIREÇÃO/CEO valem para a empresa toda.
  const cupula = useMemo(() => ativos.filter(e => rankNivel(e.nivel) >= 0 && rankNivel(e.nivel) <= NIVEIS_NORM.indexOf(normNivel("DIRETOR")))
    .sort((a, b) => rankNivel(a.nivel) - rankNivel(b.nivel) || a.nome.localeCompare(b.nome, "pt-BR")), [ativos]);

  // Quem pode cuidar de setores: DIREÇÃO … DIRETOR. Acima (ADMIN/CEO) já vê
  // tudo, abaixo (gerente) lidera o próprio setor.
  const diretores = useMemo(() => cupula.filter(e => rankNivel(e.nivel) >= rankNivel("DIREÇÃO") && rankNivel(e.nivel) <= rankNivel("DIRETOR")), [cupula]);

  // Diretor → setores sob ele, para o resumo do card "Acima dos setores".
  const setoresPorDiretor = useMemo(() => {
    const m = new Map<number, string[]>();
    setores.forEach(s => {
      const d = diretorDe.get(normSetor(s.setor)); if (!d) return;
      const arr = m.get(d.id); if (arr) arr.push(s.setor); else m.set(d.id, [s.setor]);
    });
    return m;
  }, [setores, diretorDe]);
  const semDiretor = setores.filter(s => !diretorDe.get(normSetor(s.setor))).length;

  const vis = useMemo(() => {
    const q = semAcento(busca);
    return setores.filter(s =>
      (!q || semAcento(s.setor).includes(q) || semAcento(s.lider?.nome ?? "").includes(q)) &&
      (!soPendentes || !s.lider));
  }, [setores, busca, soPendentes]);

  const comLider = setores.filter(s => s.lider).length;
  const manuais = setores.filter(s => s.origem === "manual").length;

  const limpar = async (setor: string) => {
    if (!confirm(`Voltar o setor ${setor} para o líder automático do cadastro?`)) return;
    const { error } = await (supabase as any).from("CS_LIDERES_SETOR").delete().eq("setor", setor);
    if (error) { alert(error.message); return; }
    recarregarOverrides();
  };

  const exportar = () => {
    const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const L = [["Setor", "Líder", "Nível", "Origem", "Diretor responsável", "Observação"]];
    setores.forEach(s => L.push([s.setor, s.lider?.nome ?? "", s.lider?.nivel ?? "",
      s.origem === "manual" ? "Ajuste manual" : s.origem === "cadastro" ? "Cadastro" : (s.empatados.length ? "Empate" : "Sem líder"),
      diretorDe.get(normSetor(s.setor))?.nome ?? "", s.observacao ?? ""]));
    const csv = "﻿" + L.map(l => l.map(esc).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "lideres-por-setor.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div style={embedded
      ? { display: "flex", flexDirection: "column", background: "transparent" }
      : { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ margin: embedded ? 0 : "18px 24px 0", padding: "16px 22px", border: "1px solid #e2e8f0", borderRadius: 18, background: "linear-gradient(135deg,#fff 0%,#f8fbff 100%)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!embedded && <button onClick={() => nav("/app/central-servicos/formularios")} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>← Voltar</button>}
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#0f3171" }}>👥 Líderes por setor</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              Quem responde pelo setor nos feedbacks. Sai do cadastro (Setor_ERP + nível) e só se ajusta onde a regra não decide.
            </div>
          </div>
        </div>
        <button onClick={exportar} style={btn("#fff", "#0f3171", "1px solid #0f3171")}>⬇ Exportar</button>
      </div>

      <div style={embedded
        ? { padding: "16px 0 8px" }
        : { flex: 1, overflowY: "auto", padding: "16px 24px 40px" }}>
        {carregando ? <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Carregando cadastro…</div>
        : erro ? (
          <div style={{ ...cardBox, padding: 36, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Não deu para ler o cadastro</div>
            <div style={{ fontSize: 12.5, color: "#64748b", maxWidth: 540, margin: "0 auto" }}>{erro}</div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
              <Kpi titulo="Setores" valor={nInt(setores.length)} cor="#2563eb" sub="No cadastro (ativos)" />
              <Kpi titulo="Com líder definido" valor={nInt(comLider)} cor="#16a34a" sub={`${setores.length ? Math.round(comLider / setores.length * 100) : 0}% dos setores`} />
              <Kpi titulo="Sem líder" valor={nInt(setores.length - comLider)} cor="#dc2626" sub="Precisam de ajuste" />
              <Kpi titulo="Ajustes manuais" valor={nInt(manuais)} cor="#7c3aed" sub="Fixados nesta tela" />
              <Kpi titulo="Sem diretor" valor={nInt(semDiretor)} cor={semDiretor ? "#f59e0b" : "#16a34a"} sub="Setores sem responsável acima" />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar setor ou líder…" style={inp} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", cursor: "pointer" }}>
                <input type="checkbox" checked={soPendentes} onChange={e => setSoPendentes(e.target.checked)} />
                Só setores sem líder
              </label>
            </div>

            <div style={{ ...cardBox, padding: 0, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={{ ...th, paddingLeft: 16 }}>Setor</th>
                    <th style={th}>Líder</th><th style={th}>Nível</th><th style={th}>Origem</th>
                    <th style={th}>Diretor responsável</th>
                    <th style={{ ...th, textAlign: "right", paddingRight: 16 }}>Ação</th>
                  </tr></thead>
                  <tbody>
                    {vis.length === 0 ? (
                      <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>Nenhum setor no filtro.</td></tr>
                    ) : vis.map(s => (
                      <tr key={s.setor}>
                        <td style={{ ...td, paddingLeft: 16, fontWeight: 700, color: "#0f172a" }}>{s.setor}</td>
                        <td style={td}>
                          {s.lider ? s.lider.nome : s.empatados.length
                            ? <span style={{ color: "#b45309" }}>{s.empatados.length} candidatos empatados</span>
                            : <span style={{ color: "#dc2626" }}>Ninguém com nível no setor</span>}
                          {s.observacao && <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{s.observacao}</div>}
                        </td>
                        <td style={td}>{s.lider?.nivel ? <Chip texto={s.lider.nivel} cor="#0f3171" /> : "—"}</td>
                        <td style={td}>
                          {s.origem === "manual" ? <Chip texto="Ajuste manual" cor="#7c3aed" />
                            : s.origem === "cadastro" ? <Chip texto="Cadastro" cor="#16a34a" />
                            : <Chip texto="Pendente" cor="#dc2626" />}
                        </td>
                        <td style={td}>
                          {(() => {
                            const at = diretorDe.get(normSetor(s.setor));
                            // Quem foi designado mas saiu do recorte (mudou de nível, desligou)
                            // continua aparecendo — senão o select mostraria "nenhum" e o
                            // primeiro clique apagaria a designação sem ninguém perceber.
                            const orfao = at && !diretores.some(d => d.id === at.id);
                            return (
                              <select value={at?.id ?? ""}
                                onChange={e => definirDiretor(s.setor, e.target.value ? Number(e.target.value) : null)}
                                style={{ ...inp, width: "auto", minWidth: 170, padding: "5px 8px", fontSize: 12, color: orfao ? "#b45309" : undefined }}>
                                <option value="">— nenhum —</option>
                                {orfao && <option value={at!.id}>{at!.nome || `#${at!.id}`} (fora da direção hoje)</option>}
                                {diretores.map(d => <option key={d.id} value={d.id}>{d.nome} ({d.nivel})</option>)}
                              </select>
                            );
                          })()}
                        </td>
                        <td style={{ ...td, textAlign: "right", paddingRight: 16, whiteSpace: "nowrap" }}>
                          <button onClick={() => setEditando(s)} style={btn("#fff", "#0f3171", "1px solid #0f3171")}>
                            {s.origem === "manual" ? "Trocar" : "Fixar"}
                          </button>
                          {s.origem === "manual" && (
                            <button onClick={() => limpar(s.setor)} style={{ ...btn("none", "#dc2626", "none"), marginLeft: 6 }}>Limpar ajuste</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...cardBox }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".5px" }}>Acima dos setores</div>
              <div style={{ fontSize: 11.5, color: "#94a3b8", margin: "2px 0 10px" }}>
                Quem cuida de quais setores. Isso não vem do cadastro — defina aqui em <b>Definir setores</b>, ou setor a setor na coluna <b>Diretor responsável</b> da tabela acima.
                {semDiretor > 0 && <> Ainda faltam <b style={{ color: "#b45309" }}>{nInt(semDiretor)}</b> setor(es).</>}
              </div>
              {cupula.length === 0 ? <div style={{ fontSize: 12, color: "#94a3b8" }}>Ninguém com nível de direção no cadastro.</div> : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {cupula.map(e => {
                    const meus = setoresPorDiretor.get(e.id) ?? [];
                    const podeCuidar = diretores.some(d => d.id === e.id);
                    return (
                      <div key={e.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", minWidth: 210 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Chip texto={e.nivel} cor="#0f3171" />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{e.nome}</div>
                            <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{e.setor || "sem setor"}</div>
                          </div>
                        </div>
                        <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {meus.length > 0 ? meus.map(s => (
                            <span key={s} style={{ fontSize: 10, background: "#eef4ff", color: "#0f3171", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>{s}</span>
                          )) : (
                            <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
                              {podeCuidar ? "Nenhum setor atribuído" : "Vê a empresa toda"}
                            </span>
                          )}
                        </div>
                        {podeCuidar && (
                          <button onClick={() => setEditandoDir(e)}
                            style={{ ...btn("#fff", "#0f3171", "1px solid #0f3171"), marginTop: 8, padding: "5px 10px", fontSize: 11.5, width: "100%" }}>
                            {meus.length ? `Definir setores (${nInt(meus.length)})` : "Definir setores"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 10, lineHeight: 1.5 }}>
                ⓘ Níveis, do topo para a base: {NIVEIS.join(" › ")}. Quem tem o nível mais alto dentro do
                Setor_ERP responde por ele; o diretor responde pelos setores atribuídos a ele.
              </div>
            </div>
          </>
        )}
      </div>

      {editando && <ModalEscolher alvo={editando} emps={emps} onFechar={() => setEditando(null)} onSalvo={recarregarOverrides} />}
      {editandoDir && (
        <ModalDiretorSetores diretor={editandoDir} setores={setores.map(s => s.setor)} diretorDe={diretorDe}
          onFechar={() => setEditandoDir(null)} onSalvo={recarregarDiretores} />
      )}
    </div>
  );
}
