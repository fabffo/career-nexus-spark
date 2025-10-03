import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { CandidatLayout } from "./components/layout/CandidatLayout";
import PrestataireLayout from "./components/layout/PrestataireLayout";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CandidatProtectedRoute } from "./components/CandidatProtectedRoute";
import PrestataireProtectedRoute from "./components/PrestataireProtectedRoute";
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
import CandidatCandidatures from "./pages/candidat/Candidatures";
import CandidatEntretiens from "./pages/candidat/Entretiens";
import CandidatProfil from "./pages/candidat/Profil";
import PrestataireDashboard from "./pages/prestataire/PrestataireDashboard";
import RecruteurSignup from "./pages/recruteur/RecruteurSignup";
import PrestataireSignup from "./pages/prestataire/PrestataireSignup";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Prestataires from "./pages/Prestataires";
import Contrats from "./pages/Contrats";
import ContratsClients from "./pages/ContratsClients";
import ContratsFournisseurs from "./pages/ContratsFournisseurs";
import Salaries from "./pages/Salaries";
import { Missions } from "./pages/Missions";
import MissionsClients from "./pages/MissionsClients";
import MissionsFournisseurs from "./pages/MissionsFournisseurs";
import FournisseursGeneraux from "./pages/FournisseursGeneraux";
import FournisseursServices from "./pages/FournisseursServices";
import Factures from "./pages/Factures";
import FacturesVentes from "./pages/FacturesVentes";
import FacturesAchats from "./pages/FacturesAchats";
import Parametres from "./pages/Parametres";

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
            <Route path="/recruteur/signup" element={<RecruteurSignup />} />
            <Route path="/prestataire/signup" element={<PrestataireSignup />} />
            
            {/* Routes pour les candidats */}
            <Route path="/candidat" element={
              <CandidatProtectedRoute>
                <CandidatLayout />
              </CandidatProtectedRoute>
            }>
              <Route path="dashboard" element={<CandidatDashboard />} />
              <Route path="candidatures" element={<CandidatCandidatures />} />
              <Route path="entretiens" element={<CandidatEntretiens />} />
              <Route path="profil" element={<CandidatProfil />} />
            </Route>
            
            {/* Routes pour les prestataires */}
            <Route path="/prestataire" element={
              <PrestataireProtectedRoute>
                <PrestataireLayout />
              </PrestataireProtectedRoute>
            }>
              <Route path="dashboard" element={<PrestataireDashboard />} />
            </Route>
            
            {/* Routes pour les recruteurs et admins */}
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
              <Route path="prestataires" element={<Prestataires />} />
              <Route path="fournisseurs-generaux" element={<FournisseursGeneraux />} />
              <Route path="fournisseurs-services" element={<FournisseursServices />} />
              <Route path="contrats" element={<Contrats />} />
              <Route path="contrats-clients" element={<ContratsClients />} />
              <Route path="contrats-fournisseurs" element={<ContratsFournisseurs />} />
              <Route path="salaries" element={<Salaries />} />
              <Route path="postes" element={<Postes />} />
              <Route path="missions" element={<Missions />} />
              <Route path="missions-clients" element={<MissionsClients />} />
              <Route path="missions-fournisseurs" element={<MissionsFournisseurs />} />
              <Route path="factures" element={<Factures />} />
              <Route path="factures-ventes" element={<FacturesVentes />} />
              <Route path="factures-achats" element={<FacturesAchats />} />
              <Route path="rdv" element={<RendezVous />} />
              <Route path="matching" element={<Matching />} />
              <Route path="commentaires" element={<Dashboard />} />
              <Route path="admin" element={<Admin />} />
              <Route path="parametres" element={<Parametres />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
