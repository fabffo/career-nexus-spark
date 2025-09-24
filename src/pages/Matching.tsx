import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, BrainCircuit, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { candidatService } from '@/services';
import { posteService } from '@/services';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Matching() {
  const { toast } = useToast();
  const [selectedCandidat, setSelectedCandidat] = useState<string>('');
  const [selectedPoste, setSelectedPoste] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    match: boolean;
    score: number;
    analysis: string;
    strengths: string[];
    weaknesses: string[];
  } | null>(null);

  const { data: candidats = [] } = useQuery({
    queryKey: ['candidats-with-cv'],
    queryFn: async () => {
      const allCandidats = await candidatService.getAll();
      // Filter only candidates with CV
      return allCandidats.filter(c => c.cvUrl);
    },
  });

  const { data: postes = [] } = useQuery({
    queryKey: ['postes-ouverts'],
    queryFn: async () => {
      const allPostes = await posteService.getAll();
      // Filter only open positions
      return allPostes.filter(p => p.statut === 'ENCOURS');
    },
  });

  const selectedCandidatData = candidats.find(c => c.id === selectedCandidat);
  const selectedPosteData = postes.find(p => p.id === selectedPoste);

  const handleAnalyze = async () => {
    if (!selectedCandidat || !selectedPoste) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un candidat et un poste',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedCandidatData?.cvUrl) {
      toast({
        title: 'Erreur',
        description: 'Le candidat sélectionné n\'a pas de CV',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setAnalysisResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-matching', {
        body: {
          candidatId: selectedCandidat,
          posteId: selectedPoste,
          cvUrl: selectedCandidatData.cvUrl,
          posteDetails: {
            titre: selectedPosteData?.nomPoste,
            description: selectedPosteData?.detail,
          },
        },
      });

      if (error) throw error;

      setAnalysisResult(data);
      
      toast({
        title: 'Analyse terminée',
        description: `Score de correspondance: ${data.score}%`,
      });
    } catch (error: any) {
      console.error('Error analyzing match:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de l\'analyse',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Matching IA</h1>
        <p className="text-muted-foreground mt-2">
          Analysez la correspondance entre un candidat et un poste avec l'intelligence artificielle
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5" />
              Configuration de l'analyse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="candidat">Sélectionner un candidat (avec CV)</Label>
              <Select value={selectedCandidat} onValueChange={setSelectedCandidat}>
                <SelectTrigger id="candidat">
                  <SelectValue placeholder="Choisir un candidat" />
                </SelectTrigger>
                <SelectContent>
                  {candidats.map((candidat) => (
                    <SelectItem key={candidat.id} value={candidat.id}>
                      {candidat.prenom} {candidat.nom} - {candidat.metier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poste">Sélectionner un poste</Label>
              <Select value={selectedPoste} onValueChange={setSelectedPoste}>
                <SelectTrigger id="poste">
                  <SelectValue placeholder="Choisir un poste" />
                </SelectTrigger>
                <SelectContent>
                  {postes.map((poste) => (
                    <SelectItem key={poste.id} value={poste.id}>
                      {poste.nomPoste} - {poste.client?.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCandidatData && (
              <Alert>
                <AlertDescription>
                  <strong>Candidat:</strong> {selectedCandidatData.prenom} {selectedCandidatData.nom}
                  <br />
                  <strong>Métier:</strong> {selectedCandidatData.metier}
                  <br />
                  <strong>CV:</strong> {selectedCandidatData.cvUrl ? '✅ Disponible' : '❌ Non disponible'}
                </AlertDescription>
              </Alert>
            )}

            {selectedPosteData && (
              <Alert>
                <AlertDescription>
                  <strong>Poste:</strong> {selectedPosteData.nomPoste}
                  <br />
                  <strong>Client:</strong> {selectedPosteData.client?.raisonSociale}
                  <br />
                  <strong>Statut:</strong> {selectedPosteData.statut}
                </AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleAnalyze}
              disabled={loading || !selectedCandidat || !selectedPoste}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <BrainCircuit className="mr-2 h-4 w-4" />
                  Lancer l'analyse de matching
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {analysisResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {analysisResult.match ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                Résultat de l'analyse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Score de correspondance:</span>
                <span className={`text-2xl font-bold ${
                  analysisResult.score >= 70 ? 'text-green-600' : 
                  analysisResult.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {analysisResult.score}%
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Analyse détaillée:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {analysisResult.analysis}
                </p>
              </div>

              {analysisResult.strengths.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-green-600">Points forts:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {analysisResult.strengths.map((strength, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.weaknesses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-600">Points à améliorer:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {analysisResult.weaknesses.map((weakness, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        {weakness}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={`p-3 rounded-lg text-center font-semibold ${
                analysisResult.match ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {analysisResult.match ? 
                  '✅ Correspondance recommandée' : 
                  '❌ Correspondance non recommandée'}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}