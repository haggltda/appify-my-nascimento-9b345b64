import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Trash2 } from "lucide-react";
import { useCriarBloqueioAgenda, useMeusBloqueiosAgenda, useRemoverBloqueioAgenda } from "../useBloqueioAgenda";
import { MOTIVO_BLOQUEIO_LABEL, type MotivoBloqueioAgenda, type TipoBloqueioAgenda } from "../types";

const VAZIO = {
  tipo: "data_especifica" as TipoBloqueioAgenda,
  data: "",
  dataInicio: "",
  dataFim: "",
  diaInteiro: true,
  horaInicio: "",
  horaFim: "",
  motivo: "" as MotivoBloqueioAgenda | "",
  motivoOutro: "",
};

function descreverBloqueio(b: { tipo: TipoBloqueioAgenda; data_inicio: string; data_fim: string; dia_inteiro: boolean; hora_inicio: string | null; hora_fim: string | null; motivo: MotivoBloqueioAgenda }): string {
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
  const periodo = b.tipo === "periodo" ? `${fmt(b.data_inicio)} a ${fmt(b.data_fim)}` : fmt(b.data_inicio);
  const horario = b.dia_inteiro ? "dia inteiro" : `${b.hora_inicio?.slice(0, 5)}–${b.hora_fim?.slice(0, 5)}`;
  return `${periodo} · ${horario} · ${MOTIVO_BLOQUEIO_LABEL[b.motivo]}`;
}

export function BloquearAgendaModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState(VAZIO);
  const { data: bloqueios = [] } = useMeusBloqueiosAgenda();
  const criar = useCriarBloqueioAgenda();
  const remover = useRemoverBloqueioAgenda();

  const valido =
    (form.tipo === "data_especifica" ? !!form.data : !!(form.dataInicio && form.dataFim && form.dataFim >= form.dataInicio)) &&
    (form.tipo === "periodo" || form.diaInteiro || !!(form.horaInicio && form.horaFim && form.horaFim > form.horaInicio)) &&
    !!form.motivo &&
    (form.motivo !== "outro" || !!form.motivoOutro.trim());

  const salvar = async () => {
    if (!valido || !form.motivo) return;
    const payload = form.tipo === "data_especifica"
      ? {
          tipo: "data_especifica" as const,
          data_inicio: form.data,
          data_fim: form.data,
          dia_inteiro: form.diaInteiro,
          hora_inicio: form.diaInteiro ? null : form.horaInicio,
          hora_fim: form.diaInteiro ? null : form.horaFim,
          motivo: form.motivo,
          motivo_outro: form.motivo === "outro" ? form.motivoOutro.trim() : null,
        }
      : {
          tipo: "periodo" as const,
          data_inicio: form.dataInicio,
          data_fim: form.dataFim,
          dia_inteiro: true,
          hora_inicio: null,
          hora_fim: null,
          motivo: form.motivo,
          motivo_outro: form.motivo === "outro" ? form.motivoOutro.trim() : null,
        };
    await criar.mutateAsync(payload);
    setForm(VAZIO);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bloquear Agenda</DialogTitle>
          <DialogDescription>Bloqueie períodos da sua agenda para indicar indisponibilidade.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de bloqueio</Label>
            <RadioGroup
              value={form.tipo}
              onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as TipoBloqueioAgenda, diaInteiro: true }))}
              className="grid grid-cols-2 gap-2"
            >
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 text-sm has-[[data-state=checked]]:border-primary">
                <RadioGroupItem value="data_especifica" className="mt-0.5" />
                <span>
                  <span className="block font-medium">Data específica</span>
                  <span className="block text-xs text-muted-foreground">Bloqueie um dia e horário específicos.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 text-sm has-[[data-state=checked]]:border-primary">
                <RadioGroupItem value="periodo" className="mt-0.5" />
                <span>
                  <span className="block font-medium">Período</span>
                  <span className="block text-xs text-muted-foreground">Bloqueie um intervalo de datas (dia inteiro).</span>
                </span>
              </label>
            </RadioGroup>
          </div>

          {form.tipo === "data_especifica" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.diaInteiro} onCheckedChange={(v) => setForm((f) => ({ ...f, diaInteiro: !!v }))} />
                Marcar o dia todo
              </label>
              {!form.diaInteiro && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Horário início *</Label>
                    <Input type="time" value={form.horaInicio} onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Horário fim *</Label>
                    <Input type="time" value={form.horaFim} onChange={(e) => setForm((f) => ({ ...f, horaFim: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data início *</Label>
                <Input type="date" value={form.dataInicio} onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data fim *</Label>
                <Input type="date" min={form.dataInicio || undefined} value={form.dataFim} onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Motivo do bloqueio *</Label>
            <RadioGroup value={form.motivo} onValueChange={(v) => setForm((f) => ({ ...f, motivo: v as MotivoBloqueioAgenda }))} className="space-y-1.5">
              {(Object.keys(MOTIVO_BLOQUEIO_LABEL) as MotivoBloqueioAgenda[]).map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={m} />
                  {MOTIVO_BLOQUEIO_LABEL[m]}
                </label>
              ))}
            </RadioGroup>
          </div>

          {form.motivo === "outro" && (
            <div className="space-y-1.5">
              <Label>Outro motivo *</Label>
              <Textarea
                value={form.motivoOutro}
                maxLength={250}
                onChange={(e) => setForm((f) => ({ ...f, motivoOutro: e.target.value }))}
                placeholder="Descreva o motivo do bloqueio..."
                className="min-h-16"
              />
              <p className="text-right text-xs text-muted-foreground">{form.motivoOutro.length}/250</p>
            </div>
          )}

          {bloqueios.length > 0 && (
            <div className="space-y-1.5">
              <Label>Meus bloqueios</Label>
              <div className="space-y-1">
                {bloqueios.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded border border-border px-2.5 py-1.5 text-xs">
                    <span>{descreverBloqueio(b)}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remover.mutate(b.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!valido || criar.isPending}>
            {criar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
