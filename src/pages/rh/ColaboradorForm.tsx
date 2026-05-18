import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useUpsert } from "@/hooks/useGenericCrud";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, User2 } from "lucide-react";
import { ContasBancariasGenericTab } from "@/components/contas-bancarias/ContasBancariasGenericTab";

const FOTO_BUCKET = "colaboradores-fotos";
const FOTO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const FOTO_MIME = ["image/jpeg", "image/png", "image/webp"];

export interface Colaborador {
  id?: string;
  empresa_id?: string;
  cpf?: string;
  nome?: string;
  matricula?: string | null;
  cargo?: string | null;
  data_admissao?: string | null;
  data_demissao?: string | null;
  data_nascimento?: string | null;
  genero?: string | null;
  salario_base?: number | null;
  status?: string;
  email?: string | null;
  telefone?: string | null;
  rg?: string | null;
  pis_pasep?: string | null;
  departamento?: string | null;
  jornada?: string | null;
  cbo?: string | null;
  tipo_contrato?: string | null;
  gestor_direto?: string | null;
  endereco_cep?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_uf?: string | null;
  observacoes?: string | null;
  foto_path?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<Colaborador> | null;
  onSaved?: () => void;
}

export function ColaboradorForm({ open, onOpenChange, initial, onSaved }: Props) {
  const { data: empresaId } = useEmpresaId();
  const upsert = useUpsert("colaborador");
  const { toast } = useToast();
  const [val, setVal] = useState<Colaborador>({ status: "ativo" });
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const next: Colaborador = { status: "ativo", ...(initial ?? {}) };
      setVal(next);
      setFotoPreview(next.foto_path ? supabase.storage.from(FOTO_BUCKET).getPublicUrl(next.foto_path).data.publicUrl : null);
    }
  }, [open, initial]);

  const set = <K extends keyof Colaborador>(k: K, v: Colaborador[K]) => setVal((prev) => ({ ...prev, [k]: v }));

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!FOTO_MIME.includes(f.type)) {
      toast({ title: "Formato inválido", description: "Use JPG, PNG ou WEBP.", variant: "destructive" });
      return;
    }
    if (f.size > FOTO_MAX_BYTES) {
      toast({ title: "Foto muito grande", description: "Limite de 2 MB.", variant: "destructive" });
      return;
    }
    if (!empresaId) {
      toast({ title: "Empresa não definida", variant: "destructive" });
      return;
    }
    setUploadingFoto(true);
    try {
      const ext = f.name.includes(".") ? f.name.slice(f.name.lastIndexOf(".")) : ".jpg";
      const safeCpf = (val.cpf ?? "novo").replace(/\D/g, "") || "novo";
      const path = `${empresaId}/${safeCpf}-${Date.now()}${ext}`;
      const up = await supabase.storage.from(FOTO_BUCKET).upload(path, f, { upsert: true, contentType: f.type });
      if (up.error) throw up.error;
      set("foto_path", path);
      setFotoPreview(supabase.storage.from(FOTO_BUCKET).getPublicUrl(path).data.publicUrl);
      toast({ title: "Foto carregada e arquivada" });
    } catch (err: any) {
      toast({ title: "Falha no upload da foto", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setUploadingFoto(false);
    }
  };

  const save = async () => {
    if (!val.cpf || !val.nome) {
      toast({ title: "Campos obrigatórios", description: "CPF e Nome são obrigatórios.", variant: "destructive" });
      return;
    }
    const payload: any = { ...val };
    if (!payload.id && empresaId && !payload.empresa_id) payload.empresa_id = empresaId;
    if (!payload.data_admissao) payload.data_admissao = new Date().toISOString().slice(0, 10);
    if (payload.salario_base == null || payload.salario_base === ("" as any)) payload.salario_base = 0;
    await upsert.mutateAsync(payload);
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{val.id ? "Editar colaborador" : "Cadastro de Colaborador"}</DialogTitle>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={["pessoais", "funcionais"]} className="w-full">
          {/* DADOS PESSOAIS */}
          <AccordionItem value="pessoais">
            <AccordionTrigger className="text-sm font-semibold">Dados Pessoais</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                {/* Foto */}
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border bg-muted">
                    {fotoPreview ? (
                      <img src={fotoPreview} alt="Foto" className="h-full w-full object-cover" />
                    ) : (
                      <User2 className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFoto}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadingFoto}>
                    {uploadingFoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Alterar Foto
                  </Button>
                  <p className="text-center text-[10px] text-muted-foreground">JPG/PNG/WEBP<br />Máx. 2 MB</p>
                </div>

                {/* Campos */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Nome" required>
                    <Input value={val.nome ?? ""} placeholder="Ex: Maria da Silva Souza" onChange={(e) => set("nome", e.target.value)} />
                  </Field>
                  <Field label="Data de Nascimento">
                    <Input type="date" value={val.data_nascimento ?? ""} onChange={(e) => set("data_nascimento", e.target.value || null)} />
                  </Field>
                  <Field label="CPF" required>
                    <Input value={val.cpf ?? ""} placeholder="Ex: 123.456.789-00" onChange={(e) => set("cpf", e.target.value)} />
                  </Field>
                  <Field label="Gênero">
                    <Select value={val.genero ?? ""} onValueChange={(v) => set("genero", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                        <SelectItem value="nao_informado">Não informado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="E-mail Pessoal">
                    <Input type="email" value={val.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                  </Field>
                  <Field label="RG">
                    <Input value={val.rg ?? ""} onChange={(e) => set("rg", e.target.value)} />
                  </Field>
                  <Field label="PIS/PASEP">
                    <Input value={val.pis_pasep ?? ""} onChange={(e) => set("pis_pasep", e.target.value)} />
                  </Field>
                  <Field label="Telefone Celular">
                    <Input value={val.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
                  </Field>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* DADOS FUNCIONAIS */}
          <AccordionItem value="funcionais">
            <AccordionTrigger className="text-sm font-semibold">Dados Funcionais</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Matrícula"><Input placeholder="autogerado" value={val.matricula ?? ""} onChange={(e) => set("matricula", e.target.value)} /></Field>
                <Field label="Cargo" required><Input value={val.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} /></Field>
                <Field label="Gestor Direto"><Input value={val.gestor_direto ?? ""} onChange={(e) => set("gestor_direto", e.target.value)} /></Field>
                <Field label="Data de Admissão" required>
                  <Input type="date" value={val.data_admissao ?? ""} onChange={(e) => set("data_admissao", e.target.value)} />
                </Field>
                <Field label="Tipo de Contrato">
                  <Select value={val.tipo_contrato ?? ""} onValueChange={(v) => set("tipo_contrato", v)}>
                    <SelectTrigger><SelectValue placeholder="CLT" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLT">CLT</SelectItem>
                      <SelectItem value="PJ">PJ</SelectItem>
                      <SelectItem value="Estágio">Estágio</SelectItem>
                      <SelectItem value="Temporário">Temporário</SelectItem>
                      <SelectItem value="Aprendiz">Aprendiz</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Departamento"><Input value={val.departamento ?? ""} onChange={(e) => set("departamento", e.target.value)} /></Field>
                <Field label="Jornada de Trabalho">
                  <Select value={val.jornada ?? ""} onValueChange={(v) => set("jornada", v)}>
                    <SelectTrigger><SelectValue placeholder="44h Semanais" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="44h">44h Semanais</SelectItem>
                      <SelectItem value="40h">40h Semanais</SelectItem>
                      <SelectItem value="36h">36h Semanais</SelectItem>
                      <SelectItem value="30h">30h Semanais</SelectItem>
                      <SelectItem value="20h">20h Semanais</SelectItem>
                      <SelectItem value="escala">Escala</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="CBO"><Input placeholder="Classificação Brasileira de Ocupações" value={val.cbo ?? ""} onChange={(e) => set("cbo", e.target.value)} /></Field>
                <Field label="Salário Base">
                  <Input type="number" step="0.01" placeholder="Ex: 5.500,00"
                    value={val.salario_base ?? ""}
                    onChange={(e) => set("salario_base", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
                <Field label="Status">
                  <Select value={val.status ?? "ativo"} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="afastado">Afastado</SelectItem>
                      <SelectItem value="ferias">Férias</SelectItem>
                      <SelectItem value="demitido">Demitido</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Data de Demissão">
                  <Input type="date" value={val.data_demissao ?? ""} onChange={(e) => set("data_demissao", e.target.value || null)} />
                </Field>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ENDEREÇO */}
          <AccordionItem value="endereco">
            <AccordionTrigger className="text-sm font-semibold">Informações Complementares — Endereço</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="CEP"><Input value={val.endereco_cep ?? ""} onChange={(e) => set("endereco_cep", e.target.value)} /></Field>
                <Field label="Rua"><Input value={val.endereco_rua ?? ""} onChange={(e) => set("endereco_rua", e.target.value)} /></Field>
                <Field label="Número"><Input value={val.endereco_numero ?? ""} onChange={(e) => set("endereco_numero", e.target.value)} /></Field>
                <Field label="Bairro"><Input value={val.endereco_bairro ?? ""} onChange={(e) => set("endereco_bairro", e.target.value)} /></Field>
                <Field label="Cidade"><Input value={val.endereco_cidade ?? ""} onChange={(e) => set("endereco_cidade", e.target.value)} /></Field>
                <Field label="UF"><Input maxLength={2} value={val.endereco_uf ?? ""} onChange={(e) => set("endereco_uf", e.target.value.toUpperCase())} /></Field>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* OBSERVAÇÕES */}
          <AccordionItem value="obs">
            <AccordionTrigger className="text-sm font-semibold">Observações</AccordionTrigger>
            <AccordionContent>
              <Textarea rows={4} value={val.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
