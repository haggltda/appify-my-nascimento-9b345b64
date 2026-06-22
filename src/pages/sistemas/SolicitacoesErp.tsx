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
import { Plus, Paperclip, Download, UserCircle2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Solicitacao {
  id: string;
  titulo: string;
  descricao: string | null;
  etapa: string;
  responsavel_user_id: string | null;
  progresso_pct: number;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
}

interface Anexo {
  id: string;
  storage_path: string;
  nome_arquivo: string;
  created_at: string;
}

interface Comentario {
  id: string;
  autor_id: string;
  texto: string;
  created_at: string;
}

const BUCKET = "sistema-solicitacoes";

const ETAPAS: Array<{ key: string; label: string; cor: string }> = [
  { key: "solicitacoes", label: "Solicitações", cor: "muted" },
  { key: "aprovado_presidencia", label: "Aprovado Presidência", cor: "primary" },
  { key: "projetos_definicao_responsavel", label: "Projetos e Definição de Responsável", cor: "accent" },
  { key: "em_andamento", label: "Em Andamento", cor: "info" },
  { key: "validacao_presidencia", label: "Validação Presidência", cor: "primary" },
  { key: "teste_setor_responsavel", label: "Teste com Setor Responsável", cor: "warning" },
  { key: "treinamentos", label: "Treinamentos", cor: "accent" },
  { key: "implantacao", label: "Implantação", cor: "success" },
];

// Classes Tailwind por token de cor — precisam estar escritas por extenso
// (não construídas via template string) pro JIT do Tailwind conseguir detectar.
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

// Fluxo linear: cada etapa só avança pra próxima exata, e só quem tem o
// toggle daquela transição ligado (em /app/administracao?tab=modulos,
// módulo "Sistemas") pode mover. Reforçado também no banco via trigger.
const PROXIMA_ETAPA: Record<string, { para: string; codigo: string }> = {
  solicitacoes: { para: "aprovado_presidencia", codigo: "sistemas_mover_solicitacoes_aprovado_presidencia" },
  aprovado_presidencia: { para: "projetos_definicao_responsavel", codigo: "sistemas_mover_aprovado_presidencia_projetos" },
  projetos_definicao_responsavel: { para: "em_andamento", codigo: "sistemas_mover_projetos_em_andamento" },
  em_andamento: { para: "validacao_presidencia", codigo: "sistemas_mover_em_andamento_validacao_presidencia" },
  validacao_presidencia: { para: "teste_setor_responsavel", codigo: "sistemas_mover_validacao_presidencia_teste_setor" },
  teste_setor_responsavel: { para: "treinamentos", codigo: "sistemas_mover_teste_setor_treinamentos" },
  treinamentos: { para: "implantacao", codigo: "sistemas_mover_treinamentos_implantacao" },
};

function iniciais(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function fmtData(data: string | null): string | null {
  if (!data) return null;
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function SolicitacoesErp() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: access } = useAccessibleMenus("visualizar");
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoDescricao, setNovoDescricao] = useState("");
  const [novaDataInicio, setNovaDataInicio] = useState("");
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [novoComentario, setNovoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [progressoInput, setProgressoInput] = useState(0);

  const podeCriar = access?.codes.has("sistemas_criar_solicitacao") ?? false;
  const podeMover = (codigo: string) => access?.codes.has(codigo) ?? false;
  // Definir responsável só é permitido na etapa "Projetos e Definição de
  // Responsável", por quem pode mover o card dela pra "Em Andamento" —
  // mesma regra reforçada no banco pelo trigger.
  const podeDefinirResponsavel = podeMover("sistemas_mover_projetos_em_andamento");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sistema_solicitacao"],
    queryFn: async () => {
      // Tabela nova — ainda não regenerada em integrations/supabase/types.ts
      // (mesmo padrão usado em rh/Ferias.tsx pra tabelas recém-criadas).
      const { data, error } = await (supabase as any)
        .from("sistema_solicitacao")
        .select("id, titulo, descricao, etapa, responsavel_user_id, progresso_pct, data_inicio, data_fim, created_at")
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
  const nomeUsuario = (id: string | null) => usuarios.find((u) => u.id === id)?.display_name ?? null;

  const grouped = useMemo(() => {
    const m = new Map<string, Solicitacao[]>();
    ETAPAS.forEach((e) => m.set(e.key, []));
    rows.forEach((r) => m.get(r.etapa)?.push(r));
    return m;
  }, [rows]);

  const cardDetalhe = rows.find((r) => r.id === detalheId) ?? null;

  const { data: anexos = [] } = useQuery({
    queryKey: ["sistema_solicitacao_anexo", detalheId],
    enabled: !!detalheId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sistema_solicitacao_anexo")
        .select("id, storage_path, nome_arquivo, created_at")
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
        .select("id, autor_id, texto, created_at")
        .eq("solicitacao_id", detalheId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comentario[];
    },
  });

  const criar = async () => {
    if (!novoTitulo.trim() || !novaDataInicio) return;
    setSalvando(true);
    const { data, error } = await (supabase as any)
      .from("sistema_solicitacao")
      .insert({
        titulo: novoTitulo.trim(),
        descricao: novoDescricao.trim() || null,
        data_inicio: novaDataInicio,
      })
      .select("id")
      .single();
    if (error) {
      setSalvando(false);
      toast({ title: "Erro ao criar solicitação", description: error.message, variant: "destructive" });
      return;
    }
    if (novoArquivo) {
      const { error: anexoError } = await uploadAnexo(data.id, novoArquivo);
      if (anexoError) {
        toast({ title: "Solicitação criada, mas o anexo falhou", description: anexoError, variant: "destructive" });
      }
    }
    setSalvando(false);
    setNovoOpen(false);
    setNovoTitulo("");
    setNovoDescricao("");
    setNovaDataInicio("");
    setNovoArquivo(null);
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao"] });
    toast({ title: "Solicitação criada" });
  };

  const onDrop = async (e: React.DragEvent, colunaDestino: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const card = rows.find((r) => r.id === id);
    if (!card) return;

    const transicao = PROXIMA_ETAPA[card.etapa];
    if (!transicao || transicao.para !== colunaDestino) {
      toast({ title: "Transição não permitida", description: "Cards só avançam para a próxima etapa do fluxo.", variant: "destructive" });
      return;
    }
    if (!podeMover(transicao.codigo)) {
      toast({ title: "Sem permissão", description: "Você não pode mover cards desta etapa.", variant: "destructive" });
      return;
    }

    const { error } = await (supabase as any).from("sistema_solicitacao").update({ etapa: colunaDestino }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao mover", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["sistema_solicitacao"] });
    }
  };

  const definirResponsavel = async (userId: string) => {
    if (!cardDetalhe) return;
    const { error } = await (supabase as any)
      .from("sistema_solicitacao")
      .update({ responsavel_user_id: userId })
      .eq("id", cardDetalhe.id);
    if (error) {
      toast({ title: "Erro ao definir responsável", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao"] });
  };

  // Mesma regra pra progresso e pra data final: só quem é o responsável
  // atual da solicitação (não importa o código de permissão).
  const souResponsavelAtual = !!user?.id && !!cardDetalhe && user.id === cardDetalhe.responsavel_user_id;

  const salvarProgresso = async (pct: number) => {
    if (!cardDetalhe) return;
    const { error } = await (supabase as any)
      .from("sistema_solicitacao")
      .update({ progresso_pct: pct })
      .eq("id", cardDetalhe.id);
    if (error) {
      toast({ title: "Erro ao atualizar progresso", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao"] });
  };

  const salvarDataFim = async (data: string) => {
    if (!cardDetalhe) return;
    const { error } = await (supabase as any)
      .from("sistema_solicitacao")
      .update({ data_fim: data || null })
      .eq("id", cardDetalhe.id);
    if (error) {
      toast({ title: "Erro ao atualizar data final", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao"] });
  };

  const uploadAnexo = async (solicitacaoId: string, file: File): Promise<{ error: string | null }> => {
    const path = `${solicitacaoId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (up.error) return { error: up.error.message };
    const { error } = await (supabase as any).from("sistema_solicitacao_anexo").insert({
      solicitacao_id: solicitacaoId,
      storage_path: path,
      nome_arquivo: file.name,
      mime_type: file.type || null,
      tamanho_bytes: file.size,
    });
    return { error: error?.message ?? null };
  };

  const anexar = async () => {
    if (!pendingFile || !cardDetalhe) return;
    setEnviandoAnexo(true);
    const { error } = await uploadAnexo(cardDetalhe.id, pendingFile);
    setEnviandoAnexo(false);
    if (error) {
      toast({ title: "Erro ao enviar anexo", description: error, variant: "destructive" });
      return;
    }
    setPendingFile(null);
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao_anexo", cardDetalhe.id] });
    toast({ title: "Anexo enviado" });
  };

  const getDownloadUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const comentar = async () => {
    if (!novoComentario.trim() || !cardDetalhe) return;
    setEnviandoComentario(true);
    const { error } = await (supabase as any).from("sistema_solicitacao_comentario").insert({
      solicitacao_id: cardDetalhe.id,
      texto: novoComentario.trim(),
    });
    setEnviandoComentario(false);
    if (error) {
      toast({ title: "Erro ao comentar", description: error.message, variant: "destructive" });
      return;
    }
    setNovoComentario("");
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao_comentario", cardDetalhe.id] });
  };

  return (
    <div>
      <PageHeader
        title="Solicitações ERP"
        subtitle="Fluxo de demandas de sistemas — arraste o card para a próxima etapa."
        module="Sistemas"
        breadcrumb={["Solicitações ERP"]}
        actions={
          podeCriar ? (
            <Button onClick={() => setNovoOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova Solicitação
            </Button>
          ) : undefined
        }
      />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <div className="-mb-4 flex h-[calc(100vh-170px)] min-h-[420px] gap-3 overflow-x-auto pb-0 sm:-mb-6 lg:-mb-8">
        {ETAPAS.map((etapa) => (
          <div
            key={etapa.key}
            className="flex h-full min-w-[260px] flex-1 flex-col overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, etapa.key)}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                <span className={`h-2 w-2 rounded-full ${COR_DOT[etapa.cor]}`} />
                {etapa.label}
              </span>
              <Badge variant="outline" className="text-[10px]">{grouped.get(etapa.key)?.length ?? 0}</Badge>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {grouped.get(etapa.key)?.map((card) => {
                const transicao = PROXIMA_ETAPA[card.etapa];
                const arrastavel = !!transicao && podeMover(transicao.codigo);
                const responsavelNome = nomeUsuario(card.responsavel_user_id);
                return (
                  <Card
                    key={card.id}
                    draggable={arrastavel}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
                    onClick={() => { setDetalheId(card.id); setProgressoInput(card.progresso_pct); }}
                    className={`border-l-4 p-3 ${COR_BORDER[etapa.cor]} ${arrastavel ? "cursor-grab" : "cursor-pointer"}`}
                  >
                    <p className="text-xs font-medium">{card.titulo}</p>
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
              <label className="mb-1 block text-xs text-muted-foreground">Data de início</label>
              <Input type="date" value={novaDataInicio} onChange={(e) => setNovaDataInicio(e.target.value)} />
            </div>
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
            <Button onClick={criar} disabled={!novoTitulo.trim() || !novaDataInicio || salvando}>
              {salvando ? "Salvando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detalheId} onOpenChange={(open) => { if (!open) { setDetalheId(null); setPendingFile(null); setNovoComentario(""); setProgressoInput(0); } }}>
        <DialogContent className="max-w-3xl sm:max-w-3xl">
          {cardDetalhe && (
            <>
              <DialogHeader>
                <DialogTitle>{cardDetalhe.titulo}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                <div className="space-y-4">
                  {cardDetalhe.descricao && (
                    <p className="text-sm text-muted-foreground">{cardDetalhe.descricao}</p>
                  )}

                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Responsável</p>
                    <SearchableSelect
                      value={cardDetalhe.responsavel_user_id}
                      onChange={definirResponsavel}
                      options={usuarios.map((u) => ({ value: u.id, label: u.display_name }))}
                      placeholder="Sem responsável"
                      searchPlaceholder="Buscar usuário..."
                      disabled={!podeDefinirResponsavel || cardDetalhe.etapa !== "projetos_definicao_responsavel"}
                    />
                    {cardDetalhe.etapa !== "projetos_definicao_responsavel" && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Só pode ser definido com o card em "Projetos e Definição de Responsável".
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anexos</p>
                    <div className="space-y-1">
                      {anexos.map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded border border-border px-2 py-1.5 text-xs">
                          <span className="truncate" title={a.nome_arquivo}>{a.nome_arquivo}</span>
                          <a href={getDownloadUrl(a.storage_path)} target="_blank" rel="noopener noreferrer" className="ml-2 shrink-0 text-primary hover:underline">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ))}
                      {anexos.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhum anexo ainda.</p>}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="file"
                        onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                        className="flex-1 cursor-pointer text-xs"
                      />
                      {pendingFile && (
                        <Button size="sm" onClick={anexar} disabled={enviandoAnexo} className="gap-1.5">
                          <Paperclip className="h-3.5 w-3.5" />
                          {enviandoAnexo ? "Enviando…" : "Anexar"}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progresso</p>
                    <Progress value={progressoInput} className="h-2.5" />
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">
                        Digite a porcentagem concluída dessa demanda:
                      </label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={progressoInput}
                        disabled={!souResponsavelAtual}
                        onChange={(e) => setProgressoInput(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                        onBlur={() => salvarProgresso(progressoInput)}
                        onKeyDown={(e) => e.key === "Enter" && salvarProgresso(progressoInput)}
                        className="w-20 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    {!souResponsavelAtual && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Só o responsável pela demanda pode atualizar o progresso.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Datas</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">Data de início</label>
                        <p className="text-xs">
                          {cardDetalhe.data_inicio ? new Date(`${cardDetalhe.data_inicio}T00:00:00`).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">Data final</label>
                        <Input
                          type="date"
                          value={cardDetalhe.data_fim ?? ""}
                          disabled={!souResponsavelAtual}
                          onChange={(e) => salvarDataFim(e.target.value)}
                          className="w-40 text-xs"
                        />
                      </div>
                    </div>
                    {!souResponsavelAtual && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Só o responsável pela demanda pode preencher a data final.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex h-[420px] min-h-0 flex-col border-l border-border pl-4">
                  <p className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comentários</p>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                    {comentarios.map((c) => {
                      const nome = nomeUsuario(c.autor_id) ?? "Usuário";
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
                    {comentarios.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhum comentário ainda.</p>}
                  </div>
                  <div className="mt-3 flex shrink-0 items-center gap-2">
                    <Input
                      placeholder="Comentar..."
                      value={novoComentario}
                      onChange={(e) => setNovoComentario(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && comentar()}
                      className="text-xs"
                    />
                    <Button size="icon" variant="ghost" onClick={comentar} disabled={!novoComentario.trim() || enviandoComentario}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
