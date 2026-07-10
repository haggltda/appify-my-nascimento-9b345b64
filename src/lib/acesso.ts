/**
 * Chave de fase do controle de acesso por tela.
 *
 * true  = ACESSO ABERTO: todo usuário autenticado vê todos os módulos e telas
 *         (fase FRONT — módulos entregues sem regra de permissão).
 * false = enforcement deny-by-default: a tela precisa estar cadastrada em
 *         app_menu e o usuário precisa de allow=true explícito no painel
 *         /app/administracao?tab=modulos (RPC list_accessible_menus).
 *
 * A PR de permissões (BACK/BD) muda esta chave para false e adiciona as
 * migrations que cadastram as telas e os seeds de permissão.
 * As feature flags de fase (ex.: Triagem IA) continuam soberanas e bloqueiam
 * suas rotas independentemente desta chave.
 */
export const ACESSO_ABERTO_SEM_PERMISSOES = true;
