import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import logoNascimento from "@/assets/logo-nascimento-icon.png";
import {
  CLASSIFICACAO_DEMANDA_OPCOES,
  BENEFICIOS_ESPERADOS_OPCOES,
  IMPACTO_TIPO_OPCOES,
  DOCUMENTOS_APOIO_OPCOES,
  GRAU_URGENCIA_LABEL,
} from "./types";

interface FormState {
  titulo: string;
  area_solicitante: string;
  responsavel_solicitacao: string;
  cargo_solicitante: string;
  email_solicitante: string;
  telefone_solicitante: string;
  classificacao_demanda: string[];
  descricao_necessidade: string;
  problema_atual: string;
  situacao_desejada: string;
  justificativa: string;
  beneficios_esperados_lista: string[];
  impacto_tipo: string;
  areas_impactadas: string;
  grau_urgencia: string;
  justificativa_urgencia: string;
  existe_processo_documentado: "" | "sim" | "nao";
  codigo_processo: string;
  tipos_documentos_apoio: string[];
  observacoes_abertura: string;
}

const INITIAL: FormState = {
  titulo: "",
  area_solicitante: "",
  responsavel_solicitacao: "",
  cargo_solicitante: "",
  email_solicitante: "",
  telefone_solicitante: "",
  classificacao_demanda: [],
  descricao_necessidade: "",
  problema_atual: "",
  situacao_desejada: "",
  justificativa: "",
  beneficios_esperados_lista: [],
  impacto_tipo: "",
  areas_impactadas: "",
  grau_urgencia: "",
  justificativa_urgencia: "",
  existe_processo_documentado: "",
  codigo_processo: "",
  tipos_documentos_apoio: [],
  observacoes_abertura: "",
};

function SecaoTitulo({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-1.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#153169] text-[11px] font-bold text-white">
        {numero}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#153169]">{titulo}</span>
    </div>
  );
}

function CampoTexto({ label, value, onChange, placeholder, obrigatorio }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; obrigatorio?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">
        {label}{obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm" />
    </div>
  );
}

