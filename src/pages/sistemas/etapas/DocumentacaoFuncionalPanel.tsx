import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Plus, Trash2, Undo2 } from "lucide-react";
import type { EtapaPanelProps, DfdDados, DfdEtapa } from "./types";
import {
  CLASSIFICACAO_DEMANDA_OPCOES, TIPO_SOLICITACAO_LABEL,
  fmtData, sdNumero,
} from "./types";

// ── Constantes das seções ─────────────────────────────────────────────────────

const TIPO_SOLUCAO = [
  { k: "novo_modulo", l: "Novo módulo" }, { k: "nova_funcionalidade", l: "Nova funcionalidade" },
  { k: "correcao_falha", l: "Correção de falha — Bug" }, { k: "solicitacao_melhoria", l: "Solicitação de Melhoria" },
  { k: "automacao", l: "Automação" }, { k: "integracao", l: "Integração" },
  { k: "relatorio", l: "Relatório" }, { k: "dashboard", l: "Dashboard" },
  { k: "alteracao_regra_negocio", l: "Alteração de regra de negócio" },
  { k: "alteracao_processo", l: "Alteração de processo existente" }, { k: "outro", l: "Outro" },
];

const MODULOS = [
  { k: "recrutamento_selecao", l: "Recrutamento e Seleção" }, { k: "admissao", l: "Admissão" },
  { k: "rh", l: "RH" }, { k: "financeiro", l: "Financeiro" }, { k: "compras_supply", l: "Compras / Supply" },
  { k: "licitacoes", l: "Licitações" }, { k: "operacional", l: "Operacional" },
  { k: "contratos", l: "Contratos" }, { k: "juridico", l: "Jurídico" }, { k: "sst", l: "SST" },
  { k: "treinamentos", l: "Treinamentos" }, { k: "crm", l: "CRM" }, { k: "outro", l: "Outro" },
];

const CONTEMPLAR = [
  { k: "criar_cadastro", l: "Criar cadastro novo" }, { k: "alterar_cadastro", l: "Alterar cadastro existente" },
  { k: "consultar_informacoes", l: "Consultar informações" }, { k: "controlar_andamento", l: "Controlar andamento de processo" },
  { k: "controlar_status", l: "Controlar status" }, { k: "controlar_aprovacoes", l: "Controlar aprovações" },
  { k: "controlar_reprovacoes", l: "Controlar reprovações" }, { k: "permitir_cancelamento", l: "Permitir cancelamento" },
  { k: "permitir_devolucao", l: "Permitir devolução para ajuste" }, { k: "permitir_anexar", l: "Permitir anexar documentos" },
  { k: "gerar_documento", l: "Gerar documento" }, { k: "gerar_relatorio", l: "Gerar relatório" },
  { k: "gerar_dashboard", l: "Gerar dashboard" }, { k: "enviar_notificacoes", l: "Enviar notificações" },
  { k: "controlar_prazos", l: "Controlar prazos" }, { k: "controlar_responsaveis", l: "Controlar responsáveis" },
  { k: "registrar_historico", l: "Registrar histórico" }, { k: "bloquear_avanco_pendencia", l: "Bloquear avanço quando houver pendência" },
  { k: "integrar_outro_sistema", l: "Integrar com outro sistema" }, { k: "importar_dados", l: "Importar dados" },
  { k: "exportar_dados", l: "Exportar dados" }, { k: "permitir_acesso_externos", l: "Permitir acesso de usuários externos" },
  { k: "outro", l: "Outro" },
];

const ENTREGA_PRINCIPAL = [
  { k: "cadastro", l: "Cadastro" }, { k: "workflow_aprovacao", l: "Workflow / fluxo de aprovação" },
  { k: "relatorio", l: "Relatório" }, { k: "dashboard", l: "Dashboard" },
  { k: "integracao", l: "Integração" }, { k: "automacao", l: "Automação" },
  { k: "correcao_bug", l: "Correção de Bug" }, { k: "solicitacao_melhoria", l: "Solicitação de Melhoria" },
  { k: "clientes", l: "Clientes" }, { k: "novo_modulo", l: "Novo módulo" }, { k: "outro", l: "Outro" },
];

const TIPO_INFO_CONTROLADA = [
  { k: "pessoas", l: "Pessoas" }, { k: "colaboradores", l: "Colaboradores" },
  { k: "candidatos", l: "Candidatos" }, { k: "clientes", l: "Clientes" },
  { k: "fornecedores", l: "Fornecedores" }, { k: "contratos", l: "Contratos" },
  { k: "vagas", l: "Vagas" }, { k: "documentos", l: "Documentos" }, { k: "solicitacoes", l: "Solicitações" },
  { k: "compras", l: "Compras" }, { k: "estoque", l: "Estoque" }, { k: "financeiro", l: "Financeiro" },
  { k: "operacional", l: "Operacional" }, { k: "juridico", l: "Jurídico" },
  { k: "sst", l: "SST" }, { k: "treinamentos", l: "Treinamentos" }, { k: "outro", l: "Outro" },
];

const ESCOPO_NEGATIVO = [
  { k: "nao_integracao", l: "Não contempla integração com outro sistema" },
  { k: "nao_dashboard", l: "Não contempla dashboard" },
  { k: "nao_relatorio_gerencial", l: "Não contempla relatório gerencial" },
  { k: "nao_app_mobile", l: "Não contempla aplicativo mobile" },
  { k: "nao_assinatura_digital", l: "Não contempla assinatura digital" },
  { k: "nao_envio_whatsapp", l: "Não contempla envio automático por WhatsApp" },
  { k: "nao_envio_email", l: "Não contempla envio automático por e-mail" },
  { k: "nao_acesso_externo", l: "Não contempla acesso de usuário externo" },
  { k: "nao_migracao_dados", l: "Não contempla migração de dados antigos" },
  { k: "nao_automacao_total", l: "Não contempla automação total do processo" },
  { k: "nao_alteracao_regra", l: "Não contempla alteração de regra de negócio" },
  { k: "nao_alteracao_layout", l: "Não contempla alteração de layout" },
  { k: "nao_criacao_perfis", l: "Não contempla criação de novos perfis de acesso" },
  { k: "nao_geracao_automatica_doc", l: "Não contempla geração automática de documento" },
  { k: "nao_alteracao_outro_modulo", l: "Não contempla alteração em outro módulo" },
  { k: "outro", l: "Outro" },
];

const ITEM_EXCLUIDO_TIPOS = [
  { k: "nova_funcionalidade", l: "Nova funcionalidade" }, { k: "novo_relatorio", l: "Novo relatório" },
  { k: "novo_dashboard", l: "Novo dashboard" }, { k: "nova_integracao", l: "Nova integração" },
  { k: "nova_automacao", l: "Nova automação" }, { k: "novo_perfil_acesso", l: "Novo perfil de acesso" },
  { k: "ajuste_layout", l: "Ajuste de layout" }, { k: "ampliacao_escopo", l: "Ampliação do escopo" },
  { k: "outro", l: "Outro" },
];

const QUEM_INICIA = [
  { k: "colaborador", l: "Colaborador" }, { k: "assistente", l: "Assistente" },
  { k: "analista", l: "Analista" }, { k: "supervisor", l: "Supervisor" },
  { k: "encarregado", l: "Encarregado" }, { k: "preposto", l: "Preposto" },
  { k: "gerente", l: "Gerente" }, { k: "diretor", l: "Diretor" },
  { k: "presidencia", l: "Presidência" }, { k: "cliente", l: "Cliente" },
  { k: "fornecedor", l: "Fornecedor" }, { k: "terceiro_cnpj", l: "Terceiro / Prestador CNPJ" },
  { k: "sistema_automaticamente", l: "Sistema automaticamente" }, { k: "outro", l: "Outro" },
];

