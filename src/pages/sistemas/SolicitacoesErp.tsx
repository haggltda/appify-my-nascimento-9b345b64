import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccessibleMenus } from "@/hooks/useAccessibleMenus";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, UserCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  ETAPAS, nomeUsuario, iniciais, fmtData,
  type Solicitacao, type Anexo, type Comentario, type Convidado, type Papeis,
} from "./etapas/types";
import { Historico } from "./etapas/Historico";
import { RegistroOficialPanel } from "./etapas/RegistroOficialPanel";
import { TriagemComitePanel } from "./etapas/TriagemComitePanel";
import { ProjetoPanel } from "./etapas/ProjetoPanel";
import { AprovacoesPriorizacaoPanel } from "./etapas/AprovacoesPriorizacaoPanel";
import { DefinicaoResponsavelPanel } from "./etapas/DefinicaoResponsavelPanel";
import { DesenvolvimentoAjustesPanel } from "./etapas/DesenvolvimentoAjustesPanel";
import { HomologacaoTecnicaPanel } from "./etapas/HomologacaoTecnicaPanel";
import { HomologacaoUsuarioPanel } from "./etapas/HomologacaoUsuarioPanel";
import { TreinamentosPanel } from "./etapas/TreinamentosPanel";
import { ImplantacaoPanel } from "./etapas/ImplantacaoPanel";
import { AcompanhamentoAssistidoPanel } from "./etapas/AcompanhamentoAssistidoPanel";
import { EncerramentoPanel } from "./etapas/EncerramentoPanel";

const BUCKET = "sistema-solicitacoes";

const PALETA_CORES = ["muted", "primary", "accent", "info", "warning", "success"] as const;
const ETAPAS_COR = ETAPAS.map((e, i) => ({ ...e, cor: PALETA_CORES[i % PALETA_CORES.length] }));

const COR_DOT: Record<string, string> = {
  muted: "bg-muted-foreground/40",
  primary: "bg-primary",
  accent: "bg-accent",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
};
const COR_BORDER: Record<string, string> = {
  muted: "border-l-muted-foreground/40",
  primary: "border-l-primary",
  accent: "border-l-accent",
  info: "border-l-info",
  warning: "border-l-warning",
  success: "border-l-success",
};

function DescricaoExpandivel({ texto }: { texto: string }) {
  const [expandido, setExpandido] = useState(false);
  const longa = texto.length > 220;
  return (
    <div>
      <p
        className={`whitespace-pre-wrap break-words text-sm text-muted-foreground ${!expandido && longa ? "line-clamp-4" : ""}`}
      >
        {texto}
      </p>
      {longa && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {expandido ? "ver menos" : "ver mais"}
        </button>
      )}
    </div>
  );
}

const PAINEIS: Record<string, (props: any) => JSX.Element> = {
  registro_oficial: RegistroOficialPanel,
  triagem_inicial_comite: TriagemComitePanel,
  projeto: ProjetoPanel,
  aprovacoes_priorizacao: AprovacoesPriorizacaoPanel,
  definicao_responsavel: DefinicaoResponsavelPanel,
  desenvolvimento_ajustes: DesenvolvimentoAjustesPanel,
  homologacao_tecnica: HomologacaoTecnicaPanel,
  homologacao_usuario: HomologacaoUsuarioPanel,
  treinamentos: TreinamentosPanel,
  implantacao: ImplantacaoPanel,
  acompanhamento_assistido: AcompanhamentoAssistidoPanel,
  encerramento: EncerramentoPanel,
};

