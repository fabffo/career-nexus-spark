import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Building2, Eye, Users, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ViewPosteDialog } from "@/components/ViewPosteDialog";

export default function CandidatDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [candidat, setCandidat] = useState<any>(null);
  const [postes, setPostes] = useState<any[]>([]);
  const [rdvs, setRdvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoste, setSelectedPoste] = useState<any>(null);
  const [viewPosteOpen, setViewPosteOpen] = useState(false);

  useEffect(() => {
    if (user && profile?.role === 'CANDIDAT') {
      loadCandidatData();
    }
  }, [user, profile]);

  const loadCandidatData = async () => {
    try {
      setLoading(true);

      // Charger les données du candidat
      const { data: candidatData, error: candidatError } = await supabase
        .from('candidats')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (candidatError) throw candidatError;
      setCandidat(candidatData);

      // Charger les rendez-vous du candidat avec les postes associés
      const { data: rdvsData, error: rdvsError } = await supabase
        .from('rdvs')
        .select(`
          *,
          postes!inner (
            id,
            titre,
            statut,
            description,
            localisation,
            type_contrat,
            salaire_min,
            salaire_max,
            client_id,
            clients (
              id,
              raison_sociale,
              adresse
            )
          ),
          clients (
            id,
            raison_sociale,
            adresse
          ),
          profiles:recruteur_id (
            nom,
            prenom
          ),
          referents (
            nom,
            prenom
          )
        `)
        .eq('candidat_id', candidatData.id)
        .order('date', { ascending: false });

      if (!rdvsError && rdvsData) {
        setRdvs(rdvsData);
        
        // Extraire les postes uniques des rendez-vous
        const uniquePostes = rdvsData
          .filter(rdv => rdv.postes)
          .map(rdv => rdv.postes)
          .filter((poste, index, self) => 
            index === self.findIndex(p => p.id === poste.id)
          );
        
        setPostes(uniquePostes);
      }
    } catch (error) {
      console.error('Error loading candidat data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const statutConfig: any = {
      'ENCOURS': { label: 'En cours', variant: 'default' as const, icon: Clock },
      'REALISE': { label: 'Réalisé', variant: 'success' as const, icon: CheckCircle },
      'TERMINE': { label: 'Terminé', variant: 'secondary' as const, icon: CheckCircle },
      'ANNULE': { label: 'Annulé', variant: 'destructive' as const, icon: XCircle },
    };

    const config = statutConfig[statut] || { label: statut, variant: 'outline' as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getTypeRdvLabel = (type: string) => {
    const types: any = {
      'TEAMS': 'Teams',
      'PRESENTIEL_CLIENT': 'Présentiel',
      'TELEPHONE': 'Téléphone',
    };
    return types[type] || type;
  };

  const handleViewPoste = (poste: any) => {
    setSelectedPoste(poste);
    setViewPosteOpen(true);
  };

  const getFirstRdvDate = (posteId: string) => {
    const posteRdvs = rdvs.filter(rdv => rdv.poste_id === posteId);
    if (posteRdvs.length === 0) return null;
    
    const sortedRdvs = posteRdvs.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return sortedRdvs[0].date;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!candidat) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Aucune donnée candidat trouvée</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* En-tête avec les informations du candidat */}
      <Card className="mb-8 bg-gradient-to-r from-primary/10 to-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl">
                {candidat.prenom} {candidat.nom}
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                {candidat.email} • {candidat.telephone}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Espace Candidat</p>
              <p className="text-2xl font-bold text-primary">{postes.length}</p>
              <p className="text-sm text-muted-foreground">Candidature{postes.length > 1 ? 's' : ''}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Postes avec statut */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Mes candidatures
          </CardTitle>
          <CardDescription>
            Cliquez sur un poste pour voir les détails
          </CardDescription>
        </CardHeader>
        <CardContent>
          {postes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune candidature en cours
            </p>
          ) : (
            <div className="space-y-4">
              {postes.map((poste) => {
                const firstRdvDate = getFirstRdvDate(poste.id);
                const posteRdvs = rdvs.filter(rdv => rdv.poste_id === poste.id);
                
                return (
                  <Card key={poste.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">{poste.titre}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {poste.clients?.raison_sociale}
                          </p>
                        </div>
                        {getStatutBadge(poste.statut)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{poste.localisation || 'Non spécifié'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {firstRdvDate 
                              ? `Démarré le ${format(new Date(firstRdvDate), 'dd/MM/yyyy', { locale: fr })}`
                              : 'Pas encore démarré'
                            }
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{posteRdvs.length} entretien{posteRdvs.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewPoste(poste)}
                          className="w-full"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir les détails
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liste des entretiens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mes entretiens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tous" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tous">Tous</TabsTrigger>
              <TabsTrigger value="avenir">À venir</TabsTrigger>
              <TabsTrigger value="passes">Passés</TabsTrigger>
            </TabsList>
            
            <TabsContent value="tous" className="space-y-4">
              {rdvs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun entretien programmé
                </p>
              ) : (
                rdvs.map((rdv) => (
                  <RdvCard key={rdv.id} rdv={rdv} />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="avenir" className="space-y-4">
              {rdvs.filter(rdv => new Date(rdv.date) >= new Date()).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun entretien à venir
                </p>
              ) : (
                rdvs
                  .filter(rdv => new Date(rdv.date) >= new Date())
                  .map((rdv) => (
                    <RdvCard key={rdv.id} rdv={rdv} />
                  ))
              )}
            </TabsContent>
            
            <TabsContent value="passes" className="space-y-4">
              {rdvs.filter(rdv => new Date(rdv.date) < new Date()).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun entretien passé
                </p>
              ) : (
                rdvs
                  .filter(rdv => new Date(rdv.date) < new Date())
                  .map((rdv) => (
                    <RdvCard key={rdv.id} rdv={rdv} />
                  ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ViewPosteDialog 
        poste={selectedPoste}
        open={viewPosteOpen}
        onOpenChange={setViewPosteOpen}
      />
    </div>
  );
}

function RdvCard({ rdv }: { rdv: any }) {
  const getStatutBadge = (statut: string) => {
    const statutConfig: any = {
      'ENCOURS': { label: 'En cours', variant: 'default' as const },
      'REALISE': { label: 'Réalisé', variant: 'success' as const },
      'TERMINE': { label: 'Terminé', variant: 'secondary' as const },
      'ANNULE': { label: 'Annulé', variant: 'destructive' as const },
    };

    const config = statutConfig[statut] || { label: statut, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeRdvBadge = (type: string) => {
    const typeConfig: any = {
      'TEAMS': { label: 'Teams', variant: 'default' as const },
      'PRESENTIEL_CLIENT': { label: 'Présentiel', variant: 'secondary' as const },
      'TELEPHONE': { label: 'Téléphone', variant: 'outline' as const },
    };

    const config = typeConfig[type] || { label: type, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(rdv.date), 'EEEE dd MMMM yyyy à HH:mm', { locale: fr })}
              </span>
            </div>
            
            {rdv.postes && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{rdv.postes.titre}</span>
              </div>
            )}
            
            {rdv.clients && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{rdv.clients.raison_sociale}</span>
              </div>
            )}
            
            {rdv.lieu && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{rdv.lieu}</span>
              </div>
            )}
            
            {(rdv.profiles || rdv.referents) && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>
                  Avec {rdv.profiles 
                    ? `${rdv.profiles.prenom} ${rdv.profiles.nom}`
                    : `${rdv.referents.prenom} ${rdv.referents.nom}`
                  }
                </span>
              </div>
            )}

            {rdv.teams_link && (
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(rdv.teams_link, '_blank')}
                >
                  Rejoindre la réunion Teams
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            {getTypeRdvBadge(rdv.type_rdv)}
            {getStatutBadge(rdv.statut)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}