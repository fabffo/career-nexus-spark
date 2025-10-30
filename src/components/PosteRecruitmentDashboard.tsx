import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, Calendar, TrendingUp, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';

interface PosteRecruitmentDashboardProps {
  posteId: string;
}

interface RecruitmentStats {
  totalCandidats: number;
  totalRdvs: number;
  candidatsParEtape: Record<string, number>;
  salaireMin?: number;
  salaireMax?: number;
}

export function PosteRecruitmentDashboard({ posteId }: PosteRecruitmentDashboardProps) {
  const [stats, setStats] = useState<RecruitmentStats>({
    totalCandidats: 0,
    totalRdvs: 0,
    candidatsParEtape: {},
  });
  const [etapes, setEtapes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [posteId]);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Charger les candidats associés
      const { data: candidatsPostes } = await supabase
        .from('candidats_postes')
        .select('*')
        .eq('poste_id', posteId);

      // Charger les RDVs liés au poste
      const { data: posteData } = await supabase
        .from('postes')
        .select('*, rdvs(*)')
        .eq('id', posteId)
        .single();

      // Charger les étapes de recrutement
      const { data: etapesData } = await supabase
        .from('param_etapes_recrutement')
        .select('*')
        .eq('is_active', true)
        .order('ordre', { ascending: true });

      setEtapes(etapesData || []);

      // Calculer les stats
      const candidatsParEtape: Record<string, number> = {};
      candidatsPostes?.forEach(cp => {
        candidatsParEtape[cp.etape_recrutement] = (candidatsParEtape[cp.etape_recrutement] || 0) + 1;
      });

      setStats({
        totalCandidats: candidatsPostes?.length || 0,
        totalRdvs: (posteData as any)?.rdvs?.length || 0,
        candidatsParEtape,
        salaireMin: posteData?.salaire_min,
        salaireMax: posteData?.salaire_max,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Chargement des statistiques...</div>;
  }

  const getEtapeIcon = (code: string) => {
    switch (code) {
      case 'ACCEPTE': return <CheckCircle className="h-4 w-4" />;
      case 'REFUSE': return <XCircle className="h-4 w-4" />;
      case 'ABANDONNE': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Métriques principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Candidats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCandidats}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              RDV prévus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRdvs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Taux conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalCandidats > 0
                ? Math.round(((stats.candidatsParEtape['ACCEPTE'] || 0) / stats.totalCandidats) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>

        {(stats.salaireMin || stats.salaireMax) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Salaire
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {stats.salaireMin && stats.salaireMax
                  ? `${stats.salaireMin}€ - ${stats.salaireMax}€`
                  : stats.salaireMin
                  ? `À partir de ${stats.salaireMin}€`
                  : `Jusqu'à ${stats.salaireMax}€`
                }
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Répartition par étape */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Répartition par étape</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {etapes.map((etape) => {
              const count = stats.candidatsParEtape[etape.code] || 0;
              return (
                <div
                  key={etape.code}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-2">
                    {getEtapeIcon(etape.code)}
                    <span className="text-sm font-medium">{etape.libelle}</span>
                  </div>
                  <Badge
                    style={{
                      backgroundColor: `${etape.couleur}20`,
                      color: etape.couleur,
                      borderColor: etape.couleur
                    }}
                    className="border"
                  >
                    {count}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
