import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Users, Building2, Calendar, Briefcase, TrendingUp, Clock, UserCheck, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

  return (
    <div className="space-y-8">
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming RDVs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Prochains rendez-vous
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRdvs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun rendez-vous à venir</p>
            ) : (
              <div className="space-y-4">
                {recentRdvs.map((rdv) => (
                  <div key={rdv.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {format(new Date(rdv.date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {rdv.typeRdv}
                        </Badge>
                        {rdv.lieu && <span>{rdv.lieu}</span>}
                      </div>
                    </div>
                    {getStatusBadge(rdv.statut)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Positions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Postes actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activePostes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun poste actif</p>
            ) : (
              <div className="space-y-4">
                {activePostes.map((poste) => (
                  <div key={poste.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{poste.nomPoste}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          Créé le {format(new Date(poste.dateCreation), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(poste.statut)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Contracts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Contrats actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeContrats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun contrat actif</p>
            ) : (
              <div className="space-y-4">
                {activeContrats.map((contrat) => (
                  <div key={contrat.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{contrat.numero_contrat}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {contrat.client?.raison_sociale || contrat.prestataire?.nom || 'N/A'}
                        </span>
                        {contrat.date_debut && (
                          <span>• Depuis le {format(new Date(contrat.date_debut), 'dd/MM/yyyy')}</span>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      ACTIF
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}