export default function SolicitacoesErp() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: access } = useAccessibleMenus("visualizar");
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoDescricao, setNovoDescricao] = useState("");
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [aba, setAba] = useState<"detalhes" | "historico">("detalhes");
  const [novoComentario, setNovoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [filtroResponsavelDev, setFiltroResponsavelDev] = useState<string | null>(null);

  const papeis: Papeis = {
    comite: access?.codes.has("sistemas_comite") ?? false,
    controladoria: access?.codes.has("sistemas_controladoria") ?? false,
    gerenteSistemas: access?.codes.has("sistemas_gerente_sistemas") ?? false,
    desenvolvedores: access?.codes.has("sistemas_desenvolvedores") ?? false,
    criarSolicitacao: access?.codes.has("sistemas_criar_solicitacao") ?? false,
    convidado: access?.codes.has("sistemas_convidado") ?? false,
    verTodas: access?.codes.has("sistemas_ver_todas_solicitacoes") ?? false,
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sistema_solicitacao"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sistema_solicitacao")
        .select(
          "id, titulo, descricao, etapa, recusado, prioridade, responsavel_user_id, progresso_pct, data_inicio, data_fim, " +
          "levantamento_funcional_texto, levantamento_funcional_prazo, documentacao_tecnica_texto, documentacao_tecnica_prazo, " +
          "analise_tecnica_texto, analise_tecnica_prazo, treinamento_data, implantacao_status, finalizado, etapa_entrada_em, " +
          "homologacao_aprov_1, homologacao_aprov_2, homologacao_aprov_3, criado_por, created_at",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Solicitacao[];
    },
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["sistemas-usuarios-ativos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_usuarios_ativos");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; display_name: string }>;
    },
  });

  const { data: convidaveis = [] } = useQuery({
    queryKey: ["sistemas-usuarios-convidaveis"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_usuarios_convidaveis");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; display_name: string }>;
    },
  });

  const grouped = useMemo(() => {
    const m = new Map<string, Solicitacao[]>();
    ETAPAS.forEach((e) => m.set(e.key, []));
    rows.forEach((r) => m.get(r.etapa)?.push(r));
    // Recusados sempre por último na coluna.
    m.forEach((lista) => lista.sort((a, b) => (a.recusado === b.recusado ? 0 : a.recusado ? 1 : -1)));
    return m;
  }, [rows]);

  const cardDetalhe = rows.find((r) => r.id === detalheId) ?? null;

  const { data: anexos = [] } = useQuery({
    queryKey: ["sistema_solicitacao_anexo", detalheId],
    enabled: !!detalheId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sistema_solicitacao_anexo")
        .select("id, storage_path, nome_arquivo, campo, created_at")
        .eq("solicitacao_id", detalheId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Anexo[];
    },
  });

  const { data: comentarios = [] } = useQuery({
    queryKey: ["sistema_solicitacao_comentario", detalheId],
    enabled: !!detalheId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sistema_solicitacao_comentario")
        .select("id, autor_id, texto, tipo, created_at")
        .eq("solicitacao_id", detalheId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comentario[];
    },
  });

  const { data: convidados = [] } = useQuery({
    queryKey: ["sistema_solicitacao_convidado", detalheId],
    enabled: !!detalheId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sistema_solicitacao_convidado")
        .select("id, user_id, created_at")
        .eq("solicitacao_id", detalheId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Convidado[];
    },
  });

  const invalidarCard = () => {
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao"] });
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao_log", detalheId] });
  };

  const updateCard = async (id: string, patch: Record<string, unknown>): Promise<boolean> => {
    const cardAntes = rows.find((r) => r.id === id);
    const { error } = await (supabase as any).from("sistema_solicitacao").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }
    invalidarCard();

    if (typeof patch.etapa === "string" && cardAntes && patch.etapa !== cardAntes.etapa) {
      const novaEtapaLabel = ETAPAS.find((e) => e.key === patch.etapa)?.label ?? String(patch.etapa);
      toast({ title: "Card movido", description: `Etapa: ${novaEtapaLabel}` });
      if (detalheId === id) setDetalheId(null);
    } else if ("recusado" in patch) {
      toast({ title: patch.recusado ? "Card recusado" : "Card reativado" });
    } else if ("finalizado" in patch) {
      toast({ title: patch.finalizado ? "Demanda finalizada" : "Demanda reaberta" });
    }

    return true;
  };

  const update = (patch: Record<string, unknown>): Promise<boolean> =>
    cardDetalhe ? updateCard(cardDetalhe.id, patch) : Promise.resolve(false);

  const voltarParaSolicitacoes = (id: string) => updateCard(id, { etapa: "registro_oficial", recusado: false });

  const excluirCardId = async (id: string) => {
    const { error } = await (supabase as any).from("sistema_solicitacao").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao"] });
    toast({ title: "Solicitação excluída" });
  };

  const comentar = async (texto: string, tipo?: string): Promise<boolean> => {
    if (!cardDetalhe || !texto.trim()) return false;
    const { error } = await (supabase as any).from("sistema_solicitacao_comentario").insert({
      solicitacao_id: cardDetalhe.id,
      texto: texto.trim(),
      tipo: tipo ?? null,
    });
    if (error) {
      toast({ title: "Erro ao comentar", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao_comentario", cardDetalhe.id] });
    return true;
  };

  const uploadAnexo = async (solicitacaoId: string, file: File, campo?: string): Promise<string | null> => {
    const path = `${solicitacaoId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (up.error) return up.error.message;
    const { error } = await (supabase as any).from("sistema_solicitacao_anexo").insert({
      solicitacao_id: solicitacaoId,
      storage_path: path,
      nome_arquivo: file.name,
      mime_type: file.type || null,
      tamanho_bytes: file.size,
      campo: campo ?? null,
    });
    return error?.message ?? null;
  };

  const anexar = async (file: File, campo?: string): Promise<boolean> => {
    if (!cardDetalhe) return false;
    const erro = await uploadAnexo(cardDetalhe.id, file, campo);
    if (erro) {
      toast({ title: "Erro ao enviar anexo", description: erro, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao_anexo", cardDetalhe.id] });
    toast({ title: "Anexo enviado" });
    return true;
  };

  const downloadAnexo = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao abrir anexo", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const adicionarConvidado = async (userId: string): Promise<boolean> => {
    if (!cardDetalhe) return false;
    const { error } = await (supabase as any).from("sistema_solicitacao_convidado").insert({
      solicitacao_id: cardDetalhe.id,
      user_id: userId,
    });
    if (error) {
      toast({ title: "Erro ao adicionar convidado", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao_convidado", cardDetalhe.id] });
    return true;
  };

  const removerConvidado = async (convidadoId: string): Promise<boolean> => {
    const { error } = await (supabase as any).from("sistema_solicitacao_convidado").delete().eq("id", convidadoId);
    if (error) {
      toast({ title: "Erro ao remover convidado", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao_convidado", detalheId] });
    return true;
  };

  const excluirCard = async (): Promise<boolean> => {
    if (!cardDetalhe) return false;
    const { error } = await (supabase as any).from("sistema_solicitacao").delete().eq("id", cardDetalhe.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    }
    setDetalheId(null);
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao"] });
    toast({ title: "Solicitação excluída" });
    return true;
  };

  const criar = async () => {
    if (!novoTitulo.trim()) return;
    setSalvando(true);
    const { data, error } = await (supabase as any)
      .from("sistema_solicitacao")
      .insert({
        titulo: novoTitulo.trim(),
        descricao: novoDescricao.trim() || null,
      })
      .select("id")
      .single();
    if (error) {
      setSalvando(false);
      toast({ title: "Erro ao criar solicitação", description: error.message, variant: "destructive" });
      return;
    }
    if (novoArquivo) {
      const erro = await uploadAnexo(data.id, novoArquivo);
      if (erro) {
        toast({ title: "Solicitação criada, mas o anexo falhou", description: erro, variant: "destructive" });
      }
    }
    setSalvando(false);
    setNovoOpen(false);
    setNovoTitulo("");
    setNovoDescricao("");
    setNovoArquivo(null);
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao"] });
    toast({ title: "Solicitação criada" });
  };

  const comentarGeral = async () => {
    if (!novoComentario.trim()) return;
    setEnviandoComentario(true);
    const ok = await comentar(novoComentario);
    setEnviandoComentario(false);
    if (ok) setNovoComentario("");
  };

  const PainelEtapa = cardDetalhe ? PAINEIS[cardDetalhe.etapa] : null;
  const totalNaColuna = cardDetalhe ? (grouped.get(cardDetalhe.etapa)?.length ?? 0) : 0;
  const prioridadesUsadas = cardDetalhe
    ? (grouped.get("aprovacoes_priorizacao") ?? [])
        .filter((c) => c.id !== cardDetalhe.id && c.prioridade != null)
        .map((c) => c.prioridade as number)
    : [];
  const anexosGerais = anexos.filter((a) => !a.campo);
  const comentariosGerais = comentarios.filter((c) => !c.tipo);

  return (
    <div>
      <PageHeader
        title="Solicitações ERP"
        subtitle="Fluxo de demandas de sistemas — 12 etapas, papéis configuráveis em Administração."
        module="Sistemas"
        breadcrumb={["Solicitações ERP"]}
        actions={
          papeis.criarSolicitacao ? (
            <Button onClick={() => setNovoOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova Solicitação
            </Button>
          ) : undefined
        }
      />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <div className="-mb-4 flex h-[calc(100vh-170px)] min-h-[420px] gap-3 overflow-x-auto pb-0 sm:-mb-6 lg:-mb-8">
        {ETAPAS_COR.map((etapa) => (
          <div key={etapa.key} className="flex h-full min-w-[260px] flex-1 flex-col overflow-hidden">
            <div className="mb-2 flex shrink-0 items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                <span className={`h-2 w-2 rounded-full ${COR_DOT[etapa.cor]}`} />
                {etapa.label}
              </span>
              <Badge variant="outline" className="text-[10px]">{grouped.get(etapa.key)?.length ?? 0}</Badge>
            </div>
            {etapa.key === "desenvolvimento_ajustes" && (
              <div className="mb-2 shrink-0">
                <SearchableSelect
                  value={filtroResponsavelDev}
                  onChange={(v) => setFiltroResponsavelDev(v || null)}
                  options={[{ value: "", label: "Ver todos" }, ...usuarios.map((u) => ({ value: u.id, label: u.display_name }))]}
                  placeholder="Filtrar por responsável…"
                  searchPlaceholder="Buscar usuário..."
                  allowClear
                  clearValue=""
                />
              </div>
            )}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {(etapa.key === "desenvolvimento_ajustes" && filtroResponsavelDev
                ? grouped.get(etapa.key)?.filter((c) => c.responsavel_user_id === filtroResponsavelDev)
                : etapa.key === "aprovacoes_priorizacao"
                ? [...(grouped.get(etapa.key) ?? [])].sort((a, b) => (a.prioridade ?? Infinity) - (b.prioridade ?? Infinity))
                : grouped.get(etapa.key)
              )?.map((card) => {
                const responsavelNome = nomeUsuario(usuarios, card.responsavel_user_id);
                const estadoRecusadoControladoria = card.recusado && papeis.controladoria;
                const estadoRecusadoComum = card.recusado && !papeis.controladoria;
                return (
                  <Card
                    key={card.id}
                    onClick={() => { if (!estadoRecusadoComum) { setDetalheId(card.id); setAba("detalhes"); } }}
                    className={[
                      "relative border-l-4 p-3",
                      COR_BORDER[etapa.cor],
                      estadoRecusadoComum ? "cursor-default opacity-40" : "cursor-pointer",
                      estadoRecusadoControladoria ? "bg-warning/20 border-warning" : "",
                      card.finalizado ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    {card.prioridade != null && (
                      <Badge variant="outline" className="absolute right-2 top-2 text-[9px]">P{card.prioridade}</Badge>
                    )}
                    <p className="pr-8 text-xs font-medium">{card.titulo}</p>
                    {card.descricao && (
                      <p className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">{card.descricao}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px]">
                          {responsavelNome ? iniciais(responsavelNome) : <UserCircle2 className="h-3 w-3" />}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {responsavelNome ?? "Sem responsável"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={card.progresso_pct} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground">{card.progresso_pct}%</span>
                    </div>
                    <div className="mt-1.5 text-[10px] text-muted-foreground">
                      Início: {fmtData(card.data_inicio) ?? "—"}
                      {card.data_fim && <> · Fim: {fmtData(card.data_fim)}</>}
                    </div>
                    {card.recusado && (
                      <p className="mt-1.5 text-[10px] font-medium text-warning-foreground">Recusado</p>
                    )}
                    {estadoRecusadoControladoria && (
                      <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px]" onClick={() => voltarParaSolicitacoes(card.id)}>
                          Voltar para Solicitações
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 flex-1 text-[11px]" onClick={() => excluirCardId(card.id)}>
                          Excluir
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
              {grouped.get(etapa.key)?.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                  vazio
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Título" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} />
            <Textarea placeholder="Descrição (opcional)" value={novoDescricao} onChange={(e) => setNovoDescricao(e.target.value)} />
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Anexo (opcional)</label>
              <Input
                type="file"
                onChange={(e) => setNovoArquivo(e.target.files?.[0] ?? null)}
                className="cursor-pointer text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setNovoOpen(false); setNovoArquivo(null); }}>Cancelar</Button>
            <Button onClick={criar} disabled={!novoTitulo.trim() || salvando}>
              {salvando ? "Salvando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detalheId} onOpenChange={(open) => { if (!open) { setDetalheId(null); setNovoComentario(""); } }}>
        <DialogContent className="max-w-4xl sm:max-w-4xl">
          {cardDetalhe && PainelEtapa && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {cardDetalhe.titulo}
                  {cardDetalhe.recusado && <Badge variant="outline" className="text-warning-foreground">Recusado</Badge>}
                  {cardDetalhe.finalizado && <Badge variant="outline">Finalizado</Badge>}
                </DialogTitle>
              </DialogHeader>

              <div className="flex gap-2 border-b border-border pb-2">
                <button
                  onClick={() => setAba("detalhes")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${aba === "detalhes" ? "bg-muted" : "text-muted-foreground"}`}
                >
                  Detalhes
                </button>
                <button
                  onClick={() => setAba("historico")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${aba === "historico" ? "bg-muted" : "text-muted-foreground"}`}
                >
                  Histórico
                </button>
              </div>

              {aba === "historico" && (
                <div className="max-h-[420px] overflow-y-auto py-2">
                  <Historico solicitacaoId={cardDetalhe.id} usuarios={usuarios} />
                </div>
              )}

              {aba === "detalhes" && (
                <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                  <div className="space-y-4">
                    {cardDetalhe.descricao && <DescricaoExpandivel texto={cardDetalhe.descricao} />}

                    <PainelEtapa
                      card={cardDetalhe}
                      papeis={papeis}
                      userId={user?.id ?? null}
                      usuarios={usuarios}
                      convidaveis={convidaveis}
                      anexos={anexos}
                      comentarios={comentarios}
                      convidados={convidados}
                      totalNaColuna={totalNaColuna}
                      prioridadesUsadas={prioridadesUsadas}
                      onUpdate={update}
                      onComentar={comentar}
                      onAnexar={anexar}
                      onDownloadAnexo={downloadAnexo}
                      onAdicionarConvidado={adicionarConvidado}
                      onRemoverConvidado={removerConvidado}
                      onExcluir={excluirCard}
                    />

                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anexos gerais</p>
                      <div className="space-y-1">
                        {anexosGerais.map((a) => (
                          <div key={a.id} className="flex items-center justify-between rounded border border-border px-2 py-1.5 text-xs">
                            <span className="truncate" title={a.nome_arquivo}>{a.nome_arquivo}</span>
                            <button type="button" onClick={() => downloadAnexo(a.storage_path)} className="ml-2 shrink-0 text-primary hover:underline">
                              abrir
                            </button>
                          </div>
                        ))}
                        {anexosGerais.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhum anexo geral ainda.</p>}
                      </div>
                    </div>
                  </div>

                  <div className="flex h-[420px] min-h-0 flex-col border-l border-border pl-4">
                    <p className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comentários</p>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {comentariosGerais.map((c) => {
                        const nome = nomeUsuario(usuarios, c.autor_id) ?? "Usuário";
                        return (
                          <div key={c.id} className="flex items-start gap-2">
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarFallback className="text-[9px]">{iniciais(nome)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-[11px]">
                                <span className="font-medium">{nome}</span>
                                <span className="ml-1.5 text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                              </p>
                              <p className="break-words text-xs">{c.texto}</p>
                            </div>
                          </div>
                        );
                      })}
                      {comentariosGerais.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhum comentário ainda.</p>}
                    </div>
                    <div className="mt-3 flex shrink-0 items-center gap-2">
                      <Input
                        placeholder="Comentar..."
                        value={novoComentario}
                        onChange={(e) => setNovoComentario(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && comentarGeral()}
                        className="text-xs"
                      />
                      <Button size="sm" variant="ghost" onClick={comentarGeral} disabled={!novoComentario.trim() || enviandoComentario}>
                        Enviar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
