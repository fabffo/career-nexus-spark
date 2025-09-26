import { useState } from 'react';
import { CandidatAdminDialog } from '@/components/CandidatAdminDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Settings, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Admin() {
  const [openCandidatAdmin, setOpenCandidatAdmin] = useState(false);
  const { profile } = useAuth();

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

        <Card className="hover:shadow-lg transition-shadow opacity-50 cursor-not-allowed">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              Paramètres Système
            </CardTitle>
            <CardDescription>
              Configuration générale de l'application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" disabled>
              Bientôt disponible
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow opacity-50 cursor-not-allowed">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              Sécurité
            </CardTitle>
            <CardDescription>
              Gérer les rôles et permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" disabled>
              Bientôt disponible
            </Button>
          </CardContent>
        </Card>
      </div>

      <CandidatAdminDialog 
        open={openCandidatAdmin} 
        onOpenChange={setOpenCandidatAdmin}
        onUpdate={() => {}}
      />
    </div>
  );
}