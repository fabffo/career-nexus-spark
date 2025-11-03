import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  candidatService, 
  clientService, 
  rdvService, 
  posteService
} from '@/services';
import { contratService, prestataireService } from '@/services/contratService';
import { supabase } from '@/integrations/supabase/client';
import { Candidat, Client, Rdv, PosteClient } from '@/types/models';
import { Contrat } from '@/types/contrat';
import { Users, Building2, Calendar, Briefcase, TrendingUp, Clock, UserCheck, FileText, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import CalendrierRecrutement from '@/components/calendrier/CalendrierRecrutement';
import { RecrutementGlobalView } from '@/components/recrutement/RecrutementGlobalView';
import { RecrutementPosteDetail } from '@/components/recrutement/RecrutementPosteDetail';
import { AssociateCandidatsDialog } from '@/components/AssociateCandidatsDialog';

interface PosteWithDetails extends PosteClient {
  localisation?: string;
  rdvs?: Array<Rdv & { candidat?: Candidat; client?: Client }>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    candidats: 0,
    clients: 0,
    rdvs: 0,
    postes: 0,
    prestataires: 0,
    contratsActifs: 0,
  });
  const [recentRdvs, setRecentRdvs] = useState<Rdv[]>([]);
  const [activePostes, setActivePostes] = useState<PosteClient[]>([]);
  const [activeContrats, setActiveContrats] = useState<Contrat[]>([]);
  const [postesWithDetails, setPostesWithDetails] = useState<PosteWithDetails[]>([]);
  const [selectedPoste, setSelectedPoste] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      console.log('Loading dashboard data...');
      
      // Charger les candidats directement depuis Supabase
      const { count: candidatsCount } = await supabase
        .from('candidats')
        .select('*', { count: 'exact', head: true });
        
      // Charger les clients directement depuis Supabase
      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });
        
      // Charger les prestataires directement depuis Supabase
      const { count: prestatairesCount } = await supabase
        .from('prestataires')
        .select('*', { count: 'exact', head: true });
        
      // Charger les RDVs
      const { data: rdvs } = await supabase
        .from('rdvs')
        .select('*')
        .order('date', { ascending: false });
        
      // Charger les postes
      const { data: postes } = await supabase
        .from('postes')
        .select('*')
        .order('created_at', { ascending: false });
        
      // Charger les contrats
      const { data: contrats } = await supabase
        .from('contrats')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('Dashboard data loaded:', {
        candidats: candidatsCount,
        clients: clientsCount, 
        rdvs: rdvs?.length || 0,
        postes: postes?.length || 0,
        prestataires: prestatairesCount,
        contrats: contrats?.length || 0
      });

      // Filter active contracts
      const contratsActifs = (contrats || []).filter(c => c.statut === 'ACTIF');

      setStats({
        candidats: candidatsCount || 0,
        clients: clientsCount || 0,
        rdvs: rdvs?.length || 0,
        postes: postes?.length || 0,
        prestataires: prestatairesCount || 0,
        contratsActifs: contratsActifs.length,
      });

      // Get recent RDVs - transformer les données pour correspondre au type Rdv
      const upcomingRdvs = (rdvs || [])
        .filter(rdv => rdv.statut === 'ENCOURS')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5)
        .map(rdv => ({
          ...rdv,
          date: new Date(rdv.date),
          createdAt: new Date(rdv.created_at),
          updatedAt: new Date(rdv.updated_at),
          candidatId: rdv.candidat_id,
          clientId: rdv.client_id,
          typeRdv: rdv.type_rdv as any,
          rdvType: rdv.rdv_type,
          recruteurId: rdv.recruteur_id,
          referentId: rdv.referent_id,
          posteId: rdv.poste_id
        }));
      setRecentRdvs(upcomingRdvs);

      // Get active positions - transformer les données pour correspondre au type PosteClient  
      const activePositions = (postes || [])
        .filter(poste => poste.statut === 'OUVERT' || poste.statut === 'ENCOURS')
        .slice(0, 5)
        .map(poste => ({
          ...poste,
          createdAt: new Date(poste.created_at),
          updatedAt: new Date(poste.updated_at),
          clientId: poste.client_id,
          nomPoste: poste.titre,
          dateCreation: new Date(poste.created_at),
          typeContrat: poste.type_contrat,
          typePrestation: (poste.type_prestation || 'RECRUTEMENT') as any,
          salaireMin: poste.salaire_min,
          salaireMax: poste.salaire_max,
          detail: poste.description || '',
          statut: poste.statut as any
        }));
      setActivePostes(activePositions);

      // Get active contracts
      setActiveContrats(contratsActifs.slice(0, 5));

      // Charger les postes avec les candidats et RDVs
      const { data: postesWithRdvs } = await supabase
        .from('postes')
        .select(`
          *,
          rdvs:rdvs(
            *,
            candidat:candidats(*),
            client:clients(*)
          )
        `)
        .in('statut', ['OUVERT', 'ENCOURS'])
        .order('created_at', { ascending: false });

      if (postesWithRdvs) {
        const mappedPostes: PosteWithDetails[] = postesWithRdvs.map(poste => ({
          id: poste.id,
          createdAt: new Date(poste.created_at),
          updatedAt: new Date(poste.updated_at),
          clientId: poste.client_id,
          nomPoste: poste.titre,
          dateCreation: new Date(poste.created_at),
          typeContrat: poste.type_contrat,
          typePrestation: (poste.type_prestation || 'RECRUTEMENT') as any,
          salaireMin: poste.salaire_min,
          salaireMax: poste.salaire_max,
          detail: poste.description || '',
          statut: poste.statut as any,
          titre: poste.titre,
          description: poste.description,
          localisation: poste.localisation,
          competences: poste.competences,
          rdvs: (poste.rdvs || []).map((rdv: any) => ({
            ...rdv,
            id: rdv.id,
            date: new Date(rdv.date),
            createdAt: new Date(rdv.created_at),
            updatedAt: new Date(rdv.updated_at),
            candidatId: rdv.candidat_id,
            clientId: rdv.client_id,
            typeRdv: rdv.type_rdv,
            rdvType: rdv.rdv_type,
            recruteurId: rdv.recruteur_id,
            referentId: rdv.referent_id,
            posteId: rdv.poste_id,
            statut: rdv.statut,
            lieu: rdv.lieu,
            notes: rdv.notes,
            candidat: rdv.candidat ? {
              id: rdv.candidat.id,
              nom: rdv.candidat.nom,
              prenom: rdv.candidat.prenom,
              email: rdv.candidat.email,
              telephone: rdv.candidat.telephone,
              metier: rdv.candidat.metier,
              cvUrl: rdv.candidat.cv_url,
              recommandationUrl: rdv.candidat.recommandation_url,
              detailCv: rdv.candidat.detail_cv,
              createdAt: new Date(rdv.candidat.created_at),
              updatedAt: new Date(rdv.candidat.updated_at)
            } : undefined,
            client: rdv.client ? {
              id: rdv.client.id,
              raisonSociale: rdv.client.raison_sociale,
              email: rdv.client.email,
              telephone: rdv.client.telephone,
              adresse: rdv.client.adresse,
              createdAt: new Date(rdv.client.created_at),
              updatedAt: new Date(rdv.client.updated_at)
            } : undefined
          }))
        }));
        setPostesWithDetails(mappedPostes);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const statCards = [
    { 
      title: 'Candidats', 
      value: stats.candidats, 
      icon: Users, 
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      route: '/candidats',
    },
    { 
      title: 'Clients', 
      value: stats.clients, 
      icon: Building2, 
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      route: '/clients',
    },
    { 
      title: 'Prestataires', 
      value: stats.prestataires, 
      icon: UserCheck, 
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      route: '/prestataires',
    },
    { 
      title: 'Rendez-vous', 
      value: stats.rdvs, 
      icon: Calendar, 
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      route: '/rdv',
    },
    { 
      title: 'Postes ouverts', 
      value: stats.postes, 
      icon: Briefcase, 
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      route: '/postes',
    },
    { 
      title: 'Contrats actifs', 
      value: stats.contratsActifs, 
      icon: FileText, 
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      route: '/contrats',
    },
  ];

  const getStatusBadge = (statut: string) => {
    const variants: Record<string, string> = {
      'ENCOURS': 'bg-blue-100 text-blue-800',
      'REALISE': 'bg-green-100 text-green-800',
      'TERMINE': 'bg-gray-100 text-gray-800',
      'ANNULE': 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={cn('font-medium', variants[statut] || variants['ENCOURS'])}>
        {statut}
      </Badge>
    );
  };

  const [selectedPosteForDetail, setSelectedPosteForDetail] = useState<string | null>(null);
  const [showRecrutementDetail, setShowRecrutementDetail] = useState(false);
  const [associateDialogOpen, setAssociateDialogOpen] = useState(false);
  const [selectedPosteForCandidats, setSelectedPosteForCandidats] = useState<{ id: string; titre: string } | null>(null);

  return (
    <div className="space-y-8">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="recrutement">Suivi Recrutements</TabsTrigger>
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
            <p className="text-muted-foreground mt-2">
              Vue d'ensemble de votre activité de recrutement
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(stat.route)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <Icon className={cn('h-4 w-4', stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center text-xs text-muted-foreground mt-2">
                  <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                  <span>+12% ce mois</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>


      {/* Postes en cours avec candidats et RDVs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Suivi des postes en cours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">Tous les postes</TabsTrigger>
              <TabsTrigger value="todo">RDV à faire</TabsTrigger>
              <TabsTrigger value="done">RDV réalisés</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="space-y-4">
                {/* En-têtes des colonnes */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Postes ({postesWithDetails.length})</h3>
                  <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    RDV à faire
                  </h3>
                  <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    RDV réalisés
                  </h3>
                </div>

                {/* Lignes de postes avec leurs RDV */}
                {postesWithDetails.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucun poste en cours</p>
                ) : (
                  postesWithDetails.map((poste) => {
                    const now = new Date();
                    const rdvsAFaire = poste.rdvs?.filter(rdv => 
                      rdv.statut === 'ENCOURS' && new Date(rdv.date) >= now
                    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];
                    
                    const rdvsRealises = poste.rdvs?.filter(rdv => 
                      rdv.statut === 'REALISE' || rdv.statut === 'TERMINE' || new Date(rdv.date) < now
                    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

                    return (
                      <div key={poste.id} className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-card/50">
                        {/* Poste */}
                        <div className="space-y-1">
                          <p className="font-medium">{poste.nomPoste}</p>
                          {poste.localisation && (
                            <p className="text-xs text-muted-foreground">📍 {poste.localisation}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {poste.rdvs?.length || 0} RDV total
                          </p>
                        </div>

                        {/* RDV à faire */}
                        <div className="space-y-2">
                          {rdvsAFaire.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Aucun RDV à faire</p>
                          ) : (
                            rdvsAFaire.map(rdv => (
                              <div key={rdv.id} className="p-2 border rounded bg-background space-y-1">
                                <p className="text-sm font-medium">
                                  {rdv.candidat ? `${rdv.candidat.prenom} ${rdv.candidat.nom}` : 'Candidat inconnu'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(rdv.date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                </p>
                                {rdv.typeRdv && (
                                  <p className="text-xs text-muted-foreground">{rdv.typeRdv}</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* RDV réalisés */}
                        <div className="space-y-2">
                          {rdvsRealises.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Aucun RDV réalisé</p>
                          ) : (
                            rdvsRealises.map(rdv => (
                              <div key={rdv.id} className="p-2 border rounded bg-background space-y-1">
                                <p className="text-sm font-medium">
                                  {rdv.candidat ? `${rdv.candidat.prenom} ${rdv.candidat.nom}` : 'Candidat inconnu'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(rdv.date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                </p>
                                {rdv.typeRdv && (
                                  <p className="text-xs text-muted-foreground">{rdv.typeRdv}</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="todo" className="mt-4">
              <div className="space-y-4">
                {/* En-têtes des colonnes */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Postes</h3>
                  <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    RDV à faire
                  </h3>
                  <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    RDV réalisés
                  </h3>
                </div>

                {/* Lignes de postes avec leurs RDV */}
                {postesWithDetails.filter(p => {
                  const now = new Date();
                  return p.rdvs?.some(r => r.statut === 'ENCOURS' && new Date(r.date) >= now);
                }).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucun poste avec RDV à faire</p>
                ) : (
                  postesWithDetails
                    .filter(p => {
                      const now = new Date();
                      return p.rdvs?.some(r => r.statut === 'ENCOURS' && new Date(r.date) >= now);
                    })
                    .map((poste) => {
                      const now = new Date();
                      const rdvsAFaire = poste.rdvs?.filter(rdv => 
                        rdv.statut === 'ENCOURS' && new Date(rdv.date) >= now
                      ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];
                      
                      const rdvsRealises = poste.rdvs?.filter(rdv => 
                        rdv.statut === 'REALISE' || rdv.statut === 'TERMINE' || new Date(rdv.date) < now
                      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

                      return (
                        <div key={poste.id} className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-card/50">
                          {/* Poste */}
                          <div className="space-y-1">
                            <p className="font-medium">{poste.nomPoste}</p>
                            {poste.localisation && (
                              <p className="text-xs text-muted-foreground">📍 {poste.localisation}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {rdvsAFaire.length} RDV à faire
                            </p>
                          </div>

                          {/* RDV à faire */}
                          <div className="space-y-2">
                            {rdvsAFaire.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">Aucun RDV à faire</p>
                            ) : (
                              rdvsAFaire.map(rdv => (
                                <div key={rdv.id} className="p-2 border rounded bg-background space-y-1">
                                  <p className="text-sm font-medium">
                                    {rdv.candidat ? `${rdv.candidat.prenom} ${rdv.candidat.nom}` : 'Candidat inconnu'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(rdv.date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                  </p>
                                  {rdv.typeRdv && (
                                    <p className="text-xs text-muted-foreground">{rdv.typeRdv}</p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {/* RDV réalisés */}
                          <div className="space-y-2">
                            {rdvsRealises.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">Aucun RDV réalisé</p>
                            ) : (
                              rdvsRealises.map(rdv => (
                                <div key={rdv.id} className="p-2 border rounded bg-background space-y-1">
                                  <p className="text-sm font-medium">
                                    {rdv.candidat ? `${rdv.candidat.prenom} ${rdv.candidat.nom}` : 'Candidat inconnu'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(rdv.date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                  </p>
                                  {rdv.typeRdv && (
                                    <p className="text-xs text-muted-foreground">{rdv.typeRdv}</p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </TabsContent>

            <TabsContent value="done" className="mt-4">
              <div className="space-y-4">
                {/* En-têtes des colonnes */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Postes</h3>
                  <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    RDV à faire
                  </h3>
                  <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    RDV réalisés
                  </h3>
                </div>

                {/* Lignes de postes avec leurs RDV */}
                {postesWithDetails.filter(p => {
                  const now = new Date();
                  return p.rdvs?.some(r => r.statut === 'REALISE' || r.statut === 'TERMINE' || new Date(r.date) < now);
                }).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucun poste avec RDV réalisés</p>
                ) : (
                  postesWithDetails
                    .filter(p => {
                      const now = new Date();
                      return p.rdvs?.some(r => r.statut === 'REALISE' || r.statut === 'TERMINE' || new Date(r.date) < now);
                    })
                    .map((poste) => {
                      const now = new Date();
                      const rdvsAFaire = poste.rdvs?.filter(rdv => 
                        rdv.statut === 'ENCOURS' && new Date(rdv.date) >= now
                      ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];
                      
                      const rdvsRealises = poste.rdvs?.filter(rdv => 
                        rdv.statut === 'REALISE' || rdv.statut === 'TERMINE' || new Date(rdv.date) < now
                      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

                      return (
                        <div key={poste.id} className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-card/50">
                          {/* Poste */}
                          <div className="space-y-1">
                            <p className="font-medium">{poste.nomPoste}</p>
                            {poste.localisation && (
                              <p className="text-xs text-muted-foreground">📍 {poste.localisation}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {rdvsRealises.length} RDV réalisés
                            </p>
                          </div>

                          {/* RDV à faire */}
                          <div className="space-y-2">
                            {rdvsAFaire.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">Aucun RDV à faire</p>
                            ) : (
                              rdvsAFaire.map(rdv => (
                                <div key={rdv.id} className="p-2 border rounded bg-background space-y-1">
                                  <p className="text-sm font-medium">
                                    {rdv.candidat ? `${rdv.candidat.prenom} ${rdv.candidat.nom}` : 'Candidat inconnu'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(rdv.date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                  </p>
                                  {rdv.typeRdv && (
                                    <p className="text-xs text-muted-foreground">{rdv.typeRdv}</p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {/* RDV réalisés */}
                          <div className="space-y-2">
                            {rdvsRealises.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">Aucun RDV réalisé</p>
                            ) : (
                              rdvsRealises.map(rdv => (
                                <div key={rdv.id} className="p-2 border rounded bg-background space-y-1">
                                  <p className="text-sm font-medium">
                                    {rdv.candidat ? `${rdv.candidat.prenom} ${rdv.candidat.nom}` : 'Candidat inconnu'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(rdv.date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                  </p>
                                  {rdv.typeRdv && (
                                    <p className="text-xs text-muted-foreground">{rdv.typeRdv}</p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="recrutement" className="mt-6">
          {showRecrutementDetail && selectedPosteForDetail ? (
            <RecrutementPosteDetail
              posteId={selectedPosteForDetail}
              onBack={() => setShowRecrutementDetail(false)}
            />
          ) : (
            <RecrutementGlobalView
              onPosteClick={(posteId) => {
                setSelectedPosteForDetail(posteId);
                setShowRecrutementDetail(true);
              }}
              onCandidatsClick={(posteId, posteTitle) => {
                setSelectedPosteForCandidats({ id: posteId, titre: posteTitle });
                setAssociateDialogOpen(true);
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <CalendrierRecrutement />
        </TabsContent>
      </Tabs>

      {/* Dialog pour gérer les candidats d'un poste */}
      {selectedPosteForCandidats && (
        <AssociateCandidatsDialog
          open={associateDialogOpen}
          onOpenChange={(open) => {
            setAssociateDialogOpen(open);
            if (!open) setSelectedPosteForCandidats(null);
          }}
          posteId={selectedPosteForCandidats.id}
          posteTitle={selectedPosteForCandidats.titre}
        />
      )}
    </div>
  );
}