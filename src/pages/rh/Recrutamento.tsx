import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";
import { ESTADOS_BR, municipiosDe } from "@/data/municipios-brasil";

// ── Tipos ──────────────────────────────────────────────────────────
interface Solicitacao {
  id: number;
  contrato: string;
  cargo: string;
  cidade: string;
  status: string;
  grau_urgencia: string;
  motivo_vaga: string;
  nome_substituido?: string;
  escala?: string;
  horario?: string;
  salario?: string;
  beneficios?: string;
  insalubridade_recebe?: string;
  insalubridade_quanto?: string;
  local_exato?: string;
  data_inicio_prevista?: string;
  quantidade_vagas?: number;
  req_obrigatorios?: string;
  req_desejaveis?: string;
  exp_minima?: string;
  exp_minima_qual?: string;
  alta_rotatividade?: string;
  motivos_saida?: string;
  recomendacao?: string;
  observacao_importante?: string;
  observacao_interna?: string;
  motivo_reprovacao?: string;
  funcionario_selecionado?: string;
  contratado_nome?: string;
  contratado_contato?: string;
  contratado_data_inicio?: string;
  link_publico?: string;
  analista_id?: number;
  analista_nome?: string;
  solicitante_nome?: string;
  solicitante_cpf?: string;
  aprovado_por_nome?: string;
  created_at: string;
  status_changed_at?: string;
}

interface Mensagem {
  id: number;
  mensagem: string;
  autor_nome: string;
  autor_cpf: string;
  is_treinamento?: boolean;
  created_at: string;
}

