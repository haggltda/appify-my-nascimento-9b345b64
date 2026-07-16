import { createContext, useContext, useEffect, useState } from "react";
import type { DfdDados, DfdEtapa, Solicitacao } from "./types";
import { CLASSIFICACAO_DEMANDA_OPCOES, TIPO_SOLICITACAO_LABEL, sdNumero } from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

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
  { k: "informacao_incompleta", l: "Informação incompleta" }, { k: "documento_incorreto", l: "Documento incorreto" },
  { k: "reprovacao", l: "Reprovação" }, { k: "necessidade_ajuste", l: "Necessidade de ajuste" },
  { k: "falta_aprovacao", l: "Falta de aprovação" }, { k: "divergencia_dados", l: "Divergência de dados" },
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
  { k: "registrar", l: "Registrar" }, { k: "validar", l: "Validar" }, { k: "aprovar", l: "Aprovar" },
  { k: "notificar", l: "Notificar" }, { k: "gerar_doc", l: "Gerar doc." }, { k: "integrar", l: "Integrar" }, { k: "encerrar", l: "Encerrar" },
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
const VALIDACOES_AREAS = [
  { area: "Supervisão de Processos", simNao: ["validado", "retornar_ajuste"] },
  { area: "Área Solicitante", simNao: ["validado", "retornar_ajuste"] },
  { area: "Usuário-chave", simNao: ["validado", "retornar_ajuste"] },
  { area: "Tecnologia da Informação", simNao: ["ciencia", "solicita_ajuste"] },
  { area: "Controladoria, quando aplicável", simNao: ["ciencia", "solicita_ajuste"] },
];
const DEFAULT_PERMISSOES = [
  "Presidência", "Diretor", "Gerente", "Supervisor", "Analista",
  "Assistente", "Colaborador", "Terceiro / Prestador CNPJ", "Outro",
].map((perfil) => ({ perfil }));

// ── Helpers de estilo ─────────────────────────────────────────────────────────

const S = {
  secao: "bg-[#153169] text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide",
  sub: "text-[11px] font-semibold text-[#153169] border-b border-gray-200 pb-0.5 mb-1.5 uppercase tracking-wide",
  th: "border border-gray-300 bg-gray-50 px-1.5 py-1 text-[10px] font-semibold text-center text-gray-600 whitespace-nowrap",
  td: "border border-gray-300 px-1.5 py-1 text-[10px] text-center align-middle",
  tdl: "border border-gray-300 px-1.5 py-1 text-[10px] align-middle",
  campo: "text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5",
  celBorder: "border-r border-gray-200 last:border-r-0 px-2 py-1.5",
};

// ── Contexto (evita redefinição de componentes a cada render → mantém foco) ───

interface DfdCtxValue {
  ro: boolean;
  d: DfdDados;
  patch: (p: Partial<DfdDados>) => void;
  hasArr: (field: keyof DfdDados, key: string) => boolean;
  toggleArr: (field: keyof DfdDados, key: string, checked: boolean) => void;
}
const DfdCtx = createContext<DfdCtxValue>(null!);

// ── Primitivos (fora do componente principal para identidade estável) ─────────

function Chk({ field, k, label }: { field: keyof DfdDados; k: string; label: string }) {
  const { ro, hasArr, toggleArr } = useContext(DfdCtx);
  const checked = hasArr(field, k);
  if (ro) return (
    <span className="flex items-start gap-1 text-[11px] leading-tight">
      <span className="flex-shrink-0 mt-px">{checked ? "☑" : "☐"}</span>
      <span>{label}</span>
    </span>
  );
  return (
    <label className="flex items-start gap-1.5 text-[11px] leading-tight cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => toggleArr(field, k, e.target.checked)}
        className="mt-px h-3 w-3 flex-shrink-0 accent-[#153169]" />
      <span>{label}</span>
    </label>
  );
}

function ChkGrp({ field, opcoes, cols = 1 }: { field: keyof DfdDados; opcoes: { k: string; l: string }[]; cols?: number }) {
  return (
    <div className="grid gap-x-3 gap-y-0.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {opcoes.map(({ k, l }) => <Chk key={k} field={field} k={k} label={l} />)}
    </div>
  );
}

function RadioItem({ field, k, label }: { field: keyof DfdDados; k: string; label: string }) {
  const { ro, d, patch } = useContext(DfdCtx);
  const checked = (d[field] as string | undefined) === k;
  if (ro) return (
    <span className="flex items-center gap-1 text-[11px]">
      <span>{checked ? "●" : "○"}</span> {label}
    </span>
  );
  return (
    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
      <input type="radio" checked={checked}
        onChange={() => patch({ [field]: (d[field] as string | undefined) === k ? undefined : k } as Partial<DfdDados>)}
        className="h-3 w-3 flex-shrink-0 accent-[#153169]" />
      {label}
    </label>
  );
}

function TxtArea({ value, onChange, placeholder, rows = 2, className = "" }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; rows?: number; className?: string;
}) {
  const { ro } = useContext(DfdCtx);
  if (ro) return (
    <div className={`text-[11px] min-h-[2rem] whitespace-pre-wrap break-words ${className}`}>
      {value || <span className="text-gray-400">—</span>}
    </div>
  );
  return (
    <textarea value={value} rows={rows} placeholder={placeholder}
      className={`w-full rounded border border-gray-300 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#153169] resize-none ${className}`}
      onChange={(e) => onChange?.(e.target.value)} />
  );
}

function TxtInline({ value, onChange, placeholder, className = "" }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; className?: string;
}) {
  const { ro } = useContext(DfdCtx);
  if (ro) return <span className={`text-[11px] ${className}`}>{value || <span className="text-gray-400">—</span>}</span>;
  return (
    <input type="text" value={value} placeholder={placeholder}
      className={`h-6 w-full rounded border border-gray-300 px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#153169] ${className}`}
      onChange={(e) => onChange?.(e.target.value)} />
  );
}

