import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, Briefcase, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PrestataireDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prestataire, setPrestataire] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPrestataireData();
    }
  }, [user]);

  const loadPrestataireData = async () => {
    try {
      const { data, error } = await supabase
        .from("prestataires")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setPrestataire(data);
    } catch (error) {
      console.error("Error loading prestataire data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Bienvenue, {prestataire?.prenom} {prestataire?.nom}
        </h1>
        <p className="text-muted-foreground mt-2">
          Voici votre tableau de bord prestataire
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mon CV</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {prestataire?.cv_url ? "Disponible" : "Non fourni"}
            </div>
            {prestataire?.cv_url && (
              <Button 
                variant="link" 
                className="p-0 h-auto text-xs"
                onClick={() => window.open(prestataire.cv_url, "_blank")}
              >
                Voir le CV
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contrats</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">À venir</div>
            <p className="text-xs text-muted-foreground">
              Fonctionnalité en développement
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">À venir</div>
            <p className="text-xs text-muted-foreground">
              Fonctionnalité en développement
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mon Profil</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {/* À implémenter */}}
            >
              Gérer mon profil
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Mes informations</CardTitle>
          <CardDescription>
            Vos informations personnelles et professionnelles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-base">{prestataire?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Téléphone</p>
              <p className="text-base">{prestataire?.telephone || "Non renseigné"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date d'inscription</p>
              <p className="text-base">
                {prestataire?.created_at ? 
                  new Date(prestataire.created_at).toLocaleDateString("fr-FR") : 
                  "Non disponible"
                }
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Statut</p>
              <p className="text-base">Actif</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}