import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Ban, Info, Paperclip } from "lucide-react";
import type { EtapaPanelProps } from "./types";
import { CLASSIFICACAO_DEMANDA_OPCOES, TIPO_SOLICITACAO_LABEL, fmtData, sdNumero } from "./types";
import { RecusadoPanel } from "./RecusadoPanel";

const AN_CRITERIOS_GRUPOS: { itens: { key: string; label: string }[] }[] = [
  {
    itens: [
      { key: "obrigatoriedade_legal_prazo", label: "Obrigatoriedade legal com prazo definido" },
      { key: "risco_paralisacao", label: "Risco de paralisação da operação" },
      { key: "impossibilidade_faturamento", label: "Impossibilidade de faturamento" },
      { key: "falha_critica_funcionamento", label: "Falha crítica que comprometa funcionamento essencial" },
      { key: "risco_juridico_trabalhista", label: "Risco jurídico, trabalhista, financeiro ou contratual relevante" },
      { key: "determinacao_presidencia", label: "Determinação expressa da Presidência ou Comitê" },
    ],
  },
  {
    itens: [
      { key: "correcao_bug_escopo", label: "Correção de Bug que comprometa o escopo homologado" },
      { key: "alto_impacto_operacional", label: "Alto impacto operacional" },
      { key: "alto_usuarios_impactados", label: "Alto número de usuários impactados" },
      { key: "reducao_retrabalho", label: "Redução relevante de retrabalho" },
      { key: "automacao_processo_critico", label: "Automação de processo crítico" },
      { key: "integracao_rotina_relevante", label: "Integração necessária para continuidade de rotina relevante" },
      { key: "impacto_cliente_contrato", label: "Demanda com impacto direto em cliente ou contrato" },
    ],
  },
  {
    itens: [
      { key: "projeto_planejamento_estrategico", label: "Projeto vinculado ao Planejamento Estratégico" },
      { key: "projeto_aprovado_presidencia", label: "Projeto aprovado pela Presidência" },
      { key: "novo_modulo_corporativo", label: "Novo módulo corporativo" },
      { key: "implantacao_indicadores", label: "Implantação de indicadores estratégicos" },
      { key: "projeto_multi_diretoria", label: "Projeto que impacte mais de uma diretoria" },
    ],
  },
  {
    itens: [
      { key: "ganho_operacional_relevante", label: "Ganho operacional relevante" },
      { key: "melhoria_processo_existente", label: "Melhoria de processo existente" },
      { key: "reducao_controles_manuais", label: "Redução moderada de controles manuais" },
      { key: "melhor_rastreabilidade", label: "Melhor rastreabilidade" },
      { key: "melhoria_indicadores", label: "Melhoria de indicadores" },
      { key: "melhoria_comunicacao_areas", label: "Melhoria de comunicação entre áreas" },
    ],
  },
  {
    itens: [
      { key: "melhoria_evolutiva_sem_critico", label: "Melhoria evolutiva sem caráter crítico" },
      { key: "ajuste_layout", label: "Ajuste de layout" },
      { key: "novo_filtro_simples", label: "Novo filtro simples" },
      { key: "novo_relatorio_sem_urgencia", label: "Novo relatório sem urgência" },
      { key: "ajuste_usabilidade", label: "Ajuste de usabilidade" },
      { key: "evolucao_sem_impacto_critico", label: "Evolução que não impacte operação crítica" },
    ],
  },
];

const PESSOAS_OPCOES = [
  { key: "1_5", label: "1 - 5 pessoas" },
  { key: "5_10", label: "5 - 10 pessoas" },
  { key: "mais_10", label: "Mais de 10 pessoas" },
];

