import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useCriarReuniao, useCriarReunioesRecorrentes, useUsuariosAtivos, verificarConflitoSala, verificarConflitoParticipante } from "./useReunioes";
import { SALAS_PRESENCIAIS } from "./types";

const MAX_OCORRENCIAS_RECORRENCIA = 60;

/** Gera as datas ISO da recorrência semanal: mesma hora da primeira reunião, a cada 7 dias, até repetirAte (inclusive). */
function gerarDatasRecorrencia(dataHoraInicialIso: string, repetirAte: string): string[] {
  const datas: string[] = [];
  const fim = new Date(`${repetirAte}T23:59:59`);
  let atual = new Date(dataHoraInicialIso);
  while (atual <= fim && datas.length < MAX_OCORRENCIAS_RECORRENCIA + 1) {
    datas.push(atual.toISOString());
    atual = new Date(atual.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return datas;
}

interface PautaRascunho {
  titulo_topico: string;
  descricao: string;
}

const VAZIO = {
  titulo: "",
  objetivo: "",
  data: "",
  hora: "",
  duracao_minutos: 60,
  tipo_local: "presencial" as "presencial" | "online",
  sala: "",
  local_outro: "",
  local_ou_link: "",
  responsavel: "",
  convidados: [] as string[],
  repetir: false,
  repetirAte: "",
};

export function ReuniaoFormCriar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState(VAZIO);
  const [pauta, setPauta] = useState<PautaRascunho[]>([]);
  const [novoTopico, setNovoTopico] = useState("");
  const [erroConflito, setErroConflito] = useState("");
  const [verificando, setVerificando] = useState(false);
  const { data: usuarios = [] } = useUsuariosAtivos();
  const criar = useCriarReuniao();
  const criarRecorrentes = useCriarReunioesRecorrentes();

  const opcoesUsuarios = usuarios.map((u) => ({ value: u.id, label: u.display_name }));

  const adicionarTopico = () => {
    if (!novoTopico.trim()) return;
    setPauta((p) => [...p, { titulo_topico: novoTopico.trim(), descricao: "" }]);
    setNovoTopico("");
  };

  const localFinal = form.tipo_local === "presencial"
    ? (form.sala === "Outro" ? form.local_outro.trim() : form.sala)
    : form.local_ou_link.trim();

  const valido =
    form.titulo.trim() &&
    form.data &&
    form.hora &&
    form.duracao_minutos > 0 &&
    localFinal &&
    form.responsavel &&
    pauta.length > 0 &&
    (!form.repetir || (form.repetirAte && form.repetirAte >= form.data));

  const qtdOcorrencias = form.repetir && form.data && form.hora && form.repetirAte && form.repetirAte >= form.data
    ? gerarDatasRecorrencia(new Date(`${form.data}T${form.hora}:00`).toISOString(), form.repetirAte).length
    : null;

  const salvar = async () => {
    if (!valido) return;
    setErroConflito("");
    const dataHora = new Date(`${form.data}T${form.hora}:00`).toISOString();

    if (form.repetir) {
      const datas = gerarDatasRecorrencia(dataHora, form.repetirAte);
      if (datas.length > MAX_OCORRENCIAS_RECORRENCIA) {
        setErroConflito(`Essa recorrência geraria ${datas.length} reuniões — o limite é ${MAX_OCORRENCIAS_RECORRENCIA}. Escolha uma data final mais próxima.`);
        return;
      }
      await criarRecorrentes.mutateAsync({
        base: {
          titulo: form.titulo.trim(),
          objetivo: form.objetivo.trim(),
          duracao_minutos: form.duracao_minutos,
          tipo_local: form.tipo_local,
          local_ou_link: localFinal,
          responsavel_preenchimento_user_id: form.responsavel,
          pauta,
          convidados: form.convidados,
        },
        datas,
      });
      setForm(VAZIO);
      setPauta([]);
      onOpenChange(false);
      return;
    }

    setVerificando(true);
    try {
      if (form.tipo_local === "presencial") {
        const conflito = await verificarConflitoSala({
          local: localFinal,
          dataHoraIso: dataHora,
          duracaoMinutos: form.duracao_minutos,
        });
        if (conflito) {
          setErroConflito(`"${localFinal}" já está reservada nesse horário (reunião "${conflito.titulo}").`);
          return;
        }
      }

      const conflitoResponsavel = await verificarConflitoParticipante({
        userId: form.responsavel,
        dataHoraIso: dataHora,
        duracaoMinutos: form.duracao_minutos,
      });
      if (conflitoResponsavel) {
        const nome = opcoesUsuarios.find((o) => o.value === form.responsavel)?.label ?? "O responsável";
        setErroConflito(`${nome} já está em outra reunião nesse horário (reunião "${conflitoResponsavel.titulo}").`);
        return;
      }

      for (const convidadoId of form.convidados) {
        const conflito = await verificarConflitoParticipante({
          userId: convidadoId,
          dataHoraIso: dataHora,
          duracaoMinutos: form.duracao_minutos,
        });
        if (conflito) {
          const nome = opcoesUsuarios.find((o) => o.value === convidadoId)?.label ?? "Participante";
          setErroConflito(`${nome} já está convidado para outra reunião nesse horário (reunião "${conflito.titulo}").`);
          return;
        }
      }
    } finally {
      setVerificando(false);
    }

    await criar.mutateAsync({
      titulo: form.titulo.trim(),
      objetivo: form.objetivo.trim(),
      data_hora: dataHora,
      duracao_minutos: form.duracao_minutos,
      tipo_local: form.tipo_local,
      local_ou_link: localFinal,
      responsavel_preenchimento_user_id: form.responsavel,
      pauta,
      convidados: form.convidados,
    });
    setForm(VAZIO);
    setPauta([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Reunião</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Reunião de alinhamento - Diretoria" />
          </div>

          <div className="space-y-1.5">
            <Label>Objetivo</Label>
            <Textarea value={form.objetivo} onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))} className="min-h-16" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Horário *</Label>
              <Input type="time" value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (min) *</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={form.duracao_minutos}
                onChange={(e) => setForm((f) => ({ ...f, duracao_minutos: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-4">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select
                value={form.tipo_local}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_local: v as "presencial" | "online", sala: "", local_outro: "", local_ou_link: "" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo_local === "presencial" ? (
              <div className="space-y-1.5">
                <Label>Local *</Label>
                <Select value={form.sala} onValueChange={(v) => setForm((f) => ({ ...f, sala: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione a sala" /></SelectTrigger>
                  <SelectContent>
                    {SALAS_PRESENCIAIS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.sala === "Outro" && (
                  <Input
                    className="mt-1.5"
                    value={form.local_outro}
                    onChange={(e) => setForm((f) => ({ ...f, local_outro: e.target.value }))}
                    placeholder="Descreva"
                  />
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Link da reunião *</Label>
                <Input
                  value={form.local_ou_link}
                  onChange={(e) => setForm((f) => ({ ...f, local_ou_link: e.target.value }))}
                  placeholder="Ex: https://meet.google.com/..."
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="repetir-semanal">Repetir semanalmente</Label>
              <Switch
                id="repetir-semanal"
                checked={form.repetir}
                onCheckedChange={(v) => setForm((f) => ({ ...f, repetir: v }))}
              />
            </div>
            {form.repetir && (
              <div className="space-y-1.5 pt-1.5">
                <Label>Repetir até *</Label>
                <Input type="date" value={form.repetirAte} min={form.data || undefined} onChange={(e) => setForm((f) => ({ ...f, repetirAte: e.target.value }))} />
                <p className="text-xs text-muted-foreground">
                  Cria uma reunião toda semana, no mesmo dia e horário, até essa data.
                </p>
              </div>
            )}
          </div>

          {erroConflito && (
            <p className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{erroConflito}</p>
          )}

          <div className="space-y-1.5">
            <Label>Responsável pelo preenchimento da ata *</Label>
            <SearchableSelect
              value={form.responsavel}
              onChange={(v) => setForm((f) => ({ ...f, responsavel: v }))}
              options={opcoesUsuarios}
              placeholder="Quem vai preencher as respostas após a reunião"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Convidados (recebem notificação)</Label>
            <SearchableMultiSelect
              value={form.convidados}
              onChange={(v) => setForm((f) => ({ ...f, convidados: v }))}
              options={opcoesUsuarios}
            />
          </div>

          <div className="space-y-2">
            <Label>Pauta *</Label>
            <div className="space-y-2">
              {pauta.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                  <span>{i + 1}. {p.titulo_topico}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPauta((arr) => arr.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Novo tópico de pauta"
                  value={novoTopico}
                  onChange={(e) => setNovoTopico(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarTopico())}
                />
                <Button type="button" variant="outline" className="gap-1" onClick={adicionarTopico}>
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!valido || criar.isPending || criarRecorrentes.isPending || verificando}>
            {verificando
              ? "Verificando sala…"
              : criar.isPending || criarRecorrentes.isPending
              ? "Agendando…"
              : qtdOcorrencias !== null
              ? `Agendar ${qtdOcorrencias} reuniões`
              : "Agendar reunião"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
