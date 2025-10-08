import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Calendar, MapPin, Building } from 'lucide-react';
import { ViewPosteDialog } from '@/components/ViewPosteDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Candidatures() {
  const { user } = useAuth();
  const [candidat, setCandidat] = useState<any>(null);
  const [postes, setPostes] = useState<any[]>([]);
  const [selectedPoste, setSelectedPoste] = useState<any>(null);
  const [viewPosteOpen, setViewPosteOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCandidatures();
    }
  }, [user]);

  const loadCandidatures = async () => {
    try {
      // Récupérer le candidat
      const { data: candidatData } = await supabase
        .from('candidats')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (candidatData) {
        setCandidat(candidatData);

        // Récupérer les postes via les RDVs
        const { data: rdvsData } = await supabase
          .from('rdvs')
          .select(`
            *,
            postes (
              *,
              clients (*)
            )
          `)
          .eq('candidat_id', candidatData.id)
          .order('date', { ascending: false });

        if (rdvsData) {
          // Extraire les postes uniques
          const uniquePostes = rdvsData.reduce((acc: any[], rdv: any) => {
            if (rdv.postes && !acc.find(p => p.id === rdv.postes.id)) {
              const posteWithRdvs = {
                ...rdv.postes,
                rdvs: rdvsData.filter(r => r.poste_id === rdv.postes.id)
              };
              acc.push(posteWithRdvs);
            }
            return acc;
          }, []);
          setPostes(uniquePostes);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des candidatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'OUVERT': 'default',
      'EN_COURS': 'secondary',
      'POURVU': 'destructive',
      'FERME': 'outline'
    };
    
    const labels: Record<string, string> = {
      'OUVERT': 'Ouvert',
      'EN_COURS': 'En cours',
      'POURVU': 'Pourvu',
      'FERME': 'Fermé'
    };

    return (
      <Badge variant={variants[statut] || 'default'}>
        {labels[statut] || statut}
      </Badge>
    );
  };

  const handleViewPoste = (poste: any) => {
    setSelectedPoste(poste);
    setViewPosteOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Mes candidatures</h2>
        <p className="text-muted-foreground">
          Suivez l'état de vos candidatures et prochains entretiens
        </p>
      </div>

      {postes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">
              Vous n'avez pas encore de candidatures
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {postes.map((poste) => {
            const nextRdv = poste.rdvs
              ?.filter((r: any) => new Date(r.date) >= new Date())
              .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

            return (
              <Card key={poste.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{poste.titre}</CardTitle>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
                        {poste.clients && (
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {poste.clients.raison_sociale}
                          </div>
                        )}
                        {poste.localisation && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {poste.localisation}
                          </div>
                        )}
                      </div>
                    </div>
                    {getStatutBadge(poste.statut)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {nextRdv && (
                    <div className="bg-accent/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-medium">Prochain entretien :</span>
                        <span>
                          {format(new Date(nextRdv.date), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {poste.rdvs?.length || 0} entretien(s) programmé(s)
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPoste(poste)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Voir le poste
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedPoste && (
        <ViewPosteDialog
          open={viewPosteOpen}
          onOpenChange={setViewPosteOpen}
          poste={selectedPoste}
        />
      )}
    </div>
  );
}