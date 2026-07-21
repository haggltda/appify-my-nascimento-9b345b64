import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PerguntaChecklist } from "../types";

export function ChecklistPerguntas({
  perguntas, respostas, onChange,
}: {
  perguntas: PerguntaChecklist[];
  respostas: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
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
