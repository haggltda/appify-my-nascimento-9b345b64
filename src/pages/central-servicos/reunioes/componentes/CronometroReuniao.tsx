import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";

function formatarDuracao(segundos: number): string {
  const hh = String(Math.floor(segundos / 3600)).padStart(2, "0");
  const mm = String(Math.floor((segundos % 3600) / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function CronometroReuniao({ inicioIso }: { inicioIso: string }) {
  const [pausado, setPausado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (pausado) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pausado]);

  const segundos = Math.max(0, Math.floor((agora - new Date(inicioIso).getTime()) / 1000));

  return (
    <div className="flex items-center gap-2">
      <div className="text-right">
        <p className="text-[10px] text-muted-foreground">Tempo decorrido</p>
        <p className="font-mono text-lg leading-none">{formatarDuracao(segundos)}</p>
      </div>
      <Button type="button" size="icon" variant="outline" onClick={() => setPausado((p) => !p)} title={pausado ? "Retomar" : "Pausar reunião"}>
        {pausado ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>
    </div>
  );
}