const COMO_INICIA = [
  { k: "preenchimento_solicitacao", l: "Preenchimento de solicitação" },
  { k: "cadastro_novo_registro", l: "Cadastro de novo registro" },
  { k: "inclusao_documento", l: "Inclusão de documento" },
  { k: "aprovacao_etapa_anterior", l: "Aprovação de etapa anterior" },
  { k: "recebimento_informacao_externa", l: "Recebimento de informação externa" },
  { k: "integracao_outro_sistema", l: "Integração com outro sistema" },
  { k: "importacao_planilha", l: "Importação de planilha" },
  { k: "acao_automatica_sistema", l: "Ação automática do sistema" },
  { k: "outro", l: "Outro" },
];

const RETORNO_MOTIVOS = [
  { k: "informacao_incompleta", l: "Informação incompleta" },
  { k: "documento_incorreto", l: "Documento incorreto" },
  { k: "reprovacao", l: "Reprovação" },
  { k: "necessidade_ajuste", l: "Necessidade de ajuste" },
  { k: "falta_aprovacao", l: "Falta de aprovação" },
  { k: "divergencia_dados", l: "Divergência de dados" },
  { k: "outro", l: "Outro" },
];

const ENCERRAMENTO = [
  { k: "solicitacao_aprovada", l: "A solicitação for aprovada" },
  { k: "solicitacao_reprovada", l: "A solicitação for reprovada" },
  { k: "execucao_concluida", l: "A execução for concluída" },
  { k: "documento_gerado", l: "O documento for gerado" },
  { k: "responsavel_finalizar", l: "O responsável finalizar a demanda" },
  { k: "prazo_expirar", l: "O prazo expirar" },
  { k: "houver_cancelamento", l: "Houver cancelamento" },
  { k: "outro", l: "Outro" },
];

const MATRIZ_COLS = [
  { k: "registrar", l: "Registrar" }, { k: "validar", l: "Validar" },
  { k: "aprovar", l: "Aprovar" }, { k: "notificar", l: "Notificar" },
  { k: "gerar_doc", l: "Gerar doc." }, { k: "integrar", l: "Integrar" }, { k: "encerrar", l: "Encerrar" },
];

const REGRAS_ACOES_COLS = [
  { k: "regra_negocio", l: "Regra de negócio" }, { k: "validacao", l: "Validação" },
  { k: "aprovacao", l: "Aprovação" }, { k: "reprovacao", l: "Reprovação" },
  { k: "bloqueio", l: "Bloqueio" }, { k: "notificacao", l: "Notificação" },
  { k: "outona", l: "Outona" }, { k: "retorna", l: "Retorna" },
  { k: "exige_justificativa", l: "Exige just." }, { k: "escala_superior", l: "Escala sup." },
];

const REGRAS_SOBRE = [
  { k: "quem_abrir", l: "Quem pode abrir solicitação" }, { k: "quem_analisar", l: "Quem pode analisar" },
  { k: "quem_aprovar", l: "Quem pode aprovar" }, { k: "quem_reprovar", l: "Quem pode reprovar" },
  { k: "quem_cancelar", l: "Quem pode cancelar" }, { k: "quem_editar", l: "Quem pode editar" },
  { k: "quem_anexar", l: "Quem pode anexar documentos" }, { k: "quem_visualizar", l: "Quem pode visualizar" },
  { k: "quem_concluir", l: "Quem pode concluir" }, { k: "quem_reabrir", l: "Quem pode reabrir" },
  { k: "prazos_execucao", l: "Prazos de execução" }, { k: "campos_obrigatorios", l: "Campos obrigatórios" },
  { k: "documentos_obrigatorios", l: "Documentos obrigatórios" }, { k: "validacao_dados", l: "Validação de dados" },
  { k: "status_processo", l: "Status do processo" }, { k: "notificacoes", l: "Notificações" },
  { k: "historico_movimentacoes", l: "Histórico das movimentações" },
  { k: "integracao", l: "Integração com outro sistema" }, { k: "geracao_documento", l: "Geração de documento" },
  { k: "geracao_relatorio", l: "Geração de relatório" }, { k: "outro", l: "Outro" },
];

const PRAZO_DEFINIDO_POR = [
  { k: "manual_governanca", l: "Manual de Governança do ERP" }, { k: "manual_processo", l: "Manual do Processo" },
  { k: "exigencia_legal", l: "Exigência legal" }, { k: "exigencia_contratual", l: "Exigência contratual" },
  { k: "definicao_gestor", l: "Definição do gestor" }, { k: "definicao_comite", l: "Definição do Comitê de Governança" },
  { k: "outro", l: "Outro" },
];

const PRAZOS_CONTROLADOS = [
  { k: "prazo_abertura", l: "Prazo para abertura" }, { k: "prazo_analise", l: "Prazo para análise" },
  { k: "prazo_complementacao", l: "Prazo para complementação" }, { k: "prazo_aprovacao", l: "Prazo para aprovação" },
  { k: "prazo_execucao", l: "Prazo para execução" }, { k: "prazo_resposta", l: "Prazo para resposta" },
  { k: "prazo_correcao", l: "Prazo para correção" }, { k: "prazo_legal", l: "Prazo legal" },
  { k: "prazo_contratual", l: "Prazo contratual" }, { k: "outro", l: "Outro" },
];

const ALERTAR_QUANDO = [
  { k: "nao_precisa_alertar", l: "Não precisa alertar" }, { k: "24h_vencimento", l: "24 horas antes do vencimento" },
  { k: "12h_vencimento", l: "12 horas antes do vencimento" }, { k: "no_vencimento", l: "No vencimento" },
  { k: "apos_vencimento", l: "Após vencimento" }, { k: "diariamente_atrasado", l: "Diariamente enquanto estiver atrasado" },
  { k: "outro", l: "Outro" },
];

const PRAZO_VENCE = [
  { k: "apenas_sinalizar", l: "Apenas sinalizar atraso" }, { k: "notificar_responsavel", l: "Notificar responsável" },
  { k: "notificar_superior", l: "Notificar superior imediato" }, { k: "bloquear_avanco", l: "Bloquear avanço" },
  { k: "escalar_diretoria", l: "Escalar para diretoria" }, { k: "registrar_ocorrencia", l: "Registrar ocorrência" },
  { k: "outro", l: "Outro" },
];

const FUNCIONALIDADES = [
  { k: "cadastrar", l: "Cadastrar" }, { k: "consultar", l: "Consultar" }, { k: "editar", l: "Editar" },
  { k: "excluir", l: "Excluir" }, { k: "inativar", l: "Inativar" }, { k: "reativar", l: "Reativar" },
  { k: "aprovar", l: "Aprovar" }, { k: "reprovar", l: "Reprovar" }, { k: "cancelar", l: "Cancelar" },
  { k: "reabrir", l: "Reabrir" }, { k: "avancar_etapa", l: "Avançar etapa" },
  { k: "retornar_etapa", l: "Retornar etapa" }, { k: "anexar_documento", l: "Anexar documento" },
  { k: "gerar_documento", l: "Gerar documento" }, { k: "gerar_relatorio", l: "Gerar relatório" },
  { k: "gerar_dashboard", l: "Gerar dashboard" }, { k: "exportar_dados", l: "Exportar dados" },
  { k: "enviar_notificacao", l: "Enviar notificação" }, { k: "registrar_historico", l: "Registrar histórico" },
  { k: "outro", l: "Outro" },
];

const ACOES_EXECUTORES = [
  { k: "solicitante", l: "Solicitante" }, { k: "analista", l: "Analista" },
  { k: "supervisor", l: "Supervisor" }, { k: "gerente", l: "Gerente" },
  { k: "diretor", l: "Diretor" }, { k: "outro", l: "Outro" },
];

