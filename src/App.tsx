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
import TwoFactorVerification from "./pages/TwoFactorVerification";
import TrustedDevices from "./pages/TrustedDevices";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Prestataires from "./pages/Prestataires";
import Contrats from "./pages/Contrats";
import ContratsClients from "./pages/ContratsClients";
import ContratsFournisseurs from "./pages/ContratsFournisseurs";
import ContratsSalaries from "./pages/ContratsSalaries";
import Salaries from "./pages/Salaries";
import { Missions } from "./pages/Missions";
import MissionsClients from "./pages/MissionsClients";
import MissionsFournisseurs from "./pages/MissionsFournisseurs";
import FournisseursGeneraux from "./pages/FournisseursGeneraux";
import FournisseursServices from "./pages/FournisseursServices";
import FournisseursEtatOrganismes from "./pages/FournisseursEtatOrganismes";
import Factures from "./pages/Factures";
import FacturesVentes from "./pages/FacturesVentes";
import FacturesAchats from "./pages/FacturesAchats";
import Parametres from "./pages/Parametres";
import RapprochementBancaire from "./pages/RapprochementBancaire";
import TvaMensuel from "./pages/TvaMensuel";
import Fiscalite from "./pages/Fiscalite";
import BulletinsSalaire from "./pages/BulletinsSalaire";
import SignatureContrats from "./pages/SignatureContrats";
import AbonnementsPartenaires from "./pages/AbonnementsPartenaires";
import PaiementsAbonnements from "./pages/PaiementsAbonnements";
import ChargesSalaries from "./pages/ChargesSalaries";
import DeclarationsChargesSociales from "./pages/DeclarationsChargesSociales";
import PrestatairesMissions from "./pages/PrestatairesMissions";
import PrestataireMissionDetail from "./pages/PrestataireMissionDetail";
import CRAGestion from "./pages/CRAGestion";
import DashboardFinancier from "./pages/DashboardFinancier";
import AnalyseFinanciere from "./pages/AnalyseFinanciere";
import ChargesMensuelles from "./pages/ChargesMensuelles";
import Banques from "./pages/Banques";
import FacturesEnRetard from "./pages/FacturesEnRetard";

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
            <Route path="/2fa-verify" element={<TwoFactorVerification />} />
            <Route path="/trusted-devices" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route index element={<TrustedDevices />} />
            </Route>
            
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
              <Route path="fournisseurs-etat-organismes" element={<FournisseursEtatOrganismes />} />
              <Route path="contrats" element={<Contrats />} />
              <Route path="contrats-clients" element={<ContratsClients />} />
              <Route path="contrats-fournisseurs" element={<ContratsFournisseurs />} />
              <Route path="contrats-salaries" element={<ContratsSalaries />} />
              <Route path="salaries" element={<Salaries />} />
              <Route path="postes" element={<Postes />} />
              <Route path="missions" element={<Missions />} />
              <Route path="missions-clients" element={<MissionsClients />} />
              <Route path="missions-fournisseurs" element={<MissionsFournisseurs />} />
              <Route path="factures" element={<Factures />} />
              <Route path="factures-ventes" element={<FacturesVentes />} />
              <Route path="factures-achats" element={<FacturesAchats />} />
              <Route path="rapprochement-bancaire" element={<RapprochementBancaire />} />
              <Route path="abonnements-partenaires" element={<AbonnementsPartenaires />} />
              <Route path="paiements-abonnements" element={<PaiementsAbonnements />} />
              <Route path="charges-salaries" element={<ChargesSalaries />} />
              <Route path="declarations-charges-sociales" element={<DeclarationsChargesSociales />} />
              <Route path="tva-mensuel" element={<TvaMensuel />} />
              <Route path="fiscalite" element={<Fiscalite />} />
              <Route path="bulletins-salaire" element={<BulletinsSalaire />} />
              <Route path="signature-contrats" element={<SignatureContrats />} />
              <Route path="rdv" element={<RendezVous />} />
              <Route path="matching" element={<Matching />} />
              <Route path="commentaires" element={<Dashboard />} />
              <Route path="admin" element={<Admin />} />
              <Route path="parametres" element={<Parametres />} />
              <Route path="prestataires-missions" element={<PrestatairesMissions />} />
              <Route path="prestataire-mission/:id/:missionId" element={<PrestataireMissionDetail />} />
              <Route path="cra-gestion" element={<CRAGestion />} />
              <Route path="dashboard-financier" element={<DashboardFinancier />} />
              <Route path="analyse-financiere" element={<AnalyseFinanciere />} />
              <Route path="charges-mensuelles" element={<ChargesMensuelles />} />
              <Route path="banques" element={<Banques />} />
              <Route path="factures-en-retard" element={<FacturesEnRetard />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
