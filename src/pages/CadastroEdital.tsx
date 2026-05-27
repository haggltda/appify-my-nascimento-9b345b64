import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Save, Send, Paperclip, Building2, FileText, AlertCircle, CalendarDays, FileCheck2, ShieldCheck } from "lucide-react";
import { usePermissoes } from "@/context/PermissoesContext";

type DocsTab = "edital" | "empresa";

export default function CadastroEdital() {
  const [docsTab, setDocsTab] = useState<DocsTab>("edital");
  const { can } = usePermissoes();
  // B2.1.a — Fase 1 (CadastroEdital): permissões finas
  const canIncluir = can("incluir", "licitacoes", "editais");
  const canAprovar = can("aprovar", "licitacoes", "editais");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cadastro de Edital"
        breadcrumb={["Cadastro de Editais", "Novo"]}
        subtitle="Registre as informações estruturais do edital. Campos obrigatórios são validados ao salvar."
        actions={
          <>
            {canIncluir && (
              <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
                <Save className="h-3.5 w-3.5" /> Salvar rascunho
              </button>
            )}
            <button
              disabled={!canAprovar}
              title={canAprovar ? undefined : "Sem permissão para enviar editais para triagem"}
              className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Enviar para triagem
            </button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <form className="space-y-5">
          <Section title="Identificação" icon={<FileText className="h-4 w-4" />}>
            <Grid>
              <Input label="Número do edital *" placeholder="PE 142/2025" />
              <Input label="Modalidade *" placeholder="Pregão Eletrônico" />
              <Input label="Data de abertura *" type="date" />
              <Input label="Prazo limite *" type="date" />
              <Input label="Empresa responsável *" placeholder="NEN — Nascimento Engenharia" />
              <Input label="Centro de custo" placeholder="CC-104 · Operações Sudeste" />
            </Grid>
            <Textarea label="Objeto da contratação *" rows={3}
              placeholder="Descrição completa do objeto licitado, escopo e particularidades técnicas relevantes." />
          </Section>

          <Section title="Órgão / Cliente" icon={<Building2 className="h-4 w-4" />}>
            <Grid>
              <Input label="Órgão licitante *" placeholder="SABESP — Companhia de Saneamento" />
              <Input label="UF / Município" placeholder="SP / São Paulo" />
              <Input label="Setor" placeholder="Saneamento básico" />
              <Input label="Portal de divulgação" placeholder="ComprasNet · BEC · Licitações-e" />
            </Grid>
            <Textarea
              label="Local real da prestação de serviço"
              rows={2}
              name="local_prestacao"
              placeholder="Ex.: ETE Barueri — Av. das Nações 1.200, galpão 3, turnos A e B. Inclui coleta nos setores 12, 14 e 18 da zona oeste."
            />
          </Section>

          <Section title="Datas e prazos" icon={<CalendarDays className="h-4 w-4" />}>
            <Grid>
              <Input label="Publicação" type="date" />
              <Input label="Impugnação" type="date" />
              <Input label="Esclarecimentos" type="date" />
              <Input label="Sessão pública" type="datetime-local" />
            </Grid>
          </Section>

          <Section title="Anexos & observações" icon={<Paperclip className="h-4 w-4" />}>
            <div className="flex gap-1 rounded-lg border border-border bg-surface-sunken p-1">
              <TabBtn active={docsTab === "edital"} onClick={() => setDocsTab("edital")} icon={<FileCheck2 className="h-3.5 w-3.5" />}>
                Documentos do Edital
              </TabBtn>
              <TabBtn active={docsTab === "empresa"} onClick={() => setDocsTab("empresa")} icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                Documentos da Empresa
              </TabBtn>
            </div>

            {docsTab === "edital" ? (
              <DocsZone
                title="Edital, anexos e ementas"
                subtitle="Edital base, termo de referência, planilhas de quantitativos, minuta de contrato, esclarecimentos."
                hints={["Edital integral (PDF)", "Termo de Referência", "Planilha de quantitativos", "Minuta de contrato", "Anexos técnicos / impugnações"]}
              />
            ) : (
              <DocsZone
                title="Habilitação da empresa"
                subtitle="Documentação corporativa exigida para participação: jurídica, fiscal, técnica e econômico-financeira."
                hints={[
                  "Contrato social consolidado",
                  "Certidões negativas (Federal · Estadual · Municipal · FGTS · Trabalhista)",
                  "Atestados de capacidade técnica",
                  "Balanço patrimonial e DRE assinados",
                  "ART/RRT e registro CREA/CAU",
                  "Declarações (ME/EPP, menor, idoneidade)",
                ]}
              />
            )}
            <Textarea label="Observações" rows={3} placeholder="Informações relevantes para a equipe de análise." />
          </Section>
        </form>

        <aside className="space-y-4">
          <div className="card-elevated p-4">
            <h3 className="font-display text-sm font-bold">Status do registro</h3>
            <div className="mt-3 space-y-2.5 text-xs">
              <Row label="Situação" value={<span className="chip border bg-info-soft text-info border-info/30">Rascunho</span>} />
              <Row label="Última edição" value="agora" />
              <Row label="Versão" value="0.1" />
            </div>
          </div>
          <div className="card-elevated p-4">
            <h3 className="font-display text-sm font-bold">Validação</h3>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-3.5 w-3.5 text-warning" /> 4 campos obrigatórios pendentes</li>
              <li className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-3.5 w-3.5 text-warning" /> Anexar pelo menos o edital base</li>
            </ul>
          </div>
          <div className="card-elevated p-4">
            <h3 className="font-display text-sm font-bold">Próximas etapas</h3>
            <ol className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li>1. Triagem & Análise por IA</li>
              <li>2. Parecer técnico</li>
              <li>3. Parecer gerencial</li>
              <li>4. Revisão controladoria</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card-elevated">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">{icon}</span>
        <h2 className="font-display text-sm font-bold">{title}</h2>
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold">{label}</span>
      <input {...props} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30" />
    </label>
  );
}
function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold">{label}</span>
      <textarea {...props} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30" />
    </label>
  );
}
function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
function DocsZone({ title, subtitle, hints }: { title: string; subtitle: string; hints: string[] }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center">
        <Paperclip className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-semibold">Arraste arquivos ou clique para enviar</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, XLSX, ZIP — máx. 50MB por arquivo</p>
        <button type="button" className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
          Selecionar arquivos
        </button>
      </div>
      <div className="rounded-md border border-border bg-card/60 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sugestões de itens esperados</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          {hints.map((h) => (
            <li key={h} className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
              {h}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
