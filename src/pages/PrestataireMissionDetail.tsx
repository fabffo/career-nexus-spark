import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  ArrowLeft, Calendar, DollarSign, Clock, TrendingUp, 
  FileText, CheckCircle, XCircle, User, Building, Briefcase 
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { craService } from "@/services/craService";
import { CRA, CRAJour } from "@/types/cra";

export default function PrestataireMissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [prestataire, setPrestataire] = useState<any>(null);
  const [mission, setMission] = useState<any>(null);
  const [cras, setCras] = useState<CRA[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [craJours, setCraJours] = useState<CRAJour[]>([]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger le prestataire
      const { data: prestataireData, error: prestataireError } = await supabase
        .from('prestataires')
        .select('*')
        .eq('id', id)
        .single();

      if (prestataireError) throw prestataireError;
      setPrestataire(prestataireData);

      // Charger les missions CLIENTS actives pour ce prestataire
      const { data: missionsData } = await supabase
        .from('missions')
        .select(`
          *,
          contrat:contrats(
            *,
            client:clients(*)
          ),
          prestataire:prestataires(*),
          salarie:salaries(*)
        `)
        .eq('prestataire_id', id)
        .eq('statut', 'EN_COURS')
        .not('contrat_id', 'is', null)
        .order('created_at', { ascending: false });

      console.log('Missions trouvées:', missionsData);
      
      // Prendre la première mission OU celle qui a un TJM défini
      let missionData = missionsData?.find(m => m.tjm != null) || missionsData?.[0] || null;
      
      console.log('Mission sélectionnée:', missionData?.numero_mission, 'TJM:', missionData?.tjm);
      
      if (!missionData && prestataireData.salarie_id) {
        const { data: missionDataSalarie } = await supabase
          .from('missions')
          .select(`
            *,
            contrat:contrats(
              *,
              client:clients(*)
            ),
            prestataire:prestataires(*),
            salarie:salaries(*)
          `)
          .eq('salarie_id', prestataireData.salarie_id)
          .eq('statut', 'EN_COURS')
          .not('contrat_id', 'is', null)
          .maybeSingle();
        
        missionData = missionDataSalarie;
      }

      setMission(missionData);

      // Charger les CRA de l'année en cours
      if (missionData) {
        console.log('Chargement CRA pour mission:', missionData.id);
        
        const { data: crasData, error: crasError } = await supabase
          .from('cra')
          .select('*')
          .eq('mission_id', missionData.id)
          .eq('annee', new Date().getFullYear())
          .order('mois', { ascending: false });

        console.log('CRA trouvés:', crasData);
        
        if (crasError) throw crasError;
        setCras((crasData || []) as CRA[]);

        // Charger les jours du CRA du mois actuel
        const currentMonth = new Date().getMonth() + 1;
        const currentCra = crasData?.find(c => c.mois === currentMonth);
        if (currentCra) {
          const jours = await craService.getJoursByCRA(currentCra.id);
          setCraJours(jours);
        }
      }

    } catch (error: any) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = () => {
    // Utiliser le dernier CRA disponible au lieu du mois en cours
    const dernierCra = cras.length > 0 ? cras[0] : null;
    
    const joursConsommes = cras.reduce((sum, cra) => sum + (cra.jours_travailles || 0), 0);
    const caMensuel = dernierCra?.ca_mensuel || 0;
    const caTotal = cras.reduce((sum, cra) => sum + (cra.ca_mensuel || 0), 0);

    return {
      joursConsommes,
      caMensuel,
      caTotal,
      tjm: mission?.tjm || 0
    };
  };

  const metrics = calculateMetrics();

  const getDayStatus = (date: Date): CRAJour | undefined => {
    return craJours.find(j => isSameDay(new Date(j.date), date));
  };

  const getStatusColor = (typeJour?: string) => {
    if (!typeJour) return "bg-gray-100";
    switch(typeJour) {
      case 'TRAVAILLE': return "bg-green-100 text-green-800";
      case 'CONGE_PAYE':
      case 'RTT': return "bg-orange-100 text-orange-800";
      case 'ABSENCE':
      case 'ARRET_MALADIE': return "bg-red-100 text-red-800";
      case 'FERIE':
      case 'WEEKEND': return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!prestataire) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Prestataire non trouvé</h2>
          <Button onClick={() => navigate('/prestataires-missions')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/prestataires-missions')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">
              {prestataire.prenom?.[0]}{prestataire.nom?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{prestataire.prenom} {prestataire.nom}</h1>
            <p className="text-muted-foreground">{prestataire.email}</p>
          </div>
        </div>
        {mission && (
          <Button onClick={() => navigate(`/cra-gestion?prestataire=${id}&mission=${mission.id}`)}>
            <FileText className="h-4 w-4 mr-2" />
            Saisir CRA
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mission" className="space-y-6">
        <TabsList>
          <TabsTrigger value="mission">Informations Mission</TabsTrigger>
          <TabsTrigger value="financier">Suivi Financier</TabsTrigger>
          <TabsTrigger value="cra">CRA & Activité</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        {/* Onglet Mission */}
        <TabsContent value="mission" className="space-y-6">
          {mission ? (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Détails de la Mission
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Poste</label>
                      <p className="text-lg font-medium">{mission.titre}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <p>{mission.description || 'Aucune description'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Localisation</label>
                      <p>{mission.localisation || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Statut</label>
                      <div className="mt-1">
                        <Badge className="bg-green-500">En cours</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Client
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Raison sociale</label>
                      <p className="text-lg font-medium">
                        {mission.contrat?.client?.raison_sociale || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Secteur</label>
                      <p>{mission.contrat?.client?.secteur_activite || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Contact</label>
                      <p>{mission.contrat?.client?.email || '-'}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Période de Mission
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Date de début</label>
                      <p className="text-lg font-medium">
                        {mission.date_debut 
                          ? format(new Date(mission.date_debut), 'dd MMMM yyyy', { locale: fr })
                          : '-'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Date de fin</label>
                      <p className="text-lg font-medium">
                        {mission.date_fin 
                          ? format(new Date(mission.date_fin), 'dd MMMM yyyy', { locale: fr })
                          : 'En cours'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Durée</label>
                      <p className="text-lg font-medium">
                        {mission.date_debut && mission.date_fin
                          ? `${Math.ceil((new Date(mission.date_fin).getTime() - new Date(mission.date_debut).getTime()) / (1000 * 60 * 60 * 24 * 30))} mois`
                          : 'Indéterminée'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Aucune mission active pour ce prestataire</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Onglet Financier */}
        <TabsContent value="financier" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">TJM</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.tjm} €</div>
                <p className="text-xs text-muted-foreground">Taux Moyen Journalier</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CA Mois</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.caMensuel.toLocaleString('fr-FR')} €</div>
                <p className="text-xs text-muted-foreground">{metrics.joursConsommes} jours consommés</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CA Total</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.caTotal.toLocaleString('fr-FR')} €</div>
                <p className="text-xs text-muted-foreground">Depuis le début</p>
              </CardContent>
            </Card>
          </div>

          {/* Graphique de répartition mensuelle (placeholder) */}
          <Card>
            <CardHeader>
              <CardTitle>Répartition Mensuelle ({new Date().getFullYear()})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cras.map(cra => (
                  <div key={cra.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{cra.mois}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(2025, cra.mois - 1), 'MMM', { locale: fr })}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">
                          {cra.jours_travailles} jours travaillés
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {cra.total_heures}h • {cra.jours_conges} congés • {cra.jours_absence} absences
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">
                        {cra.ca_mensuel.toLocaleString('fr-FR')} €
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {cra.statut === 'VALIDE' ? (
                          <Badge className="bg-green-500">Validé</Badge>
                        ) : cra.statut === 'SOUMIS' ? (
                          <Badge className="bg-orange-500">En attente</Badge>
                        ) : (
                          <Badge variant="outline">Brouillon</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet CRA */}
        <TabsContent value="cra" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Calendrier d'Activité - {format(selectedDate, 'MMMM yyyy', { locale: fr })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    className="rounded-md border"
                  />
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
                      <span className="text-sm">Travaillé</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-orange-100 border border-orange-300"></div>
                      <span className="text-sm">Congé / RTT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
                      <span className="text-sm">Absence</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
                      <span className="text-sm">Weekend / Férié</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Récapitulatif du mois</h3>
                  <div className="space-y-4">
                    {cras.find(c => c.mois === selectedDate.getMonth() + 1) ? (
                      <>
                        <div className="flex justify-between">
                          <span>Jours travaillés:</span>
                          <span className="font-bold">{cras.find(c => c.mois === selectedDate.getMonth() + 1)?.jours_travailles || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Congés:</span>
                          <span className="font-bold">{cras.find(c => c.mois === selectedDate.getMonth() + 1)?.jours_conges || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Absences:</span>
                          <span className="font-bold">{cras.find(c => c.mois === selectedDate.getMonth() + 1)?.jours_absence || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total heures:</span>
                          <span className="font-bold">{cras.find(c => c.mois === selectedDate.getMonth() + 1)?.total_heures || 0}h</span>
                        </div>
                        <div className="flex justify-between pt-4 border-t">
                          <span className="font-semibold">CA du mois:</span>
                          <span className="font-bold text-green-600">
                            {(cras.find(c => c.mois === selectedDate.getMonth() + 1)?.ca_mensuel || 0).toLocaleString('fr-FR')} €
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        Aucun CRA pour ce mois
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique des CRA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cras.map(cra => (
                  <div key={cra.id} className="flex items-center justify-between p-3 border rounded hover:bg-accent">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium">
                          {format(new Date(cra.annee, cra.mois - 1), 'MMMM yyyy', { locale: fr })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {cra.jours_travailles} jours • {cra.total_heures}h
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">{cra.ca_mensuel.toLocaleString('fr-FR')} €</div>
                      </div>
                      {cra.statut === 'VALIDE' ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Validé
                        </Badge>
                      ) : cra.statut === 'SOUMIS' ? (
                        <Badge className="bg-orange-500">
                          <Clock className="h-3 w-3 mr-1" />
                          En attente
                        </Badge>
                      ) : cra.statut === 'REJETE' ? (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejeté
                        </Badge>
                      ) : (
                        <Badge variant="outline">Brouillon</Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/cra-gestion?prestataire=${id}&mission=${mission?.id}&cra=${cra.id}`)}
                      >
                        Voir
                      </Button>
                    </div>
                  </div>
                ))}
                {cras.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun CRA enregistré
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Historique */}
        <TabsContent value="historique" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Missions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Fonctionnalité à venir
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