const RESULTADO_AUTOMATICO = [
  { k: "alteracao_status", l: "Alteração de status" }, { k: "notificacao_responsavel", l: "Notificação ao responsável" },
  { k: "notificacao_solicitante", l: "Notificação ao solicitante" }, { k: "geracao_documento", l: "Geração de documento" },
  { k: "geracao_relatorio", l: "Geração de relatório" }, { k: "atualizacao_indicador", l: "Atualização de indicador" },
  { k: "criacao_pendencia", l: "Criação de pendência" }, { k: "bloqueio_avanco", l: "Bloqueio de avanço" },
  { k: "encaminhamento_aprovacao", l: "Encaminhamento para aprovação" },
  { k: "registro_historico", l: "Registro de histórico" }, { k: "outro", l: "Outro" },
];

const CONDICOES = [
  { k: "campo_obrigatorio", l: "Campo obrigatório preenchido" }, { k: "documento_anexado", l: "Documento anexado" },
  { k: "aprovacao_anterior", l: "Aprovação anterior" }, { k: "prazo_dentro_limite", l: "Prazo dentro do limite" },
  { k: "perfil_autorizado", l: "Perfil autorizado" }, { k: "integracao_concluida", l: "Integração concluída" },
  { k: "cadastro_ativo", l: "Cadastro ativo" }, { k: "sem_pendencia", l: "Sem pendência aberta" },
  { k: "outro", l: "Outro" },
];

const ESTRUTURA_INTERFACE = [
  { k: "tela_unica", l: "Tela única" }, { k: "multiplas_telas", l: "Múltiplas telas" },
  { k: "abas", l: "Abas" }, { k: "assistente_etapas", l: "Assistente em etapas" },
  { k: "painel_dashboard", l: "Painel / dashboard" }, { k: "janela_modal", l: "Janela modal / pop-up" },
  { k: "outro", l: "Outro" },
];

const NAVEGACAO = [
  { k: "botoes_avancar_voltar", l: "Botões Avançar / Voltar" }, { k: "menu_lateral", l: "Menu lateral" },
  { k: "menu_superior", l: "Menu superior" }, { k: "navegacao_por_etapas", l: "Navegação por etapas" },
  { k: "fluxo_automatico", l: "Fluxo automático" }, { k: "outro", l: "Outro" },
];

const ELEMENTOS_VISUAIS = [
  { k: "botoes_acao", l: "Botões de ação" }, { k: "indicadores_flags", l: "Indicadores visuais / flags" },
  { k: "cores_indicativas", l: "Cores indicativas" }, { k: "campos_inteligentes", l: "Campos inteligentes" },
  { k: "alertas_tela", l: "Alertas em tela" }, { k: "informacoes_destaque", l: "Informações em destaque" },
  { k: "referencia_visual", l: "Referência visual de outro sistema" }, { k: "outro", l: "Outro" },
];

const REFERENCIA_SISTEMA = [
  { k: "senior", l: "Senior" }, { k: "kommo", l: "Kommo" }, { k: "nexti", l: "Nexti" },
  { k: "dominio", l: "Domínio" }, { k: "microsoft", l: "Microsoft" },
  { k: "sap", l: "SAP" }, { k: "totvs", l: "TOTVS" }, { k: "outro", l: "Outro" },
];

const PERFIS_ENVOLVIDOS = [
  { k: "presidencia", l: "Presidência" }, { k: "diretor", l: "Diretor" }, { k: "gerente", l: "Gerente" },
  { k: "supervisor", l: "Supervisor" }, { k: "encarregado", l: "Encarregado" }, { k: "preposto", l: "Preposto" },
  { k: "analista", l: "Analista" }, { k: "assistente", l: "Assistente" }, { k: "estagiario", l: "Estagiário" },
  { k: "jovem_aprendiz", l: "Jovem Aprendiz" }, { k: "colaborador", l: "Colaborador" },
  { k: "terceiro_cnpj", l: "Terceiro / Prestador CNPJ" }, { k: "cliente", l: "Cliente" },
  { k: "fornecedor", l: "Fornecedor" }, { k: "auditor", l: "Auditor" },
  { k: "administrador_sistema", l: "Administrador do Sistema" }, { k: "outro", l: "Outro" },
];

const PERMISSOES_COLS = [
  { k: "visualizar", l: "Visualizar" }, { k: "incluir", l: "Incluir" }, { k: "alterar", l: "Alterar" },
  { k: "aprovar", l: "Aprovar" }, { k: "reprovar", l: "Reprovar" }, { k: "cancelar", l: "Cancelar" },
  { k: "anexar", l: "Anexar" }, { k: "exportar", l: "Exportar" }, { k: "indicadores", l: "Indicadores" },
];

const RESTRICOES_ACESSO = [
  { k: "por_empresa", l: "Por empresa" }, { k: "por_filial", l: "Por filial" }, { k: "por_unidade", l: "Por unidade" },
  { k: "por_contrato", l: "Por contrato" }, { k: "por_centro_custo", l: "Por centro de custo" },
  { k: "por_area", l: "Por área" }, { k: "por_perfil", l: "Por perfil" },
  { k: "por_cnpj", l: "Por CNPJ" }, { k: "por_cpf", l: "Por CPF" },
  { k: "por_demanda_especifica", l: "Por demanda específica" }, { k: "outro", l: "Outro" },
];

const INTEGRACAO_TIPO = [
  { k: "consulta", l: "Consulta" }, { k: "envio", l: "Envio" }, { k: "recebimento", l: "Recebimento" },
  { k: "api", l: "API" }, { k: "planilha", l: "Planilha" },
];

const DOC_FORMATO = [
  { k: "pdf", l: "PDF" }, { k: "excel", l: "Excel" }, { k: "word", l: "Word" }, { k: "outro", l: "Outro" },
];

const PREMISSA_TIPOS = [
  { k: "premissa", l: "Premissa" }, { k: "restricao", l: "Restrição" },
  { k: "dependencia", l: "Dependência" }, { k: "risco", l: "Risco" },
];

const IMPACTO_OPCOES = [
  { k: "baixo", l: "Baixo" }, { k: "medio", l: "Médio" }, { k: "alto", l: "Alto" }, { k: "critico", l: "Crítico" },
];

const ITENS_HOMOLOGACAO = [
  { k: "funcionalidades_escopo", l: "Funcionalidades entregues conforme escopo aprovado" },
  { k: "regras_negocio", l: "Regras de negócio funcionando corretamente" },
  { k: "validacoes", l: "Validações aplicadas corretamente" },
  { k: "permissoes", l: "Permissões configuradas corretamente" },
  { k: "integracoes", l: "Integrações funcionando, quando aplicável" },
  { k: "documentos_gerados", l: "Documentos gerados corretamente, quando aplicável" },
  { k: "indicadores", l: "Indicadores disponíveis, quando aplicável" },
  { k: "ausencia_bug", l: "Ausência de Bug que impeça ou comprometa o uso da solução" },
  { k: "treinamento", l: "Treinamento / material de apoio previsto identificado" },
  { k: "outro", l: "Outro" },
];

const SITUACAO_DFD = [
  { k: "aprovado_analise", l: "Aprovado para análise técnica" },
  { k: "retornar_ajustes", l: "Retornar para ajustes" },
  { k: "suspenso", l: "Suspenso por pendência" },
  { k: "cancelado", l: "Cancelado" },
];

const DEFAULT_REGRAS = Array(5).fill(null).map(() => ({}));
const DEFAULT_ACOES = Array(5).fill(null).map(() => ({}));
const DEFAULT_PERMISSOES = [
  { perfil: "Presidência" }, { perfil: "Diretor" }, { perfil: "Gerente" },
  { perfil: "Supervisor" }, { perfil: "Analista" }, { perfil: "Assistente" },
  { perfil: "Colaborador" }, { perfil: "Terceiro / Prestador CNPJ" }, { perfil: "Outro" },
];
const DEFAULT_INTEGRACOES = Array(2).fill(null).map(() => ({}));
const DEFAULT_DOCUMENTOS = Array(2).fill(null).map(() => ({}));
const DEFAULT_INDICADORES = Array(2).fill(null).map(() => ({}));
const DEFAULT_PREMISSAS = Array(3).fill(null).map(() => ({}));
const DEFAULT_CRITERIOS_ETAPA = Array(2).fill(null).map(() => ({}));

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Secao({ num, title }: { num: number; title: string }) {
  return (
    <div className="flex items-center gap-2 rounded-t bg-[#153169] px-3 py-1.5">
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#153169]">{num}</span>
      <span className="text-xs font-bold uppercase tracking-wide text-white">{title}</span>
    </div>
  );
}

