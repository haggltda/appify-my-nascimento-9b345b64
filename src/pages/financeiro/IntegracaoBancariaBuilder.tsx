import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBuilderStore } from "./builder/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Etapa1Banco } from "./builder/etapas/Etapa1Banco";
import { Etapa2Metodo } from "./builder/etapas/Etapa2Metodo";
import { Etapa3Credenciais } from "./builder/etapas/Etapa3Credenciais";
import { Etapa4Mapeamento } from "./builder/etapas/Etapa4Mapeamento";
import { Etapa5Teste } from "./builder/etapas/Etapa5Teste";
import {
  ArrowLeft, ArrowRight, Save, FileStack, Sparkles,
  Building2, Cable, KeyRound, Workflow, Rocket, Check
} from "lucide-react";

const ETAPAS = [
  { n: 1, label: "Banco & Conta", icon: Building2 },
  { n: 2, label: "Conexão", icon: Cable },
  { n: 3, label: "Credenciais", icon: KeyRound },
  { n: 4, label: "Mapeamento", icon: Workflow },
  { n: 5, label: "Teste & Ativação", icon: Rocket },
];

export default function IntegracaoBancariaBuilder() {
  const { contaId } = useParams<{ contaId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const state = useBuilderStore();
  const [salvando, setSalvando] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [openTpl, setOpenTpl] = useState(false);
  const [openVer, setOpenVer] = useState(false);
  const [versoes, setVersoes] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      // empresa
      const { data: prof } = await supabase.from("profiles").select("empresa_id").single();
      const eid = (prof as any)?.empresa_id;
      // conta
      let cid = contaId === "novo" ? null : contaId || null;
      // estado inicial
      useBuilderStore.setState({ empresaId: eid, contaBancariaId: cid });

      // se já existe layout
      if (cid) {
        const { data: layout } = await supabase
          .from("banco_layout")
          .select("*, versao_ativa:banco_layout_versao!banco_layout_versao_ativa_fk(*)")
          .eq("conta_bancaria_id", cid)
          .maybeSingle();
        if (layout) {
          useBuilderStore.setState({
            layoutId: layout.id,
            tipo: layout.tipo,
            nomeLayout: layout.nome,
          });
          if ((layout as any).versao_ativa) {
            const v = (layout as any).versao_ativa;
            useBuilderStore.setState({
              versaoId: v.id,
              numeroVersao: v.numero_versao,
              status: v.status,
              estrutura: v.estrutura || {},
              amostraInput: v.amostra_input || state.amostraInput,
            });
          }
        }
      }

      // templates
      const { data: tpls } = await supabase.from("banco_layout_template").select("*").eq("ativo", true);
      setTemplates(tpls || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaId]);

  async function aplicarTemplate(tpl: any) {
    useBuilderStore.setState({
      estrutura: tpl.estrutura,
      tipo: tpl.tipo,
      bancoCodigo: tpl.banco_codigo || state.bancoCodigo,
      nomeLayout: state.nomeLayout || tpl.nome,
      dirty: true,
    });
    setOpenTpl(false);
    toast({ title: "Template aplicado", description: tpl.nome });
  }

  async function salvar() {
    if (!state.empresaId || !state.contaBancariaId || !state.nomeLayout) {
      toast({ title: "Faltam dados", description: "Preencha conta e nome do layout (etapa 1).", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      let layoutId = state.layoutId;
      if (!layoutId) {
        const { data: l, error } = await supabase
          .from("banco_layout")
          .insert({
            empresa_id: state.empresaId,
            conta_bancaria_id: state.contaBancariaId,
            tipo: state.tipo as any,
            nome: state.nomeLayout,
          })
          .select()
          .single();
        if (error) throw error;
        layoutId = l.id;
      } else {
        await supabase.from("banco_layout").update({ nome: state.nomeLayout, tipo: state.tipo as any }).eq("id", layoutId);
      }

      let versaoId = state.versaoId;
      if (!versaoId || state.status !== "rascunho") {
        const { data: nv, error } = await supabase.rpc("layout_nova_versao", { _layout_id: layoutId });
        if (error) throw error;
        versaoId = (nv as any).versao_id;
        useBuilderStore.setState({ versaoId, numeroVersao: (nv as any).numero_versao, status: "rascunho" });
      }

      const { error: e2 } = await supabase
        .from("banco_layout_versao")
        .update({
          estrutura: state.estrutura as any,
          amostra_input: state.amostraInput,
          amostra_output: state.amostraOutput,
        })
        .eq("id", versaoId!);
      if (e2) throw e2;

      useBuilderStore.setState({ layoutId, dirty: false });
      toast({ title: "Salvo!", description: `Versão ${state.numeroVersao} (rascunho)` });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  async function abrirVersoes() {
    if (!state.layoutId) return;
    const { data } = await supabase
      .from("banco_layout_versao").select("*")
      .eq("layout_id", state.layoutId)
      .order("numero_versao", { ascending: false });
    setVersoes(data || []);
    setOpenVer(true);
  }

  // atalhos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); salvar(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Topbar */}
      <div className="flex items-center gap-3 border-b bg-card px-6 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/financeiro/integracao-bancaria")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <Sparkles className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">Construtor de Integração Bancária</h1>
          <p className="text-xs text-muted-foreground">
            {state.nomeLayout || "Sem nome"} • v{state.numeroVersao}{" "}
            <Badge variant={state.status === "aprovada" ? "default" : "secondary"} className="ml-1 text-[10px]">
              {state.status}
            </Badge>
            {state.dirty && <Badge variant="outline" className="ml-1 text-[10px]">não salvo</Badge>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpenTpl(true)}>
          <FileStack className="mr-1 h-4 w-4" /> Templates
        </Button>
        <Button variant="outline" size="sm" onClick={abrirVersoes} disabled={!state.layoutId}>
          v{state.numeroVersao}
        </Button>
        <Button onClick={salvar} disabled={salvando}>
          <Save className="mr-1 h-4 w-4" /> {salvando ? "Salvando..." : "Salvar"} <span className="ml-2 text-[10px] opacity-60">⌘S</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar de etapas */}
        <aside className="w-64 border-r bg-muted/30 p-4">
          <div className="space-y-1">
            {ETAPAS.map((et) => {
              const Icon = et.icon;
              const ativo = state.etapa === et.n;
              const concluida = state.etapa > et.n;
              return (
                <button
                  key={et.n}
                  onClick={() => useBuilderStore.setState({ etapa: et.n })}
                  className={`flex w-full items-center gap-3 rounded-md p-3 text-left text-sm transition ${
                    ativo ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    ativo ? "bg-primary-foreground text-primary" :
                    concluida ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"
                  }`}>
                    {concluida ? <Check className="h-3 w-3" /> : et.n}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium leading-tight">{et.label}</div>
                  </div>
                  <Icon className="h-4 w-4 opacity-60" />
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-2 rounded-md border bg-card p-3 text-xs">
            <div className="font-semibold">Atalhos</div>
            <div className="text-muted-foreground"><kbd>⌘S</kbd> Salvar</div>
            <div className="text-muted-foreground">Arrastar chips → slots</div>
          </div>
        </aside>

        {/* Conteúdo da etapa */}
        <main className="flex-1 overflow-auto p-6">
          {state.etapa === 1 && <Etapa1Banco />}
          {state.etapa === 2 && <Etapa2Metodo />}
          {state.etapa === 3 && <Etapa3Credenciais />}
          {state.etapa === 4 && <Etapa4Mapeamento />}
          {state.etapa === 5 && <Etapa5Teste />}

          <div className="mt-6 flex justify-between border-t pt-4">
            <Button variant="outline" disabled={state.etapa === 1}
              onClick={() => useBuilderStore.setState({ etapa: state.etapa - 1 })}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            <Button disabled={state.etapa === 5}
              onClick={() => useBuilderStore.setState({ etapa: state.etapa + 1 })}>
              Próximo <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </main>
      </div>

      {/* Templates dialog */}
      <Dialog open={openTpl} onOpenChange={setOpenTpl}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Templates de layout</DialogTitle></DialogHeader>
          <div className="grid gap-2 max-h-[60vh] overflow-auto">
            {templates.map((t) => (
              <Card key={t.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">{t.nome}</div>
                  <div className="text-xs text-muted-foreground">{t.descricao}</div>
                  <div className="mt-1 flex gap-2">
                    {t.banco_codigo && <Badge variant="outline">Banco {t.banco_codigo}</Badge>}
                    <Badge variant="secondary">{t.tipo}</Badge>
                    {t.oficial && <Badge>oficial</Badge>}
                  </div>
                </div>
                <Button size="sm" onClick={() => aplicarTemplate(t)}>Aplicar</Button>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Versões dialog */}
      <Dialog open={openVer} onOpenChange={setOpenVer}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Histórico de versões</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {versoes.map((v) => (
              <Card key={v.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">Versão {v.numero_versao}</div>
                  <div className="text-xs text-muted-foreground">
                    Criada em {new Date(v.created_at).toLocaleString("pt-BR")}
                  </div>
                  {v.motivo_rejeicao && <div className="text-xs text-destructive">Rejeitada: {v.motivo_rejeicao}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={v.status === "aprovada" ? "default" : "secondary"}>{v.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => {
                    useBuilderStore.setState({
                      versaoId: v.id, numeroVersao: v.numero_versao,
                      status: v.status, estrutura: v.estrutura || {},
                      amostraInput: v.amostra_input || state.amostraInput,
                      dirty: false,
                    });
                    setOpenVer(false);
                    toast({ title: "Versão carregada", description: `v${v.numero_versao}` });
                  }}>Carregar</Button>
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
