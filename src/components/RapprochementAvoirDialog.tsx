import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, AlertTriangle, CheckCircle2, Link2 } from "lucide-react";

interface Facture {
  id: string;
  numero_facture: string;
  date_emission: string;
  destinataire_nom: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  statut: string;
  numero_ligne_rapprochement?: string;
}

interface RapprochementAvoirDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facture: Facture | null;
  onSuccess: () => void;
}

export default function RapprochementAvoirDialog({
  open,
  onOpenChange,
  facture,
  onSuccess,
}: RapprochementAvoirDialogProps) {
  const [avoirs, setAvoirs] = useState<Facture[]>([]);
  const [selectedAvoirIds, setSelectedAvoirIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && facture) {
      fetchAvoirs();
      setSelectedAvoirIds(new Set());
      setSearchTerm("");
    }
  }, [open, facture]);

  const fetchAvoirs = async () => {
    if (!facture) return;
    setLoading(true);
    try {
      // Chercher les avoirs non rapprochés pour le même client
      const { data, error } = await supabase
        .from("factures")
        .select("*")
        .eq("type_facture", "VENTES")
        .is("numero_ligne_rapprochement", null)
        .not("statut", "in", '("BROUILLON","ANNULEE")')
        .lt("total_ttc", 0) // Les avoirs ont des montants négatifs
        .order("date_emission", { ascending: false });

      if (error) throw error;
      setAvoirs(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les avoirs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAvoirs = useMemo(() => {
    if (!searchTerm) return avoirs;
    const term = searchTerm.toLowerCase();
    return avoirs.filter(
      (a) =>
        a.numero_facture?.toLowerCase().includes(term) ||
        a.destinataire_nom?.toLowerCase().includes(term)
    );
  }, [avoirs, searchTerm]);

  const selectedAvoirs = useMemo(() => {
    return avoirs.filter((a) => selectedAvoirIds.has(a.id));
  }, [avoirs, selectedAvoirIds]);

  const totalAvoirsTTC = useMemo(() => {
    return selectedAvoirs.reduce((sum, a) => sum + (a.total_ttc || 0), 0);
  }, [selectedAvoirs]);

  const totalAvoirsHT = useMemo(() => {
    return selectedAvoirs.reduce((sum, a) => sum + (a.total_ht || 0), 0);
  }, [selectedAvoirs]);

  const totalAvoirsTVA = useMemo(() => {
    return selectedAvoirs.reduce((sum, a) => sum + (a.total_tva || 0), 0);
  }, [selectedAvoirs]);

  const solde = useMemo(() => {
    if (!facture) return 0;
    return (facture.total_ttc || 0) + totalAvoirsTTC;
  }, [facture, totalAvoirsTTC]);

  const isBalanced = Math.abs(solde) < 0.01;

  const toggleAvoir = (id: string) => {
    const newSet = new Set(selectedAvoirIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedAvoirIds(newSet);
  };

  const handleRapprochement = async () => {
    if (!facture || selectedAvoirIds.size === 0) return;

    setSaving(true);
    try {
      // Générer un numéro de rapprochement interne unique
      const numeroRapprochement = `AVOIR-${format(new Date(), "yyyyMMdd-HHmmss")}`;
      const numeroLigne = `AVOIR-INT-${Date.now()}`;

      // Mettre à jour la facture principale
      const { error: errorFacture } = await supabase
        .from("factures")
        .update({
          numero_rapprochement: numeroRapprochement,
          numero_ligne_rapprochement: numeroLigne,
          date_rapprochement: new Date().toISOString().split("T")[0],
          statut: "PAYEE",
        })
        .eq("id", facture.id);

      if (errorFacture) throw errorFacture;

      // Mettre à jour les avoirs sélectionnés
      for (const avoirId of Array.from(selectedAvoirIds)) {
        const { error: errorAvoir } = await supabase
          .from("factures")
          .update({
            numero_rapprochement: numeroRapprochement,
            numero_ligne_rapprochement: numeroLigne,
            date_rapprochement: new Date().toISOString().split("T")[0],
            statut: "PAYEE",
          })
          .eq("id", avoirId);

        if (errorAvoir) throw errorAvoir;
      }

      toast({
        title: "Rapprochement effectué",
        description: `La facture ${facture.numero_facture} a été rapprochée avec ${selectedAvoirIds.size} avoir(s)`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible d'effectuer le rapprochement",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  if (!facture) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Rapprochement avec avoir
          </DialogTitle>
          <DialogDescription>
            Sélectionnez un ou plusieurs avoirs pour annuler la facture {facture.numero_facture}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Facture source */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">Facture à rapprocher</h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">N° Facture:</span>
                <p className="font-medium">{facture.numero_facture}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Client:</span>
                <p className="font-medium truncate">{facture.destinataire_nom}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <p className="font-medium">
                  {format(new Date(facture.date_emission), "dd/MM/yyyy", { locale: fr })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Montant TTC:</span>
                <p className="font-medium text-primary">{formatCurrency(facture.total_ttc)}</p>
              </div>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un avoir..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Liste des avoirs */}
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="p-2 space-y-2">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : filteredAvoirs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun avoir disponible
                </div>
              ) : (
                filteredAvoirs.map((avoir) => (
                  <div
                    key={avoir.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAvoirIds.has(avoir.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleAvoir(avoir.id)}
                  >
                    <Checkbox
                      checked={selectedAvoirIds.has(avoir.id)}
                      onCheckedChange={() => toggleAvoir(avoir.id)}
                    />
                    <FileText className="h-4 w-4 text-orange-500" />
                    <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                      <span className="font-medium">{avoir.numero_facture}</span>
                      <span className="truncate">{avoir.destinataire_nom}</span>
                      <span>
                        {format(new Date(avoir.date_emission), "dd/MM/yyyy", { locale: fr })}
                      </span>
                      <span className="font-medium text-orange-600">
                        {formatCurrency(avoir.total_ttc)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Résumé */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium">Résumé du rapprochement</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Facture:</span>
                <p className="font-medium">{formatCurrency(facture.total_ttc)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Avoirs sélectionnés:</span>
                <p className="font-medium text-orange-600">{formatCurrency(totalAvoirsTTC)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Solde:</span>
                <p
                  className={`font-bold ${
                    isBalanced ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  {formatCurrency(solde)}
                </p>
              </div>
            </div>

            {!isBalanced && selectedAvoirIds.size > 0 && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Le solde n'est pas équilibré. Le rapprochement sera tout de même effectué.
                </span>
              </div>
            )}

            {isBalanced && selectedAvoirIds.size > 0 && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>Les montants sont équilibrés - rapprochement parfait</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button
            onClick={handleRapprochement}
            disabled={saving || selectedAvoirIds.size === 0}
          >
            {saving ? "En cours..." : `Rapprocher (${selectedAvoirIds.size} avoir${selectedAvoirIds.size > 1 ? "s" : ""})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
