import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, DollarSign, Clock, FileText, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format, getDaysInMonth, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

interface PrestataireMission {
  id: string;
  nom: string;
  prenom: string;
  mission?: {
    id: string;
    titre: string;
    tjm?: number;
    date_debut?: string;
    date_fin?: string;
    statut?: string;
    contrat?: {
      client?: {
        raison_sociale: string;
      };
    };
  };
  cra_actuel?: {
    statut: string;
    jours_travailles: number;
    ca_mensuel: number;
  };
}

export default function PrestatairesMissions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [prestataires, setPrestataires] = useState<PrestataireMission[]>([]);
  const [filteredPrestataires, setFilteredPrestataires] = useState<PrestataireMission[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<string>("tous");
  
  const [stats, setStats] = useState({
    prestatairesMission: 0,
    prestatairesTotal: 0,
    caMonth: 0,
    caYear: 0,
    joursConsommesMois: 0,
    joursRestantsMois: 0,
    craEnAttente: 0
  });

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    filterPrestataires();
  }, [prestataires, searchTerm, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger les prestataires avec leurs missions actives
      const { data: prestatairesData, error: prestataireError } = await supabase
        .from('prestataires')
        .select(`
          id,
          nom,
          prenom,
          email,
          salarie_id
        `);

      if (prestataireError) throw prestataireError;

      // Charger les missions actives de type CLIENT uniquement
      const { data: missionsData, error: missionError } = await supabase
        .from('missions')
        .select(`
          id,
          titre,
          tjm,
          date_debut,
          date_fin,
          statut,
          type_mission,
          prestataire_id,
          salarie_id,
          contrat:contrats(
            client:clients(raison_sociale)
          )
        `)
        .eq('statut', 'EN_COURS')
        .not('contrat_id', 'is', null);

      if (missionError) throw missionError;

      // Charger les CRA du mois sélectionné
      const { data: crasData, error: craError } = await supabase
        .from('cra')
        .select('*')
        .eq('annee', selectedYear)
        .eq('mois', selectedMonth);

      if (craError) throw craError;

      // Combiner les données - créer une ligne par mission de prestataire
      const prestatairesMissions: PrestataireMission[] = [];
      
      prestatairesData.forEach(p => {
        // Chercher toutes les missions pour ce prestataire
        const missions = missionsData?.filter(m => 
          m.prestataire_id === p.id || (p.salarie_id && m.salarie_id === p.salarie_id)
        ) || [];
        
        // Ne créer des lignes QUE pour les prestataires avec missions clients actives
        missions.forEach(mission => {
          const cra = crasData?.find(c => 
            c.prestataire_id === p.id && c.mission_id === mission.id
          );
          
          prestatairesMissions.push({
            ...p,
            mission: mission,
            cra_actuel: cra ? {
              statut: cra.statut,
              jours_travailles: cra.jours_travailles || 0,
              ca_mensuel: cra.ca_mensuel || 0
            } : undefined
          });
        });
      });

      // Filtrer pour ne garder QUE les lignes avec un client
      const prestatairesMissionsAvecClient = prestatairesMissions.filter(pm => 
        pm.mission?.contrat?.client?.raison_sociale
      );
      
      setPrestataires(prestatairesMissionsAvecClient);

      // Calculer les stats
      const prestatairesMission = prestatairesMissionsAvecClient.filter(p => p.mission).length;
      const caMonth = crasData?.reduce((sum, cra) => sum + (cra.ca_mensuel || 0), 0) || 0;
      
      // CA annuel (tous les mois de l'année)
      const { data: crasAnnee } = await supabase
        .from('cra')
        .select('ca_mensuel')
        .eq('annee', selectedYear);
      const caYear = crasAnnee?.reduce((sum, cra) => sum + (cra.ca_mensuel || 0), 0) || 0;

      const joursConsommesMois = crasData?.reduce((sum, cra) => sum + (cra.jours_travailles || 0), 0) || 0;
      const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth - 1));
      const joursRestantsMois = Math.max(0, daysInMonth - new Date().getDate());
      const craEnAttente = crasData?.filter(cra => cra.statut === 'SOUMIS').length || 0;

      setStats({
        prestatairesMission,
        prestatairesTotal: prestatairesData.length,
        caMonth,
        caYear,
        joursConsommesMois,
        joursRestantsMois,
        craEnAttente
      });

    } catch (error: any) {
      console.error("Erreur lors du chargement des données:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const filterPrestataires = () => {
    let filtered = [...prestataires];

    // Filtre par recherche
    if (searchTerm) {
      filtered = filtered.filter(p => 
        `${p.nom} ${p.prenom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.mission?.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.mission?.contrat?.client?.raison_sociale.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtre par statut
    if (statusFilter === "en_mission") {
      filtered = filtered.filter(p => p.mission);
    } else if (statusFilter === "termine") {
      filtered = filtered.filter(p => !p.mission);
    }

    setFilteredPrestataires(filtered);
  };

  const getStatutCRABadge = (statut?: string) => {
    if (!statut) return <Badge variant="secondary">Non rempli</Badge>;
    
    switch(statut) {
      case 'VALIDE': return <Badge className="bg-green-500">Validé</Badge>;
      case 'SOUMIS': return <Badge className="bg-orange-500">En attente</Badge>;
      case 'REJETE': return <Badge variant="destructive">Rejeté</Badge>;
      default: return <Badge variant="outline">Brouillon</Badge>;
    }
  };

  const handleValidateCRA = async (prestataire: PrestataireMission) => {
    if (!prestataire.mission) {
      toast.error("Aucune mission associée à ce prestataire");
      return;
    }

    console.log("=== Validation CRA ===");
    console.log("Mission ID:", prestataire.mission.id);
    console.log("Prestataire ID:", prestataire.id);

    try {
      // Chercher le CRA par mission + prestataire + période
      const { data: craData, error: craError } = await supabase
        .from('cra')
        .select('*')
        .eq('mission_id', prestataire.mission.id)
        .eq('prestataire_id', prestataire.id)
        .eq('annee', selectedYear)
        .eq('mois', selectedMonth)
        .maybeSingle();

      if (craError) {
        console.error("Erreur lors de la recherche du CRA:", craError);
        toast.error("Erreur lors de la recherche du CRA");
        return;
      }

      if (!craData) {
        toast.error(`Aucun CRA trouvé pour ${prestataire.prenom} ${prestataire.nom} sur cette mission en ${selectedMonth}/${selectedYear}`);
        console.error("CRA non trouvé avec:", {
          mission_id: prestataire.mission.id,
          prestataire_id: prestataire.id,
          annee: selectedYear,
          mois: selectedMonth
        });
        return;
      }

      console.log("CRA trouvé:", craData);

      if (craData.statut !== 'SOUMIS') {
        toast.error(`Le CRA est en statut "${craData.statut}". Seuls les CRA "SOUMIS" peuvent être validés.`);
        return;
      }

      // Valider le CRA
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from('cra')
        .update({
          statut: 'VALIDE',
          date_validation: new Date().toISOString(),
          valide_par: user?.id
        })
        .eq('id', craData.id);

      if (updateError) throw updateError;

      toast.success(`CRA de ${prestataire.prenom} ${prestataire.nom} validé avec succès`);
      loadData();
    } catch (error) {
      console.error("Erreur lors de la validation:", error);
      toast.error("Erreur lors de la validation du CRA");
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = [
    { value: 1, label: "Janvier" },
    { value: 2, label: "Février" },
    { value: 3, label: "Mars" },
    { value: 4, label: "Avril" },
    { value: 5, label: "Mai" },
    { value: 6, label: "Juin" },
    { value: 7, label: "Juillet" },
    { value: 8, label: "Août" },
    { value: 9, label: "Septembre" },
    { value: 10, label: "Octobre" },
    { value: 11, label: "Novembre" },
    { value: 12, label: "Décembre" }
  ];

  const columns: ColumnDef<PrestataireMission>[] = [
    {
      id: "prestataire",
      header: "Prestataire",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.prenom} {row.original.nom}
        </span>
      ),
    },
    {
      id: "client",
      header: "Client",
      cell: ({ row }) => row.original.mission?.contrat?.client?.raison_sociale || '-',
    },
    {
      id: "poste",
      header: "Mission",
      cell: ({ row }) => row.original.mission?.titre || '-',
    },
    {
      id: "dates",
      header: "Dates",
      cell: ({ row }) => {
        const mission = row.original.mission;
        if (!mission) return '-';
        return (
          <span className="text-sm">
            {mission.date_debut && format(new Date(mission.date_debut), 'dd/MM/yyyy', { locale: fr })}
            {' - '}
            {mission.date_fin ? format(new Date(mission.date_fin), 'dd/MM/yyyy', { locale: fr }) : 'En cours'}
          </span>
        );
      },
    },
    {
      id: "tjm",
      header: "TJM",
      cell: ({ row }) => (
        <span className="text-right block">
          {row.original.mission?.tjm ? `${row.original.mission.tjm} €` : '-'}
        </span>
      ),
      meta: { className: "text-right" },
    },
    {
      id: "jours_mois",
      header: "Jours (mois)",
      cell: ({ row }) => (
        <span className="text-right block">{row.original.cra_actuel?.jours_travailles || 0}</span>
      ),
      meta: { className: "text-right" },
    },
    {
      id: "ca_mois",
      header: "CA (mois)",
      cell: ({ row }) => (
        <span className="text-right block font-medium">
          {row.original.cra_actuel?.ca_mensuel 
            ? `${row.original.cra_actuel.ca_mensuel.toLocaleString('fr-FR')} €`
            : '-'
          }
        </span>
      ),
      meta: { className: "text-right" },
    },
    {
      id: "statut_cra",
      header: "Statut CRA",
      cell: ({ row }) => getStatutCRABadge(row.original.cra_actuel?.statut),
    },
    {
      id: "mission_statut",
      header: "Mission",
      cell: ({ row }) =>
        row.original.mission ? (
          <Badge className="bg-green-500">Actif</Badge>
        ) : (
          <Badge variant="secondary">Inactif</Badge>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          {row.original.cra_actuel?.statut === 'SOUMIS' && (
            <Button
              variant="default"
              size="sm"
              onClick={async (e) => {
                e.stopPropagation();
                await handleValidateCRA(row.original);
              }}
            >
              Valider CRA
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/prestataire-mission/${row.original.id}`);
            }}
          >
            Voir détail
          </Button>
        </div>
      ),
      meta: { className: "text-right" },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Suivi des Prestataires en Mission</h1>
          <p className="text-muted-foreground">Gestion des missions et CRA</p>
        </div>
        <Button onClick={() => navigate('/cra-gestion')}>
          <FileText className="h-4 w-4 mr-2" />
          Gestion des CRA
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex gap-4 items-center">
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(month => (
              <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prestataires en mission</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.prestatairesMission}</div>
            <p className="text-xs text-muted-foreground">Sur {stats.prestatairesTotal} total</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Mois</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.caMonth.toLocaleString('fr-FR')} €</div>
            <p className="text-xs text-muted-foreground">
              {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Année</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.caYear.toLocaleString('fr-FR')} €</div>
            <p className="text-xs text-muted-foreground">Année {selectedYear}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CRA en attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.craEnAttente}</div>
            <p className="text-xs text-muted-foreground">À valider</p>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex gap-4 mb-4">        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous</SelectItem>
            <SelectItem value="en_mission">En mission</SelectItem>
            <SelectItem value="termine">Terminés</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          onClick={() => navigate('/cra-gestion')}
          variant="outline"
        >
          <FileText className="h-4 w-4 mr-2" />
          Gestion des CRA
        </Button>
      </div>

      {/* Tableau des prestataires */}
      <DataTable
        columns={columns}
        data={filteredPrestataires}
        searchPlaceholder="Rechercher un prestataire, client ou poste..."
      />
    </div>
  );
}
