import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Candidats from "./pages/Candidats";
import Clients from "./pages/Clients";
import Referents from "./pages/Referents";
import Postes from "./pages/Postes";
import RendezVous from "./pages/Rdv";
import Recherche from "./pages/Recherche";
import Matching from "./pages/Matching";
import CandidatSignup from "./pages/CandidatSignup";
import CandidatDashboard from "./pages/CandidatDashboard";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/candidat/signup" element={<CandidatSignup />} />
            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="recherche" element={<Recherche />} />
              <Route path="candidats" element={<Candidats />} />
              <Route path="clients" element={<Clients />} />
              <Route path="referents" element={<Referents />} />
              <Route path="postes" element={<Postes />} />
              <Route path="rdv" element={<RendezVous />} />
              <Route path="matching" element={<Matching />} />
              <Route path="commentaires" element={<Dashboard />} />
              <Route path="candidat/dashboard" element={<CandidatDashboard />} />
              <Route path="admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
