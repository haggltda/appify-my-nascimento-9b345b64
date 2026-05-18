import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { toast } from "sonner";
import { ContasBancariasTab } from "./ContasBancariasTab";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedor: any | null;
  onSaved: () => void;
}

const empty = {
  tipo: "pj", cnpj_cpf: "", razao_social: "", nome_fantasia: "",
  contato: "", email: "", telefone: "", endereco: "", observacoes: "", ativo: true,
};

export function FornecedorDialog({ open, onOpenChange, fornecedor, onSaved }: Props) {
  const { data: empresaId } = useEmpresaId();
  const [form, setForm] = useState<any>(empty);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [tab, setTab] = useState("dados");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const init = fornecedor ? { ...empty, ...fornecedor } : empty;
      setForm(init);
      setSavedId(fornecedor?.id ?? null);
      setTab("dados");
    }
  }, [open, fornecedor]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.razao_social || !form.cnpj_cpf) {
      toast.error("CNPJ/CPF e Razão Social são obrigatórios");
      return;
    }
    setSaving(true);
    const payload: any = { ...form };
    if (!savedId && empresaId) payload.empresa_id = empresaId;
    const { data, error } = savedId
      ? await supabase.from("fornecedor").update(payload).eq("id", savedId).select().single()
      : await supabase.from("fornecedor").insert(payload).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Fornecedor salvo");
    setSavedId(data.id);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{savedId ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
            <TabsTrigger value="contas" disabled={!savedId}>
              Contas Bancárias {!savedId && "(salve antes)"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 py-2">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                    <SelectItem value="pf">Pessoa Física</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>CNPJ/CPF *</Label><Input maxLength={20} value={form.cnpj_cpf} onChange={(e) => set("cnpj_cpf", e.target.value)} /></div>
              <div className="col-span-2"><Label>Razão Social *</Label><Input maxLength={200} value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} /></div>
              <div className="col-span-2"><Label>Nome Fantasia</Label><Input maxLength={200} value={form.nome_fantasia ?? ""} onChange={(e) => set("nome_fantasia", e.target.value)} /></div>
              <div><Label>Contato</Label><Input maxLength={100} value={form.contato ?? ""} onChange={(e) => set("contato", e.target.value)} /></div>
              <div><Label>Telefone</Label><Input maxLength={30} value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} /></div>
              <div className="col-span-2"><Label>E-mail</Label><Input type="email" maxLength={255} value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="col-span-2"><Label>Endereço</Label><Textarea maxLength={500} value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea maxLength={1000} value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></div>
              <div className="col-span-2 flex items-center justify-between rounded-md border p-3">
                <Label className="cursor-pointer">Ativo</Label>
                <Switch checked={!!form.ativo} onCheckedChange={(v) => set("ativo", v)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contas">
            {savedId && empresaId && (
              <ContasBancariasTab fornecedorId={savedId} empresaId={empresaId} />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {tab === "dados" && (
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : savedId ? "Atualizar" : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
