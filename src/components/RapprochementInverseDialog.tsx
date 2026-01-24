import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Search, ArrowLeftRight, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TransactionBancaire {
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  montant: number;
  numero_ligne?: string;
}

interface Rapprochement {
  transaction: TransactionBancaire;
  facture: any | null;
  score: number;
  status: "matched" | "unmatched" | "uncertain";
  isManual?: boolean;
  manualId?: string;
  notes?: string | null;
  numero_ligne?: string;
  abonnement_info?: { id: string; nom: string; montant_ttc?: number; tva?: string };
  declaration_info?: { id: string; nom: string; organisme: string };
  fournisseur_info?: { id: string; nom: string; type: string };
  factureIds?: string[];
  montant_facture?: number;
  total_ht?: number;
  total_tva?: number;
  total_ttc?: number;
  ligneInverse?: string; // Numéro de la ligne inverse liée
}

interface RapprochementInverseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rapprochement: Rapprochement | null;
  allRapprochements: Rapprochement[];
  onRapprochementInverse: (sourceNumeroLigne: string, targetNumeroLigne: string) => void;
}

export default function RapprochementInverseDialog({
  open,
  onOpenChange,
  rapprochement,
  allRapprochements,
  onRapprochementInverse,
}: RapprochementInverseDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLigneId, setSelectedLigneId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setSelectedLigneId(null);
    }
  }, [open]);

  // Formatter le montant en devise
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  // Calculer le montant de la transaction source
  const sourceMontant = useMemo(() => {
    if (!rapprochement) return 0;
    const { debit, credit } = rapprochement.transaction;
    return debit > 0 ? debit : -credit;
  }, [rapprochement]);

  // Filtrer les lignes candidates pour le rapprochement inverse
  const lignesCandidates = useMemo(() => {
    if (!rapprochement) return [];

    const sourceNumeroLigne = rapprochement.transaction.numero_ligne || "";
    const sourcePartenaire = rapprochement.fournisseur_info?.nom?.toLowerCase() || "";
    const sourcePartenaireId = rapprochement.fournisseur_info?.id || "";

    return allRapprochements.filter((r) => {
      // Exclure la ligne source elle-même
      if (r.transaction.numero_ligne === sourceNumeroLigne) return false;

      // Exclure les lignes déjà rapprochées (matched)
      if (r.status === "matched") return false;

      // Exclure les lignes déjà liées à une ligne inverse
      if ((r as any).ligneInverse) return false;

      // Calculer le montant de la ligne candidate
      const candidatDebit = r.transaction.debit || 0;
      const candidatCredit = r.transaction.credit || 0;
      const candidatMontant = candidatDebit > 0 ? candidatDebit : -candidatCredit;

      // Vérifier que c'est un montant inverse (signe opposé)
      if (Math.sign(candidatMontant) === Math.sign(sourceMontant)) return false;

      // Vérifier que les montants sont égaux en valeur absolue (ou proches)
      const difference = Math.abs(Math.abs(candidatMontant) - Math.abs(sourceMontant));
      if (difference > 0.01) return false;

      // Vérifier que c'est le même partenaire (si détecté)
      if (sourcePartenaireId && r.fournisseur_info?.id) {
        if (r.fournisseur_info.id !== sourcePartenaireId) return false;
      } else if (sourcePartenaire) {
        const candidatPartenaire = r.fournisseur_info?.nom?.toLowerCase() || "";
        if (candidatPartenaire && candidatPartenaire !== sourcePartenaire) return false;
      }

      // Appliquer le filtre de recherche
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          r.transaction.libelle.toLowerCase().includes(term) ||
          r.transaction.numero_ligne?.toLowerCase().includes(term) ||
          r.fournisseur_info?.nom?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [rapprochement, allRapprochements, sourceMontant, searchTerm]);

  // Calculer le solde si une ligne est sélectionnée
  const selectedLigne = useMemo(() => {
    return lignesCandidates.find((l) => l.transaction.numero_ligne === selectedLigneId);
  }, [lignesCandidates, selectedLigneId]);

  const solde = useMemo(() => {
    if (!selectedLigne) return null;
    const selectedDebit = selectedLigne.transaction.debit || 0;
    const selectedCredit = selectedLigne.transaction.credit || 0;
    const selectedMontant = selectedDebit > 0 ? selectedDebit : -selectedCredit;
    return sourceMontant + selectedMontant;
  }, [sourceMontant, selectedLigne]);

  const isBalanced = solde !== null && Math.abs(solde) < 0.01;

  const handleRapprochement = async () => {
    if (!rapprochement || !selectedLigneId) return;

    const sourceNumeroLigne = rapprochement.transaction.numero_ligne;
    if (!sourceNumeroLigne) {
      toast({
        title: "Erreur",
        description: "La ligne source n'a pas de numéro de ligne",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      onRapprochementInverse(sourceNumeroLigne, selectedLigneId);
      toast({
        title: "Rapprochement inverse effectué",
        description: "Les deux lignes ont été rapprochées ensemble",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'effectuer le rapprochement inverse",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!rapprochement) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Rapprochement inverse
          </DialogTitle>
          <DialogDescription>
            Sélectionnez une ligne bancaire avec un montant inverse pour annuler cette transaction
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Transaction source */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Transaction source</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-4 gap-4 text-sm">
                {rapprochement.transaction.numero_ligne && (
                  <div>
                    <Label className="text-muted-foreground text-xs">N° Ligne</Label>
                    <p className="font-mono text-xs">{rapprochement.transaction.numero_ligne}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground text-xs">Date</Label>
                  <p className="font-medium">
                    {format(new Date(rapprochement.transaction.date), "dd/MM/yyyy", { locale: fr })}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Partenaire</Label>
                  <p className="font-medium truncate">
                    {rapprochement.fournisseur_info?.nom || "Non identifié"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Montant</Label>
                  <p className={`font-medium ${sourceMontant > 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(Math.abs(sourceMontant))}
                    {sourceMontant > 0 ? " (Crédit)" : " (Débit)"}
                  </p>
                </div>
                <div className="col-span-4">
                  <Label className="text-muted-foreground text-xs">Libellé</Label>
                  <p className="text-sm">{rapprochement.transaction.libelle}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une ligne inverse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Liste des lignes candidates */}
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="p-2 space-y-2">
              {lignesCandidates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm
                    ? "Aucune ligne correspondante trouvée"
                    : "Aucune ligne inverse disponible (même partenaire, montant opposé)"}
                </div>
              ) : (
                lignesCandidates.map((ligne) => {
                  const ligneDebit = ligne.transaction.debit || 0;
                  const ligneCredit = ligne.transaction.credit || 0;
                  const ligneMontant = ligneDebit > 0 ? ligneDebit : -ligneCredit;
                  const isSelected = ligne.transaction.numero_ligne === selectedLigneId;

                  return (
                    <div
                      key={ligne.transaction.numero_ligne}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedLigneId(ligne.transaction.numero_ligne || null)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => setSelectedLigneId(ligne.transaction.numero_ligne || null)}
                      />
                      <div className="flex-1 grid grid-cols-5 gap-2 text-sm items-center">
                        <span className="font-mono text-xs">
                          {ligne.transaction.numero_ligne?.slice(-10) || "-"}
                        </span>
                        <span>
                          {format(new Date(ligne.transaction.date), "dd/MM/yyyy", { locale: fr })}
                        </span>
                        <span className="truncate">
                          {ligne.fournisseur_info?.nom || "Non identifié"}
                        </span>
                        <span className="truncate text-muted-foreground text-xs">
                          {ligne.transaction.libelle.slice(0, 40)}...
                        </span>
                        <span
                          className={`font-medium text-right ${
                            ligneMontant > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(Math.abs(ligneMontant))}
                          {ligneMontant > 0 ? " (Cr)" : " (Db)"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Résumé */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-medium">Résumé du rapprochement</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground text-xs">Transaction source</Label>
                  <p className={`font-medium ${sourceMontant > 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(sourceMontant)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Ligne inverse</Label>
                  <p
                    className={`font-medium ${
                      selectedLigne
                        ? (selectedLigne.transaction.debit || 0) > 0
                          ? "text-green-600"
                          : "text-red-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {selectedLigne
                      ? formatCurrency(
                          (selectedLigne.transaction.debit || 0) > 0
                            ? selectedLigne.transaction.debit
                            : -selectedLigne.transaction.credit
                        )
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Solde</Label>
                  <p
                    className={`font-bold ${
                      solde === null
                        ? "text-muted-foreground"
                        : isBalanced
                        ? "text-green-600"
                        : "text-amber-600"
                    }`}
                  >
                    {solde !== null ? formatCurrency(solde) : "-"}
                  </p>
                </div>
              </div>

              {selectedLigne && !isBalanced && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Le solde n'est pas équilibré (différence: {formatCurrency(solde || 0)})</span>
                </div>
              )}

              {selectedLigne && isBalanced && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Les montants s'annulent parfaitement</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleRapprochement} disabled={saving || !selectedLigneId}>
            <Link2 className="h-4 w-4 mr-2" />
            {saving ? "En cours..." : "Rapprocher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
