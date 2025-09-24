import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { rdvService, candidatService, clientService, posteService } from '@/services';
import { Rdv, Candidat, Client, PosteClient } from '@/types/models';
import { Users, Calendar, UserCheck, Building2, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface PosteHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  posteId: string;
}

interface RdvWithDetails extends Rdv {
  candidatDetails?: Candidat;
  clientDetails?: Client;
}

interface PosteStatistics {
  totalCandidats: number;
  rdvRecruteur: number;
  rdvClient: number;
  candidatsAvecRdv: number;
  candidatsRealises: number;
  candidatsAnnules: number;
  candidatsEnCours: number;
}

export const PosteHistoryDialog = ({ isOpen, onClose, posteId }: PosteHistoryDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [poste, setPoste] = useState<PosteClient | null>(null);
  const [rdvs, setRdvs] = useState<RdvWithDetails[]>([]);
  const [statistics, setStatistics] = useState<PosteStatistics>({
    totalCandidats: 0,
    rdvRecruteur: 0,
    rdvClient: 0,
    candidatsAvecRdv: 0,
    candidatsRealises: 0,
    candidatsAnnules: 0,
    candidatsEnCours: 0,
  });

  useEffect(() => {
    if (isOpen && posteId) {
      loadPosteHistory();
    }
  }, [isOpen, posteId]);

  const loadPosteHistory = async () => {
    setLoading(true);
    try {
      // Charger le poste
      const postes = await posteService.getAll();
      const currentPoste = postes.find(p => p.id === posteId);
      setPoste(currentPoste || null);

      // Pour l'instant, charger tous les RDVs car nous n'avons pas de relation directe
      // Entre postes et RDVs dans le modèle actuel
      const allRdvs = await rdvService.getAll();
      
      // Filtrer les RDVs par client du poste
      const posteRdvs = currentPoste ? 
        allRdvs.filter(rdv => rdv.clientId === currentPoste.clientId) : [];

      // Charger les détails pour chaque RDV
      const candidats = await candidatService.getAll();
      const clients = await clientService.getAll();

      const rdvsWithDetails: RdvWithDetails[] = posteRdvs.map(rdv => ({
        ...rdv,
        candidatDetails: candidats.find(c => c.id === rdv.candidatId),
        clientDetails: clients.find(c => c.id === rdv.clientId),
      }));

      setRdvs(rdvsWithDetails);

      // Calculer les statistiques
      const uniqueCandidats = new Set(posteRdvs.map(rdv => rdv.candidatId).filter(id => id));
      
      // Compter par type de RDV (en utilisant le lieu pour différencier)
      const rdvRecruteur = posteRdvs.filter(rdv => 
        rdv.typeRdv === 'TELEPHONE' || !rdv.lieu?.toLowerCase().includes('client')
      ).length;
      const rdvClient = posteRdvs.filter(rdv => 
        rdv.typeRdv === 'PRESENTIEL_CLIENT' || rdv.lieu?.toLowerCase().includes('client')
      ).length;

      const candidatsRealises = posteRdvs.filter(rdv => rdv.statut === 'REALISE').length;
      const candidatsAnnules = posteRdvs.filter(rdv => rdv.statut === 'ANNULE').length;
      const candidatsEnCours = posteRdvs.filter(rdv => rdv.statut === 'ENCOURS').length;

      setStatistics({
        totalCandidats: uniqueCandidats.size,
        rdvRecruteur,
        rdvClient,
        candidatsAvecRdv: uniqueCandidats.size,
        candidatsRealises,
        candidatsAnnules,
        candidatsEnCours,
      });
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique du poste:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'REALISE':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'ENCOURS':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'ANNULE':
        return 'bg-red-500/10 text-red-700 border-red-500/20';
      case 'TERMINE':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const getRdvTypeColor = (type: string) => {
    switch (type) {
      case 'TELEPHONE':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'PRESENTIEL_CLIENT':
        return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
      case 'TEAMS':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  // Grouper les RDVs par candidat
  const rdvsByCandidat = rdvs.reduce((acc, rdv) => {
    const candidatId = rdv.candidatId || 'unknown';
    if (!acc[candidatId]) {
      acc[candidatId] = {
        candidat: rdv.candidatDetails,
        rdvs: []
      };
    }
    acc[candidatId].rdvs.push(rdv);
    return acc;
  }, {} as Record<string, { candidat?: Candidat; rdvs: RdvWithDetails[] }>);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Historique du poste : {poste?.nomPoste || 'Chargement...'}</DialogTitle>
          <DialogDescription>
            Statistiques de recrutement et historique des rendez-vous pour ce poste
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs defaultValue="statistics" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="statistics">Statistiques</TabsTrigger>
              <TabsTrigger value="candidats">Par candidat</TabsTrigger>
              <TabsTrigger value="chronologique">Chronologique</TabsTrigger>
            </TabsList>

            <TabsContent value="statistics" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Total candidats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statistics.totalCandidats}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      RDV Recruteur
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statistics.rdvRecruteur}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      RDV Client
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statistics.rdvClient}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Candidats avec RDV
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statistics.candidatsAvecRdv}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Réalisés
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {statistics.candidatsRealises}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      En cours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {statistics.candidatsEnCours}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Annulés
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {statistics.candidatsAnnules}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="candidats">
              <ScrollArea className="h-[400px] pr-4">
                {Object.entries(rdvsByCandidat).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun rendez-vous trouvé pour ce poste
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(rdvsByCandidat).map(([candidatId, data]) => (
                      <Card key={candidatId}>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {data.candidat ? 
                              `${data.candidat.prenom} ${data.candidat.nom}` : 
                              'Candidat inconnu'
                            }
                            <Badge className="ml-2" variant="outline">
                              {data.rdvs.length} RDV
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {data.rdvs.map((rdv) => (
                              <div 
                                key={rdv.id} 
                                className="flex items-center justify-between p-2 rounded-lg border"
                              >
                                <div className="flex items-center gap-3">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-sm font-medium">
                                      {format(new Date(rdv.date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{rdv.typeRdv}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Badge className={getRdvTypeColor(rdv.typeRdv)}>
                                    {rdv.typeRdv === 'PRESENTIEL_CLIENT' ? 'Client' : 
                                     rdv.typeRdv === 'TELEPHONE' ? 'Téléphone' : 'Teams'}
                                  </Badge>
                                  <Badge className={getStatusColor(rdv.statut)}>
                                    {rdv.statut}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="chronologique">
              <ScrollArea className="h-[400px] pr-4">
                {rdvs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun rendez-vous trouvé pour ce poste
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rdvs
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((rdv) => (
                        <div 
                          key={rdv.id} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">
                                {rdv.candidatDetails ? 
                                  `${rdv.candidatDetails.prenom} ${rdv.candidatDetails.nom}` : 
                                  'Candidat inconnu'
                                }
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(rdv.date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                              </p>
                              {rdv.lieu && (
                                <p className="text-xs text-muted-foreground">📍 {rdv.lieu}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getRdvTypeColor(rdv.typeRdv)}>
                              {rdv.typeRdv === 'PRESENTIEL_CLIENT' ? 'Client' : 
                               rdv.typeRdv === 'TELEPHONE' ? 'Téléphone' : 'Teams'}
                            </Badge>
                            <Badge className={getStatusColor(rdv.statut)}>
                              {rdv.statut}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};