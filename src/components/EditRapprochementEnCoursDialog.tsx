import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TransactionBancaire {
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  montant: number;
  numero_ligne?: string; // Conservé tel quel, jamais modifié
}

interface FactureMatch {
  id: string;
  numero_facture: string;
  type_facture: "VENTES" | "ACHATS";
  date_emission: string;
  partenaire_nom: string;
  total_ttc: number;
  statut: string;
  numero_rapprochement?: string;
  date_rapprochement?: string;
}

interface Rapprochement {
  transaction: TransactionBancaire;
  facture: FactureMatch | null;
  score: number;
  status: "matched" | "unmatched" | "uncertain";
  isManual?: boolean;
  manualId?: string;
  notes?: string | null;
}

interface EditRapprochementEnCoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rapprochement: Rapprochement | null;
  factures: FactureMatch[];
  onStatusChange: (status: "matched" | "unmatched" | "uncertain") => void;
  onFactureSelect: (factureIds: string[]) => void;
  onNotesChange: (notes: string) => void;
}

export default function EditRapprochementEnCoursDialog({
  open,
  onOpenChange,
  rapprochement,
  factures,
  onStatusChange,
  onFactureSelect,
  onNotesChange,
}: EditRapprochementEnCoursDialogProps) {
  const [status, setStatus] = useState<"matched" | "unmatched" | "uncertain">("unmatched");
  const [selectedFactureIds, setSelectedFactureIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Réinitialiser les états quand le dialogue se ferme
  useEffect(() => {
    if (!open) {
      setStatus("unmatched");
      setSelectedFactureIds([]);
      setNotes("");
      setSearchTerm("");
    }
  }, [open]);

  // Initialiser les valeurs au chargement
  useEffect(() => {
    if (rapprochement && open) {
      setStatus(rapprochement.status);
      setNotes(rapprochement.notes || "");
      if (rapprochement.facture) {
        setSelectedFactureIds([rapprochement.facture.id]);
      }
    }
  }, [rapprochement, open]);

  // Filtrer les factures disponibles (non rapprochées)
  const facturesDisponibles = factures.filter(f => !f.numero_rapprochement || (rapprochement?.facture && f.id === rapprochement.facture.id));

  // Filtrer les factures de ventes et d'achats
  const facturesVentes = facturesDisponibles.filter((f) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = f.numero_facture.toLowerCase().includes(search) ||
      f.partenaire_nom.toLowerCase().includes(search) ||
      f.total_ttc.toString().includes(search);
    return f.type_facture === "VENTES" && matchesSearch;
  });

  const facturesAchats = facturesDisponibles.filter((f) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = f.numero_facture.toLowerCase().includes(search) ||
      f.partenaire_nom.toLowerCase().includes(search) ||
      f.total_ttc.toString().includes(search);
    return f.type_facture === "ACHATS" && matchesSearch;
  });

  const selectedFactures = facturesDisponibles.filter((f) => selectedFactureIds.includes(f.id));
  const totalFacturesSelectionnees = selectedFactures.reduce((sum, f) => sum + f.total_ttc, 0);

  const toggleFactureSelection = (factureId: string) => {
    setSelectedFactureIds((prev) =>
      prev.includes(factureId)
        ? prev.filter((id) => id !== factureId)
        : [...prev, factureId]
    );
  };

  const handleSave = () => {
    onStatusChange(status);
    onFactureSelect(selectedFactureIds);
    onNotesChange(notes);
    
    toast({
      title: "Modifications enregistrées",
      description: "Les modifications seront prises en compte lors de la validation du fichier",
    });
    
    onOpenChange(false);
  };

  if (!rapprochement) return null;

  const transaction = rapprochement.transaction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détails de la transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations de la transaction */}
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold text-lg">Transaction bancaire</h3>
            <div className="grid grid-cols-2 gap-4">
              {transaction.numero_ligne && (
                <div>
                  <Label className="text-muted-foreground">Numéro de ligne</Label>
                  <p className="font-medium font-mono text-sm">{transaction.numero_ligne}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Date</Label>
                <p className="font-medium">{format(new Date(transaction.date), "dd/MM/yyyy", { locale: fr })}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Montant</Label>
                <p className={`font-medium ${transaction.montant > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Math.abs(transaction.montant))}
                  {transaction.montant > 0 ? " (Crédit)" : " (Débit)"}
                </p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Libellé</Label>
              <p className="font-medium">{transaction.libelle}</p>
            </div>
          </div>

          {/* Statut */}
          <div className="space-y-2">
            <Label>Statut du rapprochement</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="matched">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Rapproché
                  </div>
                </SelectItem>
                <SelectItem value="uncertain">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    Incertain
                  </div>
                </SelectItem>
                <SelectItem value="unmatched">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Non rapproché
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Factures sélectionnées */}
          {selectedFactures.length > 0 && (
            <div className="space-y-2">
              <Label>Facture(s) associée(s)</Label>
              <div className="space-y-2">
                {selectedFactures.map((facture) => (
                  <div key={facture.id} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{facture.numero_facture}</span>
                        <Badge variant={facture.type_facture === "VENTES" ? "default" : "secondary"}>
                          {facture.type_facture}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {facture.partenaire_nom} • {format(new Date(facture.date_emission), "dd/MM/yyyy")} • {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(facture.total_ttc)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFactureSelection(facture.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="font-medium">Total factures :</span>
                  <span className="font-bold">{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totalFacturesSelectionnees)}</span>
                </div>
                {Math.abs(Math.abs(transaction.montant) - totalFacturesSelectionnees) > 0.01 && (
                  <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
                    <AlertCircle className="h-4 w-4" />
                    Différence de {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Math.abs(Math.abs(transaction.montant) - totalFacturesSelectionnees))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recherche et sélection de factures */}
          <div className="space-y-2">
            <Label>Associer une facture</Label>
            <Input
              placeholder="Rechercher par numéro, partenaire ou montant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto">
              {/* Factures de ventes */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Factures de ventes ({facturesVentes.length})</h4>
                {facturesVentes.map((facture) => (
                  <div
                    key={facture.id}
                    onClick={() => toggleFactureSelection(facture.id)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedFactureIds.includes(facture.id)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{facture.numero_facture}</span>
                      <Badge variant="default" className="text-xs">VENTE</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{facture.partenaire_nom}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{format(new Date(facture.date_emission), "dd/MM/yyyy")}</span>
                      <span className="font-medium text-sm">{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(facture.total_ttc)}</span>
                    </div>
                  </div>
                ))}
                {facturesVentes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center p-4">Aucune facture de vente disponible</p>
                )}
              </div>

              {/* Factures d'achats */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Factures d'achats ({facturesAchats.length})</h4>
                {facturesAchats.map((facture) => (
                  <div
                    key={facture.id}
                    onClick={() => toggleFactureSelection(facture.id)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedFactureIds.includes(facture.id)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{facture.numero_facture}</span>
                      <Badge variant="secondary" className="text-xs">ACHAT</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{facture.partenaire_nom}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{format(new Date(facture.date_emission), "dd/MM/yyyy")}</span>
                      <span className="font-medium text-sm">{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(facture.total_ttc)}</span>
                    </div>
                  </div>
                ))}
                {facturesAchats.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center p-4">Aucune facture d'achat disponible</p>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Ajouter des notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
