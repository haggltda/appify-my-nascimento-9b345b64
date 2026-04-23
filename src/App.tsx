import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import { AppShell } from "./components/layout/AppShell";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<PainelExecutivo />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="editais" element={<CadastroEdital />} />
            <Route path="documentos" element={<Documentos />} />
            <Route path="triagem" element={<TriagemIA />} />
            <Route path="parecer-tecnico" element={<Parecer papel="tecnico" />} />
            <Route path="parecer-gerencial" element={<Parecer papel="gerencial" />} />
            <Route path="controladoria" element={<Controladoria />} />
            <Route path="aprovacoes" element={<Aprovacoes />} />
            <Route path="pregao" element={<Pregao />} />
            <Route path="resultado" element={<Resultado />} />
            <Route path="prontas-contrato" element={<ProntasContrato />} />
            <Route path="historico" element={<Historico />} />
            <Route path="administracao" element={<Administracao />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
