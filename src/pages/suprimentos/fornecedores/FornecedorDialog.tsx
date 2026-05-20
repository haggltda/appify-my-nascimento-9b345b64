import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { toast } from "sonner";
import { ContasBancariasTab } from "./ContasBancariasTab";
import { usePermissoes } from "@/context/PermissoesContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedor: any | null;
  onSaved: () => void;
  /** Quando true, abre em modo somente leitura (todos os campos bloqueados). */
  readOnly?: boolean;
}

const empty: any = {
  tipo: "pj",
  cnpj_cpf: "",
  razao_social: "",
  nome_fantasia: "",
  cnae_principal: "",
  socios: [] as Array<{ nome: string; cpf?: string; participacao?: string }>,
  // localização / contato
  contato: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  inscricao_estadual: "",
  endereco: "",
  observacoes: "",
  // bancário / pix
  pix_chave: "",
  pix_tipo: "",
  ativo: true,
  is_global: false,
};

const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");
const inferTipo = (doc: string): "pj" | "pf" => (onlyDigits(doc).length === 11 ? "pf" : "pj");

export function FornecedorDialog({ open, onOpenChange, fornecedor, onSaved, readOnly = false }: Props) {
  const { data: empresaId } = useEmpresaId();
  const { roles, can } = usePermissoes();
  const canSetGlobal = roles.some((r) => ["admin", "controladoria", "diretor_adm"].includes(r));
  const canEdit = !readOnly && can(fornecedor ? "alterar" : "incluir", "suprimentos", "fornecedor");
  const isLocked = readOnly || !canEdit;

  const [form, setForm] = useState<any>(empty);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [tab, setTab] = useState("gerais");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const init = fornecedor
        ? { ...empty, ...fornecedor, socios: Array.isArray(fornecedor.socios) ? fornecedor.socios : [] }
        : empty;
      setForm(init);
      setSavedId(fornecedor?.id ?? null);
      setTab("gerais");
    }
  }, [open, fornecedor]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const setSocio = (idx: number, patch: any) =>
    setForm((f: any) => ({
      ...f,
      socios: f.socios.map((s: any, i: number) => (i === idx ? { ...s, ...patch } : s)),
    }));
  const addSocio = () => setForm((f: any) => ({ ...f, socios: [...f.socios, { nome: "" }] }));
  const removeSocio = (idx: number) =>
    setForm((f: any) => ({ ...f, socios: f.socios.filter((_: any, i: number) => i !== idx) }));

  const save = async () => {
    if (!form.razao_social?.trim() || !form.cnpj_cpf?.trim()) {
      toast.error("CNPJ/CPF e Razão Social são obrigatórios");
      return;
    }
    setSaving(true);
    const payload: any = { ...form };
    // auto-detecta tipo pelo nº de dígitos (CPF=11, CNPJ=14)
    payload.tipo = inferTipo(form.cnpj_cpf);
    if (!savedId && empresaId) payload.empresa_id = empresaId;
    if (payload.is_global && !canSetGlobal) delete payload.is_global;

    const { data, error } = savedId
      ? await supabase.from("fornecedor").update(payload).eq("id", savedId).select().single()
      : await supabase.from("fornecedor").insert(payload).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Fornecedor salvo");
    setSavedId(data.id);
    onSaved();
  };

  const title = isLocked
    ? "Visualizar fornecedor"
    : savedId
      ? "Editar fornecedor"
      : "Novo fornecedor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLocked && <Eye className="h-4 w-4 text-muted-foreground" />}
            {title}
            {isLocked && <Badge variant="secondary">Somente leitura</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gerais">Dados Gerais</TabsTrigger>
            <TabsTrigger value="local">Localização & Contato</TabsTrigger>
            <TabsTrigger value="banco" disabled={!savedId}>
              Bancário & PIX {!savedId && "(salve antes)"}
            </TabsTrigger>
          </TabsList>

          {/* ========== ABA 1: Dados Gerais ========== */}
          <TabsContent value="gerais" className="space-y-6">
            <div className="grid grid-cols-12 gap-4 py-2">
              <div className="col-span-3">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v)} disabled={isLocked}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                    <SelectItem value="pf">Pessoa Física</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[10px] text-muted-foreground">Auto-detectado pelo nº de dígitos</p>
              </div>
              <div className="col-span-4">
                <Label>CNPJ/CPF *</Label>
                <Input
                  maxLength={20}
                  value={form.cnpj_cpf}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f: any) => ({ ...f, cnpj_cpf: v, tipo: inferTipo(v) }));
                  }}
                  disabled={isLocked}
                />
              </div>
              <div className="col-span-5">
                <Label>CNAE Principal</Label>
                <Input placeholder="ex: 4744-0/05" maxLength={20} value={form.cnae_principal ?? ""} onChange={(e) => set("cnae_principal", e.target.value)} disabled={isLocked} />
              </div>

              <div className="col-span-7">
                <Label>Razão Social *</Label>
                <Input maxLength={200} value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} disabled={isLocked} />
              </div>
              <div className="col-span-5">
                <Label>Nome Fantasia</Label>
                <Input maxLength={200} value={form.nome_fantasia ?? ""} onChange={(e) => set("nome_fantasia", e.target.value)} disabled={isLocked} />
              </div>

              <div className="col-span-12 flex flex-wrap gap-4">
                <div className="flex items-center gap-3 rounded-md border px-4 py-2">
                  <Label className={isLocked ? "" : "cursor-pointer"}>Ativo</Label>
                  <Switch checked={!!form.ativo} onCheckedChange={(v) => set("ativo", v)} disabled={isLocked} />
                </div>
                {canSetGlobal && (
                  <div className="flex items-center gap-3 rounded-md border border-dashed bg-muted/30 px-4 py-2">
                    <div>
                      <Label className={isLocked ? "" : "cursor-pointer"}>Fornecedor Global (grupo)</Label>
                      <p className="text-[10px] text-muted-foreground">Visível a todas as empresas do grupo.</p>
                    </div>
                    <Switch checked={!!form.is_global} onCheckedChange={(v) => set("is_global", v)} disabled={isLocked} />
                  </div>
                )}
              </div>
            </div>

            {/* Sócios */}
            <div className="rounded-md border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Sócios da empresa</h4>
                  <p className="text-xs text-muted-foreground">Informações disponíveis no quadro societário.</p>
                </div>
                {!isLocked && (
                  <Button type="button" variant="outline" size="sm" onClick={addSocio}>
                    <Plus className="mr-1 h-4 w-4" /> Adicionar sócio
                  </Button>
                )}
              </div>
              {form.socios.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">Nenhum sócio cadastrado.</p>
              ) : (
                <div className="space-y-2">
                  {form.socios.map((s: any, i: number) => (
                    <div key={i} className="grid grid-cols-12 items-end gap-2">
                      <div className="col-span-6"><Label className="text-xs">Nome</Label><Input value={s.nome ?? ""} onChange={(e) => setSocio(i, { nome: e.target.value })} disabled={isLocked} /></div>
                      <div className="col-span-3"><Label className="text-xs">CPF</Label><Input value={s.cpf ?? ""} onChange={(e) => setSocio(i, { cpf: e.target.value })} disabled={isLocked} /></div>
                      <div className="col-span-2"><Label className="text-xs">Participação %</Label><Input value={s.participacao ?? ""} onChange={(e) => setSocio(i, { participacao: e.target.value })} disabled={isLocked} /></div>
                      <div className="col-span-1">
                        {!isLocked && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeSocio(i)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ========== ABA 2: Localização & Contato ========== */}
          <TabsContent value="local" className="space-y-4">
            <div className="grid grid-cols-12 gap-4 py-2">
              <div className="col-span-3"><Label>CEP</Label><Input maxLength={10} value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} disabled={isLocked} /></div>
              <div className="col-span-7"><Label>Logradouro</Label><Input maxLength={200} value={form.logradouro ?? ""} onChange={(e) => set("logradouro", e.target.value)} disabled={isLocked} /></div>
              <div className="col-span-2"><Label>Número</Label><Input maxLength={20} value={form.numero ?? ""} onChange={(e) => set("numero", e.target.value)} disabled={isLocked} /></div>

              <div className="col-span-4"><Label>Complemento</Label><Input maxLength={100} value={form.complemento ?? ""} onChange={(e) => set("complemento", e.target.value)} disabled={isLocked} /></div>
              <div className="col-span-4"><Label>Bairro</Label><Input maxLength={100} value={form.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} disabled={isLocked} /></div>
              <div className="col-span-3"><Label>Cidade</Label><Input maxLength={100} value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} disabled={isLocked} /></div>
              <div className="col-span-1">
                <Label>UF</Label>
                <Input maxLength={2} value={form.uf ?? ""} onChange={(e) => set("uf", e.target.value.toUpperCase())} disabled={isLocked} />
              </div>

              <div className="col-span-6"><Label>Inscrição Estadual</Label><Input maxLength={30} value={form.inscricao_estadual ?? ""} onChange={(e) => set("inscricao_estadual", e.target.value)} disabled={isLocked} /></div>
              <div className="col-span-6"><Label>Contato (responsável)</Label><Input maxLength={100} value={form.contato ?? ""} onChange={(e) => set("contato", e.target.value)} disabled={isLocked} /></div>

              <div className="col-span-6"><Label>Telefone</Label><Input maxLength={30} value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} disabled={isLocked} /></div>
              <div className="col-span-6"><Label>E-mail</Label><Input type="email" maxLength={255} value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} disabled={isLocked} /></div>

              <div className="col-span-12"><Label>Endereço (texto livre, legado)</Label><Textarea rows={2} maxLength={500} value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} disabled={isLocked} /></div>
              <div className="col-span-12"><Label>Observações</Label><Textarea rows={3} maxLength={1000} value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} disabled={isLocked} /></div>
            </div>
          </TabsContent>

          {/* ========== ABA 3: Bancário & PIX ========== */}
          <TabsContent value="banco" className="space-y-6">
            <div className="rounded-md border p-4">
              <h4 className="mb-3 text-sm font-semibold">Chave PIX principal</h4>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-3">
                  <Label>Tipo da chave</Label>
                  <Select value={form.pix_tipo ?? ""} onValueChange={(v) => set("pix_tipo", v)} disabled={isLocked}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf_cnpj">CPF/CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-9">
                  <Label>Chave PIX</Label>
                  <Input maxLength={200} value={form.pix_chave ?? ""} onChange={(e) => set("pix_chave", e.target.value)} disabled={isLocked} />
                </div>
              </div>
            </div>

            {savedId && empresaId && (
              <div className="rounded-md border p-4">
                <h4 className="mb-3 text-sm font-semibold">Contas bancárias</h4>
                <ContasBancariasTab fornecedorId={savedId} empresaId={empresaId} />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!isLocked && tab !== "banco" && (
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : savedId ? "Atualizar" : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