function SubSecao({ title }: { title: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-[#153169] border-b border-border pb-0.5 mb-1.5">{title}</p>;
}

function Chk({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-1.5 text-[11px] select-none ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
        className="h-3 w-3 flex-shrink-0 accent-[#153169]" />
      {label}
    </label>
  );
}

function Radio({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-1.5 text-[11px] select-none ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <input type="radio" checked={checked} disabled={disabled} onChange={onChange}
        className="h-3 w-3 flex-shrink-0 accent-[#153169]" />
      {label}
    </label>
  );
}

function TxtInput({ value, onChange, disabled, placeholder, className }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; className?: string;
}) {
  return (
    <Input value={value} disabled={disabled} placeholder={placeholder ?? ""} className={`h-7 text-[11px] ${className ?? ""}`}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => { if (e.target.value !== value) onChange(e.target.value); }} />
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function DocumentacaoFuncionalPanel({ card, papeis, onUpdate }: EtapaPanelProps) {
  const podeAgir = papeis.controladoria;
  const [dfd, setDfd] = useState<DfdDados>(card.dfd_dados ?? {});

  useEffect(() => { setDfd(card.dfd_dados ?? {}); }, [card.dfd_dados]);

  function patch(p: Partial<DfdDados>) {
    const novo = { ...dfd, ...p };
    setDfd(novo);
    onUpdate({ dfd_dados: novo });
  }

  function toggleArr(field: keyof DfdDados, key: string, checked: boolean) {
    const cur = (dfd[field] as string[] | undefined) ?? [];
    const novo = checked ? [...cur, key] : cur.filter((k) => k !== key);
    patch({ [field]: novo });
  }

  function hasArr(field: keyof DfdDados, key: string) {
    return ((dfd[field] as string[] | undefined) ?? []).includes(key);
  }

  function patchMatriz(codigo: string, key: string, val: boolean) {
    patch({
      matriz: {
        ...(dfd.matriz ?? {}),
        [codigo]: { ...(dfd.matriz?.[codigo] ?? {}), [key]: val },
      },
    });
  }

  function patchRow<T extends object>(
    field: "regras_negocio" | "acoes" | "permissoes" | "integracoes" | "documentos" | "indicadores" | "premissas" | "criterios_etapa",
    idx: number,
    p: Partial<T>,
    defaults: object[],
  ) {
    const base = ((dfd[field] as T[] | undefined) ?? defaults.map(() => ({} as T)));
    const padded: T[] = base.length > idx ? [...base] : [...base, ...defaults.slice(base.length).map(() => ({} as T))];
    const novo = padded.map((item, i) => (i === idx ? { ...item, ...p } : item));
    patch({ [field]: novo });
  }

  function getRow<T extends object>(
    field: "regras_negocio" | "acoes" | "permissoes" | "integracoes" | "documentos" | "indicadores" | "premissas" | "criterios_etapa",
    idx: number,
    defaults: object[],
  ): T {
    const base = (dfd[field] as T[] | undefined) ?? [];
    return (base[idx] as T | undefined) ?? (defaults[idx] as T | undefined) ?? ({} as T);
  }

  function ChkGroup({ field, opcoes, cols = 2 }: { field: keyof DfdDados; opcoes: { k: string; l: string }[]; cols?: number }) {
    return (
      <div className={`grid gap-x-4 gap-y-1`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {opcoes.map(({ k, l }) => (
          <Chk key={k} checked={hasArr(field, k)} label={l} disabled={!podeAgir}
            onChange={(v) => toggleArr(field, k, v)} />
        ))}
      </div>
    );
  }

  function RadioGroup({ field, opcoes }: { field: keyof DfdDados; opcoes: { k: string; l: string }[] }) {
    const cur = dfd[field] as string | undefined;
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {opcoes.map(({ k, l }) => (
          <Radio key={k} checked={cur === k} label={l} disabled={!podeAgir}
            onChange={() => patch({ [field]: cur === k ? undefined : k })} />
        ))}
      </div>
    );
  }

  function EtapaSelect({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
    return (
      <select
        value={value ?? ""}
        disabled={!podeAgir}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">—</option>
        {(dfd.etapas ?? []).map((e) => (
          <option key={e.codigo} value={e.codigo}>{e.codigo} – {e.descricao}</option>
        ))}
      </select>
    );
  }

  const tipoDemanda = card.classificacao_demanda?.length
    ? card.classificacao_demanda.map((v) => CLASSIFICACAO_DEMANDA_OPCOES.find((o) => o.value === v)?.label ?? v).join(", ")
    : (card.tipo_solicitacao ? (TIPO_SOLICITACAO_LABEL[card.tipo_solicitacao] ?? card.tipo_solicitacao) : null);

  return (
    <div className="space-y-4 text-[11px]">

      {/* ── CABEÇALHO ── */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ANEXO II – DOCUMENTO FUNCIONAL DA DEMANDA (DFD)</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <div><span className="font-semibold text-primary">Número da Demanda:</span> <span>{sdNumero(card)}</span></div>
          <div><span className="font-semibold text-primary">Área Solicitante:</span> <span>{card.area_solicitante ?? "—"}</span></div>
          <div><span className="font-semibold text-primary">Responsável pela Solicitação:</span> <span>{card.responsavel_solicitacao ?? "—"}</span></div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary flex-shrink-0">Usuário-chave indicado:</span>
            <TxtInput value={dfd.usuario_chave ?? ""} onChange={(v) => patch({ usuario_chave: v })} disabled={!podeAgir} />
          </div>
          <div><span className="font-semibold text-primary">Tipo da Demanda:</span> <span>{tipoDemanda ?? "—"}</span></div>
        </div>
        <div className="space-y-1">
          <label className="font-semibold text-primary">Objetivo da Demanda:</label>
          <Textarea value={dfd.objetivo ?? ""} disabled={!podeAgir} placeholder="Descreva o objetivo..."
            className="min-h-[50px] text-[11px]" onChange={(e) => patch({ objetivo: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="font-semibold text-primary">Justificativa:</label>
          <Textarea value={dfd.justificativa ?? ""} disabled={!podeAgir} placeholder="Descreva a justificativa..."
            className="min-h-[50px] text-[11px]" onChange={(e) => patch({ justificativa: e.target.value })} />
        </div>
      </div>

      {/* ── SEÇÃO 1 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={1} title="ESCOPO FUNCIONAL DA SOLUÇÃO" />
        <div className="p-3 space-y-3">
          <div><SubSecao title="1.1 Tipo de solução" /><ChkGroup field="tipo_solucao" opcoes={TIPO_SOLUCAO} cols={3} /></div>
          <div><SubSecao title="1.2 Módulos impactados" /><ChkGroup field="modulos_impactados" opcoes={MODULOS} cols={3} /></div>
          <div><SubSecao title="1.3 O que a solução deverá contemplar?" /><ChkGroup field="contemplar" opcoes={CONTEMPLAR} cols={2} /></div>
          <div>
            <SubSecao title="1.4 Principal entrega esperada (marcar apenas uma)" />
            <RadioGroup field="entrega_principal" opcoes={ENTREGA_PRINCIPAL} />
          </div>
          <div><SubSecao title="1.5 Tipo de informação controlada" /><ChkGroup field="tipo_info_controlada" opcoes={TIPO_INFO_CONTROLADA} cols={3} /></div>
          <div><SubSecao title="1.6 Escopo negativo — O que NÃO fará parte desta entrega?" /><ChkGroup field="escopo_negativo" opcoes={ESCOPO_NEGATIVO} cols={2} /></div>
          <div>
            <SubSecao title="1.7 Item excluído que deverá virar Solicitação de Melhoria futura?" />
            <div className="flex gap-4 mb-2">
              {[{ k: "sim", l: "Sim" }, { k: "nao", l: "Não" }, { k: "nao_identificado", l: "Não identificado no momento" }].map(({ k, l }) => (
                <Radio key={k} checked={dfd.item_excluido === k} label={l} disabled={!podeAgir}
                  onChange={() => patch({ item_excluido: dfd.item_excluido === k ? undefined : k })} />
              ))}
            </div>
            {dfd.item_excluido === "sim" && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Se SIM, que tipo?</p>
                <ChkGroup field="item_excluido_tipos" opcoes={ITEM_EXCLUIDO_TIPOS} cols={3} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 2 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={2} title="MAPA DAS ETAPAS DO PROCESSO" />
        <div className="p-3 space-y-3">
          {/* 2.1 Mapa das etapas — dinâmico */}
          <div>
            <SubSecao title="2.1 Mapa das etapas" />
            <div className="space-y-1 mb-2">
              {(dfd.etapas ?? []).map((etapa, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <TxtInput value={etapa.codigo} disabled={!podeAgir} placeholder="E1" className="w-16"
                    onChange={(v) => {
                      const novo = [...(dfd.etapas ?? [])];
                      novo[idx] = { ...novo[idx], codigo: v };
                      patch({ etapas: novo });
                    }} />
                  <TxtInput value={etapa.descricao} disabled={!podeAgir} placeholder="Descrição da etapa" className="flex-1"
                    onChange={(v) => {
                      const novo = [...(dfd.etapas ?? [])];
                      novo[idx] = { ...novo[idx], descricao: v };
                      patch({ etapas: novo });
                    }} />
                  {podeAgir && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive flex-shrink-0"
                      onClick={() => patch({ etapas: (dfd.etapas ?? []).filter((_, i) => i !== idx) })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {podeAgir && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]"
                onClick={() => patch({ etapas: [...(dfd.etapas ?? []), { codigo: `E${(dfd.etapas?.length ?? 0) + 1}`, descricao: "" }] })}>
                <Plus className="h-3 w-3" /> Adicionar etapa
              </Button>
            )}
          </div>

          {/* 2.2 Início do processo */}
          <div className="grid grid-cols-2 gap-4">
            <div><SubSecao title="2.2 Quem inicia o processo?" /><ChkGroup field="quem_inicia" opcoes={QUEM_INICIA} cols={1} /></div>
            <div><SubSecao title="Como inicia?" /><ChkGroup field="como_inicia" opcoes={COMO_INICIA} cols={1} /></div>
          </div>

          {/* 2.3 Retorno */}
          <div>
            <SubSecao title="2.3 Retorno entre etapas — O processo poderá retornar para etapa anterior?" />
            <div className="flex gap-4 mb-2">
              <Radio checked={dfd.tem_retorno === "sim"} label="Sim" disabled={!podeAgir}
                onChange={() => patch({ tem_retorno: dfd.tem_retorno === "sim" ? undefined : "sim" })} />
              <Radio checked={dfd.tem_retorno === "nao"} label="Não" disabled={!podeAgir}
                onChange={() => patch({ tem_retorno: dfd.tem_retorno === "nao" ? undefined : "nao" })} />
            </div>
            {dfd.tem_retorno === "sim" && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Se SIM, por qual motivo?</p>
                <ChkGroup field="retorno_motivos" opcoes={RETORNO_MOTIVOS} cols={2} />
              </div>
            )}
          </div>

          {/* 2.4 Encerramento */}
          <div><SubSecao title="2.4 Encerramento do processo — O processo será encerrado quando:" /><ChkGroup field="encerramento" opcoes={ENCERRAMENTO} cols={2} /></div>
        </div>
      </div>

      {/* ── SEÇÃO 3 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={3} title="MATRIZ FUNCIONAL POR ETAPA" />
        <div className="p-3 overflow-x-auto">
          {(dfd.etapas ?? []).length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Adicione etapas na seção 2.1 para preencher a matriz.</p>
          ) : (
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border border-border px-1 py-0.5 text-left w-20">Etapa</th>
                  {MATRIZ_COLS.map((c) => <th key={c.k} className="border border-border px-1 py-0.5">{c.l}</th>)}
                  <th className="border border-border px-1 py-0.5">Hist. S</th>
                  <th className="border border-border px-1 py-0.5">Hist. N</th>
                  <th className="border border-border px-1 py-0.5">Notif. S</th>
                  <th className="border border-border px-1 py-0.5">Notif. N</th>
                  <th className="border border-border px-1 py-0.5">Bloq. S</th>
                  <th className="border border-border px-1 py-0.5">Bloq. N</th>
                  <th className="border border-border px-1 py-0.5">Bloq. O</th>
                </tr>
              </thead>
              <tbody>
                {(dfd.etapas ?? []).map((etapa) => {
                  const row = dfd.matriz?.[etapa.codigo] ?? {};
                  const chk = (k: string) => (
                    <td key={k} className="border border-border px-1 py-0.5 text-center">
                      <input type="checkbox" checked={!!(row as Record<string, boolean>)[k]} disabled={!podeAgir}
                        onChange={(e) => patchMatriz(etapa.codigo, k, e.target.checked)}
                        className="h-3 w-3 accent-[#153169]" />
                    </td>
                  );
                  return (
                    <tr key={etapa.codigo}>
                      <td className="border border-border px-1 py-0.5 font-semibold">{etapa.codigo}</td>
                      {MATRIZ_COLS.map((c) => chk(c.k))}
                      {["gera_historico", "gera_historico_n", "gera_notificacao", "gera_notificacao_n", "bloqueia_avanco", "bloqueia_nao", "bloqueia_outro"].map((k) => chk(k))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── SEÇÃO 4 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={4} title="REGRAS DE NEGÓCIO E VALIDAÇÕES" />
        <div className="p-3 space-y-3">
          {/* 4.1 Tabela de regras */}
          <div>
            <SubSecao title="4.1 Matriz de regras por etapa" />
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-1 py-0.5 text-left w-24">Etapa</th>
                    <th className="border border-border px-1 py-0.5 text-left w-20">Tipo</th>
                    <th className="border border-border px-1 py-0.5 text-left">Regra / Validação / Aprovação</th>
                    <th className="border border-border px-1 py-0.5 text-left w-24">Responsável</th>
                    {REGRAS_ACOES_COLS.map((c) => <th key={c.k} className="border border-border px-1 py-0.5 text-center">{c.l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_REGRAS.map((_, idx) => {
                    const row = getRow<{ etapa?: string; tipo?: string; regra?: string; responsavel?: string; acoes?: string[] }>("regras_negocio", idx, DEFAULT_REGRAS);
                    return (
                      <tr key={idx}>
                        <td className="border border-border px-1 py-0.5">
                          <EtapaSelect value={row.etapa} onChange={(v) => patchRow("regras_negocio", idx, { etapa: v }, DEFAULT_REGRAS)} />
                        </td>
                        <td className="border border-border px-1 py-0.5">
                          <TxtInput value={row.tipo ?? ""} disabled={!podeAgir} placeholder="tipo"
                            onChange={(v) => patchRow("regras_negocio", idx, { tipo: v }, DEFAULT_REGRAS)} />
                        </td>
                        <td className="border border-border px-1 py-0.5">
                          <TxtInput value={row.regra ?? ""} disabled={!podeAgir} placeholder="regra"
                            onChange={(v) => patchRow("regras_negocio", idx, { regra: v }, DEFAULT_REGRAS)} />
                        </td>
                        <td className="border border-border px-1 py-0.5">
                          <TxtInput value={row.responsavel ?? ""} disabled={!podeAgir} placeholder="responsável"
                            onChange={(v) => patchRow("regras_negocio", idx, { responsavel: v }, DEFAULT_REGRAS)} />
                        </td>
                        {REGRAS_ACOES_COLS.map((c) => (
                          <td key={c.k} className="border border-border px-1 py-0.5 text-center">
                            <input type="checkbox" checked={(row.acoes ?? []).includes(c.k)} disabled={!podeAgir}
                              onChange={(e) => {
                                const cur = row.acoes ?? [];
                                patchRow("regras_negocio", idx, { acoes: e.target.checked ? [...cur, c.k] : cur.filter((x) => x !== c.k) }, DEFAULT_REGRAS);
                              }}
                              className="h-3 w-3 accent-[#153169]" />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4.2 Tipos de regras */}
          <div><SubSecao title="4.2 Tipos de regras necessárias" /><ChkGroup field="regras_sobre" opcoes={REGRAS_SOBRE} cols={2} /></div>

          {/* 4.3 Prazos e SLAs */}
          <div>
            <SubSecao title="4.3 Prazos e SLAs do processo" />
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">O processo terá controle de prazo?</p>
                <RadioGroup field="tem_prazo" opcoes={[{ k: "sim", l: "Sim" }, { k: "nao", l: "Não" }, { k: "nao_identificado", l: "Não identificado no momento" }]} />
              </div>
              {dfd.tem_prazo === "sim" && (
                <>
                  <div><p className="text-[10px] text-muted-foreground mb-1">O prazo será definido por:</p><ChkGroup field="prazo_definido_por" opcoes={PRAZO_DEFINIDO_POR} cols={2} /></div>
                  <div><p className="text-[10px] text-muted-foreground mb-1">Quais prazos deverão ser controlados?</p><ChkGroup field="prazos_controlados" opcoes={PRAZOS_CONTROLADOS} cols={2} /></div>
                  <div><p className="text-[10px] text-muted-foreground mb-1">O sistema deverá alertar quando?</p><ChkGroup field="alertar_quando" opcoes={ALERTAR_QUANDO} cols={2} /></div>
                  <div><p className="text-[10px] text-muted-foreground mb-1">Quando o prazo vencer, o sistema deverá:</p><ChkGroup field="prazo_vence" opcoes={PRAZO_VENCE} cols={2} /></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 5 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={5} title="FUNCIONALIDADES E AÇÕES SISTÊMICAS" />
        <div className="p-3 space-y-3">
          <div><SubSecao title="5.1 Funcionalidades gerais" /><ChkGroup field="funcionalidades" opcoes={FUNCIONALIDADES} cols={3} /></div>

          {/* 5.2 Detalhamento das ações */}
          <div>
            <SubSecao title="5.2 Detalhamento das ações" />
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-1 py-0.5 text-left">Ação</th>
                    <th className="border border-border px-1 py-0.5 text-left w-28">Etapa vinculada</th>
                    {ACOES_EXECUTORES.map((c) => <th key={c.k} className="border border-border px-1 py-0.5">{c.l}</th>)}
                    <th className="border border-border px-1 py-0.5">Aprov. S</th>
                    <th className="border border-border px-1 py-0.5">Aprov. N</th>
                    <th className="border border-border px-1 py-0.5">Hist. S</th>
                    <th className="border border-border px-1 py-0.5">Hist. N</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_ACOES.map((_, idx) => {
                    const row = getRow<{ acao?: string; etapa_vinculada?: string; executores?: string[]; precisa_aprovacao?: boolean | null; gera_historico?: boolean | null }>("acoes", idx, DEFAULT_ACOES);
                    return (
                      <tr key={idx}>
                        <td className="border border-border px-1 py-0.5">
                          <TxtInput value={row.acao ?? ""} disabled={!podeAgir} placeholder="ação"
                            onChange={(v) => patchRow("acoes", idx, { acao: v }, DEFAULT_ACOES)} />
                        </td>
                        <td className="border border-border px-1 py-0.5">
                          <EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("acoes", idx, { etapa_vinculada: v }, DEFAULT_ACOES)} />
                        </td>
                        {ACOES_EXECUTORES.map((c) => (
                          <td key={c.k} className="border border-border px-1 py-0.5 text-center">
                            <input type="checkbox" checked={(row.executores ?? []).includes(c.k)} disabled={!podeAgir}
                              onChange={(e) => {
                                const cur = row.executores ?? [];
                                patchRow("acoes", idx, { executores: e.target.checked ? [...cur, c.k] : cur.filter((x) => x !== c.k) }, DEFAULT_ACOES);
                              }}
                              className="h-3 w-3 accent-[#153169]" />
                          </td>
                        ))}
                        <td className="border border-border px-1 py-0.5 text-center">
                          <input type="radio" checked={row.precisa_aprovacao === true} disabled={!podeAgir}
                            onChange={() => patchRow("acoes", idx, { precisa_aprovacao: true }, DEFAULT_ACOES)} className="h-3 w-3 accent-[#153169]" />
                        </td>
                        <td className="border border-border px-1 py-0.5 text-center">
                          <input type="radio" checked={row.precisa_aprovacao === false} disabled={!podeAgir}
                            onChange={() => patchRow("acoes", idx, { precisa_aprovacao: false }, DEFAULT_ACOES)} className="h-3 w-3 accent-[#153169]" />
                        </td>
                        <td className="border border-border px-1 py-0.5 text-center">
                          <input type="radio" checked={row.gera_historico === true} disabled={!podeAgir}
                            onChange={() => patchRow("acoes", idx, { gera_historico: true }, DEFAULT_ACOES)} className="h-3 w-3 accent-[#153169]" />
                        </td>
                        <td className="border border-border px-1 py-0.5 text-center">
                          <input type="radio" checked={row.gera_historico === false} disabled={!podeAgir}
                            onChange={() => patchRow("acoes", idx, { gera_historico: false }, DEFAULT_ACOES)} className="h-3 w-3 accent-[#153169]" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div><SubSecao title="5.3 Resultado automático da funcionalidade" /><ChkGroup field="resultado_automatico" opcoes={RESULTADO_AUTOMATICO} cols={2} /></div>
          <div><SubSecao title="5.4 Condições para funcionamento da funcionalidade" /><ChkGroup field="condicoes" opcoes={CONDICOES} cols={2} /></div>
        </div>
      </div>

      {/* ── SEÇÃO 6 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={6} title="INTERFACE, NAVEGAÇÃO E INTEGRAÇÕES" />
        <div className="p-3 grid grid-cols-2 gap-4">
          <div><SubSecao title="6.1 Estrutura da interface" /><ChkGroup field="estrutura_interface" opcoes={ESTRUTURA_INTERFACE} cols={1} /></div>
          <div><SubSecao title="6.2 Navegação" /><ChkGroup field="navegacao" opcoes={NAVEGACAO} cols={1} /></div>
          <div><SubSecao title="6.3 Elementos visuais sugeridos" /><ChkGroup field="elementos_visuais" opcoes={ELEMENTOS_VISUAIS} cols={1} /></div>
          <div>
            <SubSecao title="6.4 Referência de outro sistema, se houver" />
            <RadioGroup field="referencia_outro_sistema" opcoes={REFERENCIA_SISTEMA} />
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 7 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={7} title="PERFIS E PERMISSÕES DE ACESSO" />
        <div className="p-3 space-y-3">
          <div><SubSecao title="7.1 Perfis envolvidos" /><ChkGroup field="perfis" opcoes={PERFIS_ENVOLVIDOS} cols={3} /></div>

          {/* 7.2 Matrix de permissões */}
          <div>
            <SubSecao title="7.2 Matrix resumida de permissões" />
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-1 py-0.5 text-left">Perfil</th>
                    <th className="border border-border px-1 py-0.5 text-left w-28">Etapa vinculada</th>
                    {PERMISSOES_COLS.map((c) => <th key={c.k} className="border border-border px-1 py-0.5">{c.l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_PERMISSOES.map((def, idx) => {
                    const row = getRow<{ perfil?: string; etapa_vinculada?: string } & Record<string, boolean>>("permissoes", idx, DEFAULT_PERMISSOES);
                    return (
                      <tr key={idx}>
                        <td className="border border-border px-1 py-0.5">
                          <TxtInput value={row.perfil ?? (def as { perfil: string }).perfil} disabled={!podeAgir}
                            onChange={(v) => patchRow("permissoes", idx, { perfil: v }, DEFAULT_PERMISSOES)} />
                        </td>
                        <td className="border border-border px-1 py-0.5">
                          <EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("permissoes", idx, { etapa_vinculada: v }, DEFAULT_PERMISSOES)} />
                        </td>
                        {PERMISSOES_COLS.map((c) => (
                          <td key={c.k} className="border border-border px-1 py-0.5 text-center">
                            <input type="checkbox" checked={!!row[c.k]} disabled={!podeAgir}
                              onChange={(e) => patchRow("permissoes", idx, { [c.k]: e.target.checked }, DEFAULT_PERMISSOES)}
                              className="h-3 w-3 accent-[#153169]" />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div><SubSecao title="7.3 Restrições de acesso" /><ChkGroup field="restricoes_acesso" opcoes={RESTRICOES_ACESSO} cols={2} /></div>
        </div>
      </div>

      {/* ── SEÇÃO 8 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={8} title="INTEGRAÇÕES" />
        <div className="p-3 space-y-3">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">A solução terá integração?</p>
            <RadioGroup field="tem_integracao" opcoes={[{ k: "sim", l: "Sim" }, { k: "nao", l: "Não" }, { k: "nao_identificado", l: "Não identificado no momento" }]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border border-border px-1 py-0.5 text-left w-28">Etapa vinculada</th>
                  <th className="border border-border px-1 py-0.5 text-left">Sistema / Base</th>
                  <th className="border border-border px-1 py-0.5 text-left">Tipo de integração</th>
                  <th className="border border-border px-1 py-0.5 text-left">Dados compartilhados</th>
                  <th className="border border-border px-1 py-0.5 text-left">Frequência</th>
                  <th className="border border-border px-1 py-0.5 text-left">Tratamento em caso de falha</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_INTEGRACOES.map((_, idx) => {
                  const row = getRow<{ etapa_vinculada?: string; sistema?: string; tipo?: string[]; dados?: string; frequencia?: string; tratamento_falha?: string }>("integracoes", idx, DEFAULT_INTEGRACOES);
                  return (
                    <tr key={idx}>
                      <td className="border border-border px-1 py-0.5">
                        <EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("integracoes", idx, { etapa_vinculada: v }, DEFAULT_INTEGRACOES)} />
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        <TxtInput value={row.sistema ?? ""} disabled={!podeAgir} placeholder="sistema"
                          onChange={(v) => patchRow("integracoes", idx, { sistema: v }, DEFAULT_INTEGRACOES)} />
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        <div className="space-y-0.5">
                          {INTEGRACAO_TIPO.map((c) => (
                            <Chk key={c.k} checked={(row.tipo ?? []).includes(c.k)} label={c.l} disabled={!podeAgir}
                              onChange={(v) => {
                                const cur = row.tipo ?? [];
                                patchRow("integracoes", idx, { tipo: v ? [...cur, c.k] : cur.filter((x) => x !== c.k) }, DEFAULT_INTEGRACOES);
                              }} />
                          ))}
                        </div>
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        <TxtInput value={row.dados ?? ""} disabled={!podeAgir} placeholder="dados"
                          onChange={(v) => patchRow("integracoes", idx, { dados: v }, DEFAULT_INTEGRACOES)} />
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        <TxtInput value={row.frequencia ?? ""} disabled={!podeAgir} placeholder="frequência"
                          onChange={(v) => patchRow("integracoes", idx, { frequencia: v }, DEFAULT_INTEGRACOES)} />
                      </td>
                      <td className="border border-border px-1 py-0.5">
                        <TxtInput value={row.tratamento_falha ?? ""} disabled={!podeAgir} placeholder="tratamento"
                          onChange={(v) => patchRow("integracoes", idx, { tratamento_falha: v }, DEFAULT_INTEGRACOES)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 9 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={9} title="DOCUMENTOS, RELATÓRIOS E INDICADORES" />
        <div className="p-3 space-y-3">
          {/* 9.1 Documentos */}
          <div>
            <SubSecao title="9.1 Documentos e relatórios" />
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-1 py-0.5 text-left w-28">Etapa vinculada</th>
                    <th className="border border-border px-1 py-0.5 text-left">Documento / Relatório</th>
                    <th className="border border-border px-1 py-0.5 text-left">Finalidade</th>
                    <th className="border border-border px-1 py-0.5 text-left">Formato</th>
                    <th className="border border-border px-1 py-0.5">Gerado auto?</th>
                    <th className="border border-border px-1 py-0.5 text-left">Quem acessa?</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_DOCUMENTOS.map((_, idx) => {
                    const row = getRow<{ etapa_vinculada?: string; documento?: string; finalidade?: string; formato?: string[]; gerado_auto?: boolean | null; quem_acessa?: string }>("documentos", idx, DEFAULT_DOCUMENTOS);
                    return (
                      <tr key={idx}>
                        <td className="border border-border px-1 py-0.5"><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("documentos", idx, { etapa_vinculada: v }, DEFAULT_DOCUMENTOS)} /></td>
                        <td className="border border-border px-1 py-0.5"><TxtInput value={row.documento ?? ""} disabled={!podeAgir} placeholder="documento" onChange={(v) => patchRow("documentos", idx, { documento: v }, DEFAULT_DOCUMENTOS)} /></td>
                        <td className="border border-border px-1 py-0.5"><TxtInput value={row.finalidade ?? ""} disabled={!podeAgir} placeholder="finalidade" onChange={(v) => patchRow("documentos", idx, { finalidade: v }, DEFAULT_DOCUMENTOS)} /></td>
                        <td className="border border-border px-1 py-0.5">
                          <div className="space-y-0.5">
                            {DOC_FORMATO.map((c) => (
                              <Chk key={c.k} checked={(row.formato ?? []).includes(c.k)} label={c.l} disabled={!podeAgir}
                                onChange={(v) => { const cur = row.formato ?? []; patchRow("documentos", idx, { formato: v ? [...cur, c.k] : cur.filter((x) => x !== c.k) }, DEFAULT_DOCUMENTOS); }} />
                            ))}
                          </div>
                        </td>
                        <td className="border border-border px-1 py-0.5 text-center">
                          <div className="flex flex-col gap-0.5 items-center">
                            <Radio checked={row.gerado_auto === true} label="S" disabled={!podeAgir} onChange={() => patchRow("documentos", idx, { gerado_auto: true }, DEFAULT_DOCUMENTOS)} />
                            <Radio checked={row.gerado_auto === false} label="N" disabled={!podeAgir} onChange={() => patchRow("documentos", idx, { gerado_auto: false }, DEFAULT_DOCUMENTOS)} />
                          </div>
                        </td>
                        <td className="border border-border px-1 py-0.5"><TxtInput value={row.quem_acessa ?? ""} disabled={!podeAgir} placeholder="quem acessa" onChange={(v) => patchRow("documentos", idx, { quem_acessa: v }, DEFAULT_DOCUMENTOS)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 9.2 Indicadores */}
          <div>
            <SubSecao title="9.2 Indicadores da solução" />
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-1 py-0.5 text-left w-28">Etapa vinculada</th>
                    <th className="border border-border px-1 py-0.5 text-left">Indicador</th>
                    <th className="border border-border px-1 py-0.5 text-left">Objetivo</th>
                    <th className="border border-border px-1 py-0.5 text-left">Fonte de dados</th>
                    <th className="border border-border px-1 py-0.5 text-left">Frequência</th>
                    <th className="border border-border px-1 py-0.5 text-left">Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_INDICADORES.map((_, idx) => {
                    const row = getRow<{ etapa_vinculada?: string; indicador?: string; objetivo?: string; fonte?: string; frequencia?: string; responsavel?: string }>("indicadores", idx, DEFAULT_INDICADORES);
                    return (
                      <tr key={idx}>
                        <td className="border border-border px-1 py-0.5"><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("indicadores", idx, { etapa_vinculada: v }, DEFAULT_INDICADORES)} /></td>
                        <td className="border border-border px-1 py-0.5"><TxtInput value={row.indicador ?? ""} disabled={!podeAgir} placeholder="indicador" onChange={(v) => patchRow("indicadores", idx, { indicador: v }, DEFAULT_INDICADORES)} /></td>
                        <td className="border border-border px-1 py-0.5"><TxtInput value={row.objetivo ?? ""} disabled={!podeAgir} placeholder="objetivo" onChange={(v) => patchRow("indicadores", idx, { objetivo: v }, DEFAULT_INDICADORES)} /></td>
                        <td className="border border-border px-1 py-0.5"><TxtInput value={row.fonte ?? ""} disabled={!podeAgir} placeholder="fonte" onChange={(v) => patchRow("indicadores", idx, { fonte: v }, DEFAULT_INDICADORES)} /></td>
                        <td className="border border-border px-1 py-0.5"><TxtInput value={row.frequencia ?? ""} disabled={!podeAgir} placeholder="frequência" onChange={(v) => patchRow("indicadores", idx, { frequencia: v }, DEFAULT_INDICADORES)} /></td>
                        <td className="border border-border px-1 py-0.5"><TxtInput value={row.responsavel ?? ""} disabled={!podeAgir} placeholder="responsável" onChange={(v) => patchRow("indicadores", idx, { responsavel: v }, DEFAULT_INDICADORES)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 10 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={10} title="PREMISSAS, RESTRIÇÕES, DEPENDÊNCIAS E RISCOS" />
        <div className="p-3 overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="border border-border px-1 py-0.5 text-left">Tipo</th>
                <th className="border border-border px-1 py-0.5 text-left w-28">Etapa vinculada</th>
                <th className="border border-border px-1 py-0.5 text-left">Responsável</th>
                <th className="border border-border px-1 py-0.5 text-left">Impacto</th>
                <th className="border border-border px-1 py-0.5 text-left">Tratamento</th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_PREMISSAS.map((_, idx) => {
                const row = getRow<{ tipos?: string[]; etapa_vinculada?: string; responsavel?: string; impacto?: string; tratamento?: string }>("premissas", idx, DEFAULT_PREMISSAS);
                return (
                  <tr key={idx}>
                    <td className="border border-border px-1 py-0.5">
                      <div className="space-y-0.5">
                        {PREMISSA_TIPOS.map((c) => (
                          <Chk key={c.k} checked={(row.tipos ?? []).includes(c.k)} label={c.l} disabled={!podeAgir}
                            onChange={(v) => { const cur = row.tipos ?? []; patchRow("premissas", idx, { tipos: v ? [...cur, c.k] : cur.filter((x) => x !== c.k) }, DEFAULT_PREMISSAS); }} />
                        ))}
                      </div>
                    </td>
                    <td className="border border-border px-1 py-0.5"><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("premissas", idx, { etapa_vinculada: v }, DEFAULT_PREMISSAS)} /></td>
                    <td className="border border-border px-1 py-0.5"><TxtInput value={row.responsavel ?? ""} disabled={!podeAgir} placeholder="responsável" onChange={(v) => patchRow("premissas", idx, { responsavel: v }, DEFAULT_PREMISSAS)} /></td>
                    <td className="border border-border px-1 py-0.5">
                      <div className="space-y-0.5">
                        {IMPACTO_OPCOES.map((c) => (
                          <Radio key={c.k} checked={row.impacto === c.k} label={c.l} disabled={!podeAgir}
                            onChange={() => patchRow("premissas", idx, { impacto: row.impacto === c.k ? undefined : c.k }, DEFAULT_PREMISSAS)} />
                        ))}
                      </div>
                    </td>
                    <td className="border border-border px-1 py-0.5"><TxtInput value={row.tratamento ?? ""} disabled={!podeAgir} placeholder="tratamento" onChange={(v) => patchRow("premissas", idx, { tratamento: v }, DEFAULT_PREMISSAS)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SEÇÃO 11 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={11} title="CRITÉRIOS DE HOMOLOGAÇÃO" />
        <div className="p-3 space-y-3">
          {/* 11.1 Critérios por etapa */}
          <div>
            <SubSecao title="11.1 Critérios por etapa" />
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-1 py-0.5 text-left w-28">Etapa vinculada</th>
                    <th className="border border-border px-1 py-0.5 text-left">O que deverá ser validado na homologação?</th>
                    <th className="border border-border px-1 py-0.5 text-left">Resultado esperado</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_CRITERIOS_ETAPA.map((_, idx) => {
                    const row = getRow<{ etapa_vinculada?: string; criterio?: string; resultado?: string }>("criterios_etapa", idx, DEFAULT_CRITERIOS_ETAPA);
                    return (
                      <tr key={idx}>
                        <td className="border border-border px-1 py-0.5"><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("criterios_etapa", idx, { etapa_vinculada: v }, DEFAULT_CRITERIOS_ETAPA)} /></td>
                        <td className="border border-border px-1 py-0.5"><TxtInput value={row.criterio ?? ""} disabled={!podeAgir} placeholder="critério" onChange={(v) => patchRow("criterios_etapa", idx, { criterio: v }, DEFAULT_CRITERIOS_ETAPA)} /></td>
                        <td className="border border-border px-1 py-0.5"><TxtInput value={row.resultado ?? ""} disabled={!podeAgir} placeholder="resultado esperado" onChange={(v) => patchRow("criterios_etapa", idx, { resultado: v }, DEFAULT_CRITERIOS_ETAPA)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 11.2 Itens obrigatórios */}
          <div><SubSecao title="11.2 Itens obrigatórios para homologação" /><ChkGroup field="itens_homologacao" opcoes={ITENS_HOMOLOGACAO} cols={1} /></div>

          {/* 11.3 Regra (read-only) */}
          <div>
            <SubSecao title="11.3 Regra de homologação" />
            <ul className="text-[10px] text-muted-foreground list-disc list-inside space-y-0.5">
              <li>A solução somente poderá ser homologada quando atender ao escopo aprovado.</li>
              <li>Bug deverá impedir a homologação até sua correção.</li>
              <li>Solicitação de Melhoria não deverá impedir a homologação da entrega atual, desde que represente evolução, ampliação ou alteração fora do escopo originalmente aprovado.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 12 ── */}
      <div className="rounded-md border border-border overflow-hidden">
        <Secao num={12} title="VALIDAÇÃO DO DFD" />
        <div className="p-3 space-y-3">
          <div>
            <SubSecao title="Situação final do DFD" />
            <RadioGroup field="situacao" opcoes={SITUACAO_DFD} />
          </div>
          <div>
            <SubSecao title="Observações finais" />
            <Textarea value={dfd.observacoes_finais ?? ""} disabled={!podeAgir} placeholder="Observações..."
              className="min-h-[60px] text-[11px]" onChange={(e) => patch({ observacoes_finais: e.target.value })} />
          </div>
        </div>
      </div>

      {/* ── BOTÕES ── */}
      <div className="flex gap-2">
        <Button className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "analise_tecnica" })}>
          <ArrowRight className="h-3.5 w-3.5" /> Avançar para Análise Técnica
        </Button>
        <Button variant="outline" className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "analise_necessidade" })}>
          <Undo2 className="h-3.5 w-3.5" /> Retornar para Análise de Necessidade
        </Button>
      </div>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só a Controladoria age nesta etapa.</p>}
    </div>
  );
}
