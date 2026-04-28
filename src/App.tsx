import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import { AppShell } from "./components/layout/AppShell";
import { DemoModeProvider } from "./context/DemoModeContext";
import PainelExecutivo from "./pages/PainelExecutivo";
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
import { EmpresaAtivaProvider } from "./context/EmpresaAtivaContext";
import Empresas from "./pages/controladoria/Empresas";
import CentrosCusto from "./pages/controladoria/CentrosCusto";
import LinhasDRE from "./pages/controladoria/DRE";
import Classificadores from "./pages/controladoria/Classificadores";
import PlanejadorOBZ from "./pages/controladoria/PlanejadorOBZ";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DemoModeProvider>
        <EmpresaAtivaProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<PainelExecutivo />} />
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
            <Route path="historico" element={<Historico />} />
            <Route path="administracao" element={<Administracao />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </DemoModeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
