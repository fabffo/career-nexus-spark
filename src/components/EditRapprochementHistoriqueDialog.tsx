import { useState, useEffect, useMemo } from "react";
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
  type_facture: "VENTES" | "ACHATS" | "ACHATS_GENERAUX" | "ACHATS_SERVICES" | "ACHATS_ETAT";
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
  const [extraFactures, setExtraFactures] = useState<FactureMatch[]>([]);
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
      setExtraFactures([]);
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
      const realId = rapprochement?.manualId?.replace(/^rb_/, '');
      const idsRapproches = new Set(
        (facturesRapprochees || [])
          .filter(r => r.rapprochement_id !== realId)
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
        const numeroLigne = rapprochement.transaction?.numero_ligne;
        
        // ⭐ PRIORITÉ 1: Charger depuis lignes_rapprochement (source de vérité)
        if (numeroLigne) {
          const { data: ligneData, error: ligneError } = await supabase
            .from("lignes_rapprochement")
            .select("facture_id, factures_ids, abonnement_id, declaration_charge_id")
            .eq("numero_ligne", numeroLigne)
            .maybeSingle();
          
          if (!ligneError && ligneData) {
            console.log("[EditHistorique] Données lignes_rapprochement:", ligneData);
            
            // Récupérer les IDs de factures
            const factureIds: string[] = [];
            if (ligneData.facture_id) {
              factureIds.push(ligneData.facture_id);
            }
            if (ligneData.factures_ids && Array.isArray(ligneData.factures_ids)) {
              factureIds.push(...ligneData.factures_ids.filter((id: string) => id && !factureIds.includes(id)));
            }
            
            if (factureIds.length > 0) {
              console.log("[EditHistorique] Factures trouvées dans lignes_rapprochement:", factureIds);
              setSelectedFactureIds(factureIds);
            }
            
            if (ligneData.abonnement_id) {
              setSelectedAbonnementId(ligneData.abonnement_id);
            }
            
            if (ligneData.declaration_charge_id) {
              setSelectedDeclarationId(ligneData.declaration_charge_id);
            }
            
            return; // On a trouvé les données, pas besoin de chercher dans rapprochements_bancaires
          }
        }
        
        // ⭐ FALLBACK: Charger depuis rapprochements_bancaires (compatibilité)
        if (!rapprochement.manualId) return;
        
        // Extraire l'ID réel en enlevant le préfixe "rb_"
        const realId = rapprochement.manualId.replace(/^rb_/, '');
        
        // Charger les factures associées depuis la table de jonction
        const { data: facturesData } = await supabase
          .from("rapprochements_factures")
          .select("facture_id")
          .eq("rapprochement_id", realId);
        
        if (facturesData && facturesData.length > 0) {
          console.log("[EditHistorique] Factures trouvées dans rapprochements_factures:", facturesData.map(f => f.facture_id));
          setSelectedFactureIds(facturesData.map(f => f.facture_id));
        }
        
        const { data } = await supabase
          .from("rapprochements_bancaires")
          .select("abonnement_id, declaration_charge_id")
          .eq("id", realId)
          .maybeSingle();
        
        if (data?.abonnement_id) {
          setSelectedAbonnementId(data.abonnement_id);
          
          // Charger les consommations existantes
          const { data: consommationsData } = await supabase
            .from("abonnements_consommations")
            .select("*")
            .eq("rapprochement_id", realId);
          
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

  // Charger les factures manquantes (qui ne sont pas dans la liste props ni dans facturesNonRapprochees)
  useEffect(() => {
    const loadMissingFactures = async () => {
      if (!open || !rapprochement) return;

      const idsWanted = Array.from(
        new Set<string>([
          ...selectedFactureIds,
          ...(rapprochement.facture ? [rapprochement.facture.id] : []),
        ])
      ).filter(Boolean);

      if (idsWanted.length === 0) return;

      const inProps = new Set(factures.map((f) => f.id));
      const inNonRapprochees = new Set(facturesNonRapprochees.map((f) => f.id));
      const inExtra = new Set(extraFactures.map((f) => f.id));
      const missing = idsWanted.filter((id) => !inProps.has(id) && !inNonRapprochees.has(id) && !inExtra.has(id));
      if (missing.length === 0) return;

      const { data, error } = await supabase
        .from("factures")
        .select(
          "id, numero_facture, type_facture, date_emission, total_ttc, statut, numero_rapprochement, date_rapprochement, numero_ligne_rapprochement, emetteur_nom, destinataire_nom"
        )
        .in("id", missing);

      if (error) {
        console.error("Erreur chargement factures manquantes (historique):", error);
        return;
      }

      const formatted: FactureMatch[] = (data ?? []).map((f: any) => ({
        id: f.id,
        numero_facture: f.numero_facture,
        type_facture: f.type_facture,
        date_emission: f.date_emission,
        partenaire_nom: f.type_facture === "VENTES" ? f.destinataire_nom : f.emetteur_nom,
        total_ttc: f.total_ttc ?? 0,
        statut: f.statut ?? "",
        numero_rapprochement: f.numero_rapprochement ?? undefined,
        date_rapprochement: f.date_rapprochement ?? undefined,
        numero_ligne_rapprochement: f.numero_ligne_rapprochement ?? undefined,
      }));

      setExtraFactures((prev) => {
        const map = new Map<string, FactureMatch>(prev.map((x) => [x.id, x]));
        formatted.forEach((x) => map.set(x.id, x));
        return Array.from(map.values());
      });
    };

    loadMissingFactures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rapprochement, selectedFactureIds, factures, facturesNonRapprochees]);

  // Combiner toutes les factures disponibles
  const allFactures = useMemo(() => {
    const map = new Map<string, FactureMatch>();
    factures.forEach((f) => map.set(f.id, f));
    facturesNonRapprochees.forEach((f) => map.set(f.id, f));
    extraFactures.forEach((f) => map.set(f.id, f));
    return Array.from(map.values());
  }, [factures, facturesNonRapprochees, extraFactures]);

  // Filtrer les factures de ventes et d'achats
  const facturesVentes = allFactures.filter((f) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = f.numero_facture.toLowerCase().includes(search) ||
      f.partenaire_nom.toLowerCase().includes(search) ||
      f.total_ttc.toString().includes(search);
    
    // Exclure les factures rapprochées avec une autre ligne
    const numeroLigneActuel = rapprochement?.transaction?.numero_ligne;
    const isAvailable = !f.numero_ligne_rapprochement || f.numero_ligne_rapprochement === numeroLigneActuel || selectedFactureIds.includes(f.id);
    
    return f.type_facture === "VENTES" && matchesSearch && isAvailable;
  });

  const facturesAchats = allFactures.filter((f) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      f.numero_facture.toLowerCase().includes(search) ||
      f.partenaire_nom.toLowerCase().includes(search) ||
      f.total_ttc.toString().includes(search);

    // Exclure les factures rapprochées avec une autre ligne
    const numeroLigneActuel = rapprochement?.transaction?.numero_ligne;
    const isAvailable = !f.numero_ligne_rapprochement || f.numero_ligne_rapprochement === numeroLigneActuel || selectedFactureIds.includes(f.id);

    // Inclure toutes les factures d'achats (ACHATS, ACHATS_SERVICES, ACHATS_GENERAUX, ACHATS_ETAT)
    return f.type_facture !== "VENTES" && matchesSearch && isAvailable;
  });

  const selectedFactures = allFactures.filter((f) => selectedFactureIds.includes(f.id));
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

      // ⭐ Si le statut est "unmatched", supprimer complètement le rapprochement
      if (status === "unmatched") {
        // 1. Rechercher le rapprochement existant par numero_ligne
        const { data: existing } = await supabase
          .from("rapprochements_bancaires")
          .select("id")
          .eq("numero_ligne", numeroLigne || "")
          .maybeSingle();

        if (existing) {
          const rapprochementId = existing.id;

          // 2. Dé-rapprocher TOUTES les factures qui ont ce numero_ligne
          await supabase
            .from("factures")
            .update({ 
              numero_ligne_rapprochement: null,
              numero_rapprochement: null,
              date_rapprochement: null,
            })
            .eq("numero_ligne_rapprochement", numeroLigne);

          // 3. Supprimer les associations de factures
          await supabase
            .from("rapprochements_factures")
            .delete()
            .eq("rapprochement_id", rapprochementId);

          // 4. Supprimer les paiements d'abonnements
          await supabase
            .from("paiements_abonnements")
            .delete()
            .eq("rapprochement_id", rapprochementId);

          // 5. Supprimer les paiements de déclarations de charges
          await supabase
            .from("paiements_declarations_charges")
            .delete()
            .eq("rapprochement_id", rapprochementId);

          // 6. Supprimer le rapprochement bancaire lui-même
          await supabase
            .from("rapprochements_bancaires")
            .delete()
            .eq("id", rapprochementId);

          console.log(`✅ Rapprochement ${numeroLigne} complètement supprimé`);
        }

        // 7. Mettre à jour la ligne dans lignes_rapprochement - EFFACER TOUS les champs liés
        const { error: updateLigneError } = await supabase
          .from('lignes_rapprochement')
          .update({
            statut: 'unmatched',
            facture_id: null,
            factures_ids: null,
            numero_facture: null,
            montant_facture: null,
            abonnement_id: null,
            declaration_charge_id: null,
            fournisseur_detecte_id: null,
            fournisseur_detecte_nom: null,
            fournisseur_detecte_type: null,
            score_detection: 0,
            total_ht: null,
            total_tva: null,
            total_ttc: null,
            notes,
            updated_at: new Date().toISOString()
          })
          .eq('fichier_rapprochement_id', fichierId)
          .eq('numero_ligne', numeroLigne);

        if (updateLigneError) {
          console.error("Erreur mise à jour ligne_rapprochement:", updateLigneError);
        }

        // Recalculer lignes_rapprochees
        const { count: matchedCount } = await supabase
          .from('lignes_rapprochement')
          .select('id', { count: 'exact', head: true })
          .eq('fichier_rapprochement_id', fichierId)
          .eq('statut', 'matched');

        await supabase
          .from("fichiers_rapprochement")
          .update({
            lignes_rapprochees: matchedCount || 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", fichierId);

        toast({
          title: "Succès",
          description: "Rapprochement annulé avec succès",
        });

        onSuccess();
        onOpenChange(false);
        return;
      }

      // ⭐ Si le statut est "matched" ou "uncertain", gérer normalement
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
      // ⭐ IMPORTANT: Purger d'abord TOUS les paiements liés à ce rapprochement pour éviter les doublons
      if (selectedAbonnementId && selectedAbonnementId !== "none" && rapprochementId) {
        // Purger tous les anciens paiements liés à ce rapprochement
        await supabase
          .from("paiements_abonnements")
          .delete()
          .eq("rapprochement_id", rapprochementId);
        
        await supabase
          .from("paiements_declarations_charges")
          .delete()
          .eq("rapprochement_id", rapprochementId);

        // Créer le paiement d'abonnement
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
      // ⭐ EXCLUSIVITÉ: Créer le paiement de déclaration UNIQUEMENT si aucun abonnement n'est sélectionné
      else if (selectedDeclarationId && selectedDeclarationId !== "none" && rapprochementId) {
        // Purger tous les anciens paiements liés à ce rapprochement
        await supabase
          .from("paiements_abonnements")
          .delete()
          .eq("rapprochement_id", rapprochementId);
        
        await supabase
          .from("paiements_declarations_charges")
          .delete()
          .eq("rapprochement_id", rapprochementId);

        // Créer le paiement de déclaration
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
      }
      // ⭐ Si ni abonnement ni déclaration: purger les paiements existants
      else if (rapprochementId) {
        await supabase
          .from("paiements_abonnements")
          .delete()
          .eq("rapprochement_id", rapprochementId);
        
        await supabase
          .from("paiements_declarations_charges")
          .delete()
          .eq("rapprochement_id", rapprochementId);
        
        await supabase
          .from("abonnements_consommations")
          .delete()
          .eq("rapprochement_id", rapprochementId);
      }

      // ⭐ 3. Mettre à jour la ligne dans lignes_rapprochement avec factures et montants
      const numeroLigneToUpdate = numeroLigne || transaction.numero_ligne;
      if (numeroLigneToUpdate) {
        // Calculer les montants HT/TVA/TTC à partir des factures sélectionnées
        let totalHt = 0;
        let totalTva = 0;
        let numerosFactures: string[] = [];
        
        if (selectedFactureIds.length > 0) {
          // Récupérer les détails des factures sélectionnées
          const { data: facturesDetails } = await supabase
            .from('factures')
            .select('id, numero_facture, total_ht, total_tva, total_ttc')
            .in('id', selectedFactureIds);
          
          if (facturesDetails) {
            facturesDetails.forEach(f => {
              totalHt += f.total_ht || 0;
              totalTva += f.total_tva || 0;
              if (f.numero_facture) numerosFactures.push(f.numero_facture);
            });
          }
        }
        
        // Calculer TTC à partir du montant de la transaction
        const totalTtc = Math.abs(transaction.credit || 0) || Math.abs(transaction.debit || 0);
        
        // Si pas de factures, HT = TTC et TVA = 0
        if (selectedFactureIds.length === 0) {
          totalHt = totalTtc;
          totalTva = 0;
        }
        
        // Préparer les données de mise à jour
        const updateData: any = {
          statut: status,
          abonnement_id: selectedAbonnementId && selectedAbonnementId !== "none" ? selectedAbonnementId : null,
          declaration_charge_id: selectedDeclarationId && selectedDeclarationId !== "none" ? selectedDeclarationId : null,
          notes,
          total_ht: totalHt,
          total_tva: totalTva,
          total_ttc: totalTtc,
          updated_at: new Date().toISOString()
        };
        
        // Mettre à jour les champs de factures
        if (selectedFactureIds.length === 0) {
          updateData.facture_id = null;
          updateData.factures_ids = null;
          updateData.numero_facture = null;
        } else if (selectedFactureIds.length === 1) {
          updateData.facture_id = selectedFactureIds[0];
          updateData.factures_ids = null;
          updateData.numero_facture = numerosFactures[0] || null;
        } else {
          // Multi-factures : facture_id = première, factures_ids = toutes
          updateData.facture_id = selectedFactureIds[0];
          updateData.factures_ids = selectedFactureIds;
          updateData.numero_facture = numerosFactures.join(', ');
        }
        
        const { error: updateLigneError } = await supabase
          .from('lignes_rapprochement')
          .update(updateData)
          .eq('fichier_rapprochement_id', fichierId)
          .eq('numero_ligne', numeroLigneToUpdate);

        if (updateLigneError) {
          console.error("Erreur mise à jour ligne_rapprochement:", updateLigneError);
        }
      }

      // Recalculer lignes_rapprochees
      const { count: matchedCount } = await supabase
        .from('lignes_rapprochement')
        .select('id', { count: 'exact', head: true })
        .eq('fichier_rapprochement_id', fichierId)
        .eq('statut', 'matched');

      await supabase
        .from("fichiers_rapprochement")
        .update({
          lignes_rapprochees: matchedCount || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fichierId);

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

          {/* ⭐ Factures déjà associées à ce rapprochement */}
          {selectedFactures.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-primary font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Factures associées à ce rapprochement ({selectedFactures.length})
                </Label>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total: </span>
                  <span className={`font-semibold ${Math.abs(Math.abs(transaction.montant) - totalFacturesSelectionnees) < 0.01 ? 'text-green-600' : 'text-orange-600'}`}>
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                    }).format(totalFacturesSelectionnees)}
                  </span>
                </div>
              </div>
              <div className="border-2 border-primary/30 rounded-lg bg-primary/5">
                {selectedFactures.map((facture) => (
                  <div
                    key={facture.id}
                    className="flex items-center gap-3 p-3 border-b last:border-b-0 border-primary/10"
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleFactureSelection(facture.id)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 grid grid-cols-4 gap-2 items-center">
                      <span className="font-medium">{facture.numero_facture}</span>
                      <span className="text-sm text-muted-foreground truncate">
                        {facture.partenaire_nom}
                      </span>
                      <span className={`font-medium text-right ${facture.type_facture === 'VENTES' ? 'text-green-600' : 'text-orange-600'}`}>
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(facture.total_ttc)}
                      </span>
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant={facture.type_facture === 'VENTES' ? 'default' : 'secondary'} className="text-xs">
                          {facture.type_facture === 'VENTES' ? 'Vente' : 'Achat'}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => toggleFactureSelection(facture.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Retirer cette facture"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
