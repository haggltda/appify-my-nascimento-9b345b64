import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PerguntaChecklist } from "../types";

export function ChecklistPerguntas({
  perguntas, respostas, onChange, modo = "botoes",
}: {
  perguntas: PerguntaChecklist[];
  respostas: Record<string, string>;
  onChange: (id: string, value: string) => void;
  /** "dropdown" evita os botões sobrepondo/quebrando em colunas estreitas (ex: sidebar de Encerramento). */
  modo?: "botoes" | "dropdown";
}) {
  if (modo === "dropdown") {
    return (
      <div className="space-y-3">
        {perguntas.map((p) => (
          <div key={p.id} className="space-y-1">
            <Label className="text-sm font-normal">{p.pergunta}</Label>
            <Select value={respostas[p.id] ?? ""} onValueChange={(v) => onChange(p.id, v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {p.opcoes.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {perguntas.map((p) => (
        <div key={p.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <Label className="text-sm font-normal">{p.pergunta}</Label>
          <div className="flex flex-wrap gap-1.5">
            {p.opcoes.map((o) => (
              <Button
                key={o.value}
                type="button"
                size="sm"
                variant={respostas[p.id] === o.value ? "default" : "outline"}
                onClick={() => onChange(p.id, o.value)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
