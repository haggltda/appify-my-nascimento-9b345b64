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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Solicitacao {
  id: string;
  titulo: string;
  descricao: string | null;
  etapa: string;
  created_at: string;
}

const ETAPAS: Array<{ key: string; label: string }> = [
  { key: "solicitacoes", label: "Solicitações" },
  { key: "aprovado_presidencia", label: "Aprovado Presidência" },
  { key: "projetos_definicao_responsavel", label: "Projetos e Definição de Responsável" },
  { key: "em_andamento", label: "Em Andamento" },
  { key: "validacao_presidencia", label: "Validação Presidência" },
  { key: "teste_setor_responsavel", label: "Teste com Setor Responsável" },
  { key: "treinamentos", label: "Treinamentos" },
  { key: "implantacao", label: "Implantação" },
];

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

export default function SolicitacoesErp() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: access } = useAccessibleMenus("visualizar");
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoDescricao, setNovoDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeCriar = access?.codes.has("sistemas_criar_solicitacao") ?? false;
  const podeMover = (codigo: string) => access?.codes.has(codigo) ?? false;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sistema_solicitacao"],
    queryFn: async () => {
      // Tabela nova — ainda não regenerada em integrations/supabase/types.ts
      // (mesmo padrão usado em rh/Ferias.tsx pra tabelas recém-criadas).
      const { data, error } = await (supabase as any)
        .from("sistema_solicitacao")
        .select("id, titulo, descricao, etapa, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Solicitacao[];
    },
  });

  const grouped = useMemo(() => {
    const m = new Map<string, Solicitacao[]>();
    ETAPAS.forEach((e) => m.set(e.key, []));
    rows.forEach((r) => m.get(r.etapa)?.push(r));
    return m;
  }, [rows]);

  const criar = async () => {
    if (!novoTitulo.trim()) return;
    setSalvando(true);
    const { error } = await (supabase as any).from("sistema_solicitacao").insert({
      titulo: novoTitulo.trim(),
      descricao: novoDescricao.trim() || null,
    });
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao criar solicitação", description: error.message, variant: "destructive" });
      return;
    }
    setNovoOpen(false);
    setNovoTitulo("");
    setNovoDescricao("");
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

      <div className="flex gap-3 overflow-x-auto pb-4">
        {ETAPAS.map((etapa) => (
          <div
            key={etapa.key}
            className="min-w-[260px] flex-1"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, etapa.key)}
          >
            <div className="mb-2 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider">{etapa.label}</span>
              <Badge variant="outline" className="text-[10px]">{grouped.get(etapa.key)?.length ?? 0}</Badge>
            </div>
            <div className="space-y-2">
              {grouped.get(etapa.key)?.map((card) => {
                const transicao = PROXIMA_ETAPA[card.etapa];
                const arrastavel = !!transicao && podeMover(transicao.codigo);
                return (
                  <Card
                    key={card.id}
                    draggable={arrastavel}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
                    className={arrastavel ? "cursor-grab p-3" : "p-3"}
                  >
                    <p className="text-xs font-medium">{card.titulo}</p>
                    {card.descricao && (
                      <p className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">{card.descricao}</p>
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={!novoTitulo.trim() || salvando}>
              {salvando ? "Salvando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
