import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, MinusCircle } from "lucide-react";

interface Empresa { id: string; nome_fantasia: string | null; razao_social: string; codigo: string | null; }
interface Regra {
  id: string;
  empresa_id: string;
  codigo_evento: string | null;
  descricao: string;
  conta_debito_id: string | null;
  conta_credito_id: string | null;
  ativo: boolean;
  prioridade: number | null;
  filtro: any;
  observacao: string | null;
}

// Ordem canônica esperada (Bloco A)
const EVENTOS_CANONICOS: { codigo: string; label: string; obs?: string }[] = [
  { codigo: "EVT-001", label: "NF entrada estoque (mãe)", obs: "agrupador" },
  { codigo: "EVT-001-A", label: "└ Limpeza" },
  { codigo: "EVT-001-B", label: "└ EPIs / Uniformes" },
  { codigo: "EVT-001-C", label: "└ Peças / Equipamentos" },
  { codigo: "EVT-002", label: "NF consumo direto p/ contrato" },
  { codigo: "EVT-003", label: "NF serviço administrativo" },
  { codigo: "EVT-004", label: "Pagamento fornecedor" },
  { codigo: "EVT-005", label: "NF saída / Faturamento" },
  { codigo: "EVT-006", label: "Tributos faturamento (mãe)", obs: "agrupador" },
  { codigo: "EVT-006-A", label: "└ PIS" },
  { codigo: "EVT-006-B", label: "└ COFINS" },
  { codigo: "EVT-006-C", label: "└ ISS" },
  { codigo: "EVT-006-D", label: "└ Simples Nacional", obs: "ativa só p/ HAGG" },
  { codigo: "EVT-007", label: "Recebimento cliente" },
  { codigo: "EVT-007-A", label: "└ Retenção INSS" },
  { codigo: "EVT-007-B", label: "└ Retenção ISS" },
  { codigo: "EVT-008", label: "Provisão folha operacional" },
  { codigo: "EVT-009", label: "Pagamento folha" },
  { codigo: "EVT-010", label: "Recolhimento FGTS/INSS folha" },
  { codigo: "EVT-011", label: "Mútuo intercompany saída" },
  { codigo: "EVT-012", label: "Mútuo intercompany entrada" },
  { codigo: "EVT-013", label: "Rateio admin intercompany" },
  { codigo: "EVT-014", label: "Ajuste contábil manual", obs: "contas livres" },
  { codigo: "EVT-015", label: "Baixa estoque p/ contrato" },
];

type Status = "ok" | "agrupador" | "manual" | "inativo_ok" | "faltando" | "incompleto";

function classify(codigo: string, regra: Regra | undefined): Status {
  if (!regra) return "faltando";
  // Agrupadores EVT-001 e EVT-006 mãe - esperado inativo
  if (codigo === "EVT-001" || codigo === "EVT-006") return "agrupador";
  // EVT-014 manual - sem D/C, ativo
  if (codigo === "EVT-014") return regra.ativo ? "manual" : "incompleto";
  // EVT-006-D Simples - só HAGG ativa, demais ficam inativas mas com D/C ok
  if (codigo === "EVT-006-D" && !regra.ativo && regra.conta_debito_id && regra.conta_credito_id) {
    return "inativo_ok";
  }
  if (regra.conta_debito_id && regra.conta_credito_id && regra.ativo) return "ok";
  return "incompleto";
}

function StatusIcon({ status }: { status: Status }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "agrupador":
      return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
    case "manual":
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    case "inativo_ok":
      return <MinusCircle className="h-4 w-4 text-sky-500" />;
    case "faltando":
      return <XCircle className="h-4 w-4 text-rose-500" />;
    case "incompleto":
      return <AlertCircle className="h-4 w-4 text-rose-500" />;
  }
}

const STATUS_LABEL: Record<Status, string> = {
  ok: "Vinculada e ativa",
  agrupador: "Agrupador (inativo por design)",
  manual: "Manual (D/C livres)",
  inativo_ok: "Vinculada, inativa por design",
  faltando: "Regra ausente",
  incompleto: "Sem D/C ou inativa indevidamente",
};

