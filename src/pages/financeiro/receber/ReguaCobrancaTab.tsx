import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Bell, Plus, Trash2, Mail, MessageSquare, AlertTriangle, Phone } from "lucide-react";
import { toast } from "sonner";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const canalIcon = (c: string) => {
  if (c === "email") return <Mail className="h-3.5 w-3.5" />;
  if (c === "whatsapp") return <MessageSquare className="h-3.5 w-3.5" />;
  if (c === "sms") return <Phone className="h-3.5 w-3.5" />;
  return <AlertTriangle className="h-3.5 w-3.5" />;
};

const canalCor: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  whatsapp: "bg-green-500/10 text-green-700 dark:text-green-300",
  sms: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  ligacao: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  protesto: "bg-red-500/10 text-red-700 dark:text-red-300",
  serasa: "bg-red-600/10 text-red-800 dark:text-red-300",
  negativacao: "bg-red-700/10 text-red-900 dark:text-red-300",
  interno: "bg-muted text-muted-foreground",
};

export default function ReguaCobrancaTab() {
  const qc = useQueryClient();
  const { data: empresaId = null } = useEmpresaId();
  const [reguaId, setReguaId] = useState<string>("");
  const [openNova, setOpenNova] = useState(false);
  const [openEtapa, setOpenEtapa] = useState(false);

  const { data: reguas = [] } = useQuery<any[]>({
    queryKey: ["reguas-cobranca", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("regua_cobranca")
        .select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: etapas = [] } = useQuery<any[]>({
    queryKey: ["regua-etapas", reguaId],
    queryFn: async () => {
      if (!reguaId) return [];
      const { data, error } = await (supabase as any).from("regua_cobranca_etapa")
        .select("*, template_mensagem(codigo, nome)")
        .eq("regua_id", reguaId).order("ordem");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!reguaId,
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["templates-msg"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("template_mensagem")
        .select("id, codigo, nome, tipo").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: execucoes = [] } = useQuery<any[]>({
    queryKey: ["regua-execucoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("regua_cobranca_execucao")
        .select("*, titulo_receber(numero, sacado_nome)")
        .order("agendado_para", { ascending: true }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const removerEtapa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("regua_cobranca_etapa").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Etapa removida"); qc.invalidateQueries({ queryKey: ["regua-etapas"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const togglerAtivo = useMutation({
    mutationFn: async ({ id, ativo }: any) => {
      const { error } = await (supabase as any).from("regua_cobranca_etapa").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["regua-etapas"] }),
  });

  const reguaSel = reguas.find((r) => r.id === reguaId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Réguas</CardTitle>
              <CardDescription>Selecione ou crie uma régua</CardDescription>
            </div>
            <Button size="sm" onClick={() => setOpenNova(true)}><Plus className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {reguas.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma régua. Crie uma para começar.</p>}
            {reguas.map((r) => (
              <button
                key={r.id}
                onClick={() => setReguaId(r.id)}
                className={`w-full text-left p-3 rounded-md border transition-colors ${reguaId === r.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{r.nome}</div>
                  {r.ativo ? <Badge variant="default" className="text-xs">Ativa</Badge> : <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                </div>
                {r.descricao && <p className="text-xs text-muted-foreground mt-1">{r.descricao}</p>}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Etapas {reguaSel && <span className="text-muted-foreground">- {reguaSel.nome}</span>}</CardTitle>
              <CardDescription>Sequência de ações automáticas em relação ao vencimento (negativo = antes, positivo = depois)</CardDescription>
            </div>
            {reguaId && <Button size="sm" onClick={() => setOpenEtapa(true)}><Plus className="h-4 w-4 mr-1" /> Etapa</Button>}
          </CardHeader>
          <CardContent>
            {!reguaId ? (
              <p className="text-sm text-muted-foreground text-center py-12">Selecione uma régua à esquerda</p>
            ) : etapas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sem etapas. Adicione a primeira.</p>
            ) : (
              <div className="space-y-2">
                {etapas.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-3 border rounded-md">
                    <div className={`px-2 py-1 rounded text-xs font-mono font-bold ${e.dias_em_relacao_vencimento < 0 ? "bg-blue-500/10 text-blue-700" : e.dias_em_relacao_vencimento === 0 ? "bg-amber-500/10 text-amber-700" : "bg-red-500/10 text-red-700"}`}>
                      D{e.dias_em_relacao_vencimento >= 0 ? "+" : ""}{e.dias_em_relacao_vencimento}
                    </div>
                    <Badge variant="outline" className={`text-xs gap-1 ${canalCor[e.canal] ?? ""}`}>{canalIcon(e.canal)} {e.canal}</Badge>
                    <div className="flex-1 text-sm">
                      {e.template_mensagem?.nome ?? <span className="text-muted-foreground">Sem template</span>}
                      {e.exige_aprovacao && <Badge variant="secondary" className="ml-2 text-xs">Exige aprovação</Badge>}
                    </div>
                    {Number(e.valor_minimo) > 0 && <span className="text-xs text-muted-foreground">≥ R$ {Number(e.valor_minimo).toLocaleString("pt-BR")}</span>}
                    <Switch checked={e.ativo} onCheckedChange={(v) => togglerAtivo.mutate({ id: e.id, ativo: v })} />
                    <Button size="sm" variant="ghost" onClick={() => removerEtapa.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas execuções agendadas</CardTitle>
          <CardDescription>Ações da régua programadas para os títulos</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Sacado</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {execucoes.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma execução</TableCell></TableRow>}
              {execucoes.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{e.agendado_para ? new Date(e.agendado_para).toLocaleString("pt-BR") : "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.titulo_receber?.numero}</TableCell>
                  <TableCell>{e.titulo_receber?.sacado_nome}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-xs gap-1 ${canalCor[e.canal] ?? ""}`}>{canalIcon(e.canal)} {e.canal}</Badge></TableCell>
                  <TableCell className="text-xs">{e.destinatario ?? "-"}</TableCell>
                  <TableCell><Badge variant={e.status === "executada" ? "default" : e.status === "falhou" ? "destructive" : "outline"} className="text-xs">{e.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {openNova && <NovaReguaDialog empresaId={empresaId} onClose={(ok) => { setOpenNova(false); if (ok) qc.invalidateQueries({ queryKey: ["reguas-cobranca"] }); }} />}
      {openEtapa && reguaId && <NovaEtapaDialog reguaId={reguaId} templates={templates} onClose={(ok) => { setOpenEtapa(false); if (ok) qc.invalidateQueries({ queryKey: ["regua-etapas"] }); }} />}
    </div>
  );
}

function NovaReguaDialog({ empresaId, onClose }: { empresaId: string | null; onClose: (ok: boolean) => void }) {
  const [nome, setNome] = useState("Régua padrão");
  const [descricao, setDescricao] = useState("");
  const [valorMinimo, setValorMinimo] = useState("0");

  const criar = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa");
      const { error } = await (supabase as any).from("regua_cobranca").insert({
        empresa_id: empresaId, nome, descricao: descricao || null, valor_minimo: Number(valorMinimo) || 0, ativo: true, aplicar_para: "todos",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Régua criada"); onClose(true); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova régua de cobrança</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div><Label>Valor mínimo do título</Label><Input type="number" step="0.01" value={valorMinimo} onChange={(e) => setValorMinimo(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaEtapaDialog({ reguaId, templates, onClose }: { reguaId: string; templates: any[]; onClose: (ok: boolean) => void }) {
  const [dias, setDias] = useState("0");
  const [canal, setCanal] = useState("email");
  const [templateId, setTemplateId] = useState<string>("");
  const [valorMinimo, setValorMinimo] = useState("0");
  const [exigeAprovacao, setExigeAprovacao] = useState(false);

  const criar = useMutation({
    mutationFn: async () => {
      const { data: existentes } = await (supabase as any).from("regua_cobranca_etapa").select("ordem").eq("regua_id", reguaId);
      const proxOrdem = (existentes ?? []).reduce((m: number, e: any) => Math.max(m, e.ordem), 0) + 1;
      const { error } = await (supabase as any).from("regua_cobranca_etapa").insert({
        regua_id: reguaId, ordem: proxOrdem, dias_em_relacao_vencimento: Number(dias),
        canal, template_id: templateId || null, valor_minimo: Number(valorMinimo) || 0,
        ativo: true, exige_aprovacao: exigeAprovacao,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Etapa adicionada"); onClose(true); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova etapa da régua</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Dias em relação ao vencimento</Label>
            <Input type="number" value={dias} onChange={(e) => setDias(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">-3 = 3 dias antes • 0 = no vencimento • 5 = 5 dias depois</p>
          </div>
          <div>
            <Label>Canal</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="ligacao">Ligação</SelectItem>
                <SelectItem value="protesto">Protesto</SelectItem>
                <SelectItem value="serasa">SERASA</SelectItem>
                <SelectItem value="negativacao">Negativação</SelectItem>
                <SelectItem value="interno">Aviso interno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Template de mensagem</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione um template..." /></SelectTrigger>
              <SelectContent>
                {templates.filter((t) => t.tipo === canal || canal === "interno" || ["protesto", "serasa", "negativacao", "ligacao"].includes(canal)).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome} <span className="text-xs text-muted-foreground">({t.tipo})</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Valor mínimo</Label><Input type="number" step="0.01" value={valorMinimo} onChange={(e) => setValorMinimo(e.target.value)} /></div>
          <div className="flex items-end gap-2">
            <Switch checked={exigeAprovacao} onCheckedChange={setExigeAprovacao} id="aprov" />
            <Label htmlFor="aprov" className="cursor-pointer">Exige aprovação manual</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Adicionar etapa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
