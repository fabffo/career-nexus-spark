import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText,
  UserCheck,
  Phone,
  Video,
  Briefcase,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

interface RecrutementPosteDetailProps {
  posteId: string;
  onBack: () => void;
}

interface EtapeStats {
  code: string;
  libelle: string;
  couleur: string;
  count: number;
  ordre: number;
}

interface PosteDetail {
  id: string;
  titre: string;
  description?: string;
  statut: string;
  salaire_min?: number;
  salaire_max?: number;
  localisation?: string;
  type_contrat?: string;
  competences?: string[];
  created_at: string;
}

export function RecrutementPosteDetail({ posteId, onBack }: RecrutementPosteDetailProps) {
  const [poste, setPoste] = useState<PosteDetail | null>(null);
  const [stats, setStats] = useState({
    totalCandidats: 0,
    totalRdvs: 0,
    tauxConversion: 0,
  });
  const [etapesStats, setEtapesStats] = useState<EtapeStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosteDetails();
  }, [posteId]);

  const loadPosteDetails = async () => {
    try {
      setLoading(true);

      // Charger les détails du poste
      const { data: posteData } = await supabase
        .from('postes')
        .select('*')
        .eq('id', posteId)
        .single();

      if (!posteData) return;
      setPoste(posteData);

      // Charger les candidats associés
      const { data: candidatsPostes } = await supabase
        .from('candidats_postes')
        .select('*')
        .eq('poste_id', posteId);

      // Charger les RDVs
      const { data: rdvs } = await supabase
        .from('rdvs')
        .select('*')
        .eq('poste_id', posteId);

      // Charger les étapes de recrutement
      const { data: etapesData } = await supabase
        .from('param_etapes_recrutement')
        .select('*')
        .eq('is_active', true)
        .order('ordre', { ascending: true });

      // Calculer les stats par étape
      const etapesWithStats: EtapeStats[] = (etapesData || []).map(etape => {
        const count = candidatsPostes?.filter(cp => cp.etape_recrutement === etape.code).length || 0;
        return {
          code: etape.code,
          libelle: etape.libelle,
          couleur: etape.couleur,
          ordre: etape.ordre,
          count,
        };
      });

      setEtapesStats(etapesWithStats);

      // Calculer les stats globales
      const totalCandidats = candidatsPostes?.length || 0;
      const totalRdvs = rdvs?.length || 0;
      const acceptes = candidatsPostes?.filter(cp => cp.etape_recrutement === 'ACCEPTE').length || 0;
      const tauxConversion = totalCandidats > 0 ? Math.round((acceptes / totalCandidats) * 100) : 0;

      setStats({
        totalCandidats,
        totalRdvs,
        tauxConversion,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEtapeIcon = (code: string) => {
    switch (code) {
      case 'CV_RECU': return <FileText className="h-5 w-5" />;
      case 'PRE_SELECTION': return <UserCheck className="h-5 w-5" />;
      case 'ENTRETIEN_RH': return <Phone className="h-5 w-5" />;
      case 'ENTRETIEN_TECHNIQUE': return <Video className="h-5 w-5" />;
      case 'ENTRETIEN_CLIENT': return <Briefcase className="h-5 w-5" />;
      case 'PROPOSITION': return <FileText className="h-5 w-5" />;
      case 'ACCEPTE': return <CheckCircle className="h-5 w-5" />;
      case 'REFUSE': return <XCircle className="h-5 w-5" />;
      case 'ABANDONNE': return <AlertCircle className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  if (loading || !poste) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Chargement des détails...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec bouton retour */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{poste.titre}</h2>
          <p className="text-muted-foreground mt-1">
            Détail du recrutement et suivi des candidats
          </p>
        </div>
      </div>

      <Tabs defaultValue="suivi" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="suivi">Suivi recrutement</TabsTrigger>
          <TabsTrigger value="details">Détails du poste</TabsTrigger>
        </TabsList>

        <TabsContent value="suivi" className="space-y-6 mt-6">
          {/* Métriques principales */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  Candidats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalCandidats}</div>
                <p className="text-xs text-muted-foreground mt-1">Total des candidatures</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  RDV prévus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalRdvs}</div>
                <p className="text-xs text-muted-foreground mt-1">Entretiens planifiés</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Taux conversion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.tauxConversion}%</div>
                <p className="text-xs text-muted-foreground mt-1">Candidats acceptés</p>
              </CardContent>
            </Card>
          </div>

          {/* Répartition par étape */}
          <Card>
            <CardHeader>
              <CardTitle>Répartition par étape</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {etapesStats.map((etape) => (
                  <div
                    key={etape.code}
                    className="flex items-center justify-between p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                    style={{
                      backgroundColor: `${etape.couleur}10`,
                      borderColor: `${etape.couleur}40`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: `${etape.couleur}20`,
                          color: etape.couleur,
                        }}
                      >
                        {getEtapeIcon(etape.code)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{etape.libelle}</p>
                        <p className="text-xs text-muted-foreground">Étape {etape.ordre}</p>
                      </div>
                    </div>
                    <Badge
                      style={{
                        backgroundColor: `${etape.couleur}20`,
                        color: etape.couleur,
                        borderColor: etape.couleur,
                      }}
                      className="border text-lg font-bold px-3 py-1"
                    >
                      {etape.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations du poste</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {poste.localisation && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Localisation</p>
                  <p className="mt-1">{poste.localisation}</p>
                </div>
              )}

              {poste.type_contrat && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Type de contrat</p>
                  <p className="mt-1">{poste.type_contrat}</p>
                </div>
              )}

              {(poste.salaire_min || poste.salaire_max) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Salaire</p>
                  <p className="mt-1">
                    {poste.salaire_min && poste.salaire_max
                      ? `${poste.salaire_min}€ - ${poste.salaire_max}€`
                      : poste.salaire_min
                      ? `À partir de ${poste.salaire_min}€`
                      : `Jusqu'à ${poste.salaire_max}€`
                    }
                  </p>
                </div>
              )}

              {poste.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <div className="mt-1 bg-muted/50 rounded-lg p-3">
                    <p className="text-sm whitespace-pre-wrap">{poste.description}</p>
                  </div>
                </div>
              )}

              {poste.competences && poste.competences.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Compétences requises</p>
                  <div className="flex flex-wrap gap-2">
                    {poste.competences.map((comp: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{comp}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
