import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { fmtBRL } from "@/components/crud/EntityCrudPage";
import { Building2, FileCheck2, TrendingUp, TrendingDown, Users2, ShoppingCart } from "lucide-react";

interface Resumo {
  empresa_id: string;
  razao_social: string;
  contratos_ativos: number;
  faturamento_mensal_total: number;
  contas_receber_aberto: number;
  contas_pagar_aberto: number;
  colaboradores_ativos: number;
  pedidos_compra_abertos: number;
}

export default function BIDashboard() {
  const { data: rows = [], isLoading } = useQuery<Resumo[]>({
    queryKey: ["bi_resumo"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("vw_bi_resumo_empresa").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="BI & Analytics"
        subtitle="Visão consolidada de todas as empresas do grupo."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Sem dados para exibir.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {rows.map((r) => (
            <Card key={r.empresa_id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" />
                  {r.razao_social}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                  <KPI icon={<FileCheck2 className="h-4 w-4" />} label="Contratos ativos" value={String(r.contratos_ativos)} />
                  <KPI icon={<TrendingUp className="h-4 w-4 text-success" />} label="Fat. mensal" value={fmtBRL(r.faturamento_mensal_total)} />
                  <KPI icon={<TrendingUp className="h-4 w-4 text-success" />} label="A receber" value={fmtBRL(r.contas_receber_aberto)} />
                  <KPI icon={<TrendingDown className="h-4 w-4 text-destructive" />} label="A pagar" value={fmtBRL(r.contas_pagar_aberto)} />
                  <KPI icon={<Users2 className="h-4 w-4" />} label="Colaboradores" value={String(r.colaboradores_ativos)} />
                  <KPI icon={<ShoppingCart className="h-4 w-4" />} label="Pedidos abertos" value={String(r.pedidos_compra_abertos)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