function CampoTextarea({ label, value, onChange, placeholder, obrigatorio, linhas = 3 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; obrigatorio?: boolean; linhas?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">
        {label}{obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm"
        rows={linhas}
      />
    </div>
  );
}

function Checkboxes({ opcoes, selecionados, onChange }: {
  opcoes: { value: string; label: string }[];
  selecionados: string[];
  onChange: (novos: string[]) => void;
}) {
  const toggle = (value: string) => {
    onChange(selecionados.includes(value) ? selecionados.filter((v) => v !== value) : [...selecionados, value]);
  };
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {opcoes.map((op) => (
        <div key={op.value} className="flex items-center gap-2">
          <Checkbox
            id={`chk-${op.value}`}
            checked={selecionados.includes(op.value)}
            onCheckedChange={() => toggle(op.value)}
          />
          <Label htmlFor={`chk-${op.value}`} className="cursor-pointer text-xs font-normal">{op.label}</Label>
        </div>
      ))}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  nomeUsuarioAtual?: string;
  salvando: boolean;
  onSubmit: (dados: FormState & { arquivos: File[] }) => Promise<void>;
}

export function FsdFormCriar({ open, onClose, nomeUsuarioAtual = "", salvando, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>({ ...INITIAL, responsavel_solicitacao: nomeUsuarioAtual });
  const [arquivos, setArquivos] = useState<File[]>([]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const podeSubmeter =
    form.titulo.trim() !== "" &&
    form.area_solicitante.trim() !== "" &&
    form.responsavel_solicitacao.trim() !== "" &&
    form.classificacao_demanda.length > 0 &&
    form.descricao_necessidade.trim() !== "" &&
    form.grau_urgencia !== "";

  const handleSubmit = async () => {
    if (!podeSubmeter || salvando) return;
    await onSubmit({ ...form, arquivos });
    setForm({ ...INITIAL, responsavel_solicitacao: nomeUsuarioAtual });
    setArquivos([]);
  };

  const handleClose = () => {
    if (!salvando) {
      setForm({ ...INITIAL, responsavel_solicitacao: nomeUsuarioAtual });
      setArquivos([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        {/* Cabeçalho padronizado */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoNascimento} alt="Nascimento" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-base font-bold text-[#153169]">Formulário de Solicitação de Demanda</p>
              <p className="text-xs font-semibold text-[#e67e22]">Solicitação de Demanda · FSD</p>
            </div>
          </div>
          <div className="rounded-md border border-[#153169]/30 bg-[#153169]/5 px-3 py-1.5 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#153169]/60">Nº da solicitação</p>
            <p className="text-sm font-bold text-[#153169]">Automático</p>
            <p className="text-[9px] text-muted-foreground">gerado ao criar</p>
          </div>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Título */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#153169]">
              Título da Solicitação <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="Exemplo: Desenvolvimento de módulo de controle de férias no ERP para gestão de solicitações e aprovações."
              className="text-sm font-medium"
            />
          </div>

          {/* Seção 1 - Identificação */}
          <div className="space-y-3">
            <SecaoTitulo numero={1} titulo="Identificação da Demanda" />
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoTexto label="Área Solicitante" value={form.area_solicitante} onChange={(v) => set("area_solicitante", v)} placeholder="Selecione..." obrigatorio />
              <CampoTexto label="Responsável pela Solicitação" value={form.responsavel_solicitacao} onChange={(v) => set("responsavel_solicitacao", v)} placeholder="Exemplo: João da Silva" obrigatorio />
              <CampoTexto label="Cargo" value={form.cargo_solicitante} onChange={(v) => set("cargo_solicitante", v)} placeholder="Exemplo: Coordenador Administrativo" />
              <CampoTexto label="E-mail" value={form.email_solicitante} onChange={(v) => set("email_solicitante", v)} placeholder="seu.email@empresa.com.br" />
              <CampoTexto label="Telefone" value={form.telefone_solicitante} onChange={(v) => set("telefone_solicitante", v)} placeholder="(00) 00000-0000" />
            </div>
          </div>

          {/* Seção 2 - Classificação */}
          <div className="space-y-3">
            <SecaoTitulo numero={2} titulo="Classificação da Demanda" />
            <p className="text-[11px] text-muted-foreground">Selecione uma ou mais categorias que melhor descrevem esta solicitação: <span className="text-destructive">*</span></p>
            <Checkboxes opcoes={CLASSIFICACAO_DEMANDA_OPCOES} selecionados={form.classificacao_demanda} onChange={(v) => set("classificacao_demanda", v)} />
          </div>

          {/* Seção 3 - Descrição da Necessidade */}
          <div className="space-y-3">
            <SecaoTitulo numero={3} titulo="Descrição da Necessidade" />
            <CampoTextarea label="Descreva de forma clara e objetiva a necessidade que motivou esta solicitação" value={form.descricao_necessidade} onChange={(v) => set("descricao_necessidade", v)} placeholder="Exemplo: Necessitamos de um módulo no ERP para controle de férias dos colaboradores, permitindo que o colaborador solicite férias, o gestor aprove ou rejeite, e o sistema registre o período e atualize o saldo automaticamente. Deve gerar relatórios de férias por colaborador e por período." obrigatorio linhas={4} />
          </div>

          {/* Seção 4 - Situação Atual */}
          <div className="space-y-3">
            <SecaoTitulo numero={4} titulo="Situação Atual" />
            <CampoTextarea label="Como esse processo é realizado hoje?" value={form.problema_atual} onChange={(v) => set("problema_atual", v)} placeholder="Exemplo: Atualmente as solicitações de férias são feitas por e-mail ou planilha Excel. O gestor responde por e-mail e o RH lança manualmente no sistema." linhas={3} />
          </div>

          {/* Seção 5 - Situação Desejada */}
          <div className="space-y-3">
            <SecaoTitulo numero={5} titulo="Situação Desejada" />
            <CampoTextarea label="Como você espera que esse processo funcione após a melhoria?" value={form.situacao_desejada} onChange={(v) => set("situacao_desejada", v)} placeholder="Exemplo: O colaborador solicita férias via sistema, o gestor aprova ou rejeita no ERP e o sistema registra automaticamente, atualiza o saldo e gera relatórios." linhas={3} />
          </div>

          {/* Seção 6 - Justificativa */}
          <div className="space-y-3">
            <SecaoTitulo numero={6} titulo="Justificativa" />
            <CampoTextarea label="Por que essa demanda é necessária?" value={form.justificativa} onChange={(v) => set("justificativa", v)} placeholder="Exemplo: Para padronizar e automatizar o processo de férias, reduzir retrabalho do RH, garantir controle e rastreabilidade das informações." linhas={3} />
          </div>

          {/* Seção 7 - Benefícios Esperados */}
          <div className="space-y-3">
            <SecaoTitulo numero={7} titulo="Benefícios Esperados" />
            <p className="text-[11px] text-muted-foreground">Selecione os benefícios que esta solicitação deve gerar:</p>
            <Checkboxes opcoes={BENEFICIOS_ESPERADOS_OPCOES} selecionados={form.beneficios_esperados_lista} onChange={(v) => set("beneficios_esperados_lista", v)} />
          </div>

          {/* Seção 8 - Impacto */}
          <div className="space-y-3">
            <SecaoTitulo numero={8} titulo="Impacto da Demanda" />
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Escopo de impacto:</p>
              <RadioGroup value={form.impacto_tipo} onValueChange={(v) => set("impacto_tipo", v)} className="space-y-1">
                {IMPACTO_TIPO_OPCOES.map((op) => (
                  <div key={op.value} className="flex items-center gap-2">
                    <RadioGroupItem value={op.value} id={`imp-${op.value}`} />
                    <Label htmlFor={`imp-${op.value}`} className="cursor-pointer text-xs font-normal">{op.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            {form.impacto_tipo && form.impacto_tipo !== "apenas_minha_area" && (
              <CampoTextarea label="Áreas impactadas" value={form.areas_impactadas} onChange={(v) => set("areas_impactadas", v)} placeholder="Exemplo: RH, DP, Financeiro" linhas={2} />
            )}
          </div>

          {/* Seção 9 - Urgência */}
          <div className="space-y-3">
            <SecaoTitulo numero={9} titulo="Grau de Urgência" />
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Grau de urgência: <span className="text-destructive">*</span></p>
              <RadioGroup value={form.grau_urgencia} onValueChange={(v) => set("grau_urgencia", v)} className="flex gap-4">
                {Object.entries(GRAU_URGENCIA_LABEL).map(([v, label]) => (
                  <div key={v} className="flex items-center gap-2">
                    <RadioGroupItem value={v} id={`urg-${v}`} />
                    <Label htmlFor={`urg-${v}`} className="cursor-pointer text-xs font-normal">{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <CampoTextarea label="Justificativa da urgência" value={form.justificativa_urgencia} onChange={(v) => set("justificativa_urgencia", v)} placeholder="Exemplo: Necessário para atender nova legislação que entra em vigor em 30/09/2025." linhas={2} />
          </div>

          {/* Seção 10 - Processo Documentado */}
          <div className="space-y-3">
            <SecaoTitulo numero={10} titulo="Processo Documentado" />
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Existe processo documentado relacionado a esta solicitação?</p>
              <RadioGroup value={form.existe_processo_documentado} onValueChange={(v) => set("existe_processo_documentado", v as "sim" | "nao" | "")} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="proc-sim" />
                  <Label htmlFor="proc-sim" className="cursor-pointer text-xs font-normal">Sim</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="proc-nao" />
                  <Label htmlFor="proc-nao" className="cursor-pointer text-xs font-normal">Não</Label>
                </div>
              </RadioGroup>
            </div>
            {form.existe_processo_documentado === "sim" && (
              <CampoTexto label="Caso exista, informe o código do documento ou anexe." value={form.codigo_processo} onChange={(v) => set("codigo_processo", v)} placeholder="Exemplo: POP-RH-007 ou anexe o documento." />
            )}
          </div>

          {/* Seção 11 - Documentos de Apoio */}
          <div className="space-y-3">
            <SecaoTitulo numero={11} titulo="Documentos de Apoio" />
            <p className="text-[11px] text-muted-foreground">Tipos de documentos que serão anexados:</p>
            <Checkboxes opcoes={DOCUMENTOS_APOIO_OPCOES} selecionados={form.tipos_documentos_apoio} onChange={(v) => set("tipos_documentos_apoio", v)} />
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Arquivos anexos (opcional)</label>
              <Input
                type="file"
                multiple
                onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
                className="cursor-pointer text-xs"
              />
              {arquivos.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">{arquivos.length} arquivo(s) selecionado(s).</p>
              )}
            </div>
          </div>

          {/* Seção 12 - Observações */}
          <div className="space-y-3">
            <SecaoTitulo numero={12} titulo="Observações Adicionais" />
            <CampoTextarea label="Informações complementares que possam auxiliar na análise" value={form.observacoes_abertura} onChange={(v) => set("observacoes_abertura", v)} placeholder="Exemplo: Informações adicionais que possam ajudar na análise da demanda." linhas={3} />
          </div>

          {/* Rodapé */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={handleClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!podeSubmeter || salvando}>
              {salvando ? "Enviando…" : "Criar solicitação de sistema"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
