import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Euro, FileText, Info, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MatchingHistorySection } from "./MatchingHistorySection";
import { RapprochementSearchSection } from "./RapprochementSearchSection";
import { usePartenaireLabel, getPartenaireTypeLabel } from "./PartenaireSelect";

const NATURE_LABELS: Record<string, string> = {
  RELEVE_BANQUE: "Relevé Banque",
  ASSURANCE: "Assurance",
  LOA_VOITURE: "LOA Voiture",
  LOYER: "Loyer",
  AUTRE: "Autre",
};

const NATURE_COLORS: Record<string, string> = {
  RELEVE_BANQUE: "bg-blue-500",
  ASSURANCE: "bg-green-500",
  LOA_VOITURE: "bg-purple-500",
  LOYER: "bg-orange-500",
  AUTRE: "bg-gray-500",
};

const TYPE_LABELS: Record<string, string> = {
  CHARGE: "Charge",
  AUTRE: "Autre",
};

const TVA_LABELS: Record<string, string> = {
  normal: "Normal",
  exonere: "Exonéré",
};

interface ViewAbonnementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  abonnement: {
    id: string;
    nom: string;
    nature: string;
    type: string;
    tva: string;
    montant_mensuel: number;
    jour_prelevement: number;
    actif: boolean;
    notes: string;
    partenaire_type?: string | null;
    partenaire_id?: string | null;
    documents?: Array<{ id: string; document_url: string; nom_fichier: string; created_at: string }>;
  } | null;
}

export function ViewAbonnementDialog({ open, onOpenChange, abonnement }: ViewAbonnementDialogProps) {
  const partenaireLabel = usePartenaireLabel(abonnement?.partenaire_type || null, abonnement?.partenaire_id || null);
  
  if (!abonnement) return null;

  const handleDownload = async (doc: { document_url: string; nom_fichier: string }) => {
    try {
      const response = await fetch(doc.document_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nom_fichier;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Document téléchargé");
    } catch (error) {
      console.error("Erreur téléchargement:", error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Détails de l'abonnement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informations principales */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                {abonnement.nom}
                <Badge variant={abonnement.actif ? "default" : "secondary"}>
                  {abonnement.actif ? "Actif" : "Inactif"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {/* Partenaire */}
              {abonnement.partenaire_type && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Type de partenaire</p>
                    <div className="flex items-center gap-1 font-medium">
                      <Users className="h-4 w-4" />
                      {getPartenaireTypeLabel(abonnement.partenaire_type)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Partenaire</p>
                    <p className="font-medium">{partenaireLabel || "-"}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Nature</p>
                <Badge className={NATURE_COLORS[abonnement.nature]}>
                  {NATURE_LABELS[abonnement.nature] || abonnement.nature}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <Badge variant="outline">
                  {TYPE_LABELS[abonnement.type] || abonnement.type}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">TVA</p>
                <Badge variant="secondary">
                  {TVA_LABELS[abonnement.tva] || abonnement.tva}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Montant mensuel</p>
                <div className="flex items-center gap-1 font-medium">
                  <Euro className="h-4 w-4" />
                  {abonnement.montant_mensuel
                    ? `${Number(abonnement.montant_mensuel).toFixed(2)} €`
                    : "-"}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Montant mensuel</p>
                <div className="flex items-center gap-1 font-medium">
                  <Euro className="h-4 w-4" />
                  {abonnement.montant_mensuel
                    ? `${Number(abonnement.montant_mensuel).toFixed(2)} €`
                    : "-"}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Jour de prélèvement</p>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {abonnement.jour_prelevement
                    ? `Le ${abonnement.jour_prelevement} de chaque mois`
                    : "-"}
                </div>
              </div>
              {abonnement.notes && (
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{abonnement.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          {abonnement.documents && abonnement.documents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {abonnement.documents.map((doc) => (
                    <Button
                      key={doc.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      className="w-full justify-start"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {doc.nom_fichier}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section Recherche Rapprochement */}
          <RapprochementSearchSection
            entityType="abonnement"
            entityId={abonnement.id}
            entityName={abonnement.nom}
          />

          {/* Section Matching */}
          <MatchingHistorySection
            entityType="abonnement"
            entityId={abonnement.id}
            entityName={abonnement.nom}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
