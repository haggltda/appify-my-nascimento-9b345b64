import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBuilderStore } from "../store";
import { CAMPOS_SISTEMA_DISPONIVEIS, TRANSFORMACOES_DISPONIVEIS, type CnabEstrutura } from "../types";
import { gerarPreview } from "../preview";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVertical, Plus, Trash2, Wand2, FileCode2 } from "lucide-react";

function ChipCampo({ path, label }: { path: string; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `origem:${path}`,
    data: { tipo: "origem", path },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab items-center gap-2 rounded-md border bg-card p-2 text-xs shadow-sm transition active:cursor-grabbing ${
        isDragging ? "opacity-40" : "hover:border-primary"
      }`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <span className="font-medium">{label}</span>
      <code className="ml-auto text-[10px] text-muted-foreground">{path}</code>
    </div>
  );
}

function SlotCampo({ segIdx, campoIdx }: { segIdx: number; campoIdx: number }) {
  const campo = useBuilderStore((s) => (s.estrutura as CnabEstrutura).segmentos[segIdx].campos[campoIdx]);
  const atualizar = useBuilderStore((s) => s.atualizarCampoCNAB);
  const remover = useBuilderStore((s) => s.removerCampoCNAB);
  const { isOver, setNodeRef } = useDroppable({
    id: `slot:${segIdx}:${campoIdx}`,
    data: { tipo: "slot", segIdx, campoIdx },
  });

  const isLiteral = campo.origem.startsWith("literal:");
  const cor = !campo.origem ? "border-destructive" : isOver ? "border-primary bg-primary/10" : "border-border";

  function toggleTransf(t: string) {
    const ts = new Set(campo.transformacoes || []);
    ts.has(t) ? ts.delete(t) : ts.add(t);
    atualizar(segIdx, campoIdx, { transformacoes: Array.from(ts) });
  }

  return (
    <Card ref={setNodeRef} className={`space-y-2 border-2 p-3 transition ${cor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold">{campo.nome}</span>
            <Badge variant="outline" className="text-[10px]">
              pos {campo.pos_ini}-{campo.pos_fim} ({campo.tamanho})
            </Badge>
            <Badge variant="secondary" className="text-[10px]">{campo.tipo}</Badge>
            {campo.obrigatorio && <Badge variant="destructive" className="text-[10px]">obrig</Badge>}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {campo.origem ? (
              isLiteral ? <code>literal: "{campo.origem.slice(8)}"</code> : <code>← {campo.origem}</code>
            ) : (
              <span className="text-destructive">⚠ campo sem origem (arraste um chip aqui)</span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => remover(segIdx, campoIdx)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {(campo.transformacoes || []).map((t) => (
          <Badge key={t} variant="default" className="cursor-pointer gap-1 text-[10px]" onClick={() => toggleTransf(t)}>
            <Wand2 className="h-2.5 w-2.5" />
            {t}
            <span className="ml-1">×</span>
          </Badge>
        ))}
        <details className="ml-auto">
          <summary className="cursor-pointer text-[10px] text-primary hover:underline">+ transformação</summary>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {TRANSFORMACOES_DISPONIVEIS.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTransf(t.id)}
                className="rounded border bg-background p-1 text-left text-[10px] hover:border-primary"
                title={t.desc}
              >
                {t.label}
              </button>
            ))}
          </div>
        </details>
      </div>
    </Card>
  );
}

