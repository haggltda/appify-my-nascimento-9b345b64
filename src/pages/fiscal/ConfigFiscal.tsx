import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Save, Loader2, Plus } from "lucide-react";
import { REGIME_LABEL, type EmpresaFiscalConfig, type RegimeTributario } from "./types";

export default function ConfigFiscal() {
  const { data: empresaId } = useEmpresaId();
  if (!empresaId) return <div className="p-6 text-muted-foreground">Selecione uma empresa.</div>;

  return (
    <Tabs defaultValue="config" className="space-y-4">
      <TabsList>
        <TabsTrigger value="config">Configuração da empresa</TabsTrigger>
        <TabsTrigger value="servicos">Serviços (LC 116)</TabsTrigger>
      </TabsList>
      <TabsContent value="config"><ConfigForm empresaId={empresaId} /></TabsContent>
      <TabsContent value="servicos"><ServicosTab empresaId={empresaId} /></TabsContent>
    </Tabs>
  );
}

function ConfigForm({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<EmpresaFiscalConfig>>({});

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["fiscal_config", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa_fiscal_config").select("*").eq("empresa_id", empresaId).maybeSingle();
      if (error) throw error;
      return data as EmpresaFiscalConfig | null;
    },
  });

  useEffect(() => {
    if (cfg) setForm(cfg);
    else setForm({ regime: "lucro_presumido", ambiente: "homologacao", aliq_iss: 5, aliq_pis: 0.65, aliq_cofins: 3, nfse_serie: "1", nfe_serie: "1", aliq_irpj_presuncao: 32, aliq_csll_presuncao: 32 });
  }, [cfg]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = { ...form, empresa_id: empresaId };
      if (cfg?.id) {
        const { error } = await supabase.from("empresa_fiscal_config").update(payload).eq("id", cfg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empresa_fiscal_config").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Configuração salva"); qc.invalidateQueries({ queryKey: ["fiscal_config"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const upd = (k: keyof EmpresaFiscalConfig, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Regime e ambiente</CardTitle><CardDescription>Define como impostos são apurados e onde notas são emitidas.</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Regime tributário</Label>
            <Select value={form.regime} onValueChange={(v: RegimeTributario) => upd("regime", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REGIME_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ambiente</Label>
            <Select value={form.ambiente} onValueChange={(v: any) => upd("ambiente", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>CNAE principal</Label><Input value={form.cnae_principal || ""} onChange={(e) => upd("cnae_principal", e.target.value)} /></div>
          <div><Label>Inscrição municipal</Label><Input value={form.inscricao_municipal || ""} onChange={(e) => upd("inscricao_municipal", e.target.value)} /></div>
          <div><Label>Inscrição estadual</Label><Input value={form.inscricao_estadual || ""} onChange={(e) => upd("inscricao_estadual", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Numeração</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-4 gap-4">
          <div><Label>Série NFS-e</Label><Input value={form.nfse_serie || ""} onChange={(e) => upd("nfse_serie", e.target.value)} /></div>
          <div><Label>Próximo nº NFS-e</Label><Input type="number" value={form.nfse_proximo_numero || 1} onChange={(e) => upd("nfse_proximo_numero", Number(e.target.value))} /></div>
          <div><Label>Série NF-e</Label><Input value={form.nfe_serie || ""} onChange={(e) => upd("nfe_serie", e.target.value)} /></div>
          <div><Label>Próximo nº NF-e</Label><Input type="number" value={form.nfe_proximo_numero || 1} onChange={(e) => upd("nfe_proximo_numero", Number(e.target.value))} /></div>
        </CardContent>
      </Card>

      {form.regime === "lucro_presumido" && (
        <Card>
          <CardHeader><CardTitle>Alíquotas — Lucro Presumido</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div><Label>ISS (%)</Label><Input type="number" step="0.01" value={form.aliq_iss || 0} onChange={(e) => upd("aliq_iss", Number(e.target.value))} /></div>
            <div><Label>PIS (%)</Label><Input type="number" step="0.01" value={form.aliq_pis || 0} onChange={(e) => upd("aliq_pis", Number(e.target.value))} /></div>
            <div><Label>COFINS (%)</Label><Input type="number" step="0.01" value={form.aliq_cofins || 0} onChange={(e) => upd("aliq_cofins", Number(e.target.value))} /></div>
            <div><Label>Presunção IRPJ (%)</Label><Input type="number" step="0.01" value={form.aliq_irpj_presuncao || 32} onChange={(e) => upd("aliq_irpj_presuncao", Number(e.target.value))} /></div>
            <div><Label>Presunção CSLL (%)</Label><Input type="number" step="0.01" value={form.aliq_csll_presuncao || 32} onChange={(e) => upd("aliq_csll_presuncao", Number(e.target.value))} /></div>
          </CardContent>
        </Card>
      )}

      {form.regime === "simples_nacional" && (
        <Card>
          <CardHeader><CardTitle>Simples Nacional</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div>
              <Label>Anexo</Label>
              <Select value={form.anexo_simples || ""} onValueChange={(v) => upd("anexo_simples", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="III">Anexo III</SelectItem>
                  <SelectItem value="IV">Anexo IV</SelectItem>
                  <SelectItem value="V">Anexo V</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Faixa</Label><Input type="number" value={form.faixa_simples || ""} onChange={(e) => upd("faixa_simples", Number(e.target.value))} /></div>
            <div><Label>Alíquota efetiva (%)</Label><Input type="number" step="0.01" value={form.aliq_simples_efetiva || ""} onChange={(e) => upd("aliq_simples_efetiva", Number(e.target.value))} /></div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          {salvar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}

function ServicosTab({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState({ codigo_lc116: "", descricao: "", aliq_iss: 5 });

  const { data: servicos = [] } = useQuery({
    queryKey: ["servicos_municipais", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("servico_municipal").select("*").eq("empresa_id", empresaId).order("codigo_lc116");
      return data || [];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("servico_municipal").insert({ empresa_id: empresaId, ...novo });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço cadastrado");
      qc.invalidateQueries({ queryKey: ["servicos_municipais"] });
      setOpen(false); setNovo({ codigo_lc116: "", descricao: "", aliq_iss: 5 });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Serviços municipais</CardTitle><CardDescription>Cadastro conforme Lei Complementar 116/2003.</CardDescription></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo serviço</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar serviço</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Código LC 116 *</Label><Input value={novo.codigo_lc116} onChange={(e) => setNovo(p => ({ ...p, codigo_lc116: e.target.value }))} placeholder="Ex: 17.01" /></div>
              <div><Label>Descrição *</Label><Input value={novo.descricao} onChange={(e) => setNovo(p => ({ ...p, descricao: e.target.value }))} /></div>
              <div><Label>Alíquota ISS (%)</Label><Input type="number" step="0.01" value={novo.aliq_iss} onChange={(e) => setNovo(p => ({ ...p, aliq_iss: Number(e.target.value) }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => criar.mutate()} disabled={!novo.codigo_lc116 || !novo.descricao || criar.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {servicos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum serviço cadastrado</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Código LC 116</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">ISS (%)</TableHead></TableRow></TableHeader>
            <TableBody>
              {servicos.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.codigo_lc116}</TableCell>
                  <TableCell>{s.descricao}</TableCell>
                  <TableCell className="text-right">{Number(s.aliq_iss).toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
