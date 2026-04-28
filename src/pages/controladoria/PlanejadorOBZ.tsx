import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";
import {
  linhasOrcamento,
  labelOrigem,
  labelStatus,
  labelDriver,
  type LinhaOrcamento,
  type StatusAprovacao,
  type OrigemOrcamento,
} from "@/data/orcamento";
import { formatBRL, labelGrupoGerencial } from "@/data/controladoria";
import { Lock, Unlock, KeyRound, Filter, Eye, ShieldCheck, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function PlanejadorOBZ() {
  const { empresa } = useEmpresaAtiva();
  const { toast } = useToast();

  const [filtroOrigem, setFiltroOrigem] = useState<"todas" | OrigemOrcamento>("todas");
  const [filtroStatus, setFiltroStatus] = useState<"todas" | StatusAprovacao>("todas");
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>("todas");
  const [filtroBuscaConta, setFiltroBuscaConta] = useState("");
  const [filtroEmpresaTodas, setFiltroEmpresaTodas] = useState(false);

  // Estado local das linhas (para refletir destravamento sem backend)
  const [linhas, setLinhas] = useState<LinhaOrcamento[]>(linhasOrcamento);

  // Detalhe lateral
  const [linhaDetalhe, setLinhaDetalhe] = useState<LinhaOrcamento | null>(null);

  // Modal de destravamento
  const [linhaParaDestravar, setLinhaParaDestravar] = useState<LinhaOrcamento | null>(null);
  const [senha, setSenha] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [evidenciasTxt, setEvidenciasTxt] = useState("");

  const competenciasDisponiveis = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.competenciaYYYYMM))).sort(),
    [linhas],
  );

  const filtradas = useMemo(() => {
    return linhas.filter((l) => {
      if (!filtroEmpresaTodas && l.empresaId !== empresa.id) return false;
      if (filtroOrigem !== "todas" && l.origemOrcamento !== filtroOrigem) return false;
      if (filtroStatus !== "todas" && l.statusAprovacao !== filtroStatus) return false;
      if (filtroCompetencia !== "todas" && l.competenciaYYYYMM !== filtroCompetencia) return false;
      if (filtroBuscaConta && !l.contaReduzida.includes(filtroBuscaConta) &&
          !l.descricaoConta.toLowerCase().includes(filtroBuscaConta.toLowerCase())) return false;
      return true;
    });
  }, [linhas, empresa.id, filtroEmpresaTodas, filtroOrigem, filtroStatus, filtroCompetencia, filtroBuscaConta]);

  const totalOrcado = filtradas.reduce((acc, l) => acc + (l.naturezaResultado === "receita" ? l.valorOrcado : -l.valorOrcado), 0);
  const totalCaixa = filtradas.reduce((acc, l) => acc + (l.naturezaResultado === "receita" ? l.valorCaixa : -l.valorCaixa), 0);
  const baselineBloqueadas = filtradas.filter((l) => l.bloqueadoOrigem).length;

  const abrirDestravamento = (l: LinhaOrcamento) => {
    setSenha("");
    setJustificativa("");
    setEvidenciasTxt("");
    setLinhaParaDestravar(l);
  };

  const confirmarDestravamento = () => {
    if (!linhaParaDestravar) return;
    if (senha.length < 4) {
      toast({ title: "Senha obrigatória", description: "Informe a senha do gestor habilitado.", variant: "destructive" });
      return;
    }
    if (justificativa.trim().length < 10) {
      toast({ title: "Justificativa insuficiente", description: "Mínimo de 10 caracteres.", variant: "destructive" });
      return;
    }
    const evidencias = evidenciasTxt.split(",").map((e) => e.trim()).filter(Boolean);
    setLinhas((prev) =>
      prev.map((l) =>
        l.id === linhaParaDestravar.id
          ? {
              ...l,
              bloqueadoOrigem: false,
              revisaoSobSenha: true,
              statusAprovacao: "em_aprovacao",
              origemOrcamento: "revisao_controladoria",
              versaoOrcamento: incrementarVersao(l.versaoOrcamento),
              justificativa: justificativa,
              evidencias: [...l.evidencias, ...evidencias],
              usuarioUltimaRevisao: "ana.carvalho",
              timestampUltimaRevisao: new Date().toISOString(),
            }
          : l,
      ),
    );
    toast({
      title: "Baseline destravada",
      description: `Linha ${linhaParaDestravar.contaReduzida} liberada para revisão. Auditoria registrada.`,
    });
    setLinhaParaDestravar(null);
  };

  return (
    <div>
      <PageHeader
        module="Controladoria & Orçamento"
        breadcrumb={["Orçamento", "Planejador OBZ"]}
        title="Planejador Orçamentário (OBZ)"
        subtitle="Grid com todas as dimensões. Linhas baseline_licitacao nascem bloqueadas e exigem destravamento sob senha."
        actions={
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-md bg-primary-soft px-2 py-1 font-semibold text-primary">
              Empresa ativa: {empresa.sigla}
            </span>
            <button
              onClick={() => setFiltroEmpresaTodas((v) => !v)}
              className={`rounded-md border px-2 py-1 font-semibold transition-colors ${filtroEmpresaTodas ? "border-accent bg-accent-soft text-accent" : "border-border bg-card text-muted-foreground hover:border-border-strong"}`}
            >
              {filtroEmpresaTodas ? "Vendo todas as empresas" : "Ver todas as empresas"}
            </button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Kpi label="Linhas filtradas" value={String(filtradas.length)} />
        <Kpi label="Total orçado (líquido)" value={formatBRL(totalOrcado)} />
        <Kpi label="Total caixa previsto" value={formatBRL(totalCaixa)} />
        <Kpi label="Baseline bloqueadas" value={String(baselineBloqueadas)} accent />
      </div>

      {/* Filtros */}
      <div className="card-elevated mb-4 flex flex-wrap items-center gap-2 p-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value as any)} className="rounded-md border border-border bg-card px-2 py-1 text-xs">
          <option value="todas">Origem: todas</option>
          <option value="baseline_licitacao">Baseline (Licitação)</option>
          <option value="obz">OBZ</option>
          <option value="forecast">Forecast</option>
          <option value="revisao_controladoria">Revisão</option>
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as any)} className="rounded-md border border-border bg-card px-2 py-1 text-xs">
          <option value="todas">Status: todos</option>
          <option value="rascunho">Rascunho</option>
          <option value="em_aprovacao">Em aprovação</option>
          <option value="aprovado">Aprovado</option>
          <option value="reprovado">Reprovado</option>
        </select>
        <select value={filtroCompetencia} onChange={(e) => setFiltroCompetencia(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1 text-xs">
          <option value="todas">Competência: todas</option>
          {competenciasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={filtroBuscaConta}
          onChange={(e) => setFiltroBuscaConta(e.target.value)}
          placeholder="Buscar conta ou descrição…"
          className="ml-auto h-8 w-64 rounded-md border border-border bg-card px-2 text-xs"
        />
      </div>

      {/* Tabela */}
      <div className="card-elevated overflow-x-auto">
        <table className="w-full min-w-[1400px] text-xs">
          <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Empresa</th>
              <th className="px-3 py-2 text-left">CC</th>
              <th className="px-3 py-2 text-left">Contrato</th>
              <th className="px-3 py-2 text-left">Conta</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left">DRE</th>
              <th className="px-3 py-2 text-left">Grupo gerencial</th>
              <th className="px-3 py-2 text-left">Driver</th>
              <th className="px-3 py-2 text-right">Qtd</th>
              <th className="px-3 py-2 text-right">Vlr unit.</th>
              <th className="px-3 py-2 text-right">%</th>
              <th className="px-3 py-2 text-right">Orçado</th>
              <th className="px-3 py-2 text-right">Caixa</th>
              <th className="px-3 py-2 text-left">Comp.</th>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-left">Versão</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => (
              <tr
                key={l.id}
                className={`border-t border-border/60 hover:bg-muted/30 ${l.bloqueadoOrigem ? "bg-warning-soft/30" : ""}`}
              >
                <td className="px-3 py-2 font-semibold">{l.empresaId}</td>
                <td className="px-3 py-2 font-mono text-[10px] text-primary">{l.centroCustoId}</td>
                <td className="px-3 py-2 font-mono text-[10px]">{l.contratoId ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-[10px] font-semibold">{l.contaReduzida}</td>
                <td className="px-3 py-2 max-w-[220px] truncate">{l.descricaoConta}</td>
                <td className="px-3 py-2 font-mono">{l.linhaDRE}</td>
                <td className="px-3 py-2 max-w-[180px] truncate">{labelGrupoGerencial[l.grupoGerencial]}</td>
                <td className="px-3 py-2">{labelDriver[l.driverTipo]}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.driverQtd ? l.driverQtd.toLocaleString("pt-BR") : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.driverValorUnitario ? formatBRL(l.driverValorUnitario) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.driverPercentual ? `${l.driverPercentual}%` : "—"}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatBRL(l.valorOrcado)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatBRL(l.valorCaixa)}</td>
                <td className="px-3 py-2 font-mono text-[10px]">{l.competenciaYYYYMM}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${origemBadge(l.origemOrcamento)}`}>
                    {labelOrigem[l.origemOrcamento]}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[10px]">{l.versaoOrcamento}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge(l.statusAprovacao)}`}>
                    {labelStatus[l.statusAprovacao]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setLinhaDetalhe(l)}
                      title="Ver detalhe"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {l.bloqueadoOrigem ? (
                      <button
                        onClick={() => abrirDestravamento(l)}
                        title="Solicitar destravamento"
                        className="rounded bg-warning-soft p-1 text-warning hover:bg-warning hover:text-warning-foreground"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span title="Editável" className="rounded bg-success-soft p-1 text-success">
                        <Unlock className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={18} className="px-3 py-10 text-center text-muted-foreground">
                  Nenhuma linha para os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3 w-3 text-primary" />
        Todas as linhas reservam as 40+ dimensões obrigatórias (ver detalhe lateral).
      </p>

      {/* Detalhe lateral */}
      {linhaDetalhe && (
        <Dialog open onOpenChange={(o) => !o && setLinhaDetalhe(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-sm text-primary">{linhaDetalhe.contaReduzida}</span>
                <span>{linhaDetalhe.descricaoConta}</span>
              </DialogTitle>
              <DialogDescription>
                Detalhe completo das dimensões orçamentárias da linha.
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-2 md:grid-cols-2">
              {dimensoesParaExibir(linhaDetalhe).map(([k, v]) => (
                <div key={k} className="rounded-md border border-border bg-muted/30 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                  <p className="mt-0.5 break-words font-mono text-xs text-foreground">{v}</p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de destravamento */}
      {linhaParaDestravar && (
        <Dialog open onOpenChange={(o) => !o && setLinhaParaDestravar(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-warning">
                <KeyRound className="h-4 w-4" />
                Destravar baseline de licitação
              </DialogTitle>
              <DialogDescription>
                Conta <strong className="font-mono">{linhaParaDestravar.contaReduzida}</strong> · {linhaParaDestravar.descricaoConta}
                <br />
                Origem: <strong>{labelOrigem[linhaParaDestravar.origemOrcamento]}</strong> · Versão atual: <strong>{linhaParaDestravar.versaoOrcamento}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-md border border-warning/30 bg-warning-soft/60 p-3 text-xs text-warning">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Esta linha nasceu bloqueada como baseline.
              </p>
              <p className="mt-1">
                A revisão fica registrada em auditoria, incrementa a versão e move o status para "Em aprovação".
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="senha-destrava">Senha do gestor habilitado</Label>
                <Input id="senha-destrava" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Label htmlFor="justif-destrava">Justificativa (mín. 10 caracteres)</Label>
                <Textarea id="justif-destrava" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Explique o motivo da revisão da baseline." />
              </div>
              <div>
                <Label htmlFor="evid-destrava">Evidências (separe por vírgula)</Label>
                <Input id="evid-destrava" value={evidenciasTxt} onChange={(e) => setEvidenciasTxt(e.target.value)} placeholder="Ata reunião 12/01, e-mail jurídico…" />
              </div>
            </div>

            <DialogFooter>
              <button
                onClick={() => setLinhaParaDestravar(null)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDestravamento}
                className="rounded-md bg-warning px-3 py-1.5 text-sm font-semibold text-warning-foreground hover:bg-warning/90"
              >
                Confirmar destravamento
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card-elevated p-4 ${accent ? "border-l-4 border-l-warning" : ""}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function origemBadge(o: OrigemOrcamento) {
  switch (o) {
    case "baseline_licitacao": return "bg-warning-soft text-warning";
    case "obz": return "bg-primary-soft text-primary";
    case "forecast": return "bg-info-soft text-info";
    case "revisao_controladoria": return "bg-accent-soft text-accent";
  }
}

function statusBadge(s: StatusAprovacao) {
  switch (s) {
    case "rascunho": return "bg-muted text-muted-foreground";
    case "em_aprovacao": return "bg-info-soft text-info";
    case "aprovado": return "bg-success-soft text-success";
    case "reprovado": return "bg-destructive-soft text-destructive";
  }
}

function incrementarVersao(v: string) {
  const m = v.match(/v(\d+)\.(\d+)/);
  if (!m) return v + "+rev";
  const major = Number(m[1]);
  const minor = Number(m[2]) + 1;
  return `v${major}.${minor}`;
}

function dimensoesParaExibir(l: LinhaOrcamento): [string, string][] {
  return [
    ["empresa_id", l.empresaId],
    ["contrato_id", l.contratoId ?? "—"],
    ["centro_custo_id", l.centroCustoId],
    ["area_id", l.areaId],
    ["departamento_id", l.departamentoId],
    ["gestor_id", l.gestorId],
    ["diretor_id", l.diretorId],
    ["presidencia_flag", String(l.presidenciaFlag)],
    ["conta_reduzida", l.contaReduzida],
    ["classificacao_contabil", l.classificacaoContabil],
    ["descricao_conta", l.descricaoConta],
    ["tipo_conta", l.tipoConta],
    ["natureza_conta", l.naturezaConta],
    ["linha_dre", l.linhaDRE],
    ["natureza_resultado", l.naturezaResultado],
    ["grupo_gerencial", l.grupoGerencial],
    ["direto_indireto", l.diretoIndireto],
    ["fixo_variavel", l.fixoVariavel],
    ["subgrupo_folha_operacao", l.subgrupoFolhaOperacao],
    ["regime_orcamentario", l.regimeOrcamentario],
    ["competencia_yyyy_mm", l.competenciaYYYYMM],
    ["data_caixa_prevista", l.dataCaixaPrevista],
    ["driver_tipo", l.driverTipo],
    ["driver_qtd", String(l.driverQtd)],
    ["driver_valor_unitario", String(l.driverValorUnitario)],
    ["driver_percentual", String(l.driverPercentual)],
    ["valor_orcado", formatBRL(l.valorOrcado)],
    ["valor_caixa", formatBRL(l.valorCaixa)],
    ["origem_orcamento", l.origemOrcamento],
    ["versao_orcamento", l.versaoOrcamento],
    ["bloqueado_origem", String(l.bloqueadoOrigem)],
    ["status_aprovacao", l.statusAprovacao],
    ["aprovador_atual", l.aprovadorAtual],
    ["justificativa", l.justificativa || "—"],
    ["evidencias", l.evidencias.join("; ") || "—"],
    ["revisao_sob_senha", String(l.revisaoSobSenha)],
    ["usuario_ultima_revisao", l.usuarioUltimaRevisao],
    ["timestamp_ultima_revisao", l.timestampUltimaRevisao],
  ];
}