export default function SaudeRegras() {
  const empresasQ = useQuery({
    queryKey: ["empresas-saude"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id,nome_fantasia,razao_social,codigo")
        .order("nome_fantasia");
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
  });

  const regrasQ = useQuery({
    queryKey: ["regras-todas-saude"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regra_contabilizacao")
        .select("id,empresa_id,codigo_evento,descricao,conta_debito_id,conta_credito_id,ativo,prioridade,filtro,observacao");
      if (error) throw error;
      return (data ?? []) as Regra[];
    },
  });

  const matrix = useMemo(() => {
    const map = new Map<string, Regra>();
    (regrasQ.data ?? []).forEach((r) => {
      if (r.codigo_evento) map.set(`${r.empresa_id}::${r.codigo_evento}`, r);
    });
    return map;
  }, [regrasQ.data]);

  const empresas = empresasQ.data ?? [];

  // Resumo por empresa
  const resumo = useMemo(() => {
    return empresas.map((e) => {
      const counts = { ok: 0, alerta: 0, erro: 0 };
      EVENTOS_CANONICOS.forEach((evt) => {
        const r = matrix.get(`${e.id}::${evt.codigo}`);
        const s = classify(evt.codigo, r);
        if (s === "ok" || s === "agrupador" || s === "manual" || s === "inativo_ok") counts.ok++;
        else if (s === "incompleto") counts.alerta++;
        else counts.erro++;
      });
      return { empresa: e, ...counts };
    });
  }, [empresas, matrix]);

  if (empresasQ.isLoading || regrasQ.isLoading) {
    return <div className="card-elevated p-6 text-sm text-muted-foreground">Carregando saúde das regras…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Saúde das Regras de Contabilização</h2>
        <p className="text-sm text-muted-foreground">
          Matriz Evento × Empresa com vínculo D/C e ativação. Ideal: tudo verde ou cinza (agrupador).
        </p>
      </div>

      {/* Legenda */}
      <div className="card-elevated p-3 flex flex-wrap gap-4 text-xs">
        {(["ok", "agrupador", "manual", "inativo_ok", "incompleto", "faltando"] as Status[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <StatusIcon status={s} />
            <span className="text-muted-foreground">{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>

      {/* Resumo por empresa */}
      <div className="card-elevated p-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Resumo por empresa</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {resumo.map((r) => (
            <div key={r.empresa.id} className="rounded-md border border-border/60 p-3">
              <div className="text-sm font-semibold">{r.empresa.nome_fantasia ?? r.empresa.razao_social}</div>
              <div className="text-[11px] text-muted-foreground mb-2">{r.empresa.codigo}</div>
              <div className="flex gap-2 text-xs">
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                  {r.ok} OK
                </Badge>
                {r.alerta > 0 && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                    {r.alerta} alerta
                  </Badge>
                )}
                {r.erro > 0 && (
                  <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400">
                    {r.erro} faltando
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matriz Evento × Empresa */}
      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left sticky left-0 bg-muted/60 z-10 min-w-[280px]">Evento</th>
              {empresas.map((e) => (
                <th key={e.id} className="px-3 py-2 text-center whitespace-nowrap">
                  {e.nome_fantasia ?? e.razao_social}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVENTOS_CANONICOS.map((evt) => (
              <tr key={evt.codigo} className="border-t border-border/60 hover:bg-muted/30">
                <td className="px-3 py-2 sticky left-0 bg-card">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{evt.codigo}</span>
                    <span>{evt.label}</span>
                    {evt.obs && (
                      <Badge variant="outline" className="text-[10px] ml-1">{evt.obs}</Badge>
                    )}
                  </div>
                </td>
                {empresas.map((e) => {
                  const r = matrix.get(`${e.id}::${evt.codigo}`);
                  const s = classify(evt.codigo, r);
                  return (
                    <td key={e.id} className="px-3 py-2 text-center" title={STATUS_LABEL[s]}>
                      <div className="inline-flex items-center justify-center">
                        <StatusIcon status={s} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalhe textual de problemas */}
      {(() => {
        const problemas: { empresa: string; codigo: string; status: Status; descricao: string }[] = [];
        empresas.forEach((e) => {
          EVENTOS_CANONICOS.forEach((evt) => {
            const r = matrix.get(`${e.id}::${evt.codigo}`);
            const s = classify(evt.codigo, r);
            if (s === "faltando" || s === "incompleto") {
              problemas.push({
                empresa: e.nome_fantasia ?? e.razao_social,
                codigo: evt.codigo,
                status: s,
                descricao: evt.label,
              });
            }
          });
        });
        if (problemas.length === 0) {
          return (
            <div className="card-elevated p-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Todas as regras esperadas estão vinculadas e ativas nas 6 empresas.
            </div>
          );
        }
        return (
          <div className="card-elevated p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Problemas detectados ({problemas.length})
            </div>
            <ul className="space-y-1 text-sm">
              {problemas.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <StatusIcon status={p.status} />
                  <span className="font-mono text-xs text-muted-foreground">{p.codigo}</span>
                  <span>{p.descricao}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{p.empresa}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs">{STATUS_LABEL[p.status]}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}