export function Etapa4Mapeamento() {
  const estrutura = useBuilderStore((s) => s.estrutura) as CnabEstrutura;
  const setOrigem = useBuilderStore((s) => s.setOrigemCampo);
  const adicionarCampo = useBuilderStore((s) => s.adicionarCampoCNAB);
  const adicionarSegmento = useBuilderStore((s) => s.adicionarSegmento);
  const amostraInput = useBuilderStore((s) => s.amostraInput);
  const tipo = useBuilderStore((s) => s.tipo);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const preview = useMemo(() => {
    try { return gerarPreview(estrutura, amostraInput); } catch (e: any) { return "Erro: " + e.message; }
  }, [estrutura, amostraInput]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const a = active.data.current as any;
    const o = over.data.current as any;
    if (a?.tipo === "origem" && o?.tipo === "slot") {
      setOrigem(o.segIdx, o.campoIdx, a.path);
    }
  }

  if (tipo.startsWith("api_rest")) {
    return <ApiRestEditor />;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_360px]">
        {/* Coluna esquerda: chips do meu sistema */}
        <Card className="p-3">
          <div className="mb-2 flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Campos do sistema</h3>
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">Arraste para os slots do banco →</p>
          <ScrollArea className="h-[520px] pr-2">
            <div className="space-y-1.5">
              {CAMPOS_SISTEMA_DISPONIVEIS.map((c) => (
                <ChipCampo key={c.path} path={c.path} label={c.label} />
              ))}
              <div className="mt-3 border-t pt-2">
                <Label className="text-[10px]">Adicionar literal</Label>
                <LiteralAdder />
              </div>
            </div>
          </ScrollArea>
        </Card>

        {/* Centro: layout do banco com slots */}
        <Card className="p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Layout do banco - {(estrutura as any).tipo?.toUpperCase()}</h3>
            <Button size="sm" variant="outline" onClick={() => {
              const cod = prompt("Código do segmento (ex: header_arquivo, segmento_a, trailer_lote):");
              if (cod) adicionarSegmento(cod);
            }}>
              <Plus className="mr-1 h-3 w-3" /> Segmento
            </Button>
          </div>
          <ScrollArea className="h-[520px] pr-2">
            <div className="space-y-4">
              {estrutura.segmentos.map((seg, segIdx) => (
                <div key={segIdx}>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">{seg.codigo}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => {
                      const ult = seg.campos[seg.campos.length - 1];
                      const inicio = ult ? ult.pos_fim + 1 : 1;
                      adicionarCampo(segIdx, {
                        nome: "novo_campo", pos_ini: inicio, pos_fim: inicio + 9, tamanho: 10,
                        tipo: "alfa", padding: "espacos_direita", origem: "",
                      });
                    }}>
                      <Plus className="mr-1 h-3 w-3" /> campo
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {seg.campos.map((_, campoIdx) => (
                      <SlotCampo key={campoIdx} segIdx={segIdx} campoIdx={campoIdx} />
                    ))}
                    {seg.campos.length === 0 && (
                      <div className="rounded-md border-2 border-dashed p-4 text-center text-xs text-muted-foreground">
                        Nenhum campo. Use "+ campo" e arraste origens.
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {estrutura.segmentos.length === 0 && (
                <div className="rounded-md border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
                  Adicione um segmento para começar (ex.: header_arquivo).
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Direita: preview ao vivo */}
        <Card className="p-3">
          <h3 className="mb-2 text-sm font-semibold">Preview ao vivo</h3>
          <p className="mb-2 text-[10px] text-muted-foreground">Atualiza a cada alteração.</p>
          <ScrollArea className="h-[520px]">
            <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-[10px] leading-relaxed">
              {preview || "(vazio)"}
            </pre>
          </ScrollArea>
        </Card>
      </div>
    </DndContext>
  );
}

function LiteralAdder() {
  const adicionarCampo = useBuilderStore((s) => s.adicionarCampoCNAB);
  return null; // placeholder - pode ser ampliado
}

function ApiRestEditor() {
  const estrutura = useBuilderStore((s) => s.estrutura) as any;
  const setEstrutura = useBuilderStore((s) => s.setEstrutura);
  const amostra = useBuilderStore((s) => s.amostraInput);
  const preview = useMemo(() => {
    try { return gerarPreview(estrutura, amostra); } catch (e: any) { return "Erro: " + e.message; }
  }, [estrutura, amostra]);

  const updateField = (k: string, v: any) => setEstrutura({ ...estrutura, [k]: v });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      <Card className="space-y-3 p-4">
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <Label>Método</Label>
          <select className="rounded-md border bg-background p-2 text-sm" value={estrutura.metodo || "POST"}
            onChange={(e) => updateField("metodo", e.target.value)}>
            <option>POST</option><option>PUT</option><option>PATCH</option><option>GET</option>
          </select>
          <Label>Endpoint</Label>
          <Input value={estrutura.endpoint || ""} onChange={(e) => updateField("endpoint", e.target.value)} />
        </div>

        <div>
          <Label>Headers (JSON)</Label>
          <textarea
            className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs"
            rows={5}
            value={JSON.stringify(estrutura.headers || {}, null, 2)}
            onChange={(e) => { try { updateField("headers", JSON.parse(e.target.value)); } catch {} }}
          />
        </div>

        <div>
          <Label>Body Template (JSON com {`{ origem: "campo.path", transformacoes: [...] }`})</Label>
          <textarea
            className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs"
            rows={14}
            value={JSON.stringify(estrutura.body_template || {}, null, 2)}
            onChange={(e) => { try { updateField("body_template", JSON.parse(e.target.value)); } catch {} }}
          />
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-xs">
          <strong>Dica:</strong> use chips arrastáveis em <code>{`{"origem": "titulo.valor"}`}</code> para mapear.
          Para texto fixo: <code>{`"valor literal"`}</code>. Para template inline: <code>{`"{{titulo.id}}"`}</code>.
        </div>
      </Card>

      <Card className="p-3">
        <h3 className="mb-2 text-sm font-semibold">Preview da requisição</h3>
        <ScrollArea className="h-[560px]">
          <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-[11px]">
            {preview}
          </pre>
        </ScrollArea>
      </Card>
    </div>
  );
}