function MatChk({ checked, onChange }: { checked: boolean; onChange?: (v: boolean) => void }) {
  const { ro } = useContext(DfdCtx);
  if (ro) return <span className="text-[12px]">{checked ? "☑" : "☐"}</span>;
  return <input type="checkbox" checked={checked} onChange={(e) => onChange?.(e.target.checked)}
    className="h-3 w-3 accent-[#153169]" />;
}

function EtapaSelect({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const { ro, d } = useContext(DfdCtx);
  const label = (v: string | undefined) => {
    const e = (d.etapas ?? []).find((x) => x.codigo === v);
    return e ? `${e.codigo} – ${e.descricao}` : (v ?? "—");
  };
  if (ro) return <span className="text-[11px]">{label(value)}</span>;
  return (
    <select value={value ?? ""} onChange={(e) => onChange?.(e.target.value)}
      className="h-6 w-full rounded border border-gray-300 bg-white px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#153169]">
      <option value="">—</option>
      {(d.etapas ?? []).map((e) => <option key={e.codigo} value={e.codigo}>{e.codigo} – {e.descricao}</option>)}
    </select>
  );
}

function BoolRadio({ checked, onChange, sim = "Sim", nao = "Não" }: { checked: boolean | null | undefined; onChange?: (v: boolean) => void; sim?: string; nao?: string }) {
  const { ro } = useContext(DfdCtx);
  if (ro) return (
    <div className="flex gap-3">
      <span className="text-[11px]">{checked === true ? "●" : "○"} {sim}</span>
      <span className="text-[11px]">{checked === false ? "●" : "○"} {nao}</span>
    </div>
  );
  return (
    <div className="flex gap-3">
      <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="radio" checked={checked === true} onChange={() => onChange?.(true)} className="h-3 w-3 accent-[#153169]" /> {sim}</label>
      <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="radio" checked={checked === false} onChange={() => onChange?.(false)} className="h-3 w-3 accent-[#153169]" /> {nao}</label>
    </div>
  );
}

// ── Interface ─────────────────────────────────────────────────────────────────

export interface DfdDocumentoProps {
  dados: DfdDados;
  card: Solicitacao;
  isReadOnly: boolean;
  onPatch?: (dados: DfdDados) => void;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function DfdDocumento({ dados, card, isReadOnly: ro, onPatch }: DfdDocumentoProps) {
  const [d, setD] = useState<DfdDados>(dados);
  useEffect(() => { setD(dados); }, [dados]);

  function patch(p: Partial<DfdDados>) {
    if (ro) return;
    const novo = { ...d, ...p };
    setD(novo);
    onPatch?.(novo);
  }
  function toggleArr(field: keyof DfdDados, key: string, checked: boolean) {
    const cur = (d[field] as string[] | undefined) ?? [];
    patch({ [field]: checked ? [...cur, key] : cur.filter((k) => k !== key) });
  }
  function hasArr(field: keyof DfdDados, key: string) {
    return ((d[field] as string[] | undefined) ?? []).includes(key);
  }
  function patchMatriz(codigo: string, key: string, val: boolean) {
    patch({ matriz: { ...(d.matriz ?? {}), [codigo]: { ...(d.matriz?.[codigo] ?? {}), [key]: val } } });
  }
  function patchRow<T extends object>(
    field: "regras_negocio" | "acoes" | "permissoes" | "integracoes" | "documentos" | "indicadores" | "premissas" | "criterios_etapa" | "validacoes_dfd",
    idx: number, p: Partial<T>, defLen: number,
  ) {
    const base = (d[field] as T[] | undefined) ?? Array(defLen).fill({}) as T[];
    const padded = base.length > idx ? [...base] : [...base, ...Array(idx - base.length + 1).fill({}) as T[]];
    const novo = padded.map((item, i) => (i === idx ? { ...item, ...p } : item));
    patch({ [field]: novo });
  }
  function getRow<T extends object>(
    field: "regras_negocio" | "acoes" | "permissoes" | "integracoes" | "documentos" | "indicadores" | "premissas" | "criterios_etapa" | "validacoes_dfd",
    idx: number, defLen: number, defVal?: Partial<T>,
  ): T {
    const base = (d[field] as T[] | undefined) ?? [];
    return (base[idx] as T | undefined) ?? ({ ...(defVal ?? {}) } as T);
  }

  // ── Helpers de layout ────────────────────────────────────────────────────

  function Secao({ num, title }: { num?: number; title: string }) {
    return (
      <div className={S.secao}>
        {num != null ? `${num}. ${title}` : title}
      </div>
    );
  }

  function Sub({ title, className = "" }: { title: string; className?: string }) {
    return <p className={`${S.sub} ${className}`}>{title}</p>;
  }

  const tipoDemanda = card.classificacao_demanda?.length
    ? card.classificacao_demanda.map((v) => CLASSIFICACAO_DEMANDA_OPCOES.find((o) => o.value === v)?.label ?? v).join(", ")
    : (card.tipo_solicitacao ? (TIPO_SOLICITACAO_LABEL[card.tipo_solicitacao] ?? card.tipo_solicitacao) : null);

  const etapas: DfdEtapa[] = d.etapas ?? [];

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <DfdCtx.Provider value={{ ro, d, patch, hasArr, toggleArr }}>
    <div className="text-[11px] font-[Arial,sans-serif] border border-gray-300 rounded">

      {/* ── CABEÇALHO ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-300 bg-white">
        <div className="flex items-center gap-3">
          {/* Triângulo laranja CSS */}
          <div style={{ width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderBottom: "21px solid #E55B00", flexShrink: 0 }} />
          <span className="font-bold text-[13px] uppercase tracking-wide text-gray-900">ANEXO II – DOCUMENTO FUNCIONAL DA DEMANDA (DFD)</span>
        </div>
        <div className="text-right border border-gray-400 px-2 py-0.5 min-w-[110px]">
          <p className="text-[9px] font-semibold uppercase text-gray-500">Nº da Solicitação</p>
          <p className="text-[13px] font-bold text-[#153169]">{sdNumero(card)}</p>
        </div>
      </div>

      {/* Grade de identificação */}
      <div className="border-b border-gray-300">
        <div className="grid grid-cols-4 divide-x divide-gray-300">
          <div className="px-2 py-1">
            <p className={S.campo}>Número da Demanda:</p>
            <p className="text-[11px] font-semibold">{sdNumero(card)}</p>
          </div>
          <div className="px-2 py-1">
            <p className={S.campo}>Área Solicitante:</p>
            <p className="text-[11px]">{card.area_solicitante ?? "—"}</p>
          </div>
          <div className="px-2 py-1">
            <p className={S.campo}>Responsável pela Solicitação:</p>
            <p className="text-[11px]">{card.responsavel_solicitacao ?? "—"}</p>
          </div>
          <div className="px-2 py-1">
            <p className={S.campo}>Usuário-chave indicado:</p>
            <TxtInline value={d.usuario_chave ?? ""} onChange={(v) => patch({ usuario_chave: v })} placeholder="Nome do usuário-chave" />
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-gray-300 border-t border-gray-300">
          <div className="px-2 py-1">
            <p className={S.campo}>Tipo da Demanda:</p>
            <p className="text-[11px]">{tipoDemanda ?? "—"}</p>
          </div>
          <div className="px-2 py-1">
            <p className={S.campo}>Objetivo da Demanda:</p>
            <TxtArea value={d.objetivo ?? ""} onChange={(v) => patch({ objetivo: v })} placeholder="Descreva o objetivo..." rows={2} />
          </div>
        </div>
        <div className="px-2 py-1 border-t border-gray-300">
          <p className={S.campo}>Justificativa:</p>
          <TxtArea value={d.justificativa ?? ""} onChange={(v) => patch({ justificativa: v })} placeholder="Descreva a justificativa..." rows={2} />
        </div>
      </div>

      {/* ── SEÇÃO 1 ────────────────────────────────────────────────────────── */}
      <Secao num={1} title="ESCOPO FUNCIONAL DA SOLUÇÃO" />
      {/* 1.1 / 1.2 / 1.3 */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-300">
        <div className="p-2">
          <Sub title="1.1 Tipo de solução" />
          <ChkGrp field="tipo_solucao" opcoes={TIPO_SOLUCAO} />
        </div>
        <div className="p-2">
          <Sub title="1.2 Módulos impactados" />
          <ChkGrp field="modulos_impactados" opcoes={MODULOS} />
        </div>
        <div className="p-2">
          <Sub title="1.3 O que a solução deverá contemplar?" />
          <ChkGrp field="contemplar" opcoes={CONTEMPLAR} />
        </div>
      </div>
      {/* 1.4 / 1.5 / 1.6 */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-300">
        <div className="p-2">
          <Sub title="1.4 Principal entrega esperada" />
          <p className="text-[10px] text-gray-500 mb-1">Marcar apenas uma opção principal.</p>
          <div className="flex flex-col gap-0.5">
            {ENTREGA_PRINCIPAL.map(({ k, l }) => <RadioItem key={k} field="entrega_principal" k={k} label={l} />)}
          </div>
        </div>
        <div className="p-2">
          <Sub title="1.5 Tipo de informação controlada" />
          <ChkGrp field="tipo_info_controlada" opcoes={TIPO_INFO_CONTROLADA} cols={2} />
        </div>
        <div className="p-2">
          <Sub title="1.6 Escopo negativo" />
          <p className="text-[10px] text-gray-500 mb-1">O que NÃO fará parte desta entrega?</p>
          <ChkGrp field="escopo_negativo" opcoes={ESCOPO_NEGATIVO} />
        </div>
      </div>
      {/* 1.7 */}
      <div className="p-2 border-b border-gray-300">
        <Sub title="1.7 Item excluído que deverá virar Solicitação de Melhoria futura?" />
        <div className="flex gap-4 mb-2">
          {[{ k: "sim", l: "Sim" }, { k: "nao", l: "Não" }, { k: "nao_identificado", l: "Não identificado no momento" }].map(({ k, l }) => (
            <RadioItem key={k} field="item_excluido" k={k} label={l} />
          ))}
        </div>
        {(d.item_excluido === "sim" || (ro && d.item_excluido_tipos && d.item_excluido_tipos.length > 0)) && (
          <div className="border-t border-gray-200 pt-1.5 mt-1">
            <p className="text-[10px] text-gray-500 mb-1">Se SIM:</p>
            <ChkGrp field="item_excluido_tipos" opcoes={ITEM_EXCLUIDO_TIPOS} cols={3} />
          </div>
        )}
      </div>

      {/* ── SEÇÃO 2 ────────────────────────────────────────────────────────── */}
      <Secao num={2} title="MAPA DAS ETAPAS DO PROCESSO" />
      <div className="grid grid-cols-4 divide-x divide-gray-200 border-b border-gray-300">
        {/* 2.1 */}
        <div className="p-2">
          <Sub title="2.1 Mapa das etapas" />
          <p className="text-[10px] text-gray-500 mb-1">Adicione as etapas do processo de E1 até En.</p>
          <table className="w-full border-collapse text-[10px] mb-1">
            <thead>
              <tr>
                <th className={S.th + " w-10"}>Código</th>
                <th className={S.th}>Descrição da Etapa</th>
                {!ro && <th className={S.th + " w-8"}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {etapas.length === 0 && (
                <tr><td colSpan={ro ? 2 : 3} className="text-center text-gray-400 py-2 text-[10px] border border-gray-200">Nenhuma etapa cadastrada.</td></tr>
              )}
              {etapas.map((e, idx) => (
                <tr key={idx}>
                  <td className={S.td}>
                    {ro ? e.codigo : (
                      <input type="text" value={e.codigo} placeholder="E1"
                        className="h-5 w-full border border-gray-300 rounded px-1 text-[10px]"
                        onChange={(ev) => { const novo = [...etapas]; novo[idx] = { ...novo[idx], codigo: ev.target.value }; patch({ etapas: novo }); }} />
                    )}
                  </td>
                  <td className={S.tdl}>
                    {ro ? e.descricao : (
                      <input type="text" value={e.descricao} placeholder="Descrição"
                        className="h-5 w-full border border-gray-300 rounded px-1 text-[10px]"
                        onChange={(ev) => { const novo = [...etapas]; novo[idx] = { ...novo[idx], descricao: ev.target.value }; patch({ etapas: novo }); }} />
                    )}
                  </td>
                  {!ro && (
                    <td className={S.td}>
                      <button type="button" onClick={() => { const novo = etapas.filter((_, i) => i !== idx); patch({ etapas: novo }); }}
                        className="text-red-500 hover:text-red-700 text-[12px]">✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!ro && (
            <button type="button" onClick={() => patch({ etapas: [...etapas, { codigo: `E${etapas.length + 1}`, descricao: "" }] })}
              className="text-[10px] text-[#153169] hover:underline font-semibold">+ Adicionar etapa</button>
          )}
        </div>
        {/* 2.2 */}
        <div className="p-2 col-span-1">
          <Sub title="2.2 Início do processo" />
          <p className="text-[10px] text-gray-500 mb-1">Quem inicia o processo?</p>
          <ChkGrp field="quem_inicia" opcoes={QUEM_INICIA} />
          <p className="text-[10px] text-gray-500 mt-2 mb-1">Como o processo inicia?</p>
          <ChkGrp field="como_inicia" opcoes={COMO_INICIA} />
        </div>
        {/* 2.3 */}
        <div className="p-2">
          <Sub title="2.3 Retorno entre etapas" />
          <p className="text-[10px] text-gray-500 mb-1">O processo poderá retornar para etapa anterior?</p>
          <div className="flex gap-3 mb-2">
            <RadioItem field="tem_retorno" k="sim" label="Sim" />
            <RadioItem field="tem_retorno" k="nao" label="Não" />
          </div>
          {(d.tem_retorno === "sim" || (ro && d.retorno_motivos && d.retorno_motivos.length > 0)) && (
            <>
              <p className="text-[10px] text-gray-500 mb-1">Se SIM:</p>
              <ChkGrp field="retorno_motivos" opcoes={RETORNO_MOTIVOS} />
            </>
          )}
        </div>
        {/* 2.4 */}
        <div className="p-2">
          <Sub title="2.4 Encerramento do processo" />
          <p className="text-[10px] text-gray-500 mb-1">O processo será encerrado quando:</p>
          <ChkGrp field="encerramento" opcoes={ENCERRAMENTO} />
        </div>
      </div>

      {/* ── SEÇÃO 3 ────────────────────────────────────────────────────────── */}
      <Secao num={3} title="MATRIZ FUNCIONAL POR ETAPA" />
      <div className="p-2 border-b border-gray-300 overflow-x-auto">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th rowSpan={2} className={S.th + " w-28 text-left"}>Etapa</th>
              <th colSpan={7} className={S.th}>O sistema deverá?</th>
              <th colSpan={2} className={S.th}>Gera histórico?</th>
              <th colSpan={2} className={S.th}>Gera notificação?</th>
              <th colSpan={3} className={S.th}>Bloqueia avanço?</th>
            </tr>
            <tr>
              {MATRIZ_COLS.map((c) => <th key={c.k} className={S.th}>{c.l}</th>)}
              <th className={S.th}>Sim</th><th className={S.th}>Não</th>
              <th className={S.th}>Sim</th><th className={S.th}>Não</th>
              <th className={S.th}>Sim</th><th className={S.th}>Não</th><th className={S.th}>Outro</th>
            </tr>
          </thead>
          <tbody>
            {etapas.length === 0 && (
              <tr><td colSpan={15} className="text-center text-gray-400 py-2 italic border border-gray-200">Nenhuma etapa cadastrada.</td></tr>
            )}
            {etapas.map((e, idx) => {
              const row = (d.matriz?.[e.codigo] ?? {}) as Record<string, boolean>;
              return (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className={S.tdl + " text-[10px] font-medium"}>{e.codigo} – {e.descricao}</td>
                  {MATRIZ_COLS.map((c) => (
                    <td key={c.k} className={S.td}>
                      <MatChk checked={!!row[c.k]} onChange={(v) => patchMatriz(e.codigo, c.k, v)} />
                    </td>
                  ))}
                  <td className={S.td}><MatChk checked={!!row.gera_historico} onChange={(v) => patchMatriz(e.codigo, "gera_historico", v)} /></td>
                  <td className={S.td}><MatChk checked={!row.gera_historico && !!row.gera_historico_n} onChange={(v) => patchMatriz(e.codigo, "gera_historico_n", v)} /></td>
                  <td className={S.td}><MatChk checked={!!row.gera_notificacao} onChange={(v) => patchMatriz(e.codigo, "gera_notificacao", v)} /></td>
                  <td className={S.td}><MatChk checked={!row.gera_notificacao && !!row.gera_notificacao_n} onChange={(v) => patchMatriz(e.codigo, "gera_notificacao_n", v)} /></td>
                  <td className={S.td}><MatChk checked={!!row.bloqueia_avanco} onChange={(v) => patchMatriz(e.codigo, "bloqueia_avanco", v)} /></td>
                  <td className={S.td}><MatChk checked={!row.bloqueia_avanco && !row.bloqueia_outro} onChange={(v) => patchMatriz(e.codigo, "bloqueia_nao", v)} /></td>
                  <td className={S.td}><MatChk checked={!!row.bloqueia_outro} onChange={(v) => patchMatriz(e.codigo, "bloqueia_outro", v)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── SEÇÃO 4 ────────────────────────────────────────────────────────── */}
      <Secao num={4} title="REGRAS DE NEGÓCIO E VALIDAÇÕES" />
      {/* 4.1 Tabela */}
      <div className="p-2 border-b border-gray-200 overflow-x-auto">
        <Sub title="4.1 Matriz de regras por etapa" />
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className={S.th + " w-20"}>Etapa</th>
              <th className={S.th + " w-20"}>Tipo</th>
              <th className={S.th}>Regra / Validação / Aprovação</th>
              <th className={S.th + " w-24"}>Responsável</th>
              <th colSpan={10} className={S.th}>O que acontece se não cumprir?</th>
            </tr>
            <tr>
              <th className={S.th} /><th className={S.th} /><th className={S.th} /><th className={S.th} />
              {REGRAS_ACOES_COLS.map((c) => <th key={c.k} className={S.th}>{c.l}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array(5).fill(null).map((_, idx) => {
              const row = getRow<any>("regras_negocio", idx, 5);
              return (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className={S.td}><EtapaSelect value={row.etapa} onChange={(v) => patchRow("regras_negocio", idx, { etapa: v }, 5)} /></td>
                  <td className={S.td}>
                    <TxtInline value={row.tipo ?? ""} onChange={(v) => patchRow("regras_negocio", idx, { tipo: v }, 5)} />
                  </td>
                  <td className={S.tdl}>
                    <TxtInline value={row.regra ?? ""} onChange={(v) => patchRow("regras_negocio", idx, { regra: v }, 5)} />
                  </td>
                  <td className={S.td}>
                    <TxtInline value={row.responsavel ?? ""} onChange={(v) => patchRow("regras_negocio", idx, { responsavel: v }, 5)} />
                  </td>
                  {REGRAS_ACOES_COLS.map((c) => (
                    <td key={c.k} className={S.td}>
                      <MatChk checked={!!(row.acoes ?? []).includes(c.k)}
                        onChange={(v) => {
                          const cur: string[] = row.acoes ?? [];
                          patchRow("regras_negocio", idx, { acoes: v ? [...cur, c.k] : cur.filter((x) => x !== c.k) }, 5);
                        }} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* 4.2 / 4.3 */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-300">
        <div className="p-2">
          <Sub title="4.2 Tipos de regras necessárias" />
          <p className="text-[10px] text-gray-500 mb-1">A solução deverá possuir regras sobre:</p>
          <ChkGrp field="regras_sobre" opcoes={REGRAS_SOBRE} />
        </div>
        <div className="p-2 col-span-2">
          <Sub title="4.3 Prazos e SLAs do processo" />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-gray-500 mb-1">O processo terá controle de prazo?</p>
              <RadioItem field="tem_prazo" k="sim" label="Sim" />
              <RadioItem field="tem_prazo" k="nao" label="Não" />
              <RadioItem field="tem_prazo" k="nao_identificado" label="Não identificado no momento" />
              <p className="text-[10px] text-gray-500 mt-2 mb-1">O prazo será definido por:</p>
              <ChkGrp field="prazo_definido_por" opcoes={PRAZO_DEFINIDO_POR} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 mb-1">Quais prazos deverão ser controlados?</p>
              <ChkGrp field="prazos_controlados" opcoes={PRAZOS_CONTROLADOS} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 mb-1">O sistema deverá alertar quando?</p>
              <ChkGrp field="alertar_quando" opcoes={ALERTAR_QUANDO} />
              <p className="text-[10px] text-gray-500 mt-2 mb-1">Quando o prazo vencer, o sistema deverá:</p>
              <ChkGrp field="prazo_vence" opcoes={PRAZO_VENCE} />
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 5 ────────────────────────────────────────────────────────── */}
      <Secao num={5} title="FUNCIONALIDADES E AÇÕES SISTÊMICAS" />
      <div className="grid divide-x divide-gray-200 border-b border-gray-300" style={{ gridTemplateColumns: "1fr 3fr" }}>
        <div className="p-2">
          <Sub title="5.1 Funcionalidades gerais" />
          <p className="text-[10px] text-gray-500 mb-1">A solução deverá permitir:</p>
          <ChkGrp field="funcionalidades" opcoes={FUNCIONALIDADES} />
        </div>
        <div className="p-2 overflow-x-auto">
          <Sub title="5.2 Detalhamento das ações" />
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={S.th}>Ação</th>
                <th className={S.th}>Etapa vinculada</th>
                <th colSpan={6} className={S.th}>Quem poderá executar</th>
                <th colSpan={2} className={S.th}>Precisa aprovação?</th>
                <th colSpan={2} className={S.th}>Gera histórico?</th>
              </tr>
              <tr>
                <th className={S.th} /><th className={S.th} />
                {ACOES_EXECUTORES.map((c) => <th key={c.k} className={S.th}>{c.l}</th>)}
                <th className={S.th}>Sim</th><th className={S.th}>Não</th>
                <th className={S.th}>Sim</th><th className={S.th}>Não</th>
              </tr>
            </thead>
            <tbody>
              {Array(5).fill(null).map((_, idx) => {
                const row = getRow<any>("acoes", idx, 5);
                const execs: string[] = row.executores ?? [];
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={S.tdl}>
                      <TxtInline value={row.acao ?? ""} onChange={(v) => patchRow("acoes", idx, { acao: v }, 5)} />
                    </td>
                    <td className={S.td}><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("acoes", idx, { etapa_vinculada: v }, 5)} /></td>
                    {ACOES_EXECUTORES.map((c) => (
                      <td key={c.k} className={S.td}>
                        <MatChk checked={execs.includes(c.k)}
                          onChange={(v) => patchRow("acoes", idx, { executores: v ? [...execs, c.k] : execs.filter((x) => x !== c.k) }, 5)} />
                      </td>
                    ))}
                    <td className={S.td}><MatChk checked={row.precisa_aprovacao === true} onChange={(v) => patchRow("acoes", idx, { precisa_aprovacao: v ? true : null }, 5)} /></td>
                    <td className={S.td}><MatChk checked={row.precisa_aprovacao === false} onChange={(v) => patchRow("acoes", idx, { precisa_aprovacao: v ? false : null }, 5)} /></td>
                    <td className={S.td}><MatChk checked={row.gera_historico === true} onChange={(v) => patchRow("acoes", idx, { gera_historico: v ? true : null }, 5)} /></td>
                    <td className={S.td}><MatChk checked={row.gera_historico === false} onChange={(v) => patchRow("acoes", idx, { gera_historico: v ? false : null }, 5)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-300">
        <div className="p-2">
          <Sub title="5.3 Resultado automático da funcionalidade" />
          <p className="text-[10px] text-gray-500 mb-1">A funcionalidade deverá gerar automaticamente:</p>
          <ChkGrp field="resultado_automatico" opcoes={RESULTADO_AUTOMATICO} cols={2} />
        </div>
        <div className="p-2">
          <Sub title="5.4 Condições para funcionamento da funcionalidade" />
          <p className="text-[10px] text-gray-500 mb-1">A funcionalidade dependerá de:</p>
          <ChkGrp field="condicoes" opcoes={CONDICOES} cols={2} />
        </div>
      </div>

      {/* ── SEÇÃO 6 ────────────────────────────────────────────────────────── */}
      <Secao num={6} title="INTERFACE, NAVEGAÇÃO E INTEGRAÇÕES" />
      <div className="grid grid-cols-4 divide-x divide-gray-200 border-b border-gray-300">
        <div className="p-2">
          <Sub title="6.1 Estrutura da interface" />
          <ChkGrp field="estrutura_interface" opcoes={ESTRUTURA_INTERFACE} />
        </div>
        <div className="p-2">
          <Sub title="6.2 Navegação" />
          <ChkGrp field="navegacao" opcoes={NAVEGACAO} />
        </div>
        <div className="p-2">
          <Sub title="6.3 Elementos visuais sugeridos" />
          <ChkGrp field="elementos_visuais" opcoes={ELEMENTOS_VISUAIS} />
        </div>
        <div className="p-2">
          <Sub title="6.4 Referência de outro sistema, se houver" />
          <ChkGrp field="referencia_sistemas" opcoes={REFERENCIA_SISTEMA} />
          <p className="text-[10px] text-gray-500 mt-2 mb-0.5">Qual funcionalidade serve como referência?</p>
          <TxtArea value={d.referencia_outro_sistema ?? ""} onChange={(v) => patch({ referencia_outro_sistema: v })} rows={2} />
        </div>
      </div>

      {/* ── SEÇÃO 7 ────────────────────────────────────────────────────────── */}
      <Secao num={7} title="PERFIS E PERMISSÕES DE ACESSO" />
      <div className="grid divide-x divide-gray-200 border-b border-gray-300" style={{ gridTemplateColumns: "1fr 4fr 1fr" }}>
        <div className="p-2">
          <Sub title="7.1 Perfis envolvidos" />
          <ChkGrp field="perfis" opcoes={PERFIS_ENVOLVIDOS} />
        </div>
        <div className="p-2 overflow-x-auto">
          <Sub title="7.2 Matrix resumida de permissões" />
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={S.th}>Perfil</th>
                <th className={S.th}>Etapa vinculada</th>
                {PERMISSOES_COLS.map((c) => <th key={c.k} className={S.th}>{c.l}</th>)}
              </tr>
            </thead>
            <tbody>
              {DEFAULT_PERMISSOES.map((def, idx) => {
                const row = getRow<any>("permissoes", idx, DEFAULT_PERMISSOES.length, def);
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={S.tdl + " font-medium"}>{row.perfil ?? def.perfil}</td>
                    <td className={S.td}><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("permissoes", idx, { etapa_vinculada: v }, DEFAULT_PERMISSOES.length)} /></td>
                    {PERMISSOES_COLS.map((c) => (
                      <td key={c.k} className={S.td}>
                        <MatChk checked={!!row[c.k]}
                          onChange={(v) => patchRow("permissoes", idx, { [c.k]: v }, DEFAULT_PERMISSOES.length)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-2">
          <Sub title="7.3 Restrições de acesso" />
          <ChkGrp field="restricoes_acesso" opcoes={RESTRICOES_ACESSO} />
        </div>
      </div>

      {/* ── SEÇÃO 8 ────────────────────────────────────────────────────────── */}
      <Secao num={8} title="INTEGRAÇÕES" />
      <div className="grid divide-x divide-gray-200 border-b border-gray-300" style={{ gridTemplateColumns: "1fr 4fr" }}>
        <div className="p-2">
          <Sub title="A solução terá integração?" />
          <RadioItem field="tem_integracao" k="sim" label="Sim" />
          <RadioItem field="tem_integracao" k="nao" label="Não" />
          <RadioItem field="tem_integracao" k="nao_identificado" label="Não identificado no momento" />
        </div>
        <div className="p-2 overflow-x-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={S.th}>Etapa vinculada</th>
                <th className={S.th}>Sistema / Base</th>
                <th className={S.th}>Tipo de integração</th>
                <th className={S.th}>Dados compartilhados</th>
                <th className={S.th}>Frequência</th>
                <th className={S.th}>Tratamento em caso de falha</th>
              </tr>
            </thead>
            <tbody>
              {Array(2).fill(null).map((_, idx) => {
                const row = getRow<any>("integracoes", idx, 2);
                const tipos: string[] = row.tipo ?? [];
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={S.td}><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("integracoes", idx, { etapa_vinculada: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.sistema ?? ""} onChange={(v) => patchRow("integracoes", idx, { sistema: v }, 2)} /></td>
                    <td className={S.td}>
                      <div className="flex flex-col gap-0.5 text-left">
                        {INTEGRACAO_TIPO.map(({ k, l }) => (
                          ro ? (
                            <span key={k} className="flex items-center gap-1">{tipos.includes(k) ? "☑" : "☐"} {l}</span>
                          ) : (
                            <label key={k} className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={tipos.includes(k)}
                                onChange={(e) => patchRow("integracoes", idx, { tipo: e.target.checked ? [...tipos, k] : tipos.filter((x) => x !== k) }, 2)}
                                className="h-3 w-3 accent-[#153169]" /> {l}
                            </label>
                          )
                        ))}
                      </div>
                    </td>
                    <td className={S.tdl}><TxtInline value={row.dados ?? ""} onChange={(v) => patchRow("integracoes", idx, { dados: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.frequencia ?? ""} onChange={(v) => patchRow("integracoes", idx, { frequencia: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.tratamento_falha ?? ""} onChange={(v) => patchRow("integracoes", idx, { tratamento_falha: v }, 2)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SEÇÃO 9 ────────────────────────────────────────────────────────── */}
      <Secao num={9} title="DOCUMENTOS, RELATÓRIOS E INDICADORES" />
      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-300">
        <div className="p-2 overflow-x-auto">
          <Sub title="9.1 Documentos e relatórios" />
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={S.th}>Etapa vinculada</th>
                <th className={S.th}>Documento / Relatório</th>
                <th className={S.th}>Finalidade</th>
                <th className={S.th}>Formato</th>
                <th className={S.th}>Gerado automaticamente?</th>
                <th className={S.th}>Quem acessa?</th>
              </tr>
            </thead>
            <tbody>
              {Array(2).fill(null).map((_, idx) => {
                const row = getRow<any>("documentos", idx, 2);
                const fmts: string[] = row.formato ?? [];
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={S.td}><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("documentos", idx, { etapa_vinculada: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.documento ?? ""} onChange={(v) => patchRow("documentos", idx, { documento: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.finalidade ?? ""} onChange={(v) => patchRow("documentos", idx, { finalidade: v }, 2)} /></td>
                    <td className={S.td}>
                      <div className="flex flex-col gap-0.5 text-left">
                        {DOC_FORMATO.map(({ k, l }) => (
                          ro ? <span key={k} className="flex items-center gap-1">{fmts.includes(k) ? "☑" : "☐"} {l}</span> : (
                            <label key={k} className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={fmts.includes(k)}
                                onChange={(e) => patchRow("documentos", idx, { formato: e.target.checked ? [...fmts, k] : fmts.filter((x) => x !== k) }, 2)}
                                className="h-3 w-3 accent-[#153169]" /> {l}
                            </label>
                          )
                        ))}
                      </div>
                    </td>
                    <td className={S.td}><BoolRadio checked={row.gerado_auto} onChange={(v) => patchRow("documentos", idx, { gerado_auto: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.quem_acessa ?? ""} onChange={(v) => patchRow("documentos", idx, { quem_acessa: v }, 2)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-2 overflow-x-auto">
          <Sub title="9.2 Indicadores da solução" />
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={S.th}>Etapa vinculada</th>
                <th className={S.th}>Indicador</th>
                <th className={S.th}>Objetivo</th>
                <th className={S.th}>Fonte de dados</th>
                <th className={S.th}>Frequência</th>
                <th className={S.th}>Responsável pelo acompanhamento</th>
              </tr>
            </thead>
            <tbody>
              {Array(2).fill(null).map((_, idx) => {
                const row = getRow<any>("indicadores", idx, 2);
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={S.td}><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("indicadores", idx, { etapa_vinculada: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.indicador ?? ""} onChange={(v) => patchRow("indicadores", idx, { indicador: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.objetivo ?? ""} onChange={(v) => patchRow("indicadores", idx, { objetivo: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.fonte ?? ""} onChange={(v) => patchRow("indicadores", idx, { fonte: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.frequencia ?? ""} onChange={(v) => patchRow("indicadores", idx, { frequencia: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.responsavel ?? ""} onChange={(v) => patchRow("indicadores", idx, { responsavel: v }, 2)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SEÇÃO 10 ───────────────────────────────────────────────────────── */}
      <Secao num={10} title="PREMISSAS, RESTRIÇÕES, DEPENDÊNCIAS E RISCOS" />
      <div className="p-2 border-b border-gray-300 overflow-x-auto">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className={S.th}>Tipo</th>
              <th className={S.th}>Etapa vinculada</th>
              <th className={S.th}>Responsável</th>
              <th className={S.th}>Impacto</th>
              <th className={S.th}>Tratamento</th>
            </tr>
          </thead>
          <tbody>
            {Array(3).fill(null).map((_, idx) => {
              const row = getRow<any>("premissas", idx, 3);
              const tipos: string[] = row.tipos ?? [];
              return (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className={S.td}>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-left justify-center">
                      {PREMISSA_TIPOS.map(({ k, l }) => (
                        ro ? <span key={k} className="flex items-center gap-0.5">{tipos.includes(k) ? "☑" : "☐"} {l}</span> : (
                          <label key={k} className="flex items-center gap-0.5 cursor-pointer">
                            <input type="checkbox" checked={tipos.includes(k)}
                              onChange={(e) => patchRow("premissas", idx, { tipos: e.target.checked ? [...tipos, k] : tipos.filter((x) => x !== k) }, 3)}
                              className="h-3 w-3 accent-[#153169]" /> {l}
                          </label>
                        )
                      ))}
                    </div>
                  </td>
                  <td className={S.td}><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("premissas", idx, { etapa_vinculada: v }, 3)} /></td>
                  <td className={S.tdl}><TxtInline value={row.responsavel ?? ""} onChange={(v) => patchRow("premissas", idx, { responsavel: v }, 3)} /></td>
                  <td className={S.td}>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 justify-center">
                      {IMPACTO_OPCOES.map(({ k, l }) => (
                        ro ? <span key={k} className="flex items-center gap-0.5">{row.impacto === k ? "●" : "○"} {l}</span> : (
                          <label key={k} className="flex items-center gap-0.5 cursor-pointer">
                            <input type="radio" checked={row.impacto === k}
                              onChange={() => patchRow("premissas", idx, { impacto: k }, 3)}
                              className="h-3 w-3 accent-[#153169]" /> {l}
                          </label>
                        )
                      ))}
                    </div>
                  </td>
                  <td className={S.tdl}><TxtInline value={row.tratamento ?? ""} onChange={(v) => patchRow("premissas", idx, { tratamento: v }, 3)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── SEÇÃO 11 ───────────────────────────────────────────────────────── */}
      <Secao num={11} title="CRITÉRIOS DE HOMOLOGAÇÃO" />
      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-300">
        <div className="p-2">
          <Sub title="Objetivo" />
          <p className="text-[11px] text-gray-700 mb-2">
            Definir como a área solicitante e o Usuário-chave validarão se a solução foi entregue conforme o escopo aprovado.
          </p>
        </div>
        <div className="p-2 overflow-x-auto">
          <Sub title="11.1 Critérios por etapa" />
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={S.th}>Etapa vinculada</th>
                <th className={S.th}>O que deverá ser validado na homologação?</th>
                <th className={S.th}>Resultado esperado</th>
              </tr>
            </thead>
            <tbody>
              {Array(2).fill(null).map((_, idx) => {
                const row = getRow<any>("criterios_etapa", idx, 2);
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={S.td}><EtapaSelect value={row.etapa_vinculada} onChange={(v) => patchRow("criterios_etapa", idx, { etapa_vinculada: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.criterio ?? ""} onChange={(v) => patchRow("criterios_etapa", idx, { criterio: v }, 2)} /></td>
                    <td className={S.tdl}><TxtInline value={row.resultado ?? ""} onChange={(v) => patchRow("criterios_etapa", idx, { resultado: v }, 2)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-300">
        <div className="p-2">
          <Sub title="11.2 Itens obrigatórios para homologação" />
          <ChkGrp field="itens_homologacao" opcoes={ITENS_HOMOLOGACAO} />
        </div>
        <div className="p-2">
          <Sub title="11.3 Regra de homologação" />
          <ul className="list-disc pl-4 space-y-1 text-[11px] text-gray-700">
            <li>A solução somente poderá ser homologada quando atender ao escopo aprovado.</li>
            <li>Bug deverá impedir a homologação até sua correção.</li>
            <li>Solicitação de Melhoria não deverá impedir a homologação da entrega atual, desde que represente evolução, ampliação ou alteração fora do escopo originalmente aprovado.</li>
          </ul>
        </div>
      </div>

      {/* ── SEÇÃO 12 ───────────────────────────────────────────────────────── */}
      <Secao num={12} title="VALIDAÇÃO DO DFD" />
      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-300">
        <div className="p-2">
          <Sub title="Situação final do DFD" />
          <div className="flex flex-col gap-0.5">
            {SITUACAO_DFD.map(({ k, l }) => <RadioItem key={k} field="situacao" k={k} label={l} />)}
          </div>
        </div>
        <div className="p-2 overflow-x-auto">
          <Sub title="Validações obrigatórias" />
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={S.th}>Área / Responsável</th>
                <th className={S.th}>Nome</th>
                <th className={S.th}>Cargo</th>
                <th className={S.th}>Data</th>
                <th colSpan={2} className={S.th}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {VALIDACOES_AREAS.map(({ area, simNao }, idx) => {
                const row = getRow<any>("validacoes_dfd", idx, VALIDACOES_AREAS.length, { area });
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={S.tdl + " font-medium text-[10px]"}>{area}</td>
                    <td className={S.tdl}><TxtInline value={row.nome ?? ""} onChange={(v) => patchRow("validacoes_dfd", idx, { area, nome: v }, VALIDACOES_AREAS.length)} /></td>
                    <td className={S.tdl}><TxtInline value={row.cargo ?? ""} onChange={(v) => patchRow("validacoes_dfd", idx, { area, cargo: v }, VALIDACOES_AREAS.length)} /></td>
                    <td className={S.tdl}><TxtInline value={row.data ?? ""} onChange={(v) => patchRow("validacoes_dfd", idx, { area, data: v }, VALIDACOES_AREAS.length)} /></td>
                    {simNao.map((opcao) => (
                      <td key={opcao} className={S.td}>
                        {ro ? (
                          <span>{row.situacao === opcao ? "☑" : "☐"} {opcao === "validado" || opcao === "ciencia" ? (opcao === "validado" ? "Validado" : "Ciência") : (opcao === "retornar_ajuste" ? "Retornar ajuste" : "Solicita ajuste")}</span>
                        ) : (
                          <label className="flex items-center gap-1 cursor-pointer justify-center">
                            <input type="radio" checked={row.situacao === opcao}
                              onChange={() => patchRow("validacoes_dfd", idx, { area, situacao: opcao }, VALIDACOES_AREAS.length)}
                              className="h-3 w-3 accent-[#153169]" />
                            <span>{opcao === "validado" ? "Validado" : opcao === "retornar_ajuste" ? "Retornar ajuste" : opcao === "ciencia" ? "Ciência" : "Solicita ajuste"}</span>
                          </label>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="p-2">
        <Sub title="Observações finais" />
        <TxtArea value={d.observacoes_finais ?? ""} onChange={(v) => patch({ observacoes_finais: v })} rows={3} placeholder="Observações sobre a validação do DFD..." />
      </div>
      <div className="bg-gray-50 px-3 py-1.5 text-[9px] text-gray-500 border-t border-gray-200 text-right">
        Versão: 1.0 | Documento Funcional da Demanda (DFD)
      </div>

    </div>
    </DfdCtx.Provider>
  );
}
