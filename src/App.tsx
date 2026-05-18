import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import TrocarSenha from "./pages/TrocarSenha.tsx";
import { AppShell } from "./components/layout/AppShell";
import { DemoModeProvider } from "./context/DemoModeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import PainelExecutivo from "./pages/PainelExecutivo";
import Inicio from "./pages/Inicio";
import Presidencia from "./pages/Presidencia";
import Pipeline from "./pages/Pipeline";
import CadastroEdital from "./pages/CadastroEdital";
import Documentos from "./pages/Documentos";
import TriagemIA from "./pages/TriagemIA";
import Parecer from "./pages/Parecer";
import Controladoria from "./pages/Controladoria";
import Aprovacoes from "./pages/Aprovacoes";
import Pregao from "./pages/Pregao";
import Resultado from "./pages/Resultado";
import ProntasContrato from "./pages/ProntasContrato";
import Historico from "./pages/Historico";
import Administracao from "./pages/Administracao";
import Composicao from "./pages/Composicao";
import CustosBDI from "./pages/CustosBDI";
import ParecerSST from "./pages/pareceres/ParecerSST";
import ParecerJuridico from "./pages/pareceres/ParecerJuridico";
import ParecerControladoria from "./pages/pareceres/ParecerControladoria";
import ParecerDiretorOperacional from "./pages/pareceres/ParecerDiretorOperacional";
import ParecerDiretorAdministrativo from "./pages/pareceres/ParecerDiretorAdministrativo";
import Implantacao from "./pages/contratos/Implantacao";
import ContratosAtivos from "./pages/contratos/Ativos";
import Empenhos from "./pages/contratos/Empenhos";
import Postos from "./pages/contratos/Postos";
import Faturamento from "./pages/contratos/Faturamento";
import Medicoes from "./pages/contratos/Medicoes";
import Reajustes from "./pages/contratos/Reajustes";
import Encerramentos from "./pages/contratos/Encerramentos";
import ContratoDetalhe from "./pages/contratos/ContratoDetalhe";
import { EmpresaAtivaProvider } from "./context/EmpresaAtivaContext";
import { PermissoesProvider } from "./context/PermissoesContext";
import Empresas from "./pages/controladoria/Empresas";
import CentrosCusto from "./pages/controladoria/CentrosCusto";
import EstruturaOrganizacional from "./pages/controladoria/EstruturaOrganizacional";
import LinhasDRE from "./pages/controladoria/DRE";
import Classificadores from "./pages/controladoria/Classificadores";
import PlanejadorOBZ from "./pages/controladoria/PlanejadorOBZ";
import Orcamento from "./pages/Orcamento";
import Fornecedores from "./pages/suprimentos/Fornecedores";
import ProdutosServicos from "./pages/suprimentos/ProdutosServicos";
import Requisicoes from "./pages/suprimentos/Requisicoes";
import PedidosCompra from "./pages/suprimentos/PedidosCompra";
import Almoxarifados from "./pages/suprimentos/Almoxarifados";
import CategoriasProduto from "./pages/suprimentos/CategoriasProduto";
import Produtos from "./pages/suprimentos/Produtos";
import Estoque from "./pages/suprimentos/Estoque";
import MovimentosEstoque from "./pages/suprimentos/MovimentosEstoque";
import NFEntrada from "./pages/suprimentos/NFEntrada";
import AprovacoesCompras from "./pages/suprimentos/AprovacoesCompras";
import Recebimentos from "./pages/suprimentos/Recebimentos";
import Cotacoes from "./pages/suprimentos/Cotacoes";
import ContasPagar from "./pages/financeiro/ContasPagar";
import ContasReceber from "./pages/financeiro/ContasReceber";
import FluxoCaixa from "./pages/financeiro/FluxoCaixa";
import FluxoCaixaDiario from "./pages/financeiro/FluxoCaixaDiario";
import CapitalGiro from "./pages/financeiro/CapitalGiro";
import ConciliacaoFluxoCaixa from "./pages/financeiro/ConciliacaoFluxoCaixa";
import OBZVersoes from "./pages/controladoria/OBZVersoes";
import DREGerencial from "./pages/controladoria/DREGerencial";
import MovimentosBancarios from "./pages/financeiro/MovimentosBancarios";
import IntegracaoBancaria from "./pages/financeiro/IntegracaoBancaria";
import IntegracaoBancariaBuilder from "./pages/financeiro/IntegracaoBancariaBuilder";
import ProgramacaoPagamentos from "./pages/financeiro/ProgramacaoPagamentos";
import ValidacaoPosPagamento from "./pages/financeiro/ValidacaoPosPagamento";
import Lancamentos from "./pages/contabil/Lancamentos";
import PlanoContas from "./pages/contabil/PlanoContas";
import AprovacaoContas from "./pages/contabil/AprovacaoContas";
import Balancete from "./pages/contabil/Balancete";
import Razao from "./pages/contabil/Razao";
import DREGerencialReal from "./pages/contabil/DREGerencialReal";
import ConciliacaoEventos from "./pages/contabil/ConciliacaoEventos";
import Folha from "./pages/rh/Folha";
import Contabilidade from "./pages/Contabilidade";
import Colaboradores from "./pages/rh/Colaboradores";
import Alocacoes from "./pages/rh/Alocacoes";
import BIDashboard from "./pages/bi/Dashboard";
import Fiscal from "./pages/Fiscal";
import IntegracaoBatches from "./pages/integracao/Batches";
import BatchDetalhe from "./pages/integracao/BatchDetalhe";
import IntegracaoAliases from "./pages/integracao/Aliases";
import MigracaoZero from "./pages/admin/MigracaoZero";
import PlanoAcoesLista from "./pages/plano-acoes/Lista";
import PlanoAcoesDashboard from "./pages/plano-acoes/Dashboard";
import PlanoAcoesKanban from "./pages/plano-acoes/Kanban";
import PlanoAcaoDetalhe from "./pages/plano-acoes/Detalhe";
import PlanoAcoesImportar from "./pages/plano-acoes/Importar";
import PlanoAcoesAprovacoes from "./pages/plano-acoes/Aprovacoes";
import PlanoAcoesConfiguracoes from "./pages/plano-acoes/Configuracoes";
import CopilotoIA from "./pages/plano-acoes/CopilotoIA";
import Ajuda from "./pages/ajuda/Ajuda";
import AjudaTopico from "./pages/ajuda/AjudaTopico";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DemoModeProvider>
        <PermissoesProvider>
        <EmpresaAtivaProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/trocar-senha" element={<TrocarSenha />} />
          <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Inicio />} />
            <Route path="painel-executivo" element={<PainelExecutivo />} />
            <Route path="presidencia" element={<Presidencia />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="editais" element={<CadastroEdital />} />
            <Route path="documentos" element={<Documentos />} />
            <Route path="triagem" element={<TriagemIA />} />
            <Route path="composicao" element={<Composicao />} />
            <Route path="custos-bdi" element={<CustosBDI />} />
            <Route path="parecer-tecnico" element={<Parecer papel="tecnico" />} />
            <Route path="parecer-sst" element={<ParecerSST />} />
            <Route path="parecer-juridico" element={<ParecerJuridico />} />
            <Route path="parecer-controladoria" element={<ParecerControladoria />} />
            <Route path="parecer-dir-operacional" element={<ParecerDiretorOperacional />} />
            <Route path="parecer-dir-administrativo" element={<ParecerDiretorAdministrativo />} />
            <Route path="parecer-gerencial" element={<Parecer papel="gerencial" />} />
            <Route path="controladoria" element={<Controladoria />} />
            <Route path="aprovacoes" element={<Aprovacoes />} />
            <Route path="pregao" element={<Pregao />} />
            <Route path="resultado" element={<Resultado />} />
            <Route path="prontas-contrato" element={<ProntasContrato />} />
            <Route path="contratos/implantacao" element={<Implantacao />} />
            <Route path="contratos/ativos" element={<ContratosAtivos />} />
            <Route path="contratos/empenhos" element={<Empenhos />} />
            <Route path="contratos/postos" element={<Postos />} />
            <Route path="contratos/faturamento" element={<Faturamento />} />
            <Route path="contratos/medicoes" element={<Medicoes />} />
            <Route path="contratos/reajustes" element={<Reajustes />} />
            <Route path="contratos/encerramentos" element={<Encerramentos />} />
            <Route path="contratos/:id" element={<ContratoDetalhe />} />
            <Route path="historico" element={<Historico />} />
            <Route path="administracao" element={<Administracao />} />
            <Route path="co/empresas" element={<Empresas />} />
            <Route path="co/centros-custo" element={<CentrosCusto />} />
            <Route path="co/estrutura-organizacional" element={<EstruturaOrganizacional />} />
            <Route path="co/dre" element={<LinhasDRE />} />
            <Route path="co/classificadores" element={<Classificadores />} />
            <Route path="co/obz" element={<PlanejadorOBZ />} />
            <Route path="co/obz-versoes" element={<OBZVersoes />} />
            <Route path="co/dre-gerencial" element={<DREGerencial />} />
            <Route path="orcamento" element={<Orcamento />} />
            {/* Suprimentos */}
            <Route path="suprimentos/fornecedores" element={<Fornecedores />} />
            <Route path="suprimentos/produtos-servicos" element={<ProdutosServicos />} />
            <Route path="suprimentos/produtos" element={<Produtos />} />
            <Route path="suprimentos/categorias" element={<CategoriasProduto />} />
            <Route path="suprimentos/almoxarifados" element={<Almoxarifados />} />
            <Route path="suprimentos/estoque" element={<Estoque />} />
            <Route path="suprimentos/movimentos" element={<MovimentosEstoque />} />
            <Route path="suprimentos/nf-entrada" element={<NFEntrada />} />
            <Route path="suprimentos/requisicoes" element={<Requisicoes />} />
            <Route path="suprimentos/pedidos" element={<PedidosCompra />} />
            <Route path="suprimentos/aprovacoes" element={<AprovacoesCompras />} />
            <Route path="suprimentos/recebimentos" element={<Recebimentos />} />
            <Route path="suprimentos/cotacoes" element={<Cotacoes />} />
            {/* Financeiro */}
            <Route path="financeiro/contas-pagar" element={<ContasPagar />} />
            <Route path="financeiro/contas-receber" element={<ContasReceber />} />
            <Route path="financeiro/fluxo-caixa" element={<FluxoCaixa />} />
            <Route path="financeiro/fluxo-caixa-diario" element={<FluxoCaixaDiario />} />
            <Route path="financeiro/capital-giro" element={<CapitalGiro />} />
            <Route path="financeiro/conciliacao-fluxo-caixa" element={<ConciliacaoFluxoCaixa />} />
            <Route path="financeiro/movimentos" element={<MovimentosBancarios />} />
            <Route path="financeiro/integracao-bancaria" element={<IntegracaoBancaria />} />
            <Route path="financeiro/integracao-bancaria/builder/:contaId" element={<IntegracaoBancariaBuilder />} />
            <Route path="financeiro/programacao-pagamentos" element={<ProgramacaoPagamentos />} />
            <Route path="financeiro/validacao-pos-pagamento" element={<ValidacaoPosPagamento />} />
            {/* Fiscal */}
            <Route path="fiscal" element={<Fiscal />} />
            {/* Contábil */}
            <Route path="contabil/lancamentos" element={<Lancamentos />} />
            <Route path="contabil/plano-contas" element={<PlanoContas />} />
            <Route path="contabil/avancada" element={<Contabilidade />} />
            <Route path="contabil/aprovacao-contas" element={<AprovacaoContas />} />
            <Route path="contabil/balancete" element={<Balancete />} />
            <Route path="contabil/razao" element={<Razao />} />
            <Route path="contabil/dre-gerencial-real" element={<DREGerencialReal />} />
            <Route path="contabil/conciliacao-eventos" element={<ConciliacaoEventos />} />
            {/* RH */}
            <Route path="rh/colaboradores" element={<Colaboradores />} />
            <Route path="rh/alocacoes" element={<Alocacoes />} />
            <Route path="rh/folha" element={<Folha />} />
            {/* BI */}
            <Route path="bi" element={<BIDashboard />} />
            {/* Integração & Migração */}
            <Route path="integracao" element={<IntegracaoBatches />} />
            <Route path="integracao/aliases" element={<IntegracaoAliases />} />
            <Route path="integracao/:id" element={<BatchDetalhe />} />
            <Route path="admin/migracao-zero" element={<MigracaoZero />} />
            {/* Plano de Ações */}
            <Route path="plano-acoes" element={<PlanoAcoesLista />} />
            <Route path="plano-acoes/dashboard" element={<PlanoAcoesDashboard />} />
            <Route path="plano-acoes/kanban" element={<PlanoAcoesKanban />} />
            <Route path="plano-acoes/importar" element={<PlanoAcoesImportar />} />
            <Route path="plano-acoes/aprovacoes" element={<PlanoAcoesAprovacoes />} />
            <Route path="plano-acoes/configuracoes" element={<PlanoAcoesConfiguracoes />} />
            <Route path="plano-acoes/copiloto" element={<CopilotoIA />} />
            <Route path="plano-acoes/:id" element={<PlanoAcaoDetalhe />} />
            {/* Ajuda / Base de Conhecimento */}
            <Route path="ajuda" element={<Ajuda />} />
            <Route path="ajuda/:modulo/:slug" element={<AjudaTopico />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </EmpresaAtivaProvider>
        </PermissoesProvider>
        </DemoModeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
