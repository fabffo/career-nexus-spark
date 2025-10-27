import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Search, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TransactionBancaire {
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  montant: number;
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

interface Consommation {
  montant: number;
  libelle: string;
  description?: string;
}

interface RapprochementManuelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionBancaire | null;
  factures: FactureMatch[];
  onSuccess: () => void;
}

export default function RapprochementManuelDialog({
  open,
  onOpenChange,
  transaction,
  factures,
  onSuccess,
}: RapprochementManuelDialogProps) {
  const [selectedFactureIds, setSelectedFactureIds] = useState<string[]>([]);
  const [selectedAbonnementId, setSelectedAbonnementId] = useState<string>("");
  const [selectedDeclarationId, setSelectedDeclarationId] = useState<string>("");
  const [abonnements, setAbonnements] = useState<any[]>([]);
  const [declarations, setDeclarations] = useState<any[]>([]);
  const [consommations, setConsommations] = useState<Consommation[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Réinitialiser les états quand le dialogue se ferme
  useEffect(() => {
    if (!open) {
      setSelectedFactureIds([]);
      setSelectedAbonnementId("");
      setSelectedDeclarationId("");
      setConsommations([]);
      setNotes("");
      setSearchTerm("");
      setFacturesNonRapprochees([]);
    }
  }, [open]);

  // Charger les abonnements et déclarations actifs
  useEffect(() => {
    const loadData = async () => {
      const [abonnementsRes, declarationsRes] = await Promise.all([
        supabase
          .from("abonnements_partenaires")
          .select("*")
          .eq("actif", true)
          .order("nom"),
        supabase
          .from("declarations_charges_sociales")
          .select("*")
          .eq("actif", true)
          .order("nom")
      ]);

      if (!abonnementsRes.error && abonnementsRes.data) {
        setAbonnements(abonnementsRes.data);
      }
      
      if (!declarationsRes.error && declarationsRes.data) {
        setDeclarations(declarationsRes.data);
      }
    };

    if (open) {
      loadData();
    }
  }, [open]);

  // Filtrer les factures pour n'afficher que celles non encore rapprochées
  const [facturesNonRapprochees, setFacturesNonRapprochees] = useState<FactureMatch[]>([]);

  useEffect(() => {
    console.log("===== RAPPROCHEMENT MANUEL DIALOG =====");
    console.log("Dialog open:", open);
    console.log("Factures reçues en prop:", factures.length);
    
    const loadFacturesNonRapprochees = async () => {
      // Si pas de factures passées en prop
      if (!factures || factures.length === 0) {
        console.warn("⚠️ Aucune facture passée au composant RapprochementManuelDialog");
        setFacturesNonRapprochees([]);
        return;
      }

      console.log("✓ Factures reçues:", factures.length);
      
      // Filtrer par numero_rapprochement
      const nonRapprocheesBase = factures.filter(f => !f.numero_rapprochement);
      console.log("✓ Factures sans numero_rapprochement:", nonRapprocheesBase.length);
      
      // Récupérer les factures dans la table de jonction
      const { data: facturesRapprochees, error } = await supabase
        .from("rapprochements_factures")
        .select("facture_id");

      if (error) {
        console.error("❌ Erreur chargement rapprochements_factures:", error);
      } else {
        console.log("✓ Table de jonction - Factures rapprochées:", facturesRapprochees?.length || 0);
      }

      const idsRapproches = new Set(facturesRapprochees?.map(r => r.facture_id) || []);
      
      // Filtrer les factures de la table de jonction
      const facturesFinales = nonRapprocheesBase.filter(f => !idsRapproches.has(f.id));
      
      console.log("✅ RÉSULTAT FINAL:", facturesFinales.length, "factures disponibles");
      console.log("  Ventes:", facturesFinales.filter(f => f.type_facture === 'VENTES').length);
      console.log("  Achats:", facturesFinales.filter(f => f.type_facture === 'ACHATS').length);
      console.log("=======================================");
      
      setFacturesNonRapprochees(facturesFinales);
    };

    if (open) {
      loadFacturesNonRapprochees();
    }
  }, [open, factures]);

  // Filtrer les factures de ventes et d'achats non rapprochées
  const facturesVentes = facturesNonRapprochees.filter((f) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = f.numero_facture.toLowerCase().includes(search) ||
      f.partenaire_nom.toLowerCase().includes(search) ||
      f.total_ttc.toString().includes(search);
    return f.type_facture === "VENTES" && matchesSearch;
  });

  const facturesAchats = facturesNonRapprochees.filter((f) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = f.numero_facture.toLowerCase().includes(search) ||
      f.partenaire_nom.toLowerCase().includes(search) ||
      f.total_ttc.toString().includes(search);
    return f.type_facture === "ACHATS" && matchesSearch;
  });

  const selectedFactures = facturesNonRapprochees.filter((f) => selectedFactureIds.includes(f.id));
  const totalFacturesSelectionnees = selectedFactures.reduce((sum, f) => sum + f.total_ttc, 0);

  const toggleFactureSelection = (factureId: string) => {
    setSelectedFactureIds((prev) =>
      prev.includes(factureId)
        ? prev.filter((id) => id !== factureId)
        : [...prev, factureId]
    );
  };

  const handleSave = async () => {
    if (!transaction) {
      toast({
        title: "Erreur",
        description: "Transaction manquante",
        variant: "destructive",
      });
      return;
    }

    // Validation: au moins une facture, un abonnement ou une déclaration doit être sélectionné
    if (selectedFactureIds.length === 0 && !selectedAbonnementId && !selectedDeclarationId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins une facture, un abonnement ou une déclaration",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();

      // Vérifier si un rapprochement existe déjà pour cette transaction
      const { data: existing } = await supabase
        .from("rapprochements_bancaires")
        .select("id")
        .eq("transaction_date", transaction.date)
        .eq("transaction_libelle", transaction.libelle)
        .eq("transaction_montant", transaction.montant)
        .maybeSingle();

      let rapprochementId = existing?.id;

      if (existing) {
        // Mettre à jour
        const { error } = await supabase
          .from("rapprochements_bancaires")
          .update({
            abonnement_id: selectedAbonnementId || null,
            declaration_charge_id: selectedDeclarationId || null,
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
        rapprochementId = existing.id;
      } else {
        // Créer un nouveau
        const { data: newRapprochement, error } = await supabase
          .from("rapprochements_bancaires")
          .insert({
            transaction_date: transaction.date,
            transaction_libelle: transaction.libelle,
            transaction_debit: transaction.debit,
            transaction_credit: transaction.credit,
            transaction_montant: transaction.montant,
            abonnement_id: selectedAbonnementId || null,
            declaration_charge_id: selectedDeclarationId || null,
            notes,
            created_by: authData.user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        rapprochementId = newRapprochement.id;
      }

      // Gérer les factures associées
      if (rapprochementId && selectedFactureIds.length > 0) {
        // Supprimer les anciennes associations
        await supabase
          .from("rapprochements_factures")
          .delete()
          .eq("rapprochement_id", rapprochementId);

        // Créer les nouvelles associations
        const facturesAssociations = selectedFactureIds.map((factureId) => ({
          rapprochement_id: rapprochementId,
          facture_id: factureId,
          created_by: authData.user?.id,
        }));

        const { error: facturesError } = await supabase
          .from("rapprochements_factures")
          .insert(facturesAssociations);

        if (facturesError) throw facturesError;
      }

      // Si un abonnement est sélectionné, créer automatiquement un paiement d'abonnement
      if (selectedAbonnementId && rapprochementId) {
        const { error: paiementError } = await supabase
          .from("paiements_abonnements")
          .insert({
            abonnement_id: selectedAbonnementId,
            rapprochement_id: rapprochementId,
            date_paiement: transaction.date,
            montant: Math.abs(transaction.montant),
            notes: `Créé automatiquement depuis le rapprochement bancaire`,
            created_by: authData.user?.id,
          });

        if (paiementError) {
          console.error("Erreur lors de la création du paiement:", paiementError);
          // On ne bloque pas le process, juste un warning
          toast({
            title: "Attention",
            description: "Rapprochement enregistré mais erreur lors de la création du paiement d'abonnement",
            variant: "destructive",
          });
        }

        // Créer les consommations si elles existent
        if (consommations.length > 0) {
          const consommationsToInsert = consommations.map((c) => ({
            abonnement_id: selectedAbonnementId,
            rapprochement_id: rapprochementId,
            date_consommation: transaction.date,
            montant: c.montant,
            libelle: c.libelle,
            description: c.description || null,
            created_by: authData.user?.id,
          }));

          const { error: consommationError } = await supabase
            .from("abonnements_consommations")
            .insert(consommationsToInsert);

          if (consommationError) {
            console.error("Erreur lors de la création des consommations:", consommationError);
            toast({
              title: "Attention",
              description: "Erreur lors de l'enregistrement des consommations",
              variant: "destructive",
            });
          }
        }
      }

      // Si une déclaration est sélectionnée, créer automatiquement un paiement de déclaration
      if (selectedDeclarationId && rapprochementId) {
        const { error: paiementError } = await supabase
          .from("paiements_declarations_charges")
          .insert({
            declaration_charge_id: selectedDeclarationId,
            rapprochement_id: rapprochementId,
            date_paiement: transaction.date,
            montant: Math.abs(transaction.montant),
            notes: `Créé automatiquement depuis le rapprochement bancaire`,
            created_by: authData.user?.id,
          });

        if (paiementError) {
          console.error("Erreur lors de la création du paiement:", paiementError);
          toast({
            title: "Attention",
            description: "Rapprochement enregistré mais erreur lors de la création du paiement de déclaration",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Succès",
        description: selectedAbonnementId 
          ? `Rapprochement enregistré, paiement d'abonnement créé${consommations.length > 0 ? ` et ${consommations.length} consommation(s) ajoutée(s)` : ""}`
          : selectedDeclarationId
          ? "Rapprochement enregistré, paiement de déclaration créé"
          : `Rapprochement manuel enregistré${selectedFactureIds.length > 0 ? ` avec ${selectedFactureIds.length} facture(s)` : ""}`,
      });

      onSuccess();
      onOpenChange(false);
      setSelectedFactureIds([]);
      setSelectedAbonnementId("");
      setSelectedDeclarationId("");
      setConsommations([]);
      setNotes("");
      setSearchTerm("");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le rapprochement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rapprochement manuel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold">Transaction bancaire</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Date:</span>{" "}
                {format(new Date(transaction.date), "dd MMMM yyyy", { locale: fr })}
              </div>
              <div>
                <span className="text-muted-foreground">Montant:</span>{" "}
                <span className={transaction.montant > 0 ? "text-green-600" : "text-red-600"}>
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(Math.abs(transaction.montant))}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Libellé:</span>{" "}
                {transaction.libelle}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <Label>Rechercher une facture</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="N° facture, partenaire, montant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Factures de ventes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-green-600 font-semibold">Factures de ventes non rapprochées</Label>
              {selectedFactureIds.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Total sélectionné: </span>
                  <span className={`font-semibold ${Math.abs(transaction.montant - totalFacturesSelectionnees) < 0.01 ? 'text-green-600' : 'text-orange-600'}`}>
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                    }).format(totalFacturesSelectionnees)}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    ({selectedFactureIds.length} facture{selectedFactureIds.length > 1 ? 's' : ''})
                  </span>
                </div>
              )}
            </div>
            <div className="border rounded-lg max-h-[250px] overflow-y-auto">
              {facturesVentes.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Aucune facture de vente non rapprochée
                </div>
              ) : (
                facturesVentes.map((facture) => (
                  <div
                    key={facture.id}
                    className={`flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer ${
                      selectedFactureIds.includes(facture.id) ? 'bg-green-50 dark:bg-green-950' : ''
                    }`}
                    onClick={() => toggleFactureSelection(facture.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFactureIds.includes(facture.id)}
                      onChange={() => toggleFactureSelection(facture.id)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 grid grid-cols-4 gap-2 items-center">
                      <span className="font-medium">{facture.numero_facture}</span>
                      <span className="text-sm text-muted-foreground truncate">
                        {facture.partenaire_nom}
                      </span>
                      <span className="font-medium text-right text-green-600">
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(facture.total_ttc)}
                      </span>
                      <span className="text-xs text-muted-foreground text-right">
                        {format(new Date(facture.date_emission), "dd/MM/yyyy")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Factures d'achats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-orange-600 font-semibold">Factures d'achats non rapprochées</Label>
            </div>
            <div className="border rounded-lg max-h-[250px] overflow-y-auto">
              {facturesAchats.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Aucune facture d'achat non rapprochée
                </div>
              ) : (
                facturesAchats.map((facture) => (
                  <div
                    key={facture.id}
                    className={`flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer ${
                      selectedFactureIds.includes(facture.id) ? 'bg-orange-50 dark:bg-orange-950' : ''
                    }`}
                    onClick={() => toggleFactureSelection(facture.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFactureIds.includes(facture.id)}
                      onChange={() => toggleFactureSelection(facture.id)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 grid grid-cols-4 gap-2 items-center">
                      <span className="font-medium">{facture.numero_facture}</span>
                      <span className="text-sm text-muted-foreground truncate">
                        {facture.partenaire_nom}
                      </span>
                      <span className="font-medium text-right text-orange-600">
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(facture.total_ttc)}
                      </span>
                      <span className="text-xs text-muted-foreground text-right">
                        {format(new Date(facture.date_emission), "dd/MM/yyyy")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Abonnement selection */}
          <div className="space-y-2">
            <Label>Abonnement partenaire</Label>
            <Select value={selectedAbonnementId} onValueChange={setSelectedAbonnementId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un abonnement (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="text-muted-foreground">Aucun abonnement</span>
                </SelectItem>
                {abonnements.map((abonnement) => (
                  <SelectItem key={abonnement.id} value={abonnement.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{abonnement.nom}</span>
                      <Badge variant="outline" className="text-xs">
                        {abonnement.nature}
                      </Badge>
                      {abonnement.montant_mensuel && (
                        <span className="text-sm text-muted-foreground">
                          {Number(abonnement.montant_mensuel).toFixed(2)} €/mois
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAbonnementId && (
              <p className="text-xs text-muted-foreground">
                Un paiement d'abonnement sera automatiquement créé
              </p>
            )}
          </div>

          {/* Déclaration de charges sociales selection */}
          <div className="space-y-2">
            <Label>Déclaration de charges sociales</Label>
            <Select value={selectedDeclarationId} onValueChange={setSelectedDeclarationId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une déclaration (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="text-muted-foreground">Aucune déclaration</span>
                </SelectItem>
                {declarations.map((declaration) => (
                  <SelectItem key={declaration.id} value={declaration.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{declaration.nom}</span>
                      <Badge variant="outline" className="text-xs">
                        {declaration.type_charge}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {declaration.organisme}
                      </span>
                      {declaration.montant_estime && (
                        <span className="text-sm text-muted-foreground">
                          ~{Number(declaration.montant_estime).toFixed(2)} €
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDeclarationId && (
              <p className="text-xs text-muted-foreground">
                Un paiement de déclaration sera automatiquement créé
              </p>
            )}
          </div>

          {/* Consommations d'abonnement */}
          {selectedAbonnementId && (
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label>Consommations supplémentaires</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConsommations([...consommations, { montant: 0, libelle: "" }])}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
              {consommations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucune consommation supplémentaire
                </p>
              )}
              {consommations.map((consommation, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <Input
                      placeholder="Libellé"
                      value={consommation.libelle}
                      onChange={(e) => {
                        const updated = [...consommations];
                        updated[index].libelle = e.target.value;
                        setConsommations(updated);
                      }}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder="Montant"
                      value={consommation.montant || ""}
                      onChange={(e) => {
                        const updated = [...consommations];
                        updated[index].montant = parseFloat(e.target.value) || 0;
                        setConsommations(updated);
                      }}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="Description (opt.)"
                      value={consommation.description || ""}
                      onChange={(e) => {
                        const updated = [...consommations];
                        updated[index].description = e.target.value;
                        setConsommations(updated);
                      }}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setConsommations(consommations.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {consommations.length > 0 && (
                <div className="pt-2 border-t text-sm font-medium">
                  Total consommations: {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(consommations.reduce((sum, c) => sum + c.montant, 0))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optionnel)</Label>
            <Textarea
              placeholder="Ajouter des notes sur ce rapprochement..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || (selectedFactureIds.length === 0 && !selectedAbonnementId && !selectedDeclarationId)}
          >
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
