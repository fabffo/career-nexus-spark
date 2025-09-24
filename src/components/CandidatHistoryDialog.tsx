import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Building2, MapPin, User, Briefcase, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CandidatHistoryDialogProps {
  candidat: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CandidatHistoryDialog({ candidat, open, onOpenChange }: CandidatHistoryDialogProps) {
  const [rdvs, setRdvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && candidat?.id) {
      loadCandidatHistory();
    }
  }, [open, candidat]);

  const loadCandidatHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rdvs')
        .select(`
          *,
          clients(raison_sociale),
          postes:poste_id(titre, statut),
          profiles:recruteur_id(nom, prenom),
          referents:referent_id(nom, prenom)
        `)
        .eq('candidat_id', candidat.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setRdvs(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'REALISE':
        return <Badge className="bg-green-500 text-white">Réalisé</Badge>;
      case 'ANNULE':
        return <Badge variant="destructive">Annulé</Badge>;
      case 'TERMINE':
        return <Badge className="bg-blue-500 text-white">Terminé</Badge>;
      default:
        return <Badge variant="secondary">En cours</Badge>;
    }
  };

  const getPosteStatut = (rdv: any) => {
    // Déterminer le statut du candidat pour ce poste basé sur le statut du RDV
    if (rdv.statut === 'TERMINE' && rdv.notes?.includes('accepté')) {
      return <Badge className="bg-green-600 text-white">Accepté</Badge>;
    } else if (rdv.statut === 'TERMINE' && rdv.notes?.includes('refusé')) {
      return <Badge className="bg-red-600 text-white">Refusé</Badge>;
    } else if (rdv.statut === 'ANNULE') {
      return <Badge variant="destructive">Annulé</Badge>;
    } else if (rdv.statut === 'REALISE') {
      return <Badge className="bg-yellow-600 text-white">En attente de décision</Badge>;
    } else {
      return <Badge variant="outline">En cours</Badge>;
    }
  };

  const rdvsByStatus = {
    enCours: rdvs.filter(r => r.statut === 'ENCOURS'),
    realises: rdvs.filter(r => r.statut === 'REALISE'),
    termines: rdvs.filter(r => r.statut === 'TERMINE'),
    annules: rdvs.filter(r => r.statut === 'ANNULE'),
  };

  if (!candidat) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Historique de {candidat.prenom} {candidat.nom}
          </DialogTitle>
          <DialogDescription>
            Consultez l'historique complet des rendez-vous et le statut du candidat pour chaque poste
          </DialogDescription>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant="outline" className="text-sm">
              <Briefcase className="h-3 w-3 mr-1" />
              {candidat.metier}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {rdvs.length} rendez-vous au total
            </span>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : (
          <Tabs defaultValue="tous" className="mt-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="tous">Tous ({rdvs.length})</TabsTrigger>
              <TabsTrigger value="encours">En cours ({rdvsByStatus.enCours.length})</TabsTrigger>
              <TabsTrigger value="realises">Réalisés ({rdvsByStatus.realises.length})</TabsTrigger>
              <TabsTrigger value="termines">Terminés ({rdvsByStatus.termines.length})</TabsTrigger>
              <TabsTrigger value="annules">Annulés ({rdvsByStatus.annules.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="tous" className="space-y-4 mt-4">
              {rdvs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucun rendez-vous trouvé</p>
              ) : (
                rdvs.map((rdv) => (
                  <RdvCard key={rdv.id} rdv={rdv} getStatutBadge={getStatutBadge} getPosteStatut={getPosteStatut} />
                ))
              )}
            </TabsContent>

            <TabsContent value="encours" className="space-y-4 mt-4">
              {rdvsByStatus.enCours.map((rdv) => (
                <RdvCard key={rdv.id} rdv={rdv} getStatutBadge={getStatutBadge} getPosteStatut={getPosteStatut} />
              ))}
            </TabsContent>

            <TabsContent value="realises" className="space-y-4 mt-4">
              {rdvsByStatus.realises.map((rdv) => (
                <RdvCard key={rdv.id} rdv={rdv} getStatutBadge={getStatutBadge} getPosteStatut={getPosteStatut} />
              ))}
            </TabsContent>

            <TabsContent value="termines" className="space-y-4 mt-4">
              {rdvsByStatus.termines.map((rdv) => (
                <RdvCard key={rdv.id} rdv={rdv} getStatutBadge={getStatutBadge} getPosteStatut={getPosteStatut} />
              ))}
            </TabsContent>

            <TabsContent value="annules" className="space-y-4 mt-4">
              {rdvsByStatus.annules.map((rdv) => (
                <RdvCard key={rdv.id} rdv={rdv} getStatutBadge={getStatutBadge} getPosteStatut={getPosteStatut} />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RdvCard({ rdv, getStatutBadge, getPosteStatut }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(rdv.date), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </CardTitle>
            {rdv.postes && (
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-primary">{rdv.postes.titre}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end">
            {getStatutBadge(rdv.statut)}
            {getPosteStatut(rdv)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {rdv.clients && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{rdv.clients.raison_sociale}</span>
            </div>
          )}
          
          {rdv.lieu && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{rdv.lieu}</span>
            </div>
          )}

          {(rdv.profiles || rdv.referents) && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>
                {rdv.profiles ? 
                  `${rdv.profiles.prenom} ${rdv.profiles.nom} (Recruteur)` : 
                  `${rdv.referents.prenom} ${rdv.referents.nom} (Référent)`
                }
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Badge variant="outline">{rdv.type_rdv}</Badge>
          </div>
        </div>

        {rdv.notes && (
          <div className="border-t pt-3">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{rdv.notes}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}