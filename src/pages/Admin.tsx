import { useState } from 'react';
import { CandidatAdminDialog } from '@/components/CandidatAdminDialog';
import { SystemSettingsDialog } from '@/components/SystemSettingsDialog';
import { SecurityDialog } from '@/components/SecurityDialog';
import { EmailHistoryDialog } from '@/components/EmailHistoryDialog';
import { SocieteInterneDialog } from '@/components/SocieteInterneDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Settings, ShieldCheck, Mail, Building2, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';

export default function Admin() {
  const [openCandidatAdmin, setOpenCandidatAdmin] = useState(false);
  const [openSystemSettings, setOpenSystemSettings] = useState(false);
  const [openSecurityDialog, setOpenSecurityDialog] = useState(false);
  const [openEmailHistory, setOpenEmailHistory] = useState(false);
  const [openSocieteInterne, setOpenSocieteInterne] = useState(false);
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Vérifier que l'utilisateur est admin
  if (profile?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Administration</h1>
        <p className="text-muted-foreground mt-2">
          Gérez les accès et les paramètres de l'application
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setOpenCandidatAdmin(true)}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Gestion des Candidats
            </CardTitle>
            <CardDescription>
              Gérer les accès des candidats et envoyer les invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              Ouvrir
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setOpenSystemSettings(true)}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Paramètres Système
            </CardTitle>
            <CardDescription>
              Gérer les profils et envoyer des invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              Ouvrir
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setOpenSecurityDialog(true)}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Sécurité
            </CardTitle>
            <CardDescription>
              Gérer les paramètres de sécurité et consulter les logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              Ouvrir
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setOpenEmailHistory(true)}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Historique des Emails
            </CardTitle>
            <CardDescription>
              Consulter l'historique des emails envoyés depuis l'application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              Ouvrir
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setOpenSocieteInterne(true)}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Société Interne
            </CardTitle>
            <CardDescription>
              Gérer les informations de la société et les coordonnées bancaires
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              Ouvrir
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/parametres')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              Paramètres
            </CardTitle>
            <CardDescription>
              Gérer les paramètres métiers (TVA, types de mission, types d'intervenant)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              Ouvrir
            </Button>
          </CardContent>
        </Card>
      </div>

      <CandidatAdminDialog 
        open={openCandidatAdmin} 
        onOpenChange={setOpenCandidatAdmin}
        onUpdate={() => {}}
      />
      
      <SystemSettingsDialog
        open={openSystemSettings}
        onOpenChange={setOpenSystemSettings}
      />
      
      <SecurityDialog
        open={openSecurityDialog}
        onOpenChange={setOpenSecurityDialog}
      />
      
      <EmailHistoryDialog
        open={openEmailHistory}
        onOpenChange={setOpenEmailHistory}
      />
      
      <SocieteInterneDialog
        open={openSocieteInterne}
        onOpenChange={setOpenSocieteInterne}
      />
    </div>
  );
}