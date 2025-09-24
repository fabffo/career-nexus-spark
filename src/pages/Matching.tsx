import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BrainCircuit, ChevronRight, Loader2, FileText, Briefcase, History, CheckCircle, XCircle, User, MapPin, FileCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { candidatService, posteService } from "@/services";

export default function Matching() {
  const [selectedCandidat, setSelectedCandidat] = useState("");
  const [selectedPoste, setSelectedPoste] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [matchingHistory, setMatchingHistory] = useState<any[]>([]);
  const [fullAnalysisHistory, setFullAnalysisHistory] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch candidats with CV or detail_cv
  const { data: candidats, isLoading: candidatsLoading } = useQuery({
    queryKey: ["candidats-with-cv"],
    queryFn: async () => {
      const allCandidats = await candidatService.getAll();
      return allCandidats.filter(c => c.cvUrl || c.detail_cv);
    },
  });

  // Fetch open postes
  const { data: postes, isLoading: postesLoading } = useQuery({
    queryKey: ["postes-ouverts"],
    queryFn: async () => {
      const allPostes = await posteService.getAll();
      return allPostes.filter(p => p.statut === "ENCOURS");
    },
  });

  const selectedCandidatData = candidats?.find(c => c.id === selectedCandidat);
  const selectedPosteData = postes?.find(p => p.id === selectedPoste);

  // Fetch matching history from both tables
  useEffect(() => {
    const fetchMatchingHistory = async () => {
      // Fetch from new table with full data
      const { data: fullData, error: fullError } = await supabase
        .from('analyse_poste_candidat')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!fullError && fullData) {
        console.log('Full analysis data:', fullData);
        
        // Fetch candidat and poste names separately
        const enrichedData = await Promise.all(
          fullData.map(async (analysis) => {
            // Get candidat info
            let candidatInfo = null;
            if (analysis.candidat_id) {
              const { data: candidat } = await supabase
                .from('candidats')
                .select('nom, prenom')
                .eq('id', analysis.candidat_id)
                .maybeSingle();
              candidatInfo = candidat;
            }
            
            // Get poste info from detail_poste JSON which contains the titre
            const posteInfo = {
              titre: (analysis.detail_poste as any)?.titre || 'Poste inconnu'
            };
            
            return {
              ...analysis,
              candidat: candidatInfo,
              poste: posteInfo
            };
          })
        );
        
        setFullAnalysisHistory(enrichedData);
      } else if (fullError) {
        console.error('Error fetching full analysis history:', fullError);
      }

      // Also fetch from matchings for backward compatibility  
      const { data, error } = await supabase
        .from('matchings')
        .select(`
          *,
          candidats (nom, prenom),
          postes (titre)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setMatchingHistory(data);
      }
    };

    fetchMatchingHistory();
  }, [analysisResult]); // Refresh when a new analysis is done

  const handleAnalyze = async () => {
    if (!selectedCandidat || !selectedPoste) {
      toast({
        title: "Sélection requise",
        description: "Veuillez sélectionner un candidat et un poste",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCandidatData?.cvUrl && !selectedCandidatData?.detail_cv) {
      toast({
        title: "CV manquant",
        description: "Le candidat sélectionné n'a pas de CV ni de détails CV",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-matching", {
        body: {
          candidatId: selectedCandidat,
          posteId: selectedPoste,
          cvUrl: selectedCandidatData.cvUrl,
          detailCv: selectedCandidatData.detail_cv,
          posteDetails: {
            titre: selectedPosteData?.nomPoste,
            description: selectedPosteData?.detail,
            type_contrat: selectedPosteData?.statut,
            localisation: '',
            competences: []
          },
          userId: user?.id
        },
      });

      if (error) throw error;

      setAnalysisResult({
        ...data,
        candidat: selectedCandidatData,
        poste: selectedPosteData
      });

      toast({
        title: "Analyse terminée",
        description: `Score de correspondance: ${data.score}%`,
      });
    } catch (error: any) {
      console.error("Error analyzing match:", error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'analyse",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <BrainCircuit className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Matching IA</h1>
          <p className="text-muted-foreground">
            Analysez la correspondance entre un candidat et un poste avec l'intelligence artificielle
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration de l'analyse</CardTitle>
            <CardDescription>
              Sélectionnez un candidat avec CV et un poste à analyser
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="candidat">Candidat (avec CV)</Label>
              <Select value={selectedCandidat} onValueChange={setSelectedCandidat}>
                <SelectTrigger id="candidat">
                  <SelectValue placeholder="Sélectionner un candidat" />
                </SelectTrigger>
                <SelectContent>
                  {candidats?.map((candidat) => (
                    <SelectItem key={candidat.id} value={candidat.id}>
                      {candidat.prenom} {candidat.nom} - {candidat.metier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poste">Poste ouvert</Label>
              <Select value={selectedPoste} onValueChange={setSelectedPoste}>
                <SelectTrigger id="poste">
                  <SelectValue placeholder="Sélectionner un poste" />
                </SelectTrigger>
                <SelectContent>
                  {postes?.map((poste) => (
                    <SelectItem key={poste.id} value={poste.id}>
                      {poste.nomPoste} - {poste.client?.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCandidatData && (
              <Alert className="border-primary/20">
                <User className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">{selectedCandidatData.prenom} {selectedCandidatData.nom}</p>
                    <p className="text-sm text-muted-foreground">{selectedCandidatData.metier}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <FileText className="h-3 w-3" />
                      <span className="text-xs">
                        {selectedCandidatData.cvUrl && "CV disponible"}
                        {selectedCandidatData.cvUrl && selectedCandidatData.detail_cv && " | "}
                        {selectedCandidatData.detail_cv && "Détails CV disponibles"}
                      </span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {selectedPosteData && (
              <Alert className="border-primary/20">
                <Briefcase className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">{selectedPosteData.nomPoste}</p>
                    <p className="text-sm text-muted-foreground">{selectedPosteData.client?.raisonSociale}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !selectedCandidat || !selectedPoste}
              className="w-full"
              size="lg"
            >
              {isAnalyzing ? (
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

        {/* Results Card */}
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
            <CardContent>
              <Tabs defaultValue="results" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="results">Résultat</TabsTrigger>
                  <TabsTrigger value="cv">CV Analysé</TabsTrigger>
                  <TabsTrigger value="poste">Poste</TabsTrigger>
                </TabsList>
                
                <TabsContent value="results" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                    <span className="text-lg font-semibold">Score de correspondance</span>
                    <span className={cn(
                      "text-3xl font-bold",
                      analysisResult.score >= 70 ? "text-green-600" : 
                      analysisResult.score >= 50 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {analysisResult.score}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Analyse détaillée</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {analysisResult.analysis}
                    </p>
                  </div>

                  <div className="grid gap-4">
                    {analysisResult.strengths && analysisResult.strengths.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-green-600">Points forts</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {analysisResult.strengths.map((strength: string, index: number) => (
                            <li key={index} className="text-sm">{strength}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisResult.weaknesses && analysisResult.weaknesses.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-orange-600">Points faibles</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {analysisResult.weaknesses.map((weakness: string, index: number) => (
                            <li key={index} className="text-sm">{weakness}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className={cn(
                    "p-4 rounded-lg text-center font-medium",
                    analysisResult.match ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                  )}>
                    {analysisResult.match ? "✅ Recommandé pour ce poste" : "❌ Non recommandé pour ce poste"}
                  </div>
                </TabsContent>

                <TabsContent value="cv" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">
                        CV de {analysisResult.candidat?.prenom} {analysisResult.candidat?.nom}
                      </h3>
                    </div>
                    <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                      <pre className="text-sm whitespace-pre-wrap font-mono break-words">
                        {analysisResult.candidat?.detail_cv || analysisResult.cvExtract || "Le contenu du CV sera affiché ici après l'analyse"}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="poste" className="mt-4">
                  <ScrollArea className="h-[600px] w-full">
                    <div className="space-y-4 p-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{analysisResult.poste?.nomPoste}</h3>
                      </div>
                      
                      {analysisResult.poste?.client && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Client</h4>
                          <p className="text-sm text-muted-foreground">
                            {analysisResult.poste.client.raisonSociale}
                          </p>
                        </div>
                      )}

                      <div>
                        <h4 className="font-semibold text-sm mb-2">Description</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                          {analysisResult.poste?.detail}
                        </p>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Full Analysis History with complete data */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des analyses complètes
          </CardTitle>
          <CardDescription>
            Les 10 dernières analyses avec les données complètes (CV et poste complets)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fullAnalysisHistory.length > 0 ? (
            <div className="space-y-3">
              {fullAnalysisHistory.map((analysis) => (
                <div 
                  key={analysis.id} 
                  className="p-4 border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedHistoryItem(analysis)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">
                        {analysis.candidat?.prenom} {analysis.candidat?.nom || 
                         `Candidat ID: ${analysis.candidat_id?.substring(0, 8)}...`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {analysis.poste?.titre}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {new Date(analysis.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <span className="text-xs text-muted-foreground">•</span>
                        <p className="text-xs text-muted-foreground">
                          CV: {analysis.detail_cv?.length || 0} caractères
                        </p>
                        <span className="text-xs text-muted-foreground">•</span>
                        <p className="text-xs text-muted-foreground">
                          Poste: {(analysis.detail_poste as any)?.description?.length || 0} caractères
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={cn(
                          "text-2xl font-bold",
                          analysis.score >= 70 ? "text-green-600" :
                          analysis.score >= 50 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {analysis.score}%
                        </div>
                        <Badge 
                          variant={analysis.match ? "default" : "secondary"}
                          className={cn(
                            analysis.match ? "bg-green-100 text-green-800 hover:bg-green-200" : ""
                          )}
                        >
                          {analysis.match ? "Match" : "No Match"}
                        </Badge>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                  
                  {/* Analysis summary */}
                  {analysis.analysis && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {analysis.analysis}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucune analyse complète disponible
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Les analyses avec données complètes apparaîtront ici
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legacy Matching History */}
      {matchingHistory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique des matchings (ancienne table)
            </CardTitle>
            <CardDescription>
              Analyses précédentes (données partielles)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {matchingHistory.map((matching) => (
                <div 
                  key={matching.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">
                      {matching.candidats?.prenom} {matching.candidats?.nom}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {matching.postes?.titre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(matching.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={cn(
                        "text-2xl font-bold",
                        matching.score >= 70 ? "text-green-600" :
                        matching.score >= 50 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {matching.score}%
                      </div>
                      <Badge 
                        variant={matching.match ? "default" : "secondary"}
                        className={cn(
                          matching.match ? "bg-green-100 text-green-800 hover:bg-green-200" : ""
                        )}
                      >
                        {matching.match ? "Match" : "No Match"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Dialog to view saved analysis details */}
      <Dialog open={!!selectedHistoryItem} onOpenChange={(open) => !open && setSelectedHistoryItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de l'analyse sauvegardée</DialogTitle>
          </DialogHeader>
          {selectedHistoryItem && (
            <Tabs defaultValue="results" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="results">Résultat</TabsTrigger>
                <TabsTrigger value="cv">CV Complet</TabsTrigger>
                <TabsTrigger value="poste">Poste Complet</TabsTrigger>
              </TabsList>
              
              <TabsContent value="results" className="space-y-4 mt-4">
                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                  <span className="text-lg font-semibold">Score de correspondance</span>
                  <span className={cn(
                    "text-3xl font-bold",
                    selectedHistoryItem.score >= 70 ? "text-green-600" : 
                    selectedHistoryItem.score >= 50 ? "text-yellow-600" : "text-red-600"
                  )}>
                    {selectedHistoryItem.score}%
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Analyse détaillée</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedHistoryItem.analysis}
                  </p>
                </div>

                {selectedHistoryItem.strengths && selectedHistoryItem.strengths.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-green-600">Points forts</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedHistoryItem.strengths.map((strength: string, index: number) => (
                        <li key={index} className="text-sm">{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedHistoryItem.weaknesses && selectedHistoryItem.weaknesses.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-orange-600">Points faibles</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedHistoryItem.weaknesses.map((weakness: string, index: number) => (
                        <li key={index} className="text-sm">{weakness}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cv" className="mt-4">
                <ScrollArea className="h-[500px] w-full rounded-md border p-4">
                  <pre className="text-sm whitespace-pre-wrap font-mono break-words">
                    {selectedHistoryItem.detail_cv || "Aucun CV disponible"}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="poste" className="mt-4">
                <ScrollArea className="h-[500px] w-full rounded-md border p-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">
                        {(selectedHistoryItem.detail_poste as any)?.titre || "Titre non disponible"}
                      </h3>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Description complète</h4>
                      <pre className="text-sm whitespace-pre-wrap break-words">
                        {(selectedHistoryItem.detail_poste as any)?.description || "Description non disponible"}
                      </pre>
                    </div>
                    {(selectedHistoryItem.detail_poste as any)?.competences?.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Compétences</h4>
                        <p className="text-sm">
                          {(selectedHistoryItem.detail_poste as any).competences.join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}