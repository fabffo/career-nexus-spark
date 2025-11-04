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
import { Search, CheckCircle, XCircle, AlertCircle, Plus, X } from "lucide-react";
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
  numero_ligne_rapprochement?: string;
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

interface Consommation {
  id?: string;
  montant: number;
  libelle: string;
  description?: string;
}

interface EditRapprochementHistoriqueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rapprochement: Rapprochement | null;
  factures: FactureMatch[];
  fichierId: string;
  onSuccess: () => void;
}

export default function EditRapprochementHistoriqueDialog({
  open,
  onOpenChange,
  rapprochement,
  factures,
  fichierId,
  onSuccess,
}: EditRapprochementHistoriqueDialogProps) {
  const [status, setStatus] = useState<"matched" | "unmatched" | "uncertain">("unmatched");
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
      setStatus("unmatched");
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
    console.log("===== EDIT HISTORIQUE DIALOG - USEEFFECT TRIGGERED =====");
    console.log("Dialog open:", open);
    console.log("Factures reçues en prop:", factures?.length || 0);
    console.log("Rapprochement:", rapprochement);
    
    const loadFacturesNonRapprochees = async () => {
      // Si pas de factures passées en prop, impossible de continuer
      if (!factures || factures.length === 0) {
        console.warn("⚠️ Aucune facture passée au composant EditRapprochementHistoriqueDialog");
        setFacturesNonRapprochees([]);
        return;
      }

      console.log("✓ Factures reçues:", factures.length);
      
      const numeroLigneActuel = rapprochement?.transaction?.numero_ligne;
      console.log("✓ Numéro de ligne actuel:", numeroLigneActuel);
      console.log("✓ Mode:", numeroLigneActuel ? "Édition d'un rapprochement existant" : "Nouveau rapprochement ou non rapproché");
      
      // Filtrer les factures disponibles
      const facturesDisponibles = factures.filter(f => {
        const numeroLigneFacture = f.numero_ligne_rapprochement;
        
        // Cas 1: Facture non rapprochée (pas de numero_ligne_rapprochement)
        if (!numeroLigneFacture) {
          console.log(`  ✓ Facture ${f.numero_facture}: non rapprochée`);
          return true;
        }
        
        // Cas 2: Facture rapprochée avec CE numero_ligne (mode édition)
        if (numeroLigneActuel && numeroLigneFacture === numeroLigneActuel) {
          console.log(`  ✓ Facture ${f.numero_facture}: rapprochée avec cette ligne`);
          return true;
        }
        
        // Cas 3: Facture rapprochée avec un AUTRE numero_ligne -> exclure
        console.log(`  ✗ Facture ${f.numero_facture}: rapprochée avec une autre ligne (${numeroLigneFacture})`);
        return false;
      });
      
      console.log("✓ Après filtrage par numero_ligne:", facturesDisponibles.length);
      
      // Récupérer les IDs de factures dans la table de jonction (sauf celles du rapprochement actuel)
      const { data: facturesRapprochees, error } = await supabase
        .from("rapprochements_factures")
        .select("facture_id, rapprochement_id");

      if (error) {
        console.error("❌ Erreur chargement rapprochements_factures:", error);
      } else {
        console.log("✓ Table de jonction - Total:", facturesRapprochees?.length || 0);
      }

      // Exclure les factures qui sont dans la table de jonction avec un AUTRE rapprochement
      const idsRapproches = new Set(
        (facturesRapprochees || [])
          .filter(r => r.rapprochement_id !== rapprochement?.manualId)
          .map(r => r.facture_id)
      );
      
      console.log("✓ IDs à exclure (autres rapprochements dans table de jonction):", idsRapproches.size);
      
      // Filtrer les factures de la table de jonction
      const facturesFinales = facturesDisponibles.filter(f => !idsRapproches.has(f.id));
      
      console.log("✅ RÉSULTAT FINAL:", facturesFinales.length, "factures disponibles");
      console.log("  Ventes:", facturesFinales.filter(f => f.type_facture === 'VENTES').length);
      console.log("  Achats:", facturesFinales.filter(f => f.type_facture === 'ACHATS').length);
      console.log("=====================================");
      
      setFacturesNonRapprochees(facturesFinales);
    };

    if (open) {
      console.log("🚀 Démarrage chargement des factures...");
      loadFacturesNonRapprochees();
    } else {
      console.log("❌ Dialog fermé, pas de chargement");
    }
  }, [open, factures, rapprochement]);

  // Initialiser les valeurs au chargement
  useEffect(() => {
    if (rapprochement && open) {
      setStatus(rapprochement.status);
      setNotes(rapprochement.notes || "");
      
      // Charger les factures, l'abonnement, la déclaration et les consommations associés
      const loadAssociatedData = async () => {
        if (!rapprochement.manualId) return;
        
        // Charger les factures associées depuis la table de jonction
        const { data: facturesData } = await supabase
          .from("rapprochements_factures")
          .select("facture_id")
          .eq("rapprochement_id", rapprochement.manualId);
        
        if (facturesData) {
          setSelectedFactureIds(facturesData.map(f => f.facture_id));
        }
        
        const { data } = await supabase
          .from("rapprochements_bancaires")
          .select("abonnement_id, declaration_charge_id")
          .eq("id", rapprochement.manualId)
          .maybeSingle();
        
        if (data?.abonnement_id) {
          setSelectedAbonnementId(data.abonnement_id);
          
          // Charger les consommations existantes
          const { data: consommationsData } = await supabase
            .from("abonnements_consommations")
            .select("*")
            .eq("rapprochement_id", rapprochement.manualId);
          
          if (consommationsData) {
            setConsommations(consommationsData.map(c => ({
              id: c.id,
              montant: Number(c.montant),
              libelle: c.libelle,
              description: c.description || undefined,
            })));
          }
        }
        
        if (data?.declaration_charge_id) {
          setSelectedDeclarationId(data.declaration_charge_id);
        }
      };
      
      loadAssociatedData();
    }
  }, [rapprochement, open]);

  // Filtrer les factures de ventes et d'achats
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
    if (!rapprochement) return;

    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const transaction = rapprochement.transaction;

      // ⭐ Générer un numero_ligne unique si la transaction n'en a pas
      let numeroLigne = transaction.numero_ligne;
      if (!numeroLigne) {
        const { data: numeroLigneData, error: numeroLigneError } = await supabase
          .rpc('generate_numero_ligne');
        
        if (numeroLigneError || !numeroLigneData) {
          throw new Error("Erreur lors de la génération du numero_ligne");
        }
        
        numeroLigne = numeroLigneData;
        console.log(`✅ Numéro de ligne généré: ${numeroLigne}`);
      }

      // 1. Mettre à jour ou créer le rapprochement manuel - RECHERCHER PAR numero_ligne
      const { data: existing } = await supabase
        .from("rapprochements_bancaires")
        .select("id")
        .eq("numero_ligne", numeroLigne || "")
        .maybeSingle();

      let rapprochementId = existing?.id;

      if (existing) {
        const { error } = await supabase
          .from("rapprochements_bancaires")
          .update({
            abonnement_id: selectedAbonnementId && selectedAbonnementId !== "none" ? selectedAbonnementId : null,
            declaration_charge_id: selectedDeclarationId && selectedDeclarationId !== "none" ? selectedDeclarationId : null,
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { data: newRapprochement, error } = await supabase
          .from("rapprochements_bancaires")
          .insert({
            transaction_date: transaction.date,
            transaction_libelle: transaction.libelle,
            transaction_debit: transaction.debit,
            transaction_credit: transaction.credit,
            transaction_montant: transaction.montant,
            numero_ligne: numeroLigne || null,
            abonnement_id: selectedAbonnementId && selectedAbonnementId !== "none" ? selectedAbonnementId : null,
            declaration_charge_id: selectedDeclarationId && selectedDeclarationId !== "none" ? selectedDeclarationId : null,
            notes,
            created_by: authData.user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        rapprochementId = newRapprochement.id;
      }

      // ⭐ Récupérer le numero_rapprochement du fichier
      const { data: fichierInfo } = await supabase
        .from("fichiers_rapprochement")
        .select("numero_rapprochement")
        .eq("id", fichierId)
        .maybeSingle();
      
      const numeroRapprochement = fichierInfo?.numero_rapprochement;

      // Gérer les factures associées
      if (rapprochementId && numeroLigne) {
        // 1. Dé-rapprocher TOUTES les factures qui ont ce numero_ligne
        await supabase
          .from("factures")
          .update({ 
            numero_ligne_rapprochement: null,
            numero_rapprochement: null,
            date_rapprochement: null,
          })
          .eq("numero_ligne_rapprochement", numeroLigne);

        // 2. Supprimer les anciennes associations
        await supabase
          .from("rapprochements_factures")
          .delete()
          .eq("rapprochement_id", rapprochementId);

        // 3. Créer les nouvelles associations et rapprocher les factures
        if (selectedFactureIds.length > 0) {
          const facturesAssociations = selectedFactureIds.map((factureId) => ({
            rapprochement_id: rapprochementId,
            facture_id: factureId,
            created_by: authData.user?.id,
          }));

          const { error: facturesError } = await supabase
            .from("rapprochements_factures")
            .insert(facturesAssociations);

          if (facturesError) throw facturesError;

          // ⭐ 4. Mettre à jour toutes les informations de rapprochement des factures
          for (const factureId of selectedFactureIds) {
            await supabase
              .from("factures")
              .update({ 
                numero_ligne_rapprochement: numeroLigne,
                numero_rapprochement: numeroRapprochement,
                date_rapprochement: new Date().toISOString(),
              })
              .eq("id", factureId);
          }
        }
      }

      // 2. Créer le paiement d'abonnement si nécessaire
      if (selectedAbonnementId && selectedAbonnementId !== "none" && rapprochementId) {
        // Vérifier si un paiement existe déjà pour ce rapprochement
        const { data: existingPaiement } = await supabase
          .from("paiements_abonnements")
          .select("id")
          .eq("rapprochement_id", rapprochementId)
          .maybeSingle();

        if (!existingPaiement) {
          const { error: paiementError } = await supabase
            .from("paiements_abonnements")
            .insert({
              abonnement_id: selectedAbonnementId,
              rapprochement_id: rapprochementId,
              date_paiement: transaction.date,
              montant: Math.abs(transaction.montant),
              notes: `Créé depuis l'édition du rapprochement historique`,
              created_by: authData.user?.id,
            });

          if (paiementError) {
            console.error("Erreur lors de la création du paiement:", paiementError);
          }
        } else {
          // Mettre à jour le paiement existant
          const { error: updateError } = await supabase
            .from("paiements_abonnements")
            .update({
              abonnement_id: selectedAbonnementId,
              date_paiement: transaction.date,
              montant: Math.abs(transaction.montant),
              notes: notes || null,
            })
            .eq("id", existingPaiement.id);

          if (updateError) {
            console.error("Erreur lors de la mise à jour du paiement:", updateError);
          }
        }

        // Gérer les consommations
        // Supprimer les anciennes consommations
        await supabase
          .from("abonnements_consommations")
          .delete()
          .eq("rapprochement_id", rapprochementId);

        // Créer les nouvelles consommations
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
          }
        }
      }

      // Créer le paiement de déclaration si nécessaire
      if (selectedDeclarationId && selectedDeclarationId !== "none" && rapprochementId) {
        const { data: existingPaiement } = await supabase
          .from("paiements_declarations_charges")
          .select("id")
          .eq("rapprochement_id", rapprochementId)
          .maybeSingle();

        if (!existingPaiement) {
          const { error: paiementError } = await supabase
            .from("paiements_declarations_charges")
            .insert({
              declaration_charge_id: selectedDeclarationId,
              rapprochement_id: rapprochementId,
              date_paiement: transaction.date,
              montant: Math.abs(transaction.montant),
              notes: `Créé depuis l'édition du rapprochement historique`,
              created_by: authData.user?.id,
            });

          if (paiementError) {
            console.error("Erreur lors de la création du paiement:", paiementError);
          }
        } else {
          const { error: updateError } = await supabase
            .from("paiements_declarations_charges")
            .update({
              declaration_charge_id: selectedDeclarationId,
              date_paiement: transaction.date,
              montant: Math.abs(transaction.montant),
              notes: notes || null,
            })
            .eq("id", existingPaiement.id);

          if (updateError) {
            console.error("Erreur lors de la mise à jour du paiement:", updateError);
          }
        }
      }

      // ⭐ 3. Mettre à jour le fichier de rapprochement pour recalculer le nombre de lignes rapprochées
      const { data: fichierDataFull } = await supabase
        .from("fichiers_rapprochement")
        .select("*")
        .eq("id", fichierId)
        .single();

      if (fichierDataFull) {
        // ⭐ Récupérer TOUS les rapprochements bancaires liés aux transactions de ce fichier
        const fichierData = fichierDataFull.fichier_data as any;
        const transactionsFichier = fichierData?.transactions || [];
        const numerosLignesFichier = transactionsFichier
          .map((t: any) => t.numero_ligne)
          .filter(Boolean);

        let lignesRapprochees = 0;
        
        if (numerosLignesFichier.length > 0) {
          const { data: rapprochementsLinked, count } = await supabase
            .from("rapprochements_bancaires")
            .select("numero_ligne", { count: "exact" })
            .in("numero_ligne", numerosLignesFichier);
          
          lignesRapprochees = count || 0;
        }

        // Mettre à jour le rapprochement dans fichier_data.rapprochements
        const rapprochements = fichierData?.rapprochements || [];
        const rapprochementIndex = rapprochements.findIndex(
          (r: any) =>
            r.transaction.date === transaction.date &&
            r.transaction.libelle === transaction.libelle &&
            r.transaction.montant === transaction.montant
        );

        if (rapprochementIndex >= 0) {
          rapprochements[rapprochementIndex] = {
            ...rapprochements[rapprochementIndex],
            status,
            isManual: true,
            notes,
            numero_ligne: numeroLigne,
          };
        }

        const { error: updateFichierError } = await supabase
          .from("fichiers_rapprochement")
          .update({
            fichier_data: {
              ...fichierData,
              rapprochements,
            } as any,
            lignes_rapprochees: lignesRapprochees,
            updated_at: new Date().toISOString(),
          })
          .eq("id", fichierId);

        if (updateFichierError) throw updateFichierError;
      }

      toast({
        title: "Succès",
        description: "Rapprochement modifié avec succès",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le rapprochement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!rapprochement) return null;

  const transaction = rapprochement.transaction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le rapprochement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold">Transaction bancaire</h3>
            {transaction.numero_ligne && (
              <div className="mb-2">
                <span className="text-muted-foreground text-sm">Numéro de ligne:</span>{" "}
                <span className="font-mono text-sm font-medium text-primary">{transaction.numero_ligne}</span>
              </div>
            )}
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

          {/* Status selection */}
          <div className="space-y-2">
            <Label>Statut *</Label>
            <Select value={status} onValueChange={(value: any) => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="matched">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Rapproché</span>
                  </div>
                </SelectItem>
                <SelectItem value="uncertain">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span>Incertain</span>
                  </div>
                </SelectItem>
                <SelectItem value="unmatched">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>Non rapproché</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="none">
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
            {selectedAbonnementId && selectedAbonnementId !== "none" && (
              <p className="text-xs text-muted-foreground">
                Un paiement d'abonnement sera créé ou mis à jour
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
                <SelectItem value="none">
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
            {selectedDeclarationId && selectedDeclarationId !== "none" && (
              <p className="text-xs text-muted-foreground">
                Un paiement de déclaration sera créé ou mis à jour
              </p>
            )}
          </div>

          {/* Consommations d'abonnement */}
          {selectedAbonnementId && selectedAbonnementId !== "none" && (
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
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
