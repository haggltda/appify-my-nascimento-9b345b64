import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChecklistPerguntas } from "./ChecklistPerguntas";
import { PERGUNTAS_CHECKLIST_INICIO } from "../types";

export function ChecklistPreInicio({ onIniciar, iniciando }: { onIniciar: (checklist: Record<string, string>) => void; iniciando: boolean }) {
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const completo = PERGUNTAS_CHECKLIST_INICIO.every((p) => !!respostas[p.id]);

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="text-sm font-semibold">Check-list antes do início</p>
        <p className="text-xs text-muted-foreground">Confirme os itens abaixo para iniciar a reunião.</p>
      </div>
      <ChecklistPerguntas
        perguntas={PERGUNTAS_CHECKLIST_INICIO}
        respostas={respostas}
        onChange={(id, v) => setRespostas((r) => ({ ...r, [id]: v }))}
      />
      <Button className="w-full" disabled={!completo || iniciando} onClick={() => onIniciar(respostas)}>
        {iniciando ? "Iniciando…" : completo ? "Iniciar reunião" : "Confirme todos os itens acima"}
      </Button>
    </Card>
  );
}
