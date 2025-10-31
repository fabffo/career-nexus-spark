import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AddRdvDialog } from '@/components/AddRdvDialog';
import { EditRdvDialog } from '@/components/EditRdvDialog';
import { ViewRdvDialog } from '@/components/ViewRdvDialog';
import VueAnnuelle from './VueAnnuelle';
import VueMensuelle from './VueMensuelle';
import VueJournaliere from './VueJournaliere';

export type ViewMode = 'year' | 'month' | 'day';

export interface RdvData {
  id: string;
  date: Date;
  candidat_id: string;
  client_id: string | null;
  poste_id: string | null;
  type_rdv: string;
  statut: string;
  lieu: string | null;
  notes: string | null;
  candidat?: {
    nom: string;
    prenom: string;
  };
  poste?: {
    titre: string;
  };
}

export default function CalendrierRecrutement() {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rdvs, setRdvs] = useState<RdvData[]>([]);
  const [filteredRdvs, setFilteredRdvs] = useState<RdvData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [selectedRdv, setSelectedRdv] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);

  useEffect(() => {
    loadRdvs();
  }, []);

  useEffect(() => {
    filterRdvs();
  }, [rdvs, searchTerm, filterType, filterStatut]);

  const loadRdvs = async () => {
    try {
      const { data, error } = await supabase
        .from('rdvs')
        .select(`
          *,
          candidat:candidats(nom, prenom),
          poste:postes(titre)
        `)
        .order('date', { ascending: true });

      if (error) throw error;

      const mappedRdvs: RdvData[] = (data || []).map(rdv => ({
        id: rdv.id,
        date: new Date(rdv.date),
        candidat_id: rdv.candidat_id,
        client_id: rdv.client_id,
        poste_id: rdv.poste_id,
        type_rdv: rdv.type_rdv || 'TELEPHONE',
        statut: rdv.statut || 'ENCOURS',
        lieu: rdv.lieu,
        notes: rdv.notes,
        candidat: rdv.candidat,
        poste: rdv.poste
      }));

      setRdvs(mappedRdvs);
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous:', error);
    }
  };

  const filterRdvs = () => {
    let filtered = [...rdvs];

    // Filtre par recherche
    if (searchTerm) {
      filtered = filtered.filter(rdv => {
        const candidatName = rdv.candidat ? `${rdv.candidat.prenom} ${rdv.candidat.nom}`.toLowerCase() : '';
        const posteName = rdv.poste?.titre?.toLowerCase() || '';
        return candidatName.includes(searchTerm.toLowerCase()) || posteName.includes(searchTerm.toLowerCase());
      });
    }

    // Filtre par type
    if (filterType !== 'all') {
      filtered = filtered.filter(rdv => rdv.type_rdv === filterType);
    }

    // Filtre par statut
    if (filterStatut !== 'all') {
      filtered = filtered.filter(rdv => rdv.statut === filterStatut);
    }

    setFilteredRdvs(filtered);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') {
      newDate.setFullYear(newDate.getFullYear() + 1);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleMonthClick = (month: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(month);
    setCurrentDate(newDate);
    setViewMode('month');
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  };

  const handleRdvClick = (rdv: RdvData) => {
    setSelectedRdv(rdv);
    setShowViewDialog(true);
  };

  const handleEditRdv = (rdv: RdvData) => {
    setSelectedRdv(rdv);
    setShowEditDialog(true);
  };

  const getViewTitle = () => {
    if (viewMode === 'year') {
      return currentDate.getFullYear();
    } else if (viewMode === 'month') {
      return currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    } else {
      return currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendrier de recrutement</h1>
          <p className="text-muted-foreground mt-2">
            Gérez vos rendez-vous et entretiens
          </p>
        </div>
        <AddRdvDialog onSuccess={loadRdvs} />
      </div>

      {/* Barre de recherche et filtres */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par candidat ou poste..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Type d'entretien" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="TELEPHONE">Téléphonique</SelectItem>
              <SelectItem value="TEAMS">Visio</SelectItem>
              <SelectItem value="PRESENTIEL_CLIENT">Présentiel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger>
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="ENCOURS">Planifié</SelectItem>
              <SelectItem value="REALISE">Confirmé</SelectItem>
              <SelectItem value="TERMINE">Terminé</SelectItem>
              <SelectItem value="ANNULE">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Navigation du calendrier */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToToday} className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              Aujourd'hui
            </Button>
            <Button variant="outline" size="icon" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-xl font-semibold capitalize">{getViewTitle()}</h2>

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'day' ? 'default' : 'outline'}
              onClick={() => setViewMode('day')}
            >
              Jour
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              onClick={() => setViewMode('month')}
            >
              Mois
            </Button>
            <Button
              variant={viewMode === 'year' ? 'default' : 'outline'}
              onClick={() => setViewMode('year')}
            >
              Année
            </Button>
          </div>
        </div>
      </Card>

      {/* Vue du calendrier */}
      <Card className="p-4">
        {viewMode === 'year' && (
          <VueAnnuelle
            currentDate={currentDate}
            rdvs={filteredRdvs}
            onMonthClick={handleMonthClick}
          />
        )}
        {viewMode === 'month' && (
          <VueMensuelle
            currentDate={currentDate}
            rdvs={filteredRdvs}
            onDayClick={handleDayClick}
            onRdvClick={handleRdvClick}
          />
        )}
        {viewMode === 'day' && (
          <VueJournaliere
            currentDate={currentDate}
            rdvs={filteredRdvs}
            onRdvClick={handleRdvClick}
            onEditRdv={handleEditRdv}
          />
        )}
      </Card>

      {/* Dialogs */}
      {showEditDialog && selectedRdv && (
        <EditRdvDialog
          rdv={selectedRdv}
          onSuccess={() => {
            loadRdvs();
            setShowEditDialog(false);
          }}
        />
      )}

      {showViewDialog && selectedRdv && (
        <ViewRdvDialog
          rdv={selectedRdv}
          open={showViewDialog}
          onOpenChange={setShowViewDialog}
        />
      )}
    </div>
  );
}