export function AnaliseNecessidadePanel({ card, papeis, anexos, onUpdate, onAnexar, onDownloadAnexo, onExcluir }: EtapaPanelProps) {
  const podeAgir = papeis.comite;
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [criteriosLocal, setCriteriosLocal] = useState<string[]>(card.an_criterios ?? []);
  const [pessoasLocal, setPessoasLocal] = useState<string | null>(card.an_pessoas_impactadas ?? null);

  useEffect(() => { setCriteriosLocal(card.an_criterios ?? []); }, [card.an_criterios]);
  useEffect(() => { setPessoasLocal(card.an_pessoas_impactadas ?? null); }, [card.an_pessoas_impactadas]);

  if (card.recusado) {
    return (
      <RecusadoPanel
        podeReativar={papeis.controladoria}
        onReativar={() => onUpdate({ etapa: "solicitacao_demanda", recusado: false })}
        onExcluir={onExcluir}
      />
    );
  }

  function toggleCriterio(key: string, checked: boolean) {
    const novo = checked
      ? [...criteriosLocal, key]
      : criteriosLocal.filter((k) => k !== key);
    setCriteriosLocal(novo);
    onUpdate({ an_criterios: novo });
  }

  function togglePessoas(key: string) {
    const novo = pessoasLocal === key ? null : key;
    setPessoasLocal(novo);
    onUpdate({ an_pessoas_impactadas: novo });
  }

  const tipoDemanda = card.classificacao_demanda?.length
    ? card.classificacao_demanda
        .map((v) => CLASSIFICACAO_DEMANDA_OPCOES.find((o) => o.value === v)?.label ?? v)
        .join(", ")
    : card.tipo_solicitacao
      ? (TIPO_SOLICITACAO_LABEL[card.tipo_solicitacao] ?? card.tipo_solicitacao)
      : null;

  const anexosDoCampo = anexos.filter((a) => a.campo === "analise_necessidade");

  async function enviarArquivos() {
    const pendentes = arquivos;
    setArquivos([]);
    for (const f of pendentes) await onAnexar(f, "analise_necessidade");
  }

  return (
    <div className="space-y-4">
      {/* DETALHES DA ABERTURA */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhes da Abertura</p>
        <div className="flex items-center gap-1.5 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2 py-1 text-[11px] text-blue-700 dark:text-blue-300">
          <Info className="h-3 w-3 flex-shrink-0" />
          Origem: Card Solicitação ERP
        </div>
        <div className="grid gap-y-1.5">
          {(
            [
              { label: "Número da demanda", valor: sdNumero(card) },
              { label: "Área solicitante", valor: card.area_solicitante },
              { label: "Responsável pela solicitação", valor: card.responsavel_solicitacao },
              { label: "Cargo", valor: card.cargo_solicitante },
              { label: "E-mail", valor: card.email_solicitante },
              { label: "Telefone", valor: card.telefone_solicitante },
              { label: "Data da solicitação", valor: fmtData(card.created_at?.slice(0, 10)) },
              { label: "Tipo da demanda", valor: tipoDemanda },
            ] as { label: string; valor: string | null }[]
          ).map(({ label, valor }) => (
            <div key={label} className="flex gap-2 text-[11px]">
              <span className="font-semibold text-primary w-44 flex-shrink-0">{label}:</span>
              <span className="text-foreground">
                {valor ?? <span className="italic text-muted-foreground">—</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CRITÉRIOS */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Critérios para Classificação Automática da Prioridade Institucional
        </p>
        {AN_CRITERIOS_GRUPOS.map((grupo, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="border-t border-border/60 mt-1 mb-2" />}
            <div className="space-y-1.5">
              {grupo.itens.map(({ key, label }) => {
                const checked = criteriosLocal.includes(key);
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-2 text-[11px] select-none ${podeAgir ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!podeAgir}
                      onChange={(e) => toggleCriterio(key, e.target.checked)}
                      className="h-3.5 w-3.5 flex-shrink-0 rounded border-border accent-primary"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {/* Pessoas envolvidas */}
        <div className="border-t border-border/60 mt-1 pt-2 space-y-1.5">
          <p className="text-[11px] font-semibold">Pessoas envolvidas / impactadas:</p>
          {PESSOAS_OPCOES.map(({ key, label }) => (
            <label
              key={key}
              className={`flex items-center gap-2 text-[11px] select-none ${podeAgir ? "cursor-pointer" : "cursor-default"}`}
            >
              <input
                type="checkbox"
                checked={pessoasLocal === key}
                disabled={!podeAgir}
                onChange={() => togglePessoas(key)}
                className="h-3.5 w-3.5 flex-shrink-0 rounded border-border accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* PRAZO */}
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-muted-foreground">Prazo:</label>
        <Input
          type="date"
          defaultValue={card.analise_necessidade_prazo ?? ""}
          disabled={!podeAgir}
          onBlur={(e) => {
            if (e.target.value !== (card.analise_necessidade_prazo ?? ""))
              onUpdate({ analise_necessidade_prazo: e.target.value || null });
          }}
          className="h-8 w-40 text-xs"
        />
      </div>

      {/* ARQUIVOS */}
      <div className="space-y-1">
        {anexosDoCampo.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-border px-2 py-1 text-[11px]">
            <span className="truncate">{a.nome_arquivo}</span>
            <button type="button" onClick={() => onDownloadAnexo(a.storage_path)} className="text-primary hover:underline">
              abrir
            </button>
          </div>
        ))}
        {podeAgir && (
          <div className="flex min-w-0 items-center gap-2">
            <Input
              type="file"
              multiple
              className="h-8 min-w-0 flex-1 cursor-pointer text-[11px]"
              onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
            />
            {arquivos.length > 0 && (
              <Button size="sm" className="h-8 gap-1" onClick={enviarArquivos}>
                <Paperclip className="h-3 w-3" /> Anexar ({arquivos.length})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* INFO BOX */}
      <div className="flex items-start gap-1.5 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-2 py-1.5 text-[11px] text-blue-700 dark:text-blue-300">
        <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
        Estas informações serão utilizadas automaticamente para cálculo da Prioridade Institucional da demanda no Parecer Técnico de Viabilidade (Anexo III).
      </div>

      {/* BOTÕES */}
      <div className="flex gap-2">
        <Button className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "levantamento_funcional" })}>
          <ArrowRight className="h-3.5 w-3.5" /> Avançar para Levantamento Funcional
        </Button>
        <Button variant="destructive" className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ recusado: true })}>
          <Ban className="h-3.5 w-3.5" /> Reprovar Demanda
        </Button>
      </div>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só o Comitê age nesta etapa.</p>}
    </div>
  );
}
