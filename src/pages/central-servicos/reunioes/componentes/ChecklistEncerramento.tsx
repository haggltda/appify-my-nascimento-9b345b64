import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChecklistPerguntas } from "./ChecklistPerguntas";
import { PERGUNTAS_CHECKLIST_ENCERRAMENTO } from "../types";

export function ChecklistEncerramento({
  horaInicioReal, onEncerrar, encerrando,
}: {
  horaInicioReal: string | null;
  onEncerrar: (checklist: Record<string, string>) => void;
  encerrando: boolean;
}) {
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const completo = PERGUNTAS_CHECKLIST_ENCERRAMENTO.every((p) => !!respostas[p.id]);
  const duracaoPrevista = horaInicioReal
    ? Math.round((Date.now() - new Date(horaInicioReal).getTime()) / 60_000)
    : null;

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="text-sm font-semibold">Encerramento da reunião</p>
        <p className="text-xs text-muted-foreground">Confirme os itens abaixo para concluir a reunião.</p>
      </div>
      <ChecklistPerguntas
        perguntas={PERGUNTAS_CHECKLIST_ENCERRAMENTO}
        respostas={respostas}
        onChange={(id, v) => setRespostas((r) => ({ ...r, [id]: v }))}
      />
      {duracaoPrevista !== null && (
        <p className="text-xs text-muted-foreground">Duração real (calculada automaticamente): {duracaoPrevista} min</p>
      )}
      <Button className="w-full" variant="destructive" disabled={!completo || encerrando} onClick={() => onEncerrar(respostas)}>
        {encerrando ? "Encerrando…" : completo ? "Concluir reunião" : "Confirme todos os itens acima"}
      </Button>
    </Card>
  );
}
