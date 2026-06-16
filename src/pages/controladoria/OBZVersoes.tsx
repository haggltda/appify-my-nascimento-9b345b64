import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Send, Check, Archive, Edit3 } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const statusBadge = (s: string) => {
  const map: Record<string, any> = {
    rascunho: { v: "outline", l: "Rascunho" },
    em_aprovacao: { v: "secondary", l: "Em aprovação" },
    aprovada: { v: "default", l: "Aprovada" },
    arquivada: { v: "secondary", l: "Arquivada" },
  };
  const c = map[s] ?? { v: "outline", l: s };
  return <Badge variant={c.v}>{c.l}</Badge>;
};

export default function OBZVersoes() {
  const qc = useQueryClient();
  const [openNova, setOpenNova] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const { data: versoes = [], isLoading } = useQuery<any[]>({
    queryKey: ["obz_versoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("obz_versoes")
        .select("*, empresas(razao_social, sigla)")
        .order("ano", { ascending: false }).order("versao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const submeter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("obz_versao_submeter", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Submetida"); qc.invalidateQueries({ queryKey: ["obz_versoes"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("obz_versao_aprovar", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Aprovada"); qc.invalidateQueries({ queryKey: ["obz_versoes"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const arquivar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("obz_versao_arquivar", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Arquivada"); qc.invalidateQueries({ queryKey: ["obz_versoes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="OBZ — Orçamento Base Zero"
        subtitle="Versões anuais com lançamento mensal por linha DRE × centro de custo"
        module="Controladoria"
        breadcrumb={["Controladoria", "OBZ"]}
        actions={<Button onClick={() => setOpenNova(true)}><Plus className="h-4 w-4 mr-2" />Nova versão</Button>}
      />

      <Card>
        <CardHeader><CardTitle>Versões</CardTitle><CardDescription>Cada versão gera 12 períodos mensais.</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead><TableHead>Ano</TableHead><TableHead>Versão</TableHead>
                  <TableHead>Nome</TableHead><TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versoes.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma versão</TableCell></TableRow>}
                {versoes.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-xs">{v.empresas?.sigla ?? v.empresas?.razao_social ?? "—"}</TableCell>
                    <TableCell>{v.ano}</TableCell>
                    <TableCell>v{v.versao}.{v.revisao}</TableCell>
                    <TableCell>{v.nome}</TableCell>
                    <TableCell>{statusBadge(v.status)}</TableCell>
                    <TableCell className="text-xs">{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(v.id)}><Edit3 className="h-3 w-3 mr-1" />Editar</Button>
                      {v.status === "rascunho" && <Button size="sm" onClick={() => submeter.mutate(v.id)}><Send className="h-3 w-3 mr-1" />Submeter</Button>}
                      {v.status === "em_aprovacao" && <Button size="sm" onClick={() => aprovar.mutate(v.id)}><Check className="h-3 w-3 mr-1" />Aprovar</Button>}
                      {v.status !== "arquivada" && <Button size="sm" variant="ghost" onClick={() => arquivar.mutate(v.id)}><Archive className="h-3 w-3" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {openNova && <NovaVersaoDialog onClose={() => { setOpenNova(false); qc.invalidateQueries({ queryKey: ["obz_versoes"] }); }} />}
      {editing && <EditarValoresDialog versaoId={editing} onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["obz_versoes"] }); }} />}
    </div>
  );
}

function NovaVersaoDialog({ onClose }: { onClose: () => void }) {
  const [empresaId, setEmpresaId] = useState("");
  const [ano, setAno] = useState(new Date().getFullYear() + 1);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: empresas = [] } = useQuery<any[]>({
    queryKey: ["empresas-obz"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresas").select("id, razao_social, sigla").order("razao_social");
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!empresaId || !ano) throw new Error("Preencha empresa e ano");
      const { data, error } = await (supabase as any).rpc("obz_versao_criar", {
        _empresa_id: empresaId, _ano: ano, _nome: nome || null, _descricao: descricao || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Versão criada"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova versão OBZ</DialogTitle><DialogDescription>Os 12 períodos mensais serão criados automaticamente em rascunho.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Ano</Label><Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} /></div>
          <div><Label>Nome (opcional)</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={`OBZ ${ano} v1`} /></div>
          <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarValoresDialog({ versaoId, onClose }: { versaoId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [ccId, setCcId] = useState<string>("none");

  const { data: versao } = useQuery<any>({
    queryKey: ["obz_versao", versaoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("obz_versoes").select("*").eq("id", versaoId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: linhas = [] } = useQuery<any[]>({
    queryKey: ["dre_linhas", versao?.empresa_id],
    enabled: !!versao?.empresa_id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("dre_linhas")
        .select("*").eq("empresa_id", versao.empresa_id).eq("ativo", true).order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ccs = [] } = useQuery<any[]>({
    queryKey: ["centros_custo_obz", versao?.empresa_id],
    enabled: !!versao?.empresa_id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("centros_custo")
        .select("id, codigo, nome").eq("empresa_id", versao.empresa_id).eq("ativo", true).order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: valores = [], refetch } = useQuery<any[]>({
    queryKey: ["obz_valores", versaoId, ccId],
    queryFn: async () => {
      let q = (supabase as any).from("obz_valores")
        .select("*, obz_periodos!inner(mes)").eq("versao_id", versaoId);
      if (ccId === "none") q = q.is("centro_custo_id", null);
      else q = q.eq("centro_custo_id", ccId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const valoresMap = useMemo(() => {
    const m: Record<string, number> = {};
    valores.forEach((v: any) => { m[`${v.dre_linha_id}-${v.obz_periodos.mes}`] = Number(v.valor); });
    return m;
  }, [valores]);

  const upsert = useMutation({
    mutationFn: async ({ dre, mes, valor }: { dre: string; mes: number; valor: number }) => {
      const { error } = await (supabase as any).rpc("obz_valor_upsert", {
        _versao_id: versaoId, _dre_linha_id: dre,
        _centro_custo_id: ccId === "none" ? null : ccId,
        _mes: mes, _valor: valor, _memoria: null,
      });
      if (error) throw error;
    },
    onSuccess: () => refetch(),
    onError: (e: any) => toast.error(e.message),
  });

  const editavel = versao && ["rascunho", "em_aprovacao"].includes(versao.status);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>{versao?.nome} — {versao?.ano}</DialogTitle>
          <DialogDescription>
            Status: {versao && statusBadge(versao.status)} {!editavel && <span className="ml-2 text-warning">(somente leitura)</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 mb-2">
          <Label>Centro de custo</Label>
          <Select value={ccId} onValueChange={setCcId}>
            <SelectTrigger className="w-80"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Sem CC (geral) —</SelectItem>
              {ccs.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-auto max-h-[65vh]">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Linha DRE</TableHead>
                {meses.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l: any) => {
                const total = meses.reduce((s, _, i) => s + (valoresMap[`${l.id}-${i + 1}`] || 0), 0);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="sticky left-0 bg-card text-xs whitespace-nowrap">
                      <span className="font-mono text-muted-foreground">{l.codigo}</span> {l.descricao}
                    </TableCell>
                    {meses.map((_, i) => {
                      const k = `${l.id}-${i + 1}`;
                      const v = valoresMap[k] || 0;
                      return (
                        <TableCell key={i} className="p-0">
                          <Input
                            type="number"
                            step="0.01"
                            disabled={!editavel}
                            defaultValue={v || ""}
                            className="h-8 text-right text-xs border-0 focus-visible:ring-1"
                            onBlur={(e) => {
                              const nv = Number(e.target.value) || 0;
                              if (nv !== v) upsert.mutate({ dre: l.id, mes: i + 1, valor: nv });
                            }}
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right text-xs font-semibold tabular-nums">{fmt(total)}</TableCell>
                  </TableRow>
                );
              })}
              {linhas.length === 0 && <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">Nenhuma linha DRE para esta empresa.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>

        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
