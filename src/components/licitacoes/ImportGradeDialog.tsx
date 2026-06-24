import { useMemo, useState, useContext } from "react";
import { EmpresaAtivaContext } from "@/context/EmpresaAtivaContext";
import { Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import gradeSeed from "@/data/licitacoesGradeSeed.json";
import {
  mapGradeToImportRows,
  hashRows,
  extrairResponsavelTexto,
  type GradeImportRow,
} from "@/utils/licitacoes/mapGradeToImportRows";
import {
  useLicitacaoImportacao,
  type AnexarResult,
  type ConfirmarResult,
  type ImportacaoErro,
} from "@/hooks/useLicitacaoImportacao";

export type ImportGradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string | null;
  onImported?: () => void;
};

type Etapa = "idle" | "preview" | "confirmando" | "sucesso";

function fmtErro(e: ImportacaoErro): string {
  const linha = e.linha != null ? `linha ${e.linha}` : "linha ?";
  if (e.campo || e.mensagem) return `${linha} — ${e.campo ?? "?"}: ${e.mensagem ?? "erro"}`;
  if (e.erro) return `${linha} — ${e.erro}`;
  return `${linha} — erro`;
}

export function ImportGradeDialog({
  open,
  onOpenChange,
  empresaId,
  onImported,
}: ImportGradeDialogProps) {
  const empresaCtx = useContext(EmpresaAtivaContext);
  const empresaSigla = empresaCtx?.empresa?.sigla ?? "—";

  const {
    criarLote,
    anexarLinhas,
    confirmarLote,
    cancelarLote,
    isCreating,
    isUploading,
    isConfirming,
    isCanceling,
    isBusy,
  } = useLicitacaoImportacao();

  const [etapa, setEtapa] = useState<Etapa>("idle");
  const [lote, setLote] = useState<string | null>(null);
  const [preview, setPreview] = useState<AnexarResult | null>(null);
  const [resultado, setResultado] = useState<ConfirmarResult | null>(null);
  const [erroFatal, setErroFatal] = useState<string | null>(null);

  const rows: GradeImportRow[] = useMemo(
    () => mapGradeToImportRows(gradeSeed as unknown[]),
    [],
  );
  const totalLinhas = rows.length;

  const pendenciasPrevistas = useMemo(() => {
    const out: Array<{ linha: number; texto: string }> = [];
    rows.forEach((r, i) => {
      const t = extrairResponsavelTexto(r.observacoes);
      if (t) out.push({ linha: i + 1, texto: t });
    });
    return out;
  }, [rows]);

  const linhasValidas = preview?.linhas_validas ?? 0;
  const linhasInvalidas = preview?.linhas_invalidas ?? 0;
  const erros = preview?.erros ?? [];
  const pendenciasRegistradas = preview?.pendencias_responsavel ?? [];

  const podeConfirmar =
    etapa === "preview" &&
    !!lote &&
    !!preview &&
    linhasInvalidas === 0 &&
    linhasValidas > 0 &&
    !isBusy;

  const reset = () => {
    setEtapa("idle");
    setLote(null);
    setPreview(null);
    setResultado(null);
    setErroFatal(null);
  };

  const tentarFecharComCancelamento = async () => {
    if (isBusy) return;
    if (lote && etapa !== "sucesso") {
      try {
        await cancelarLote.mutateAsync({ lote });
        toast({ title: "Lote cancelado." });
      } catch (e) {
        setErroFatal((e as Error).message);
        toast({
          title: "Não foi possível cancelar o lote",
          description: "Tente novamente. O modal permanece aberto.",
          variant: "destructive",
        });
        return;
      }
    }
    reset();
    onOpenChange(false);
  };

  const handleCarregar = async () => {
    setErroFatal(null);
    if (!empresaId) {
      toast({
        title: "Empresa ativa não definida",
        description: "Selecione uma empresa antes de importar.",
        variant: "destructive",
      });
      return;
    }
    let loteCriado: string | null = null;
    try {
      loteCriado = await criarLote.mutateAsync({
        empresaId,
        arquivoNome: "licitacoesGradeSeed.json",
        arquivoHash: hashRows(rows),
      });
      setLote(loteCriado);
      const result = await anexarLinhas.mutateAsync({ lote: loteCriado, linhas: rows });
      setPreview(result);
      setEtapa("preview");
      if ((result.linhas_invalidas ?? 0) > 0) {
        toast({
          title: "Existem linhas com erro",
          description: "Revise antes de confirmar.",
          variant: "destructive",
        });
      }
    } catch (e) {
      const msg = (e as Error).message;
      setErroFatal(msg);
      toast({ title: "Erro na importação", description: msg, variant: "destructive" });
      if (loteCriado) {
        try {
          await cancelarLote.mutateAsync({ lote: loteCriado });
          setLote(null);
          setEtapa("idle");
        } catch (e2) {
          toast({
            title: "Falha ao cancelar lote",
            description:
              (e2 as Error).message + " — você pode tentar cancelar novamente.",
            variant: "destructive",
          });
          setEtapa("idle");
        }
      } else {
        setEtapa("idle");
      }
    }
  };

  const handleConfirmar = async () => {
    if (!lote || !podeConfirmar) return;
    setEtapa("confirmando");
    try {
      const r = await confirmarLote.mutateAsync({ lote });
      setResultado(r);
      setEtapa("sucesso");
      toast({ title: "Grade importada com sucesso." });
      try {
        await onImported?.();
      } catch {
        toast({
          title: "Importação gravada, mas a atualização visual falhou.",
          description: "Recarregue a página para ver os dados reais.",
          variant: "destructive",
        });
      }
    } catch (e) {
      const msg = (e as Error).message;
      setErroFatal(msg);
      setEtapa("preview");
      toast({ title: "Erro ao confirmar", description: msg, variant: "destructive" });
    }
  };

  const handleCancelarManual = async () => {
    if (!lote || isBusy) return;
    try {
      await cancelarLote.mutateAsync({ lote });
      toast({ title: "Lote cancelado." });
      reset();
      onOpenChange(false);
    } catch (e) {
      setErroFatal((e as Error).message);
      toast({
        title: "Falha ao cancelar lote",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) tentarFecharComCancelamento();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>Importar Grade 2026</DialogTitle>
              <DialogDescription>
                Carga validada por lote. As linhas são verificadas antes de gravar em{" "}
                <code>public.licitacao</code>. Responsáveis existentes não são sobrescritos;
                responsável textual vira pendência.
              </DialogDescription>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Building2 className="h-3.5 w-3.5" />
              {empresaSigla}
            </span>
          </div>
        </DialogHeader>

        {erroFatal && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {erroFatal}
          </div>
        )}

        {etapa === "idle" && (
          <div className="space-y-2 text-sm">
            <p>
              Total de linhas a enviar: <strong>{totalLinhas}</strong>
            </p>
            {pendenciasPrevistas.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {pendenciasPrevistas.length} linha(s) com responsável textual identificado
                localmente (pendência <em>prevista</em>; ainda não persistida).
              </p>
            )}
            {lote && (
              <p className="text-xs text-destructive">
                Lote {lote} em aberto. Use "Cancelar lote" para descartar.
              </p>
            )}
          </div>
        )}

        {etapa === "preview" && preview && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Recebidas" value={preview.linhas_recebidas ?? totalLinhas} />
              <Stat label="Válidas" value={linhasValidas} tone="ok" />
              <Stat
                label="Inválidas"
                value={linhasInvalidas}
                tone={linhasInvalidas ? "err" : "muted"}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Status do lote: <code>{preview.status_lote ?? "—"}</code>
            </p>

            {erros.length > 0 && (
              <details
                open
                className="rounded-md border border-destructive/30 bg-destructive/5 p-2"
              >
                <summary className="cursor-pointer text-xs font-semibold text-destructive">
                  {erros.length} erro(s) no lote
                </summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
                  {erros.slice(0, 200).map((e, i) => (
                    <li key={i}>{fmtErro(e)}</li>
                  ))}
                </ul>
              </details>
            )}

            {pendenciasPrevistas.length > 0 && (
              <details className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                <summary className="cursor-pointer text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {pendenciasPrevistas.length} pendência(s) <em>prevista(s)</em> (local,
                  não persistida)
                </summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
                  {pendenciasPrevistas.slice(0, 200).map((p) => (
                    <li key={p.linha}>
                      linha {p.linha} — "{p.texto}"
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {pendenciasRegistradas.length > 0 && (
              <details className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
                <summary className="cursor-pointer text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {pendenciasRegistradas.length} pendência(s){" "}
                  <strong>registrada(s)</strong> no lote
                </summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
                  {pendenciasRegistradas.slice(0, 200).map((p, i) => (
                    <li key={i}>
                      linha {p.linha ?? "?"} — "{p.texto ?? p.responsavel_texto ?? ""}"
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {linhasInvalidas > 0 && (
              <p className="text-xs text-destructive">
                Existem linhas com erro. Revise ou cancele o lote.
              </p>
            )}
          </div>
        )}

        {etapa === "sucesso" && resultado && (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Importação concluída.</p>
            <ul className="text-xs text-muted-foreground">
              <li>Inseridas: {resultado.inseridas ?? 0}</li>
              <li>Atualizadas: {resultado.atualizadas ?? 0}</li>
              <li>Ignoradas: {resultado.ignoradas ?? 0}</li>
              <li>Pendências de responsável: {resultado.pendencias_responsavel ?? 0}</li>
              <li>Erros: {resultado.erros ?? 0}</li>
            </ul>
            <p className="rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-800 dark:text-emerald-300">
              Importação gravada no banco. O Pipeline foi atualizado com os dados reais.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {etapa === "idle" && (
            <>
              <Button
                variant="outline"
                onClick={tentarFecharComCancelamento}
                disabled={isBusy}
              >
                Fechar
              </Button>
              {lote && (
                <Button
                  variant="destructive"
                  onClick={handleCancelarManual}
                  disabled={isBusy}
                >
                  {isCanceling ? "Cancelando..." : "Cancelar lote"}
                </Button>
              )}
              <Button onClick={handleCarregar} disabled={isBusy || !empresaId || !!lote}>
                {isCreating
                  ? "Criando lote..."
                  : isUploading
                  ? "Validando..."
                  : "Carregar / Validar"}
              </Button>
            </>
          )}
          {etapa === "preview" && (
            <>
              <Button variant="outline" onClick={handleCancelarManual} disabled={isBusy}>
                {isCanceling ? "Cancelando..." : "Cancelar lote"}
              </Button>
              <Button onClick={handleConfirmar} disabled={!podeConfirmar}>
                {isConfirming ? "Confirmando..." : "Confirmar"}
              </Button>
            </>
          )}
          {etapa === "confirmando" && <Button disabled>Confirmando...</Button>}
          {etapa === "sucesso" && (
            <Button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "ok" | "err" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "err"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${cls}`}>{value}</p>
    </div>
  );
}