interface Curriculo {
  id: number;
  origem: string;
  telefone?: string;
  nome?: string;
  email?: string;
  cpf?: string;
  mensagem?: string;
  tem_pdf?: boolean;
  storage_path?: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────
function esc(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDt(s?: string) {
  if (!s) return "—";
  return s.replace("T", " ").slice(0, 10);
}

function badgeStatusCls(st: string) {
  const m: Record<string, string> = {
    "Aguardando Aprovação": "bg-yellow-100 text-yellow-800 border border-yellow-200",
    "Aguardando Recrutamento": "bg-purple-100 text-purple-700 border border-purple-200",
    Aprovada: "bg-green-100 text-green-700 border border-green-200",
    Reprovada: "bg-red-100 text-red-700 border border-red-200",
    "Vaga Aberta": "bg-orange-100 text-orange-700 border border-orange-200",
    "Funcionário Selecionado": "bg-purple-100 text-purple-700 border border-purple-200",
    Contratado: "bg-green-100 text-green-700 border border-green-200",
  };
  return m[st] ?? "bg-blue-100 text-blue-700 border border-blue-200";
}

function badgeUrgCls(u?: string) {
  if (!u) return "";
  if (u.startsWith("Alta")) return "bg-red-100 text-red-700 border border-red-200";
  if (u === "Média") return "bg-yellow-100 text-yellow-700 border border-yellow-200";
  return "bg-green-100 text-green-700 border border-green-200";
}

const KB_STATUS_ORDER = [
  "Aguardando Aprovação",
  "Aguardando Recrutamento",
  "Aprovada",
  "Vaga Aberta",
  "Seleção de Currículos",
  "Entrevistas",
  "Entrevista com Gestor",
  "Entrevista com Psicóloga",
  "Aguardando Documentação",
  "Aguardando ASO",
  "Funcionário Selecionado",
  "Contratado",
  "Reprovada",
];

const KB_COL_COLORS: Record<string, { dot: string; label: string; accent: string }> = {
  "Aguardando Aprovação":    { dot: "#f59e0b", label: "#b45309", accent: "#f59e0b" },
  "Aguardando Recrutamento": { dot: "#8b5cf6", label: "#7c3aed", accent: "#8b5cf6" },
  Aprovada:                  { dot: "#16a34a", label: "#15803d", accent: "#16a34a" },
  "Vaga Aberta":             { dot: "#f97316", label: "#ea580c", accent: "#f97316" },
  "Seleção de Currículos":   { dot: "#3b82f6", label: "#2563eb", accent: "#3b82f6" },
  Entrevistas:               { dot: "#3b82f6", label: "#2563eb", accent: "#3b82f6" },
  "Entrevista com Gestor":   { dot: "#8b5cf6", label: "#7c3aed", accent: "#8b5cf6" },
  "Entrevista com Psicóloga":{ dot: "#8b5cf6", label: "#7c3aed", accent: "#8b5cf6" },
  "Aguardando Documentação": { dot: "#f59e0b", label: "#b45309", accent: "#f59e0b" },
  "Aguardando ASO":          { dot: "#f59e0b", label: "#b45309", accent: "#f59e0b" },
  "Funcionário Selecionado": { dot: "#16a34a", label: "#15803d", accent: "#16a34a" },
  Contratado:                { dot: "#16a34a", label: "#15803d", accent: "#16a34a" },
  Reprovada:                 { dot: "#dc2626", label: "#b91c1c", accent: "#dc2626" },
};

// ── Componente Principal ───────────────────────────────────────────
export default function Recrutamento() {
  const { user } = useAuth();
  const { roles } = usePermissoes();

  const isAdmin       = roles.includes("admin");
  const isTreinamento = roles.includes("treinamentos");
  const isRH          = roles.includes("rh") && !isAdmin && !isTreinamento;

  // Para isAnalista: qualquer usuário que pode ver itens atribuídos a ele
  // Na prática, qualquer usuário não-RH, não-Treinamento, não-Admin é solicitante
  // Admin e Treinamento têm poderes especiais
  const isAnalista = isAdmin; // Analistas são gerenciados no banco; admin vê tudo

  // ── Estado ─────────────────────────────────────────────────────
  const [view, setView]               = useState<"tabela" | "kanban">("tabela");
  const [tab, setTab]                 = useState("minha");
  const [page, setPage]               = useState(1);
  const [pages, setPages]             = useState(1);
  const [total, setTotal]             = useState(0);
  const [items, setItems]             = useState<Solicitacao[]>([]);
  const [loading, setLoading]         = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [contratoFiltro, setContratoFiltro]         = useState<string[]>([]);
  const [contratoCounts, setContratoCounts]         = useState<{ contrato: string; n: number }[]>([]);
  const [showContratoFiltro, setShowContratoFiltro] = useState(false);
  const [search, setSearch]           = useState("");
  const [stats, setStats]             = useState({ total: 0, pendentes: 0, ag_treinamentos: 0, em_processo: 0, contratados: 0, reprovadas: 0 });
  const [kanbanData, setKanbanData]   = useState<Record<string, Solicitacao[]>>({});

  // Drawer
  const [drawerId, setDrawerId]       = useState<number | null>(null);
  const [drawerSol, setDrawerSol]     = useState<Solicitacao | null>(null);
  const [msgs, setMsgs]               = useState<Mensagem[]>([]);
  const [chatInput, setChatInput]     = useState("");
  const [sendingMsg, setSendingMsg]   = useState(false);

  // Modais
  const [modalReprovar, setModalReprovar]   = useState(false);
  const [reprovarMotivo, setReprovarMotivo] = useState("");
  const [modalStatus, setModalStatus]       = useState(false);
  const [statusSel, setStatusSel]           = useState("");
  const [statusExtra, setStatusExtra]       = useState<Record<string, string>>({});
  const [modalLink, setModalLink]           = useState(false);
  const [linkCopiado, setLinkCopiado]       = useState(false);
  const [modalVaga, setModalVaga]           = useState(false);
  const [vagaStep, setVagaStep]             = useState(1);
  const [curriculos, setCurriculos]         = useState<Curriculo[]>([]);
  const [showCurriculos, setShowCurriculos] = useState(false);

  // Kanban drag
  const [dragId, setDragId]                 = useState<number | null>(null);
  const [dragStatus, setDragStatus]         = useState<string | null>(null);
  const [dragOver, setDragOver]             = useState<string | null>(null);
  const [modalMoverKb, setModalMoverKb]     = useState(false);
  const [pendMover, setPendMover]           = useState<{ id: number; novoStatus: string; oldSt: string } | null>(null);
  const [moverExtra, setMoverExtra]         = useState<Record<string, string>>({});

  // Wizard nova vaga
  const [vaga, setVaga] = useState({
    motivo_vaga: "", nome_substituido: "", contrato: "", cargo: "",
    estado: "", cidade: "", quantidade_vagas: "1", data_inicio_prevista: "",
    escala: "", horario: "", salario: "", insalubridade_recebe: "Não",
    insalubridade_quanto: "", beneficios: "", local_exato: "",
    grau_urgencia: "", alta_rotatividade: "Não", req_obrigatorios: "",
    req_desejaveis: "", exp_minima: "Não", exp_minima_qual: "",
    motivos_saida: "", recomendacao: "", observacao_importante: "",
  });
  const [contratos, setContratos] = useState<string[]>([]);
  const [contratosFull, setContratosFull] = useState<any[]>([]);
  const [empregados, setEmpregados] = useState<any[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [showEmpDrop, setShowEmpDrop] = useState(false);
  const [loadingEmps, setLoadingEmps] = useState(false);

  // Toast
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);
  const toastId = useRef(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const kbBoardRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const empDebounce = useRef<ReturnType<typeof setTimeout> | null>(null); // debounce busca colaborador
  const empTermo    = useRef("");  // último termo buscado (descarta respostas obsoletas)

  // ── Toast helper ─────────────────────────────────────────────
  const toast = useCallback((msg: string, type = "info") => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  // ── Tabs por perfil ───────────────────────────────────────────
  const tabs = isRH
    ? [{ label: "Todas as Solicitações", tab: "todas" }]
    : isAdmin || isTreinamento
    ? [
        { label: "Todas", tab: "todas" },
        { label: "Pendente Aprovação", tab: "analista" },
        { label: "Minhas Solicitações", tab: "minha" },
      ]
    : [{ label: "Minhas Solicitações", tab: "minha" }];

  useEffect(() => { setTab(tabs[0].tab); }, [isRH, isAdmin, isTreinamento]);

  // ── Carregar Stats ────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("SISTEMA_RECRUTAMENTO")
      .select("status");
    if (error || !data) return;
    const rows: { status: string }[] = data;
    const emProcesso = [
      "Vaga Aberta","Seleção de Currículos","Entrevistas",
      "Entrevista com Gestor","Entrevista com Psicóloga",
      "Aguardando Documentação","Aguardando ASO","Funcionário Selecionado",
    ];
    setStats({
      total:            rows.length,
      pendentes:        rows.filter(r => r.status === "Aguardando Aprovação").length,
      ag_treinamentos:  rows.filter(r => r.status === "Aguardando Recrutamento").length,
      em_processo:      rows.filter(r => emProcesso.includes(r.status)).length,
      contratados:      rows.filter(r => r.status === "Contratado").length,
      reprovadas:       rows.filter(r => r.status === "Reprovada").length,
    });
  }, []);

  // ── Filtros compartilhados ────────────────────────────────────
  // Tabela e Kanban são a MESMA consulta, só muda a apresentação — então os
  // dois aplicam exatamente os mesmos filtros (aba/status/busca).
  const aplicarFiltros = useCallback((q: any) => {
    if (statusFilter === "em_processo") {
      q = q.in("status", [
        "Vaga Aberta","Seleção de Currículos","Entrevistas",
        "Entrevista com Gestor","Entrevista com Psicóloga",
        "Aguardando Documentação","Aguardando ASO","Funcionário Selecionado",
      ]);
    } else if (statusFilter) {
      q = q.eq("status", statusFilter);
    }
    if (tab === "minha" && user?.email) {
      q = q.eq("solicitante_cpf", user.email);
    } else if (tab === "analista") {
      q = q.eq("status", "Aguardando Aprovação");
    }
    if (search) {
      q = q.or(`cargo.ilike.%${search}%,contrato.ilike.%${search}%,cidade.ilike.%${search}%`);
    }
    return q;
  }, [statusFilter, tab, search, user]);

  // ── Carregar Lista ────────────────────────────────────────────
  const loadLista = useCallback(async () => {
    setLoading(true);
    const PER = 20;
    let q = (supabase as any)
      .from("SISTEMA_RECRUTAMENTO")
      .select("*", { count: "exact" });
    q = aplicarFiltros(q);
    if (contratoFiltro.length) q = q.in("contrato", contratoFiltro);

    const from = (page - 1) * PER;
    const to   = from + PER - 1;
    q = q.order("created_at", { ascending: false }).range(from, to);

    const { data, count, error } = await q;
    setLoading(false);
    if (error) { toast("Erro ao carregar lista: " + error.message, "err"); return; }
    setItems(data ?? []);
    const ct = count ?? 0;
    setTotal(ct);
    setPages(Math.max(1, Math.ceil(ct / PER)));
  }, [aplicarFiltros, contratoFiltro, page, toast]);

  // ── Carregar Kanban ───────────────────────────────────────────
  const loadKanban = useCallback(async () => {
    // Mesma consulta da tabela (mesmos filtros), só agrupada por status.
    // Tenta trazer status_changed_at (tempo na etapa atual); se a coluna ainda
    // não existir no ambiente, refaz a consulta sem ela.
    const kbQuery = (cols: string) => {
      let q = (supabase as any).from("SISTEMA_RECRUTAMENTO").select(cols);
      q = aplicarFiltros(q);
      if (contratoFiltro.length) q = q.in("contrato", contratoFiltro);
      return q.order("created_at", { ascending: false });
    };
    let { data, error } = await kbQuery("id,cargo,contrato,cidade,status,grau_urgencia,quantidade_vagas,analista_nome,solicitante_nome,created_at,status_changed_at");
    if (error) ({ data, error } = await kbQuery("id,cargo,contrato,cidade,status,grau_urgencia,quantidade_vagas,analista_nome,solicitante_nome,created_at"));
    if (error || !data) return;
    const grouped: Record<string, Solicitacao[]> = {};
    for (const row of data) {
      if (!grouped[row.status]) grouped[row.status] = [];
      grouped[row.status].push(row);
    }
    setKanbanData(grouped);
  }, [aplicarFiltros, contratoFiltro]);

  // Contagem de solicitações por contrato (respeita aba/status/busca; ignora o próprio filtro de contrato).
  const loadContratoCounts = useCallback(async () => {
    let q = (supabase as any).from("SISTEMA_RECRUTAMENTO").select("contrato");
    q = aplicarFiltros(q);
    const { data, error } = await q;
    if (error || !data) return;
    const map = new Map<string, number>();
    for (const r of data) {
      const c = String(r.contrato ?? "").trim();
      if (c) map.set(c, (map.get(c) ?? 0) + 1);
    }
    setContratoCounts(Array.from(map, ([contrato, n]) => ({ contrato, n })).sort((a, b) => a.contrato.localeCompare(b.contrato)));
  }, [aplicarFiltros]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadContratoCounts(); }, [loadContratoCounts]);
  useEffect(() => { if (view === "tabela") loadLista(); else loadKanban(); }, [view, loadLista, loadKanban, tab, page, statusFilter, search]);

  const debounceSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); }, 350);
  };

  // ── Abrir Detalhe ─────────────────────────────────────────────
  const verDetalhe = useCallback(async (id: number) => {
    setDrawerId(id);
    setDrawerSol(null);
    setMsgs([]);
    if (pollTimer.current) clearInterval(pollTimer.current);

    const [{ data: sol }, { data: mensagens }] = await Promise.all([
      (supabase as any).from("SISTEMA_RECRUTAMENTO").select("*").eq("id", id).single(),
      (supabase as any).from("WA_MENSAGENS_RECRUTAMENTO").select("*").eq("solicitacao_id", id).order("created_at"),
    ]);
    if (sol) setDrawerSol(sol);
    if (mensagens) setMsgs(mensagens);

    pollTimer.current = setInterval(async () => {
      const { data: nm } = await (supabase as any)
        .from("WA_MENSAGENS_RECRUTAMENTO").select("*").eq("solicitacao_id", id).order("created_at");
      if (nm) setMsgs(nm);
    }, 5000);
  }, []);

  const fecharDrawer = () => {
    setDrawerId(null);
    setDrawerSol(null);
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (view === "kanban") loadKanban();
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // ── Enviar Mensagem ───────────────────────────────────────────
  const enviarMsg = async () => {
    if (!chatInput.trim() || !drawerId || isRH) return;
    setSendingMsg(true);
    const { error } = await (supabase as any).from("WA_MENSAGENS_RECRUTAMENTO").insert({
      solicitacao_id: drawerId,
      mensagem: chatInput.trim(),
      autor_nome: user?.user_metadata?.nome ?? user?.email ?? "Usuário",
      autor_cpf: user?.email ?? "",
      is_treinamento: isTreinamento,
    });
    setSendingMsg(false);
    if (error) { toast("Erro ao enviar mensagem.", "err"); return; }
    setChatInput("");
    const { data } = await (supabase as any)
      .from("WA_MENSAGENS_RECRUTAMENTO").select("*").eq("solicitacao_id", drawerId).order("created_at");
    if (data) setMsgs(data);
  };

  // ── Aprovar ───────────────────────────────────────────────────
  const aprovar = async () => {
    if (!drawerId || !drawerSol) return;
    const label = drawerSol.status === "Aguardando Recrutamento" ? "Liberar Vaga" : "Aprovar";
    if (!confirm(`${label} solicitação #${drawerId}?`)) return;

    let novoStatus = drawerSol.status === "Aguardando Recrutamento"
      ? "Aprovada"
      : "Aguardando Recrutamento";

    const { error } = await (supabase as any)
      .from("SISTEMA_RECRUTAMENTO")
      .update({ status: novoStatus, aprovado_por_nome: user?.user_metadata?.nome ?? user?.email ?? "" })
      .eq("id", drawerId);

    if (error) { toast("Erro ao aprovar.", "err"); return; }
    toast(drawerSol.status === "Aguardando Recrutamento" ? "Vaga liberada!" : "Aprovado e encaminhado para Recrutamento!", "ok");
    fecharDrawer();
    loadStats();
    loadLista();
  };

  // ── Reprovar ──────────────────────────────────────────────────
  const confirmarReprovar = async () => {
    if (!reprovarMotivo.trim()) { toast("Informe o motivo.", "err"); return; }
    const { error } = await (supabase as any)
      .from("SISTEMA_RECRUTAMENTO")
      .update({ status: "Reprovada", motivo_reprovacao: reprovarMotivo.trim(), aprovado_por_nome: user?.user_metadata?.nome ?? "" })
      .eq("id", drawerId);
    if (error) { toast("Erro ao reprovar.", "err"); return; }
    toast("Solicitação reprovada.", "ok");
    setModalReprovar(false);
    setReprovarMotivo("");
    fecharDrawer();
    loadStats();
    loadLista();
  };

  // ── Atualizar Status ──────────────────────────────────────────
  const confirmarStatus = async () => {
    if (!statusSel) { toast("Selecione um status.", "err"); return; }
    const payload: Record<string, any> = { status: statusSel };
    if (statusSel === "Funcionário Selecionado") {
      if (!statusExtra.nome) { toast("Informe o nome.", "err"); return; }
      payload.funcionario_selecionado = statusExtra.nome;
    } else if (statusSel === "Contratado") {
      if (!statusExtra.nome || !statusExtra.contato || !statusExtra.data) { toast("Preencha todos os campos.", "err"); return; }
      payload.contratado_nome        = statusExtra.nome;
      payload.contratado_contato     = statusExtra.contato;
      payload.contratado_data_inicio = statusExtra.data;
    }
    const { error } = await (supabase as any).from("SISTEMA_RECRUTAMENTO").update(payload).eq("id", drawerId);
    if (error) { toast("Erro ao atualizar status.", "err"); return; }
    toast("Status atualizado!", "ok");
    setModalStatus(false);
    setStatusSel("");
    setStatusExtra({});
    if (drawerId) verDetalhe(drawerId);
    loadStats();
    loadLista();
  };

  // ── Carregar Currículos ───────────────────────────────────────
  const abrirCurriculos = async () => {
    setShowCurriculos(true);
    setCurriculos([]);
    const { data } = await (supabase as any)
      .from("WA_CURRICULOS")
      .select("*")
      .eq("vaga_id", drawerId)
      .order("created_at", { ascending: false });
    if (data) {
      setCurriculos(data.map((c: any) => ({
        ...c,
        nome: c.nome_cand ?? c.nome ?? "",
        email: c.email_cand ?? c.email ?? "",
        cpf: c.cpf_cand ?? "",
        tem_pdf: !!c.storage_path,
      })));
    }
  };

  // Download do currículo: signed URL temporária no bucket privado 'curriculos'.
  const baixarCurriculo = async (cv: Curriculo) => {
    if (!cv.storage_path) return;
    const { data, error } = await supabase.storage.from("curriculos").createSignedUrl(cv.storage_path, 3600);
    if (error || !data?.signedUrl) { toast("Não foi possível abrir o arquivo.", "err"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  // ── Kanban Mover ──────────────────────────────────────────────
  const executarMover = async (id: number, novoStatus: string, oldSt: string, extra: Record<string, any>) => {
    const payload: Record<string, any> = { status: novoStatus, ...extra };
    const { error } = await (supabase as any).from("SISTEMA_RECRUTAMENTO").update(payload).eq("id", id);
    if (error) { toast("Erro ao mover card.", "err"); loadKanban(); return; }
    toast(`Card movido para "${novoStatus}"`, "ok");
    loadStats();
    loadKanban();
  };

  const kbDrop = (novoStatus: string) => {
    if (!dragId || novoStatus === dragStatus) return;
    const id   = dragId;
    const oldSt = dragStatus!;
    setDragId(null);
    setDragStatus(null);
    setDragOver(null);

    if (["Funcionário Selecionado", "Contratado", "Reprovada"].includes(novoStatus)) {
      setPendMover({ id, novoStatus, oldSt });
      setMoverExtra({});
      setModalMoverKb(true);
      return;
    }
    executarMover(id, novoStatus, oldSt, {});
  };

  const confirmarMoverKb = async () => {
    if (!pendMover) return;
    const { id, novoStatus, oldSt } = pendMover;
    const extra: Record<string, any> = {};

    if (novoStatus === "Funcionário Selecionado") {
      if (!moverExtra.nome) { toast("Informe o nome.", "err"); return; }
      extra.funcionario_selecionado = moverExtra.nome;
    } else if (novoStatus === "Contratado") {
      if (!moverExtra.nome || !moverExtra.contato || !moverExtra.data) { toast("Preencha todos os campos.", "err"); return; }
      extra.contratado_nome        = moverExtra.nome;
      extra.contratado_contato     = moverExtra.contato;
      extra.contratado_data_inicio = moverExtra.data;
    } else if (novoStatus === "Reprovada") {
      if (!moverExtra.motivo) { toast("Informe o motivo.", "err"); return; }
      extra.motivo_reprovacao = moverExtra.motivo;
      extra.aprovado_por_nome = user?.user_metadata?.nome ?? "";
    }
    setModalMoverKb(false);
    setPendMover(null);
    executarMover(id, novoStatus, oldSt, extra);
  };

  // ── Solicitar Vaga ────────────────────────────────────────────
  const carregarContratos = async () => {
    const { data } = await (supabase as any)
      .from("CONTRATOS")
      .select('"NOME CONTRATO", Filial')
      .eq("ATIVO", "SIM")
      .order('"NOME CONTRATO"');
    if (data) {
      setContratosFull(data);
      // dedup de nomes — há contratos com mesmo NOME CONTRATO em filiais diferentes
      const nomes = Array.from(new Set(data.map((c: any) => c["NOME CONTRATO"] ?? "").filter(Boolean)));
      setContratos(nomes as string[]);
    }
  };

  const buscarEmpregados = async (term: string) => {
    empTermo.current = term;
    setLoadingEmps(true);
    const { data, error } = await (supabase as any)
      .from("EMPREGADOS")
      .select('"Nome", "Filial", "Nome Filial", "Título do Cargo", "Valor Salário", "% Insalubridade", "Escala"')
      .eq("Situação", "Trabalhando")
      .ilike("Nome", `%${term}%`)
      .order('"Nome"')
      .limit(50);
    if (empTermo.current !== term) return; // resposta de uma busca antiga — descarta
    setLoadingEmps(false);
    if (error) { toast("EMPREGADOS: " + error.message + " (" + (error.code ?? "?") + ")", "err"); return; }
    setEmpregados(data ?? []);
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
      escala: emp["Escala"] ? String(emp["Escala"]) : v.escala,
      contrato: contratoMatch ? contratoMatch["NOME CONTRATO"] : v.contrato,
    }));
    setEmpSearch(emp.Nome);
    setShowEmpDrop(false);
  };

  const abrirModalVaga = () => {
    setModalVaga(true);
    setVagaStep(1);
    setEmpSearch("");
    setShowEmpDrop(false);
    if (!contratos.length) carregarContratos();
  };

  const vagaValidar = (step: number) => {
    if (step === 1) {
      if (!vaga.motivo_vaga) { toast("Selecione o motivo da vaga.", "err"); return false; }
      if (!vaga.contrato)    { toast("Selecione o contrato.", "err"); return false; }
      if (!vaga.cargo.trim()){ toast("Informe o cargo.", "err"); return false; }
    }
    if (step === 3) {
      if (!vaga.req_obrigatorios.trim()) { toast("Informe os requisitos obrigatórios.", "err"); return false; }
    }
    return true;
  };

  const submitVaga = async () => {
    if (!vagaValidar(3)) return;
    const payload = {
      ...vaga,
      quantidade_vagas: parseInt(vaga.quantidade_vagas) || 1,
      status: "Aguardando Aprovação",
      solicitante_nome: user?.user_metadata?.nome ?? user?.email ?? "",
      solicitante_cpf: user?.email ?? "",
    };
    const { error, data } = await (supabase as any).from("SISTEMA_RECRUTAMENTO").insert(payload).select("id").single();
    if (error) { toast("Erro ao solicitar vaga: " + error.message, "err"); return; }
    toast(`Solicitação #${data?.id} criada com sucesso!`, "ok");
    setModalVaga(false);
    setVaga({ motivo_vaga:"",nome_substituido:"",contrato:"",cargo:"",estado:"",cidade:"",
      quantidade_vagas:"1",data_inicio_prevista:"",escala:"",horario:"",salario:"",
      insalubridade_recebe:"Não",insalubridade_quanto:"",beneficios:"",local_exato:"",
      grau_urgencia:"",alta_rotatividade:"Não",req_obrigatorios:"",req_desejaveis:"",
      exp_minima:"Não",exp_minima_qual:"",motivos_saida:"",recomendacao:"",observacao_importante:"" });
    setVagaStep(1);
    setEmpSearch("");
    setShowEmpDrop(false);
    loadStats();
    loadLista();
  };

  // ── CSS injetado ──────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "rec-styles";
    style.textContent = `
      .rec-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;box-shadow:0 8px 24px rgba(15,23,42,.06)}
      .rec-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap}
      .rec-table{width:100%;border-collapse:collapse}
      .rec-table th{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.7px;padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left;background:#f8fafc}
      .rec-table td{padding:11px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;vertical-align:middle}
      .rec-table tr:hover td{background:#f8fbff;cursor:pointer}
      .rec-drawer-ov{position:fixed;inset:0;z-index:500;background:rgba(15,23,42,.42);backdrop-filter:blur(4px);display:flex;justify-content:flex-end}
      .rec-drawer{width:84%;max-width:960px;height:100%;background:#fff;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;overflow:hidden;box-shadow:-20px 0 60px rgba(15,23,42,.18);animation:drIn .22s ease}
      @keyframes drIn{from{transform:translateX(40px);opacity:.4}to{transform:translateX(0);opacity:1}}
      .rec-modal-ov{position:fixed;inset:0;z-index:700;background:rgba(15,23,42,.42);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center}
      .rec-modal{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;position:relative;box-shadow:0 16px 40px rgba(15,23,42,.1)}
      .rec-fi{width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;color:#0f172a;font-size:13px;padding:8px 12px;outline:none;font-family:inherit;transition:.15s}
      .rec-fi:focus{border-color:#0f3171;box-shadow:0 0 0 4px rgba(15,49,113,.08)}
      .rec-fg{margin-bottom:14px}
      .rec-fg label{display:block;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
      .kb-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap}
      .kb-hint{font-size:11px;color:#94a3b8;font-weight:600}
      .kb-hint strong{color:#475569}
      .kb-nav{display:flex;gap:6px;flex-shrink:0}
      .kb-nav-btn{width:34px;height:30px;border-radius:9px;border:1px solid #e2e8f0;background:#fff;color:#0f3171;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(15,23,42,.06);transition:.15s;display:inline-flex;align-items:center;justify-content:center}
      .kb-nav-btn:hover{background:#0f3171;color:#fff;border-color:#0f3171}
      .kb-board{display:flex;gap:10px;height:calc(100vh - 320px);min-height:420px;overflow-x:auto;overflow-y:hidden;padding-bottom:14px;align-items:flex-start;scroll-behavior:smooth;cursor:grab}
      .kb-board.kb-grabbing{cursor:grabbing;scroll-behavior:auto;user-select:none}
      .kb-board::-webkit-scrollbar{height:12px}
      .kb-board::-webkit-scrollbar-track{background:#eef2f7;border-radius:8px}
      .kb-board::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:8px;border:3px solid #eef2f7}
      .kb-board::-webkit-scrollbar-thumb:hover{background:#94a3b8}
      .kb-board{scrollbar-width:auto;scrollbar-color:#cbd5e1 #eef2f7}
      .kb-col{flex:0 0 252px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;display:flex;flex-direction:column;max-height:100%;overflow:hidden;transition:.15s;box-shadow:0 8px 24px rgba(15,23,42,.06)}
      .kb-col.drag-over{border-color:#0f3171;background:rgba(15,49,113,.04)}
      .kb-col-head{padding:10px 12px 8px;border-bottom:1px solid #e2e8f0;flex-shrink:0;display:flex;align-items:center;gap:6px;background:#fcfdff}
      .kb-col-body{flex:1;overflow-y:auto;padding:8px 6px;display:flex;flex-direction:column;gap:6px}
      .kb-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;cursor:pointer;transition:transform .12s,border-color .12s;box-shadow:0 8px 24px rgba(15,23,42,.06)}
      .kb-card:hover{border-color:#cbd5e1;transform:translateY(-2px)}
      .kb-card.dragging{opacity:.3;transform:scale(.96)}
      .cv-panel-ov{position:fixed;inset:0;z-index:800;background:rgba(15,23,42,.48);backdrop-filter:blur(5px);display:flex;justify-content:flex-end}
      .cv-panel{width:88%;max-width:1100px;height:100%;background:#fff;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;overflow:hidden;box-shadow:-20px 0 60px rgba(15,23,42,.18)}
      .cv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
      .cv-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 24px rgba(15,23,42,.06)}
      .rec-dg{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:14px;box-shadow:0 8px 24px rgba(15,23,42,.06)}
      .rec-di{padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px}
      .rec-di:nth-last-child(-n+2){border-bottom:none}
      .rec-di.full{grid-column:1/-1}
      .rec-di label{display:block;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.7px;margin-bottom:2px}
      .rec-dd{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;font-size:13px;color:#475569;line-height:1.6;margin-bottom:12px;white-space:pre-wrap;word-break:break-word}
      .rec-dd-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.7px;margin-bottom:5px}
      .rec-chat-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
      .rec-cmsg{max-width:88%}
      .rec-cmsg.mine{align-self:flex-end;align-items:flex-end;display:flex;flex-direction:column}
      .rec-cmsg.theirs{align-self:flex-start;align-items:flex-start;display:flex;flex-direction:column}
      .rec-cbubble-mine{padding:8px 12px;border-radius:12px 12px 3px 12px;font-size:13px;line-height:1.5;background:rgba(15,49,113,.10);border:1px solid rgba(15,49,113,.20);color:#0f172a}
      .rec-cbubble-theirs{padding:8px 12px;border-radius:12px 12px 12px 3px;font-size:13px;line-height:1.5;background:#fff;border:1px solid #e2e8f0;color:#0f172a}
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("rec-styles")?.remove(); };
  }, []);

  // ── Render Detalhe ────────────────────────────────────────────
  const renderDetalhe = (s: Solicitacao) => {
    const di = (label: string, val: any, full = false) => (
      <div className={`rec-di${full ? " full" : ""}`} key={label}>
        <label>{label}</label>
        <span>{val || "—"}</span>
      </div>
    );
    const dd = (label: string, val?: string) => val ? (
      <div key={label} style={{ marginBottom: 12 }}>
        <div className="rec-dd-label">{label}</div>
        <div className="rec-dd">{val}</div>
      </div>
    ) : null;

    return (
      <div style={{ padding: 20 }}>
        <div className="rec-dg">
          {di("Contrato", s.contrato, true)}
          {di("Cargo", s.cargo)}
          {di("Cidade", s.cidade)}
          {di("Motivo da Vaga", s.motivo_vaga)}
          {di("Escala", s.escala)}
          {di("Horário", s.horario)}
          {di("Salário", s.salario)}
          {di("Benefícios", s.beneficios, true)}
          {di("Insalubridade", s.insalubridade_recebe + (s.insalubridade_quanto ? " — " + s.insalubridade_quanto : ""))}
          {di("Local Exato", s.local_exato)}
          {di("Data Início Prevista", s.data_inicio_prevista)}
          {di("Solicitado por", s.solicitante_nome)}
          {di("Data Solicitação", fmtDt(s.created_at))}
          {s.aprovado_por_nome ? di("Aprovado/Reprovado por", s.aprovado_por_nome) : null}
        </div>
        {dd("Colaborador Substituído", s.nome_substituido)}
        {dd("Requisitos Obrigatórios", s.req_obrigatorios)}
        {dd("Requisitos Desejáveis", s.req_desejaveis)}
        <div className="rec-dg">
          {di("Experiência Mínima", s.exp_minima + (s.exp_minima_qual ? " — " + s.exp_minima_qual : ""))}
          {di("Alta Rotatividade", s.alta_rotatividade)}
        </div>
        {dd("Motivos de Saída", s.motivos_saida)}
        {dd("Recomendação", s.recomendacao)}
        {dd("Observação Importante", s.observacao_importante)}
        {dd("Motivo de Reprovação", s.motivo_reprovacao)}
        {s.status === "Funcionário Selecionado" && dd("Funcionário Selecionado", s.funcionario_selecionado)}
        {s.status === "Contratado" && dd("Contratado", [s.contratado_nome, s.contratado_contato ? "Contato: " + s.contratado_contato : "", s.contratado_data_inicio ? "Início: " + s.contratado_data_inicio : ""].filter(Boolean).join("\n"))}
      </div>
    );
  };

  // ── Ações do Drawer ───────────────────────────────────────────
  const renderActions = (s: Solicitacao) => {
    const btns = [];

    const canApprove = isAdmin || isTreinamento;
    if (s.status === "Aguardando Aprovação" && canApprove && !isTreinamento) {
      btns.push(<button key="rep" onClick={() => { setReprovarMotivo(""); setModalReprovar(true); }} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Reprovar</button>);
      btns.push(<button key="apr" onClick={aprovar} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>✓ Aprovar</button>);
    }
    if (s.status === "Aguardando Recrutamento" && (isTreinamento || isAdmin)) {
      btns.push(<button key="rep2" onClick={() => { setReprovarMotivo(""); setModalReprovar(true); }} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Reprovar</button>);
      btns.push(<button key="lib" onClick={aprovar} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>✓ Liberar Vaga</button>);
    }
    if ((isTreinamento || isAdmin) && !["Aguardando Aprovação","Aguardando Recrutamento","Reprovada","Contratado"].includes(s.status)) {
      btns.push(<button key="st" onClick={() => { setStatusSel(""); setStatusExtra({}); setModalStatus(true); }} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#0f3171", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>Atualizar Status</button>);
    }
    const linkStatuses = ["Aprovada","Vaga Aberta","Em Processo Seletivo"];
    if ((isTreinamento || isAdmin) && linkStatuses.includes(s.status) && s.link_publico) {
      btns.push(<button key="lnk" onClick={() => { setLinkCopiado(false); setModalLink(true); }} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,.35)", background: "rgba(99,102,241,.15)", color: "#818cf8", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>Gerar Link</button>);
    }
    if (isTreinamento || isAdmin) {
      btns.push(<button key="cv" onClick={abrirCurriculos} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(34,197,94,.25)", background: "rgba(34,197,94,.1)", color: "#22c55e", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>Currículos</button>);
    }
    return btns;
  };

  const canNovaVaga = !isRH;
  const linkUrl = drawerSol?.link_publico ? `${window.location.origin}/recrutamento/candidatura/${drawerSol.link_publico}` : "";

  // Kanban: rola o quadro horizontalmente (~1,5 coluna por clique).
  const scrollKb = (dir: -1 | 1) => kbBoardRef.current?.scrollBy({ left: dir * 380, behavior: "smooth" });

  // Portal público de candidatura (/vagas): copiar o link para divulgar.
  const [portalCopiado, setPortalCopiado] = useState(false);
  const copiarLinkPortal = async () => {
    const url = `${window.location.origin}/vagas`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand("copy"); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setPortalCopiado(true);
    toast("Link de candidatura copiado!", "ok");
    setTimeout(() => setPortalCopiado(false), 2000);
  };

  // Kanban: clicar numa área vazia do quadro e arrastar para o lado (pan).
  // Ignora cliques sobre os cards para não atrapalhar o arrastar-e-soltar deles.
  const kbPan = useRef({ down: false, startX: 0, startLeft: 0 });
  const kbPanDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".kb-card")) return;
    const el = kbBoardRef.current; if (!el) return;
    e.preventDefault();
    kbPan.current = { down: true, startX: e.pageX, startLeft: el.scrollLeft };
    el.classList.add("kb-grabbing");
  };
  const kbPanMove = (e: React.MouseEvent) => {
    const st = kbPan.current; if (!st.down) return;
    const el = kbBoardRef.current; if (!el) return;
    el.scrollLeft = st.startLeft - (e.pageX - st.startX);
  };
  const kbPanEnd = () => {
    if (!kbPan.current.down) return;
    kbPan.current.down = false;
    kbBoardRef.current?.classList.remove("kb-grabbing");
  };

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "linear-gradient(135deg,#fff 0%,#f8fbff 100%)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: "#0f3171" }}>🎯 Seleção e Recrutamento</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(isAdmin || isTreinamento) && (
            <button onClick={copiarLinkPortal} title="Copia o link público (/vagas) para os candidatos escolherem a cidade e enviarem o currículo" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, border: "1px solid #f97316", background: "rgba(249,115,22,.10)", color: "#ea580c", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              🔗 {portalCopiado ? "Link copiado!" : "Copiar link de candidatura"}
            </button>
          )}
          {canNovaVaga && (
            <button onClick={abrirModalVaga} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, border: "none", background: "#0f3171", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 22px rgba(15,49,113,.18)" }}>
              + Nova Solicitação
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total",          val: stats.total,           color: "#0f3171" },
            { label: "Ag. Aprovação",  val: stats.pendentes,       color: "#f59e0b" },
            { label: "Ag. Recrutamento",val: stats.ag_treinamentos, color: "#8b5cf6" },
            { label: "Em Processo",    val: stats.em_processo,     color: "#3b82f6" },
            { label: "Contratados",    val: stats.contratados,     color: "#16a34a" },
            { label: "Reprovadas",     val: stats.reprovadas,      color: "#dc2626" },
          ].map(k => (
            <div key={k.label} className="rec-kpi">
              <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".7px", marginBottom: 6, fontWeight: 700 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* View Toggle */}
        <div style={{ display: "inline-flex", gap: 2, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 4, marginBottom: 14, boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
          {(["tabela","kanban"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "5px 16px", borderRadius: 8, border: "none", background: view === v ? "#0f3171" : "transparent", color: view === v ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}>
              {v === "tabela" ? "⊞ Tabela" : "⚏ Kanban"}
            </button>
          ))}
        </div>

        {/* Filtro de Contratos — vale para Tabela e Kanban */}
        <div style={{ position: "relative", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowContratoFiltro(v => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: contratoFiltro.length ? "#0f3171" : "#fff", color: contratoFiltro.length ? "#fff" : "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
            🗂 Filtros · Contratos{contratoFiltro.length ? ` (${contratoFiltro.length})` : ""} ▾
          </button>
          {contratoFiltro.length > 0 && (
            <button onClick={() => { setContratoFiltro([]); setPage(1); }} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>limpar</button>
          )}
          {showContratoFiltro && (
            <>
              <div onClick={() => setShowContratoFiltro(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, marginTop: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 16px 40px rgba(15,23,42,.16)", padding: 10, width: 340, maxWidth: "90vw", maxHeight: 360, overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 4px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>Mostrar só estes contratos</span>
                  {contratoFiltro.length > 0 && <button onClick={() => { setContratoFiltro([]); setPage(1); }} style={{ background: "none", border: "none", color: "#0f3171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Limpar</button>}
                </div>
                {contratoCounts.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 6px" }}>Nenhum contrato com solicitação.</div>
                ) : contratoCounts.map(c => {
                  const checked = contratoFiltro.includes(c.contrato);
                  return (
                    <label key={c.contrato} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 6px", borderRadius: 8, cursor: "pointer", background: checked ? "#eef4ff" : "transparent" }}>
                      <input type="checkbox" checked={checked} onChange={() => { setContratoFiltro(prev => checked ? prev.filter(x => x !== c.contrato) : [...prev, c.contrato]); setPage(1); }} style={{ width: 15, height: 15, accentColor: "#0f3171", cursor: "pointer" }} />
                      <span style={{ flex: 1, fontSize: 13, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.contrato}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#0f3171", background: "#fff", border: "1px solid #dbe4f0", borderRadius: 20, padding: "1px 9px", minWidth: 22, textAlign: "center" }}>{c.n}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Tabela View */}
        {view === "tabela" && (
          <>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
              {tabs.map(t => (
                <button key={t.tab} onClick={() => { setTab(t.tab); setPage(1); }} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: tab === t.tab ? "#0f3171" : "#fff", color: tab === t.tab ? "#fff" : "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Status Pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {[
                { label: "Pend. Analista", val: "Aguardando Aprovação" },
                { label: "Pend. Recrutamento", val: "Aguardando Recrutamento" },
                { label: "Em Processo", val: "em_processo" },
                { label: "Contratados", val: "Contratado" },
                { label: "Reprovados", val: "Reprovada" },
                { label: "Todas", val: "" },
              ].map(p => (
                <button key={p.val} onClick={() => { setStatusFilter(p.val); setPage(1); }} style={{ padding: "5px 13px", borderRadius: 20, border: "1px solid #e2e8f0", background: statusFilter === p.val ? "#0f3171" : "#fff", color: statusFilter === p.val ? "#fff" : "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Busca */}
            <div style={{ marginBottom: 10 }}>
              <input style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: 12, padding: "9px 12px", outline: "none", width: "100%", maxWidth: 400, boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}
                placeholder="Buscar por cargo, contrato, cidade..."
                onChange={e => debounceSearch(e.target.value)} />
            </div>

            {/* Tabela */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
              {loading ? (
                <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Carregando...</div>
              ) : items.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Nenhuma solicitação encontrada.</div>
              ) : (
                <table className="rec-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Contrato</th><th>Cargo</th><th>Cidade</th>
                      <th>Status</th><th>Urgência</th><th>Solicitante</th><th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} onClick={() => verDetalhe(item.id)}>
                        <td style={{ color: "#94a3b8", fontSize: 11 }}>#{item.id}</td>
                        <td style={{ fontWeight: 600, color: "#0f172a" }}>{item.contrato || "—"}</td>
                        <td>{item.cargo || "—"}</td>
                        <td>{item.cidade || "—"}</td>
                        <td><span className={`rec-badge ${badgeStatusCls(item.status)}`}>{item.status || "—"}</span></td>
                        <td>{item.grau_urgencia ? <span className={`rec-badge ${badgeUrgCls(item.grau_urgencia)}`}>{item.grau_urgencia.startsWith("Alta") ? "⚡ Alta" : item.grau_urgencia}</span> : "—"}</td>
                        <td>{item.solicitante_nome || "—"}</td>
                        <td style={{ color: "#94a3b8", fontSize: 11 }}>{fmtDt(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginação */}
            {pages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: "5px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? .35 : 1 }}>‹ Anterior</button>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Página {page} de {pages} ({total} registros)</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} style={{ padding: "5px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: page >= pages ? "default" : "pointer", opacity: page >= pages ? .35 : 1 }}>Próxima ›</button>
              </div>
            )}
          </>
        )}

        {/* Kanban View */}
        {view === "kanban" && (
          <>
            <div className="kb-toolbar">
              <span className="kb-hint">Arraste os cards entre as colunas · <strong>clique e arraste a tela</strong>, use as setas ou <strong>Shift + roda do mouse</strong> para navegar →</span>
              <div className="kb-nav">
                <button type="button" className="kb-nav-btn" onClick={() => scrollKb(-1)} aria-label="Rolar para a esquerda" title="Rolar para a esquerda">◀</button>
                <button type="button" className="kb-nav-btn" onClick={() => scrollKb(1)} aria-label="Rolar para a direita" title="Rolar para a direita">▶</button>
              </div>
            </div>
          <div className="kb-board" ref={kbBoardRef}
            onMouseDown={kbPanDown} onMouseMove={kbPanMove} onMouseUp={kbPanEnd} onMouseLeave={kbPanEnd}>
            {KB_STATUS_ORDER.map(status => {
              const cards = kanbanData[status] ?? [];
              const meta  = KB_COL_COLORS[status] ?? { dot: "#f97316", label: "#ea580c", accent: "#f97316" };
              return (
                <div key={status} className={`kb-col${dragOver === status ? " drag-over" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(status); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => kbDrop(status)}>
                  <div className="kb-col-head">
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.dot, flexShrink: 0, display: "inline-block" }}></span>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".4px", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "uppercase", color: meta.label }}>{status}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, background: "#eef2f7", borderRadius: 20, padding: "1px 7px", color: "#94a3b8" }}>{cards.length}</span>
                  </div>
                  <div className="kb-col-body">
                    {cards.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "22px 8px", color: "#94a3b8", fontSize: 10, opacity: .6 }}>Nenhuma solicitação</div>
                    ) : cards.map(c => {
                      const dias = Math.floor((Date.now() - new Date(c.status_changed_at || c.created_at).getTime()) / 86400000);
                      return (
                        <div key={c.id} id={`kbcard_${c.id}`} className={`kb-card${dragId === c.id ? " dragging" : ""}`}
                          draggable
                          onDragStart={() => { setDragId(c.id); setDragStatus(status); }}
                          onDragEnd={() => { setDragOver(null); }}
                          onClick={() => verDetalhe(c.id)}>
                          <div style={{ height: 3, background: meta.accent }}></div>
                          <div style={{ padding: "9px 10px 8px" }}>
                            <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, fontFamily: "monospace", marginBottom: 3 }}>#{c.id}</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.cargo || "—"}</div>
                            <div style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 5 }}>{c.contrato || ""}</div>
                            {c.cidade && <div style={{ fontSize: 10, color: "#475569", marginBottom: 6 }}>📍 {c.cidade}</div>}
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                              {c.grau_urgencia?.startsWith("Alta") && <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: "#fee2e2", color: "#dc2626" }}>🔴 Urgente</span>}
                              {c.quantidade_vagas && c.quantidade_vagas > 1 && <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: "rgba(249,115,22,.12)", color: "#f97316" }}>{c.quantidade_vagas} vagas</span>}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "5px 10px 6px", background: "#fcfdff" }}>
                            <span style={{ fontSize: 9, color: "#94a3b8" }} title={`Tempo parado neste status (${status})`}>⏱ {dias === 0 ? "hoje" : `${dias}d nesta etapa`}</span>
                            <span style={{ fontSize: 9, color: "#94a3b8", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(c.analista_nome ?? c.solicitante_nome ?? "").split(" ")[0]}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      {/* ── Drawer Detalhe ── */}
      {drawerId && (
        <div className="rec-drawer-ov" onClick={e => { if (e.target === e.currentTarget) fecharDrawer(); }}>
          <div className="rec-drawer">
            {/* Head */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #e2e8f0", flexShrink: 0, gap: 10, flexWrap: "wrap", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700 }}>Solicitação #{drawerId}</span>
                {drawerSol && <span className={`rec-badge ${badgeStatusCls(drawerSol.status)}`}>{drawerSol.status}</span>}
                {drawerSol?.grau_urgencia && <span className={`rec-badge ${badgeUrgCls(drawerSol.grau_urgencia)}`}>{drawerSol.grau_urgencia.startsWith("Alta") ? "⚡ Alta" : drawerSol.grau_urgencia}</span>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {drawerSol && renderActions(drawerSol)}
                <button onClick={fecharDrawer} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>✕</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
              {/* Left: detalhe */}
              <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
                {drawerSol ? renderDetalhe(drawerSol) : <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Carregando...</div>}
              </div>

              {/* Right: chat */}
              <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderLeft: "1px solid #e2e8f0", background: "#fff" }}>
                <div style={{ padding: "11px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 700, color: "#475569", flexShrink: 0, background: "#f8fafc", display: "flex", alignItems: "center", gap: 6 }}>
                  💬 Chat
                </div>
                <div className="rec-chat-msgs" style={{ background: "linear-gradient(180deg,#fff 0%,#f8fafc 100%)" }}>
                  {msgs.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, padding: "24px 16px" }}>Nenhuma mensagem ainda.</div>
                  ) : msgs.map(m => {
                    const mine = m.autor_cpf === user?.email;
                    return (
                      <div key={m.id} className={`rec-cmsg ${mine ? "mine" : "theirs"}`}>
                        <div style={{ fontSize: 10, color: "#94a3b8", padding: "0 2px" }}>{m.is_treinamento ? "🎓 " : ""}{m.autor_nome}</div>
                        <div className={mine ? "rec-cbubble-mine" : "rec-cbubble-theirs"}>{m.mensagem}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8", padding: "0 2px" }}>{fmtDt(m.created_at)}</div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                {!isRH && (
                  <div style={{ padding: "10px 12px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 7, flexShrink: 0, background: "#f8fafc" }}>
                    <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Escreva uma mensagem..." style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#0f172a", fontSize: 13, padding: "8px 12px", outline: "none", resize: "none", fontFamily: "inherit", minHeight: 60, width: "100%" }} />
                    <button onClick={enviarMsg} disabled={sendingMsg || !chatInput.trim()} style={{ background: "#0f3171", color: "#fff", border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", alignSelf: "flex-end", opacity: sendingMsg || !chatInput.trim() ? .5 : 1 }}>
                      ➤ Enviar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: "10px 20px", borderTop: "1px solid #e2e8f0", flexShrink: 0, display: "flex", justifyContent: "flex-end", background: "#f8fafc" }}>
              <button onClick={fecharDrawer} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Reprovar ── */}
      {modalReprovar && (
        <div className="rec-modal-ov">
          <div className="rec-modal">
            <button onClick={() => setModalReprovar(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Reprovar Solicitação</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 18 }}>Informe o motivo da reprovação.</div>
            <div className="rec-fg">
              <label>Motivo da reprovação *</label>
              <textarea className="rec-fi" rows={4} placeholder="Descreva o motivo..." value={reprovarMotivo} onChange={e => setReprovarMotivo(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setModalReprovar(false)} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmarReprovar} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirmar Reprovação</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Status ── */}
      {modalStatus && (
        <div className="rec-modal-ov">
          <div className="rec-modal">
            <button onClick={() => setModalStatus(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Atualizar Status — #{drawerId}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 18 }}>Selecione o novo status da solicitação.</div>
            <div className="rec-fg">
              <label>Status</label>
              <select className="rec-fi" value={statusSel} onChange={e => { setStatusSel(e.target.value); setStatusExtra({}); }}>
                <option value="">— Selecione —</option>
                {["Vaga Aberta","Seleção de Currículos","Entrevistas","Entrevista com Gestor","Entrevista com Psicóloga","Aguardando Documentação","Aguardando ASO","Funcionário Selecionado","Contratado"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {statusSel === "Funcionário Selecionado" && (
              <div className="rec-fg">
                <label>Nome do Funcionário Selecionado *</label>
                <input className="rec-fi" placeholder="Nome completo" value={statusExtra.nome ?? ""} onChange={e => setStatusExtra(x => ({ ...x, nome: e.target.value }))} />
              </div>
            )}
            {statusSel === "Contratado" && (<>
              <div className="rec-fg"><label>Nome Completo do Contratado *</label><input className="rec-fi" placeholder="Nome completo" value={statusExtra.nome ?? ""} onChange={e => setStatusExtra(x => ({ ...x, nome: e.target.value }))} /></div>
              <div className="rec-fg"><label>Contato *</label><input className="rec-fi" placeholder="Telefone / e-mail" value={statusExtra.contato ?? ""} onChange={e => setStatusExtra(x => ({ ...x, contato: e.target.value }))} /></div>
              <div className="rec-fg"><label>Data de Início (DD/MM/AAAA) *</label><input className="rec-fi" placeholder="DD/MM/AAAA" maxLength={10} value={statusExtra.data ?? ""} onChange={e => setStatusExtra(x => ({ ...x, data: e.target.value }))} /></div>
            </>)}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={() => setModalStatus(false)} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmarStatus} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#0f3171", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Salvar Status</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Link ── */}
      {modalLink && drawerSol && (
        <div className="rec-modal-ov" onClick={e => { if (e.target === e.currentTarget) setModalLink(false); }}>
          <div className="rec-modal">
            <button onClick={() => setModalLink(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Link para Candidatura</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>Compartilhe este link para receber currículos.</div>
            <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(15,49,113,.07)", border: "1px solid rgba(15,49,113,.18)", borderRadius: 10, fontSize: 13 }}>
              <strong>{drawerSol.cargo}</strong>{drawerSol.cidade ? ` · 📍 ${drawerSol.cidade}` : ""}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Link de candidatura</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={linkUrl} onClick={e => (e.target as HTMLInputElement).select()} style={{ flex: 1, background: "rgba(255,255,255,.04)", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#f97316", fontFamily: "monospace", outline: "none" }} />
                <button onClick={() => { navigator.clipboard.writeText(linkUrl); setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 3000); }} style={{ flexShrink: 0, padding: "0 18px", background: linkCopiado ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#0f3171,#1e4a8a)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {linkCopiado ? "✓ Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setModalLink(false)} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Mover Kanban ── */}
      {modalMoverKb && pendMover && (
        <div className="rec-modal-ov">
          <div className="rec-modal" style={{ maxWidth: 400 }}>
            <button onClick={() => { setModalMoverKb(false); setPendMover(null); }} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
              {pendMover.novoStatus === "Reprovada" ? "Reprovar Solicitação" : pendMover.novoStatus}
            </div>
            {pendMover.novoStatus === "Funcionário Selecionado" && (
              <div className="rec-fg"><label>Nome do Funcionário *</label><input className="rec-fi" placeholder="Nome completo" value={moverExtra.nome ?? ""} onChange={e => setMoverExtra(x => ({ ...x, nome: e.target.value }))} /></div>
            )}
            {pendMover.novoStatus === "Contratado" && (<>
              <div className="rec-fg"><label>Nome Completo *</label><input className="rec-fi" placeholder="Nome completo" value={moverExtra.nome ?? ""} onChange={e => setMoverExtra(x => ({ ...x, nome: e.target.value }))} /></div>
              <div className="rec-fg"><label>Contato *</label><input className="rec-fi" placeholder="Telefone / e-mail" value={moverExtra.contato ?? ""} onChange={e => setMoverExtra(x => ({ ...x, contato: e.target.value }))} /></div>
              <div className="rec-fg"><label>Data de Início (DD/MM/AAAA) *</label><input className="rec-fi" placeholder="DD/MM/AAAA" maxLength={10} value={moverExtra.data ?? ""} onChange={e => setMoverExtra(x => ({ ...x, data: e.target.value }))} /></div>
            </>)}
            {pendMover.novoStatus === "Reprovada" && (
              <div className="rec-fg"><label>Motivo *</label><textarea className="rec-fi" rows={3} placeholder="Descreva o motivo..." value={moverExtra.motivo ?? ""} onChange={e => setMoverExtra(x => ({ ...x, motivo: e.target.value }))} /></div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => { setModalMoverKb(false); setPendMover(null); }} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmarMoverKb} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#0f3171", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Painel Currículos ── */}
      {showCurriculos && (
        <div className="cv-panel-ov" onClick={e => { if (e.target === e.currentTarget) setShowCurriculos(false); }}>
          <div className="cv-panel">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: "1px solid #e2e8f0", flexShrink: 0, background: "#f8fafc", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
                Currículos Recebidos
                <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(249,115,22,.12)", color: "#f97316", border: "1px solid rgba(249,115,22,.18)" }}>{curriculos.length}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{drawerSol?.cargo} — #{drawerId}</span>
                <button onClick={() => setShowCurriculos(false)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
              {curriculos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                  <div style={{ fontSize: 14, marginBottom: 4 }}>Nenhum currículo recebido ainda.</div>
                  <div style={{ fontSize: 12 }}>Com a vaga em <b>“Seleção de Currículos”</b>, ela aparece no portal público <b>/vagas</b> para receber candidaturas.</div>
                </div>
              ) : (
                <div className="cv-grid">
                  {curriculos.map(cv => (
                    <div key={cv.id} className="cv-card">
                      <div style={{ height: 3, background: cv.origem === "whatsapp" ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#0f3171,#1e4a8a)" }}></div>
                      <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", padding: "3px 9px", borderRadius: 4, background: cv.origem === "whatsapp" ? "rgba(34,197,94,.1)" : "rgba(249,115,22,.12)", color: cv.origem === "whatsapp" ? "#22c55e" : "#f97316", border: `1px solid ${cv.origem === "whatsapp" ? "rgba(34,197,94,.2)" : "rgba(249,115,22,.18)"}` }}>
                          {cv.origem === "whatsapp" ? "WhatsApp" : "Link Público"}
                        </span>
                        {cv.nome ? <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{cv.nome}</div> : <div style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", fontStyle: "italic" }}>Nome não informado</div>}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {cv.telefone && <div style={{ fontSize: 12, color: "#475569", display: "flex", gap: 7 }}><span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", minWidth: 50 }}>Fone</span>{cv.telefone}</div>}
                          {cv.email    && <div style={{ fontSize: 12, color: "#475569", display: "flex", gap: 7 }}><span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", minWidth: 50 }}>Email</span>{cv.email}</div>}
                          {cv.cpf      && <div style={{ fontSize: 12, color: "#475569", display: "flex", gap: 7 }}><span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", minWidth: 50 }}>CPF</span>{cv.cpf}</div>}
                        </div>
                        {cv.mensagem && <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: "10px 12px", lineHeight: 1.6, maxHeight: 80, overflow: "hidden" }}>{cv.mensagem}</div>}
                      </div>
                      <div style={{ padding: "12px 18px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#fcfdff" }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDt(cv.created_at)}</span>
                        {cv.tem_pdf ? (
                          <button onClick={() => baixarCurriculo(cv)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, background: "rgba(249,115,22,.12)", border: "1px solid rgba(249,115,22,.25)", color: "#f97316", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            ↓ Baixar currículo
                          </button>
                        ) : <span style={{ fontSize: 11, color: "#94a3b8" }}>Sem arquivo</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nova Vaga (Wizard 3 etapas) ── */}
      {modalVaga && (
        <div className="rec-modal-ov">
          <div className="rec-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setModalVaga(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Solicitar Nova Vaga</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
              {vagaStep === 1 ? "Etapa 1 de 3 — Identificação da Vaga" : vagaStep === 2 ? "Etapa 2 de 3 — Detalhes do Posto" : "Etapa 3 de 3 — Requisitos e Urgência"}
            </div>

            {/* Progress */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < vagaStep ? "#16a34a" : i === vagaStep ? "#0f3171" : "#dbe4f0", transition: "background .2s" }}></div>
              ))}
            </div>

            {/* Step 1 */}
            {vagaStep === 1 && (<>
              <div className="rec-fg">
                <label>Motivo da Vaga *</label>
                <select className="rec-fi" value={vaga.motivo_vaga} onChange={e => setVaga(v => ({ ...v, motivo_vaga: e.target.value }))}>
                  <option value="">— Selecione —</option>
                  {["Admissão","Substituição","Expansão","Transferência","Retorno"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              {vaga.motivo_vaga === "Substituição" && (
                <div className="rec-fg" style={{ position: "relative" }}
                  onBlur={() => setTimeout(() => setShowEmpDrop(false), 150)}>
                  <label>Colaborador a Substituir</label>
                  <input
                    className="rec-fi"
                    placeholder="Buscar colaborador..."
                    value={empSearch}
                    autoComplete="off"
                    onChange={e => {
                      const v = e.target.value;
                      setEmpSearch(v);
                      setVaga(prev => ({ ...prev, nome_substituido: v }));
                      if (empDebounce.current) clearTimeout(empDebounce.current);
                      if (v.trim().length >= 2) {
                        setShowEmpDrop(true);
                        setLoadingEmps(true);
                        empDebounce.current = setTimeout(() => buscarEmpregados(v.trim()), 350);
                      } else { setShowEmpDrop(false); setEmpregados([]); }
                    }}
                  />
                  {showEmpDrop && empSearch.length >= 2 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,.14)", maxHeight: 220, overflowY: "auto", marginTop: 2 }}>
                      {loadingEmps ? (
                        <div style={{ padding: "12px", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>Buscando...</div>
                      ) : (() => {
                        const filtrados = empregados.slice(0, 40);
                        return filtrados.length === 0 ? (
                          <div style={{ padding: "12px", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>Nenhum colaborador encontrado.</div>
                        ) : filtrados.map((emp, i) => (
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
              <div className="rec-fg">
                <label>Contrato *</label>
                <select className="rec-fi" value={vaga.contrato} onChange={e => setVaga(v => ({ ...v, contrato: e.target.value }))}>
                  <option value="">— Selecione —</option>
                  {contratos.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="rec-fg"><label>Cargo *</label><input className="rec-fi" placeholder="Ex: Auxiliar de Limpeza, Vigilante..." value={vaga.cargo} onChange={e => setVaga(v => ({ ...v, cargo: e.target.value }))} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="rec-fg">
                  <label>Estado (UF)</label>
                  <select className="rec-fi" value={vaga.estado} onChange={e => setVaga(v => ({ ...v, estado: e.target.value, cidade: "" }))}>
                    <option value="">— Selecione —</option>
                    {ESTADOS_BR.map(e => <option key={e.uf} value={e.uf}>{e.uf} — {e.nome}</option>)}
                  </select>
                </div>
                <div className="rec-fg">
                  <label>Cidade</label>
                  <select className="rec-fi" value={vaga.cidade} disabled={!vaga.estado} onChange={e => setVaga(v => ({ ...v, cidade: e.target.value }))}>
                    <option value="">{vaga.estado ? "— Selecione —" : "Selecione o estado primeiro"}</option>
                    {municipiosDe(vaga.estado).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </>)}

            {/* Step 2 */}
            {vagaStep === 2 && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="rec-fg"><label>Quantidade de Vagas</label><input className="rec-fi" type="number" min={1} max={99} value={vaga.quantidade_vagas} onChange={e => setVaga(v => ({ ...v, quantidade_vagas: e.target.value }))} /></div>
                <div className="rec-fg"><label>Data de Início Prevista</label><input className="rec-fi" type="date" value={vaga.data_inicio_prevista} onChange={e => setVaga(v => ({ ...v, data_inicio_prevista: e.target.value }))} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="rec-fg"><label>Escala</label><input className="rec-fi" placeholder="Ex: 12x36, 5x2..." value={vaga.escala} onChange={e => setVaga(v => ({ ...v, escala: e.target.value }))} /></div>
                <div className="rec-fg"><label>Horário</label><input className="rec-fi" placeholder="Ex: 07h às 19h..." value={vaga.horario} onChange={e => setVaga(v => ({ ...v, horario: e.target.value }))} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="rec-fg"><label>Salário</label><input className="rec-fi" placeholder="Ex: R$ 1.412,00" value={vaga.salario} onChange={e => setVaga(v => ({ ...v, salario: e.target.value }))} /></div>
                <div className="rec-fg">
                  <label>Insalubridade</label>
                  <select className="rec-fi" value={vaga.insalubridade_recebe} onChange={e => setVaga(v => ({ ...v, insalubridade_recebe: e.target.value }))}>
                    <option>Não</option><option>Sim</option>
                  </select>
                </div>
              </div>
              {vaga.insalubridade_recebe === "Sim" && (
                <div className="rec-fg"><label>Percentual de Insalubridade</label><input className="rec-fi" placeholder="Ex: 20%, 40%" value={vaga.insalubridade_quanto} onChange={e => setVaga(v => ({ ...v, insalubridade_quanto: e.target.value }))} /></div>
              )}
              <div className="rec-fg"><label>Benefícios</label><textarea className="rec-fi" rows={2} placeholder="VT, VR, Plano de Saúde..." value={vaga.beneficios} onChange={e => setVaga(v => ({ ...v, beneficios: e.target.value }))} /></div>
              <div className="rec-fg"><label>Local Exato / Posto</label><input className="rec-fi" placeholder="Nome do posto ou endereço..." value={vaga.local_exato} onChange={e => setVaga(v => ({ ...v, local_exato: e.target.value }))} /></div>
            </>)}

            {/* Step 3 */}
            {vagaStep === 3 && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="rec-fg">
                  <label>Grau de Urgência</label>
                  <select className="rec-fi" value={vaga.grau_urgencia} onChange={e => setVaga(v => ({ ...v, grau_urgencia: e.target.value }))}>
                    <option value="">— Selecione —</option>
                    {["Baixa","Média","Alta — Urgente"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="rec-fg">
                  <label>Alta Rotatividade?</label>
                  <select className="rec-fi" value={vaga.alta_rotatividade} onChange={e => setVaga(v => ({ ...v, alta_rotatividade: e.target.value }))}>
                    <option>Não</option><option>Sim</option>
                  </select>
                </div>
              </div>
              <div className="rec-fg"><label>Requisitos Obrigatórios *</label><textarea className="rec-fi" rows={3} placeholder="Experiência comprovada, CNH B..." value={vaga.req_obrigatorios} onChange={e => setVaga(v => ({ ...v, req_obrigatorios: e.target.value }))} /></div>
              <div className="rec-fg"><label>Requisitos Desejáveis</label><textarea className="rec-fi" rows={2} placeholder="Inglês básico, curso técnico... (opcional)" value={vaga.req_desejaveis} onChange={e => setVaga(v => ({ ...v, req_desejaveis: e.target.value }))} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="rec-fg">
                  <label>Experiência Mínima?</label>
                  <select className="rec-fi" value={vaga.exp_minima} onChange={e => setVaga(v => ({ ...v, exp_minima: e.target.value }))}>
                    <option>Não</option><option>Sim</option>
                  </select>
                </div>
                {vaga.exp_minima === "Sim" && (
                  <div className="rec-fg"><label>Qual experiência?</label><input className="rec-fi" placeholder="Ex: 6 meses em limpeza" value={vaga.exp_minima_qual} onChange={e => setVaga(v => ({ ...v, exp_minima_qual: e.target.value }))} /></div>
                )}
              </div>
              <div className="rec-fg"><label>Observação Importante</label><textarea className="rec-fi" rows={2} placeholder="Opcional..." value={vaga.observacao_importante} onChange={e => setVaga(v => ({ ...v, observacao_importante: e.target.value }))} /></div>
            </>)}

            {/* Navegação */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
              <div />
              <div style={{ display: "flex", gap: 8 }}>
                {vagaStep > 1 && <button onClick={() => setVagaStep(s => s - 1)} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← Anterior</button>}
                {vagaStep < 3 && <button onClick={() => { if (vagaValidar(vagaStep)) setVagaStep(s => s + 1); }} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#0f3171", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Próximo →</button>}
                {vagaStep === 3 && <button onClick={submitVaga} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ Solicitar Vaga</button>}
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
            color:      t.type === "ok" ? "#15803d"  : t.type === "err" ? "#b91c1c"  : "#1d4ed8",
            border: `1px solid ${t.type === "ok" ? "#86efac" : t.type === "err" ? "#fecaca" : "#bfdbfe"}`,
          }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
