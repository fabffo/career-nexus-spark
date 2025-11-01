import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Users, CheckCircle, TrendingUp, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';

interface PosteStats {
  id: string;
  titre: string;
  created_at: string;
  statut: string;
  totalCandidats: number;
  totalRdvs: number;
  tauxConversion: number;
}

interface GlobalStats {
  postesOuverts: number;
  postesPourvus: number;
  postesTotal: number;
  tauxReussite: number;
}

interface RecrutementGlobalViewProps {
  onPosteClick: (posteId: string) => void;
}

export function RecrutementGlobalView({ onPosteClick }: RecrutementGlobalViewProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    postesOuverts: 0,
    postesPourvus: 0,
    postesTotal: 0,
    tauxReussite: 0,
  });
  const [postesStats, setPostesStats] = useState<PosteStats[]>([]);
  const [filteredPostes, setFilteredPostes] = useState<PosteStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Générer les années disponibles (5 dernières années)
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    loadGlobalData();
  }, [selectedYear]);

  useEffect(() => {
    filterPostes();
  }, [searchTerm, postesStats]);

  const loadGlobalData = async () => {
    try {
      setLoading(true);

      // Calculer les dates de début et fin de l'année sélectionnée
      const startDate = new Date(selectedYear, 0, 1).toISOString();
      const endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

      // Charger tous les postes de l'année
      const { data: postes } = await supabase
        .from('postes')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (!postes) return;

      // Calculer les stats globales
      const postesOuverts = postes.filter(p => p.statut === 'OUVERT' || p.statut === 'ENCOURS').length;
      const postesPourvus = postes.filter(p => p.statut === 'REALISE' || p.pourvu_par).length;
      const postesTotal = postes.length;
      const tauxReussite = postesTotal > 0 ? Math.round((postesPourvus / postesTotal) * 100) : 0;

      setGlobalStats({
        postesOuverts,
        postesPourvus,
        postesTotal,
        tauxReussite,
      });

      // Charger les stats détaillées pour chaque poste
      const postesStatsPromises = postes.map(async (poste) => {
        // Charger les candidats associés
        const { data: candidatsPostes } = await supabase
          .from('candidats_postes')
          .select('*')
          .eq('poste_id', poste.id);

        // Charger les RDVs
        const { data: rdvs } = await supabase
          .from('rdvs')
          .select('*')
          .eq('poste_id', poste.id);

        const totalCandidats = candidatsPostes?.length || 0;
        const totalRdvs = rdvs?.length || 0;
        const acceptes = candidatsPostes?.filter(cp => cp.etape_recrutement === 'ACCEPTE').length || 0;
        const tauxConversion = totalCandidats > 0 ? Math.round((acceptes / totalCandidats) * 100) : 0;

        return {
          id: poste.id,
          titre: poste.titre,
          created_at: poste.created_at,
          statut: poste.statut,
          totalCandidats,
          totalRdvs,
          tauxConversion,
        };
      });

      const stats = await Promise.all(postesStatsPromises);
      setPostesStats(stats);
      setFilteredPostes(stats);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPostes = () => {
    if (!searchTerm.trim()) {
      setFilteredPostes(postesStats);
      return;
    }

    const filtered = postesStats.filter(poste =>
      poste.titre.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredPostes(filtered);
  };

  const getStatusBadge = (statut: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      'OUVERT': { label: 'Ouvert', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      'ENCOURS': { label: 'En cours', className: 'bg-orange-100 text-orange-800 border-orange-200' },
      'REALISE': { label: 'Pourvu', className: 'bg-green-100 text-green-800 border-green-200' },
      'ANNULE': { label: 'Fermé', className: 'bg-gray-100 text-gray-800 border-gray-200' },
    };

    const variant = variants[statut] || variants['OUVERT'];
    return (
      <Badge className={`font-medium border ${variant.className}`}>
        {variant.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec sélecteur d'année */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Suivi Global des Recrutements</h2>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble de tous les recrutements de l'année
          </p>
        </div>
        <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs cliquables */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            setSearchTerm('');
            const ouverts = postesStats.filter(p => p.statut === 'OUVERT' || p.statut === 'ENCOURS');
            setFilteredPostes(ouverts);
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-orange-600" />
              Postes ouverts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{globalStats.postesOuverts}</div>
            <p className="text-xs text-muted-foreground mt-1">En cours de recrutement</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            setSearchTerm('');
            const pourvus = postesStats.filter(p => p.statut === 'REALISE');
            setFilteredPostes(pourvus);
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Postes pourvus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{globalStats.postesPourvus}</div>
            <p className="text-xs text-muted-foreground mt-1">Recrutements terminés</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            setSearchTerm('');
            setFilteredPostes(postesStats);
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Total postes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{globalStats.postesTotal}</div>
            <p className="text-xs text-muted-foreground mt-1">De l'année {selectedYear}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Taux de réussite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{globalStats.tauxReussite}%</div>
            <p className="text-xs text-muted-foreground mt-1">Pourvus / Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Tableau des postes */}
      <DataTable
        columns={columns}
        data={filteredPostes}
        searchPlaceholder="Rechercher un poste..."
      />
    </div>
  );
}
