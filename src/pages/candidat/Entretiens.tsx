import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, User, Video, Building } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Entretiens() {
  const { user } = useAuth();
  const [candidat, setCandidat] = useState<any>(null);
  const [rdvs, setRdvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadEntretiens();
    }
  }, [user]);

  const loadEntretiens = async () => {
    try {
      // Récupérer le candidat
      const { data: candidatData } = await supabase
        .from('candidats')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (candidatData) {
        setCandidat(candidatData);

        // Récupérer les RDVs avec les informations complètes
        const { data: rdvsData } = await supabase
          .from('rdvs')
          .select(`
            *,
            poste:postes!rdvs_poste_id_fkey(*),
            client:clients!rdvs_client_id_fkey(*),
            recruteur:profiles!rdvs_recruteur_id_fkey(*)
          `)
          .eq('candidat_id', candidatData.id)
          .order('date', { ascending: false });

        if (rdvsData) {
          setRdvs(rdvsData);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des entretiens:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'PLANIFIE': 'default',
      'REALISE': 'secondary',
      'ANNULE': 'destructive',
      'REPORTE': 'outline'
    };
    
    const labels: Record<string, string> = {
      'PLANIFIE': 'Planifié',
      'REALISE': 'Réalisé',
      'ANNULE': 'Annulé',
      'REPORTE': 'Reporté'
    };

    return (
      <Badge variant={variants[statut] || 'default'}>
        {labels[statut] || statut}
      </Badge>
    );
  };

  const getTypeRdvLabel = (type: string) => {
    const labels: Record<string, string> = {
      'TELEPHONIQUE': 'Téléphonique',
      'VISIO': 'Visioconférence',
      'PHYSIQUE': 'En présentiel',
      'TECHNIQUE': 'Technique',
      'RH': 'RH',
      'MANAGER': 'Manager',
      'DIRECTION': 'Direction',
      'CLIENT': 'Client'
    };
    return labels[type] || type;
  };

  const rdvsFuturs = rdvs.filter(rdv => 
    new Date(rdv.date) >= new Date() && rdv.statut === 'PLANIFIE'
  );
  
  const rdvsPasses = rdvs.filter(rdv => 
    new Date(rdv.date) < new Date() || rdv.statut !== 'PLANIFIE'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const RdvCard = ({ rdv }: { rdv: any }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {rdv.poste?.titre || 'Entretien'}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(rdv.date), "d MMMM yyyy", { locale: fr })}
              <Clock className="h-3 w-3 ml-2" />
              {format(new Date(rdv.date), "HH:mm", { locale: fr })}
            </div>
          </div>
          {getStatutBadge(rdv.statut)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{getTypeRdvLabel(rdv.type_rdv)}</Badge>
          </div>
          
          {rdv.client && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building className="h-3 w-3" />
              {rdv.client.raison_sociale}
            </div>
          )}
          
          {rdv.lieu && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {rdv.lieu}
            </div>
          )}
          
          {rdv.recruteur && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3 w-3" />
              {rdv.recruteur.prenom} {rdv.recruteur.nom}
            </div>
          )}
        </div>

        {rdv.teams_link && rdv.statut === 'PLANIFIE' && (
          <Button
            className="w-full"
            variant="default"
            onClick={() => window.open(rdv.teams_link, '_blank')}
          >
            <Video className="h-4 w-4 mr-2" />
            Rejoindre la réunion Teams
          </Button>
        )}

        {rdv.notes && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">{rdv.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Mes entretiens</h2>
        <p className="text-muted-foreground">
          Consultez vos entretiens à venir et passés
        </p>
      </div>

      <Tabs defaultValue="futurs" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="futurs">
            À venir ({rdvsFuturs.length})
          </TabsTrigger>
          <TabsTrigger value="passes">
            Passés ({rdvsPasses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="futurs" className="space-y-4">
          {rdvsFuturs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  Aucun entretien à venir
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {rdvsFuturs.map((rdv) => (
                <RdvCard key={rdv.id} rdv={rdv} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="passes" className="space-y-4">
          {rdvsPasses.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  Aucun entretien passé
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {rdvsPasses.map((rdv) => (
                <RdvCard key={rdv.id} rdv={rdv} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}