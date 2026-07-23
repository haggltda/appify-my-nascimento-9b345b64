import { supabase } from "@/integrations/supabase/client";

// =====================================================================
// NASCIMENTO FORMULÁRIOS — QUEM RESPONDE POR CADA SETOR
//
// Em EMPREGADOS a coluna LIDER guarda o NÍVEL da pessoa (CEO, DIREÇÃO,
// GERENTE, SUPERVISOR…) — NÃO o nome do líder dela. Então "Setor_ERP =
// COMPRAS" + "LIDER = GERENTE" quer dizer: essa pessoa é a gerente do Compras.
//
// O líder de um setor é quem tem o MAIOR nível dentro dele. Onde a regra não
// decide (empate, setor sem ninguém com nível), vale a DESIGNAÇÃO feita na
// Administração > Módulos & Menus > Acesso por Usuário: os papéis por usuário
// 'gerente_setor' e 'diretor_setor' em CS_FORM_ACESSOS, lidos aqui pela RPC
// cs_responsaveis_setor. São os mesmos toggles que abrem o setor no Painel
// Gerencial — designação e visibilidade saem do MESMO lugar.
// =====================================================================

// Do mais alto para o mais baixo (ordem confirmada pelo RH em jul/2026). ADMIN
// está acima de tudo; LÍDER fica no fim — se não existir de fato na coluna, é
// inofensivo (ninguém casa), e mantê-lo evita rebaixar alguém real por engano.
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
// Linha crua da RPC rh_cadastro_dados (inclui o contrato/local).
export interface CadastroRow { id: number; nome: string; setor: string; nivel: string; cargo: string; local: string; situacao: string; perfil: string }

// Faz uma promise (ex.: consulta) falhar com mensagem se passar do tempo, em
// vez de deixar a tela presa em "Carregando…" pra sempre.
function comTimeout<T>(p: PromiseLike<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms)),
  ]);
}

/**
 * Lê o cadastro pela RPC rh_cadastro_dados (server-side, SECURITY DEFINER —
 * sem custo de RLS por linha, que estourava o statement_timeout na leitura
 * direta). PAGINADO: o PostgREST deste app corta QUALQUER resposta em 1000
 * linhas — inclusive as de RPC —, então sem paginar metade do cadastro some
 * (foi o que sumiu o "YURI ROSA", gerente de Controladoria além da linha 1000).
 * Dedup por ID protege de sobreposição entre páginas.
 */
export async function carregaCadastroDados(): Promise<CadastroRow[]> {
  const bloco = 1000; const byId = new Map<number, CadastroRow>();
  for (let de = 0; ; de += bloco) {
    // .order("id"): pagina de forma determinística. Sem ordenar, um UPDATE no
    // cadastro (ex.: mudar o setor de alguém) reordena o heap entre as páginas
    // e a paginação por offset pula/repete linhas.
    const q = (supabase as any).rpc("rh_cadastro_dados").order("id", { ascending: true }).range(de, de + bloco - 1);
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
        // Vazio até a migration 20260731000002 rodar no banco do app — quem usa
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
  return (await carregaCadastroDados()).map(({ local, ...e }) => e);
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
/**
 * Uma leitura só do cadastro, com tudo que as telas gerenciais pedem: a lista
 * de empregados, quem lidera cada setor e qual diretor responde por ele.
 *
 * Junto de propósito: ler EMPREGADOS custa ~13 chamadas paginadas, e o Painel
 * Gerencial precisava dos três ao mesmo tempo — buscar separado dobrava a
 * espera da tela mais pesada do módulo.
 *
 * As designações vêm da RPC cs_responsaveis_setor — ou seja, dos MESMOS toggles
 * por usuário que liberam o setor no painel (papéis 'gerente_setor' e
 * 'diretor_setor' em CS_FORM_ACESSOS). Antes eram duas tabelas à parte
 * (CS_LIDERES_SETOR / RH_SETOR_DIRETOR), que guardavam a mesma coisa por pessoa
 * e viviam divergindo da permissão.
 */
export async function carregaCadastro(): Promise<{
  emps: Empregado[];
  liderPorSetor: Map<string, string>;
  diretorPorSetor: Map<string, string>;
  ceo: string;
}> {
  const [emps, respRes] = await Promise.all([
    carregaEmpregados(),   // via RPC — não estoura o timeout
    (supabase as any).rpc("cs_responsaveis_setor"),
  ]);
  const designados = (papel: string) => (respRes.data ?? []).filter((r: any) => r?.papel === papel && r?.nome);
  const porSetor = new Map<string, { nome: string; rank: number; empate: boolean }>();
  emps.forEach(e => {
    if (!ehNivel(e.nivel) || !e.setor || !ehAtivoSit(e.situacao)) return;
    const rk = rankNivel(e.nivel), k = normSetor(e.setor), cur = porSetor.get(k);
    if (!cur || rk < cur.rank) porSetor.set(k, { nome: e.nome, rank: rk, empate: false });
    else if (rk === cur.rank) cur.empate = true;
  });
  const liderPorSetor = new Map<string, string>();
  porSetor.forEach((v, k) => { if (!v.empate && v.nome) liderPorSetor.set(k, v.nome); });
  // Designação manda: sobrepõe o automático (inclusive desempata).
  designados("gerente_setor").forEach((o: any) => liderPorSetor.set(normSetor(o.setor), String(o.nome).trim()));
  const diretorPorSetor = new Map<string, string>();
  designados("diretor_setor").forEach((d: any) => diretorPorSetor.set(normSetor(d.setor), String(d.nome).trim()));
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

