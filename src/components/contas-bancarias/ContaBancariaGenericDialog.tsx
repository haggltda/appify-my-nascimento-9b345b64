import { useEffect, useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BANCOS_CATALOGO } from "@/pages/financeiro/builder/types";

const schema = z.object({
  banco_codigo: z.string().min(1, "Banco obrigatório"),
  agencia: z.string().regex(/^\d{1,10}$/, "Apenas dígitos"),
  agencia_digito: z.string().regex(/^[\dxX]{0,2}$/).optional().or(z.literal("")),
  conta: z.string().regex(/^\d{1,20}$/, "Apenas dígitos"),
  conta_digito: z.string().regex(/^[\dxX]{0,2}$/).optional().or(z.literal("")),
  tipo: z.enum(["corrente", "poupanca", "pagamento"]),
  titular_nome: z.string().max(200).optional().or(z.literal("")),
  titular_documento: z.string().max(20).optional().or(z.literal("")),
  pix_tipo: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria", ""]).optional(),
  pix_chave: z.string().max(200).optional().or(z.literal("")),
  principal: z.boolean(),
  ativa: z.boolean(),
  observacoes: z.string().max(500).optional().or(z.literal("")),
});

const empty = {
  banco_codigo: "", agencia: "", agencia_digito: "", conta: "", conta_digito: "",
  tipo: "corrente", titular_nome: "", titular_documento: "", pix_tipo: "", pix_chave: "",
  principal: false, ativa: true, observacoes: "",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Nome da tabela: "fornecedor_conta_bancaria" | "colaborador_conta_bancaria" */
  tableName: "fornecedor_conta_bancaria" | "colaborador_conta_bancaria";
  /** Nome do campo FK na tabela: "fornecedor_id" | "colaborador_id" */
  parentField: "fornecedor_id" | "colaborador_id";
  parentId: string;
  empresaId: string;
  conta?: any;
  onSaved: () => void;
}

export function ContaBancariaGenericDialog({
  open, onOpenChange, tableName, parentField, parentId, empresaId, conta, onSaved,
}: Props) {
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(conta ? { ...empty, ...conta } : empty);
  }, [open, conta]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const banco = BANCOS_CATALOGO.find((b) => b.codigo === form.banco_codigo);
    const payload: any = {
      [parentField]: parentId,
      empresa_id: empresaId,
      banco_codigo: form.banco_codigo,
      banco_nome: banco?.nome ?? form.banco_codigo,
      agencia: form.agencia,
      agencia_digito: form.agencia_digito || null,
      conta: form.conta,
      conta_digito: form.conta_digito || null,
      tipo: form.tipo,
      titular_nome: form.titular_nome || null,
      titular_documento: form.titular_documento || null,
      pix_tipo: form.pix_tipo || null,
      pix_chave: form.pix_chave || null,
      principal: !!form.principal,
      ativa: !!form.ativa,
      observacoes: form.observacoes || null,
    };
    const client: any = supabase;
    const { error } = conta?.id
      ? await client.from(tableName).update(payload).eq("id", conta.id)
      : await client.from(tableName).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Conta salva");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{conta?.id ? "Editar conta bancária" : "Nova conta bancária"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2">
            <Label>Banco *</Label>
            <Select value={form.banco_codigo} onValueChange={(v) => set("banco_codigo", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {BANCOS_CATALOGO.map((b) => (
                  <SelectItem key={b.codigo} value={b.codigo}>{b.codigo} — {b.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Agência *</Label><Input value={form.agencia} onChange={(e) => set("agencia", e.target.value.replace(/\D/g, ""))} /></div>
          <div><Label>Dígito</Label><Input maxLength={2} value={form.agencia_digito} onChange={(e) => set("agencia_digito", e.target.value)} /></div>
          <div><Label>Conta *</Label><Input value={form.conta} onChange={(e) => set("conta", e.target.value.replace(/\D/g, ""))} /></div>
          <div><Label>Dígito</Label><Input maxLength={2} value={form.conta_digito} onChange={(e) => set("conta_digito", e.target.value)} /></div>
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Conta Corrente</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
                <SelectItem value="pagamento">Conta Pagamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div></div>
          <div><Label>Titular (nome)</Label><Input maxLength={200} value={form.titular_nome} onChange={(e) => set("titular_nome", e.target.value)} placeholder="Se diferente do titular padrão" /></div>
          <div><Label>Titular (CNPJ/CPF)</Label><Input maxLength={20} value={form.titular_documento} onChange={(e) => set("titular_documento", e.target.value)} /></div>
          <div>
            <Label>Tipo de PIX</Label>
            <Select value={form.pix_tipo || "none"} onValueChange={(v) => set("pix_tipo", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem PIX</SelectItem>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="aleatoria">Chave aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Chave PIX</Label><Input maxLength={200} value={form.pix_chave} onChange={(e) => set("pix_chave", e.target.value)} /></div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label className="cursor-pointer">Conta principal</Label>
            <Switch checked={form.principal} onCheckedChange={(v) => set("principal", v)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label className="cursor-pointer">Ativa</Label>
            <Switch checked={form.ativa} onCheckedChange={(v) => set("ativa", v)} />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea maxLength={500} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
