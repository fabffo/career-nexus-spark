import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Receipt, RefreshCcw } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

interface RapprochementLigne {
  id: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_montant: number;
  transaction_credit: number;
  transaction_debit: number;
  statut: string;
  facture?: {
    numero_facture: string;
    total_tva: number;
    type_facture: string;
    activite?: string;
    type_frais?: string;
    type_fournisseur?: string;
    emetteur_nom?: string;
  };
  factures?: {
    numero_facture: string;
    total_tva: number;
    type_facture: string;
    activite?: string;
    type_frais?: string;
    type_fournisseur?: string;
    emetteur_nom?: string;
  }[];
  total_tva?: number;
  manualId?: string;
  abonnementId?: string;
  declarationId?: string;
  notes?: string;
  abonnement_type?: string;
  abonnement_nom?: string;
  declaration_organisme?: string;
}

interface PeriodeStat {
  tva_collectee: number;
  tva_deductible: number;
  tva_a_payer: number;
}

export default function TvaMensuel() {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<{ month: string; year: string }[]>([]);
  const [lignes, setLignes] = useState<RapprochementLigne[]>([]);
  const [stats, setStats] = useState<PeriodeStat>({ tva_collectee: 0, tva_deductible: 0, tva_a_payer: 0 });
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [filterTypeTva, setFilterTypeTva] = useState<string>("all");
  const { toast } = useToast();

  const toggleLineSelection = (lineId: string) => {
    setSelectedLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineId)) {
        newSet.delete(lineId);
      } else {
        newSet.add(lineId);
      }
      return newSet;
    });
  };

  const toggleAllLines = () => {
    if (selectedLines.size === lignes.length) {
      setSelectedLines(new Set());
    } else {
      setSelectedLines(new Set(lignes.map(l => l.id)));
    }
  };

  const columns: ColumnDef<RapprochementLigne>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={selectedLines.size === lignes.length && lignes.length > 0}
          onCheckedChange={toggleAllLines}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedLines.has(row.original.id)}
          onCheckedChange={() => toggleLineSelection(row.original.id)}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "transaction_date",
      header: "Date",
      cell: ({ row }) => 
        row.original.transaction_date 
          ? format(new Date(row.original.transaction_date), "dd/MM/yyyy", { locale: fr })
          : "",
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.original.transaction_date);
        const dateB = new Date(rowB.original.transaction_date);
        return dateA.getTime() - dateB.getTime();
      },
      enableSorting: true,
    },
    {
      accessorKey: "transaction_libelle",
      header: "Libellé",
      enableSorting: true,
    },
    {
      accessorKey: "transaction_montant",
      header: "Montant",
      cell: ({ row }) => 
        new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
        }).format(row.original.transaction_montant),
      sortingFn: (rowA, rowB) => {
        return rowA.original.transaction_montant - rowB.original.transaction_montant;
      },
      enableSorting: true,
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => (
        <Badge variant={row.original.statut === "RAPPROCHE" ? "default" : "outline"}>
          {row.original.statut === "RAPPROCHE" ? "Rapprochée" : "Non rapprochée"}
        </Badge>
      ),
      sortingFn: (rowA, rowB) => {
        const statusOrder = { "RAPPROCHE": 1, "NON_RAPPROCHE": 0 };
        return (statusOrder[rowA.original.statut as keyof typeof statusOrder] || 0) - 
               (statusOrder[rowB.original.statut as keyof typeof statusOrder] || 0);
      },
      enableSorting: true,
    },
    {
      id: "facture",
      header: "Facture",
      cell: ({ row }) => {
        // Si c'est un abonnement, afficher le nom
        if (row.original.abonnementId) {
          return row.original.abonnement_nom || "Abonnement";
        }
        // Si c'est une déclaration de charges
        if (row.original.declarationId) {
          return "Déclaration";
        }
        // Si c'est une ou plusieurs factures
        if (row.original.factures && row.original.factures.length > 0) {
          return row.original.factures.map(f => f.numero_facture).join(", ");
        }
        if (row.original.facture?.numero_facture) {
          return row.original.facture.numero_facture;
        }
        // Par défaut pour les lignes non rapprochées: facDefaut
        if (row.original.statut !== "RAPPROCHE") {
          return "facDefaut";
        }
        return "—";
      },
      enableSorting: false,
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => {
        // Si c'est un abonnement
        if (row.original.abonnementId) {
          return "Abonnement";
        }
        // Si c'est une déclaration de charges
        if (row.original.declarationId) {
          return "Déclaration";
        }
        // Si c'est une ou plusieurs factures
        if (row.original.factures && row.original.factures.length > 0) {
          return row.original.factures[0].type_facture === "VENTES" ? "Vente" : "Achat";
        }
        if (row.original.facture) {
          return row.original.facture.type_facture === "VENTES" ? "Vente" 
            : row.original.facture.type_facture === "ACHATS" ? "Achat" : "—";
        }
        // Par défaut pour les lignes non rapprochées: Achat
        if (row.original.statut !== "RAPPROCHE") {
          return "Achat";
        }
        return "—";
      },
      sortingFn: (rowA, rowB) => {
        const getType = (row: any) => {
          if (row.original.abonnementId) return "Abonnement";
          if (row.original.declarationId) return "Déclaration";
          if (row.original.factures && row.original.factures.length > 0) {
            return row.original.factures[0].type_facture;
          }
          if (row.original.facture?.type_facture) return row.original.facture.type_facture;
          if (row.original.statut !== "RAPPROCHE") return "ACHATS";
          return "";
        };
        return getType(rowA).localeCompare(getType(rowB));
      },
      enableSorting: true,
    },
    {
      id: "activite",
      header: "Activité",
      cell: ({ row }) => {
        // Si c'est un abonnement, on affiche le type d'abonnement
        if (row.original.abonnementId) {
          return row.original.abonnement_type || "—";
        }
        // Si c'est une déclaration de charges, on affiche l'organisme
        if (row.original.declarationId) {
          return row.original.declaration_organisme || "—";
        }
        // Si c'est une ou plusieurs factures
        if (row.original.factures && row.original.factures.length > 0) {
          const firstFacture = row.original.factures[0];
          // Pour les ventes: on utilise activite
          if (firstFacture.type_facture === "VENTES") {
            return firstFacture.activite || "—";
          }
          // Pour les achats: on utilise type_fournisseur (Généraux/Services)
          if (firstFacture.type_facture === "ACHATS") {
            return firstFacture.type_fournisseur || "—";
          }
        }
        if (row.original.facture) {
          if (row.original.facture.type_facture === "VENTES") {
            return row.original.facture.activite || "—";
          }
          if (row.original.facture.type_facture === "ACHATS") {
            return row.original.facture.type_fournisseur || "—";
          }
        }
        // Par défaut pour les lignes non rapprochées: Généraux
        if (row.original.statut !== "RAPPROCHE") {
          return "Généraux";
        }
        return "—";
      },
      sortingFn: (rowA, rowB) => {
        const getActivite = (row: any) => {
          if (row.original.abonnementId) return row.original.abonnement_type || "";
          if (row.original.declarationId) return row.original.declaration_organisme || "";
          if (row.original.factures && row.original.factures.length > 0) {
            const f = row.original.factures[0];
            return f.type_facture === "VENTES" ? (f.activite || "") : (f.type_fournisseur || "");
          }
          if (row.original.facture) {
            const f = row.original.facture;
            return f.type_facture === "VENTES" ? (f.activite || "") : (f.type_fournisseur || "");
          }
          if (row.original.statut !== "RAPPROCHE") return "Généraux";
          return "";
        };
        return getActivite(rowA).localeCompare(getActivite(rowB));
      },
      enableSorting: true,
    },
    {
      id: "total_tva",
      header: "TVA",
      cell: ({ row }) => {
        // Pas de TVA pour les abonnements et déclarations
        if (row.original.abonnementId || row.original.declarationId) {
          return "—";
        }
        // TVA pour les factures
        const tva = row.original.total_tva ?? row.original.facture?.total_tva;
        return tva !== undefined
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(tva)
          : "—";
      },
      sortingFn: (rowA, rowB) => {
        // Pas de TVA pour abonnements et déclarations
        const tvaA = (rowA.original.abonnementId || rowA.original.declarationId) 
          ? 0 
          : (rowA.original.total_tva ?? rowA.original.facture?.total_tva ?? 0);
        const tvaB = (rowB.original.abonnementId || rowB.original.declarationId) 
          ? 0 
          : (rowB.original.total_tva ?? rowB.original.facture?.total_tva ?? 0);
        return tvaA - tvaB;
      },
      enableSorting: true,
    },
    {
      id: "type_tva",
      header: "Type TVA",
      cell: ({ row }) => {
        // Pas de TVA pour les abonnements et déclarations
        if (row.original.abonnementId || row.original.declarationId) {
          return "—";
        }
        // Déterminer le type TVA selon le type de facture
        if (row.original.factures && row.original.factures.length > 0) {
          const typeTva = row.original.factures[0].type_facture === "VENTES" ? "Collectée" : "Déductible";
          return (
            <Badge variant={typeTva === "Collectée" ? "default" : "secondary"}>
              {typeTva}
            </Badge>
          );
        }
        if (row.original.facture) {
          const typeTva = row.original.facture.type_facture === "VENTES" ? "Collectée" : "Déductible";
          return (
            <Badge variant={typeTva === "Collectée" ? "default" : "secondary"}>
              {typeTva}
            </Badge>
          );
        }
        return "—";
      },
      sortingFn: (rowA, rowB) => {
        const getTypeTva = (row: any) => {
          if (row.original.abonnementId || row.original.declarationId) return "";
          if (row.original.factures && row.original.factures.length > 0) {
            return row.original.factures[0].type_facture === "VENTES" ? "Collectée" : "Déductible";
          }
          if (row.original.facture) {
            return row.original.facture.type_facture === "VENTES" ? "Collectée" : "Déductible";
          }
          return "";
        };
        return getTypeTva(rowA).localeCompare(getTypeTva(rowB));
      },
      enableSorting: true,
    },
  ];

  useEffect(() => {
    loadAvailablePeriods();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      loadTvaData();
    }
  }, [selectedMonth, selectedYear]);

  const loadAvailablePeriods = async () => {
    try {
      const { data: fichiers, error } = await supabase
        .from("fichiers_rapprochement")
        .select("date_debut, date_fin")
        .eq("statut", "VALIDE")
        .order("date_debut", { ascending: false });

      if (error) throw error;

      const periods = new Map<string, { month: string; year: string }>();
      fichiers?.forEach(fichier => {
        const date = new Date(fichier.date_debut);
        const month = (date.getMonth() + 1).toString();
        const year = date.getFullYear().toString();
        const key = `${year}-${month}`;
        if (!periods.has(key)) {
          periods.set(key, { month, year });
        }
      });

      const periodsArray = Array.from(periods.values()).sort((a, b) => {
        if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
        return parseInt(b.month) - parseInt(a.month);
      });

      setAvailablePeriods(periodsArray);
      if (periodsArray.length > 0 && !selectedMonth && !selectedYear) {
        setSelectedMonth(periodsArray[0].month);
        setSelectedYear(periodsArray[0].year);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les périodes disponibles",
        variant: "destructive",
      });
    }
  };

  const loadTvaData = async () => {
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

      console.log("Chargement TVA pour période:", startDate, "->", endDate);

      // 1. Charger le fichier de rapprochement validé pour cette période
      const { data: fichiers, error: fichierError } = await supabase
        .from("fichiers_rapprochement")
        .select("*")
        .eq("statut", "VALIDE")
        .gte("date_debut", startDate)
        .lte("date_fin", endDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fichierError) {
        console.error("Erreur chargement fichier:", fichierError);
        throw fichierError;
      }

      if (!fichiers) {
        console.log("Aucun fichier de rapprochement validé trouvé pour cette période");
        setLignes([]);
        setStats({ tva_collectee: 0, tva_deductible: 0, tva_a_payer: 0 });
        return;
      }

      // 2. Charger les référentiels nécessaires (abonnements, déclarations, fournisseurs)
      const { data: abonnementsData } = await supabase
        .from("abonnements_partenaires")
        .select("id, type, nom");

      const abonnementsMap = new Map<string, any>();
      abonnementsData?.forEach(a => abonnementsMap.set(a.id, a));

      const { data: declarationsData } = await supabase
        .from("declarations_charges_sociales")
        .select("id, organisme, nom");

      const declarationsMap = new Map<string, any>();
      declarationsData?.forEach(d => declarationsMap.set(d.id, d));

      const { data: fournisseursServices } = await supabase
        .from("fournisseurs_services")
        .select("raison_sociale");

      const { data: fournisseursGeneraux } = await supabase
        .from("fournisseurs_generaux")
        .select("raison_sociale");

      const fournisseurTypesMap = new Map<string, string>();
      fournisseursServices?.forEach(f => {
        if (f.raison_sociale) {
          fournisseurTypesMap.set(f.raison_sociale.toLowerCase().trim(), "Services");
        }
      });
      fournisseursGeneraux?.forEach(f => {
        if (f.raison_sociale) {
          fournisseurTypesMap.set(f.raison_sociale.toLowerCase().trim(), "Généraux");
        }
      });

      // ⭐ Charger les lignes depuis lignes_rapprochement (source de vérité)
      const { data: lignesRapprochement, error: lignesError } = await supabase
        .from("lignes_rapprochement")
        .select(`
          *,
          abonnements_partenaires (id, nom, montant_mensuel, type),
          declarations_charges_sociales (id, nom, organisme)
        `)
        .eq("fichier_rapprochement_id", fichiers.id)
        .order("transaction_date", { ascending: true });

      if (lignesError) {
        console.error("Erreur chargement lignes_rapprochement:", lignesError);
        throw lignesError;
      }

      console.log("📦 Lignes depuis lignes_rapprochement:", lignesRapprochement?.length || 0);

      // Convertir les lignes en format rapprochement
      // IMPORTANT: on ne complète plus via rapprochements_factures ici, car ça peut sur-compter
      // si des liaisons historiques existent. La TVA mensuelle se base sur les associations
      // présentes sur lignes_rapprochement (facture_id / factures_ids).
      const rapprochementsReconstruits: any[] = (lignesRapprochement || []).map((ligne: any) => {
        const rapprochement: any = {
          transaction: {
            date: ligne.transaction_date,
            libelle: ligne.transaction_libelle,
            debit: ligne.transaction_debit || 0,
            credit: ligne.transaction_credit || 0,
            montant: ligne.transaction_montant || 0,
            numero_ligne: ligne.numero_ligne,
          },
          facture: ligne.facture_id ? { id: ligne.facture_id, numero_facture: ligne.numero_facture || "" } : null,
          factureIds: Array.isArray(ligne.factures_ids) ? ligne.factures_ids : [],
          score: ligne.score_detection || 0,
          status: ligne.statut || "unmatched",
          isManual: ligne.statut === "matched",
          notes: ligne.notes,
          abonnement_info: ligne.abonnements_partenaires
            ? {
                id: ligne.abonnements_partenaires.id,
                nom: ligne.abonnements_partenaires.nom,
                type: ligne.abonnements_partenaires.type,
              }
            : undefined,
          declaration_info: ligne.declarations_charges_sociales
            ? {
                id: ligne.declarations_charges_sociales.id,
                nom: ligne.declarations_charges_sociales.nom,
                organisme: ligne.declarations_charges_sociales.organisme,
              }
            : undefined,
        };

        return rapprochement;
      });

      const tousLesRapprochements = rapprochementsReconstruits;
      
      console.log("📦 Total rapprochements:", tousLesRapprochements.length);
      console.log("📊 Répartition par statut:");
      console.log("  - Matched:", tousLesRapprochements.filter(r => r.status === "matched").length);
      console.log("  - Uncertain:", tousLesRapprochements.filter(r => r.status === "uncertain").length);
      console.log("  - Unmatched:", tousLesRapprochements.filter(r => r.status === "unmatched").length);

      if (tousLesRapprochements.length === 0) {
        console.log("⚠️ Aucun rapprochement trouvé dans le fichier");
        setLignes([]);
        setStats({ tva_collectee: 0, tva_deductible: 0, tva_a_payer: 0 });
        return;
      }

      // 3. Récupérer tous les IDs de factures depuis les rapprochements matched
      const factureIds = new Set<string>();
      tousLesRapprochements.forEach((rapp: any) => {
        if (rapp.status === 'matched') {
          if (rapp.facture?.id) {
            factureIds.add(rapp.facture.id);
          }
          if (rapp.factureIds && Array.isArray(rapp.factureIds)) {
            rapp.factureIds.forEach((id: string) => factureIds.add(id));
          }
        }
      });

      console.log("📋 Total factures uniques trouvées:", factureIds.size);

      // 4. Charger toutes les factures nécessaires
      let facturesMap = new Map<string, any>();
      
      if (factureIds.size > 0) {
        const { data: factures, error: facturesError } = await supabase
          .from("factures")
          .select("id, numero_facture, type_facture, total_tva, total_ttc, statut, date_emission, activite, type_frais, emetteur_nom")
          .in("id", Array.from(factureIds));

        if (facturesError) {
          console.error("❌ Erreur chargement factures:", facturesError);
        } else if (factures) {
          console.log("✅ Factures chargées:", factures.length);
          factures.forEach(f => facturesMap.set(f.id, f));
        }
      }

      // 5. Créer les lignes TVA à partir de TOUS les rapprochements
      const nouvLignes: RapprochementLigne[] = [];
      let totalTvaCollectee = 0;
      let totalTvaDeductible = 0;
      let countRapprochees = 0;

      tousLesRapprochements.forEach((rapp: any, index: number) => {
        // ⭐ Compter les lignes RAPPROCHE comme rapprochées
        const estRapproche = rapp.status === 'matched' || rapp.status === 'RAPPROCHE';
        if (estRapproche) {
          countRapprochees++;
        }

        // Récupérer les factures depuis le rapprochement
        let facturesData: any[] = [];
        
        // Cas 1: Facture unique
        if (rapp.facture?.id) {
          const facture = facturesMap.get(rapp.facture.id);
          if (facture) {
            facturesData.push(facture);
          }
        }
        
        // Cas 2: Factures multiples
        if (rapp.factureIds && Array.isArray(rapp.factureIds)) {
          rapp.factureIds.forEach((factureId: string) => {
            const facture = facturesMap.get(factureId);
            if (facture) {
              facturesData.push(facture);
            }
          });
        }

        // Calculer TVA UNIQUEMENT pour les lignes rapprochées (matched)
        let tvaLigne = 0;

        if (estRapproche && facturesData.length > 0) {
          tvaLigne = facturesData.reduce((sum, f) => sum + (f.total_tva || 0), 0);

          const typeFacture = facturesData[0].type_facture;
          // Accumuler dans les totaux - VENTES = collectée, ACHATS* = déductible
          if (typeFacture === "VENTES") {
            totalTvaCollectee += tvaLigne;
          } else if (typeFacture && typeFacture.startsWith("ACHATS")) {
            // Inclut ACHATS, ACHATS_GENERAUX, ACHATS_SERVICES, etc.
            totalTvaDeductible += tvaLigne;
          }
        }

        // Récupérer les infos d'abonnement et déclaration
        const abonnementInfo = rapp.abonnement_info?.id ? abonnementsMap.get(rapp.abonnement_info.id) : null;
        const declarationInfo = rapp.declaration_info?.id ? declarationsMap.get(rapp.declaration_info.id) : null;

        const ligne: RapprochementLigne = {
          id: `${rapp.transaction.date}_${rapp.transaction.libelle}_${index}`,
          transaction_date: rapp.transaction.date,
          transaction_libelle: rapp.transaction.libelle,
          transaction_debit: rapp.transaction.debit || 0,
          transaction_credit: rapp.transaction.credit || 0,
          transaction_montant: rapp.transaction.montant,
          statut: estRapproche ? 'RAPPROCHE' : 'NON_RAPPROCHE', // ⭐ Statut basé sur status du rapprochement
          abonnementId: rapp.abonnement_info?.id,
          declarationId: rapp.declaration_info?.id,
          notes: rapp.notes,
          abonnement_type: abonnementInfo?.type,
          abonnement_nom: abonnementInfo?.nom,
          declaration_organisme: declarationInfo?.organisme,
        };

        if (facturesData.length > 0) {
          ligne.factures = facturesData.map(f => {
            // Déterminer le type de fournisseur pour les achats
            let typeFournisseur: string | undefined;
            if (f.type_facture === "ACHATS" && f.emetteur_nom) {
              typeFournisseur = fournisseurTypesMap.get(f.emetteur_nom.toLowerCase().trim());
            }
            return {
              numero_facture: f.numero_facture,
              total_tva: f.total_tva || 0,
              type_facture: f.type_facture,
              activite: f.activite,
              type_frais: f.type_frais,
              type_fournisseur: typeFournisseur,
              emetteur_nom: f.emetteur_nom,
            };
          });
          ligne.total_tva = tvaLigne;
        }

        nouvLignes.push(ligne);
      });

      console.log("📊 Total lignes:", nouvLignes.length);
      console.log("✅ Lignes rapprochées:", countRapprochees);
      console.log("💰 TVA collectée:", totalTvaCollectee);
      console.log("💸 TVA déductible:", totalTvaDeductible);

      setLignes(nouvLignes);
      setStats({
        tva_collectee: totalTvaCollectee,
        tva_deductible: totalTvaDeductible,
        tva_a_payer: totalTvaCollectee - totalTvaDeductible,
      });
    } catch (error: any) {
      console.error("Erreur chargement TVA:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données TVA",
        variant: "destructive",
      });
    }
  };

  const getMonthName = (month: string) => {
    const date = new Date(2024, parseInt(month) - 1, 1);
    return format(date, "MMMM", { locale: fr });
  };

  const recalculerTVA = async () => {
    if (!selectedMonth || !selectedYear) return;
    
    setIsRecalculating(true);
    try {
      // Récupérer toutes les factures validées
      const { data: factures, error: facturesError } = await supabase
        .from("factures")
        .select("id, numero_facture, type_facture, total_tva, total_ttc")
        .in("statut", ["VALIDEE", "PAYEE"]);

      if (facturesError) throw facturesError;

      // Créer une map pour recherche rapide par numéro de facture
      const factureMapByNumero = new Map(factures?.map(f => [f.numero_facture, f]) || []);
      
      // Créer une map pour recherche par montant approximatif (±1%)
      const factureMapByMontant = new Map<number, typeof factures>();
      factures?.forEach(f => {
        const montantKey = Math.round(f.total_ttc * 100) / 100;
        if (!factureMapByMontant.has(montantKey)) {
          factureMapByMontant.set(montantKey, []);
        }
        factureMapByMontant.get(montantKey)?.push(f);
      });

      // Parcourir les lignes et essayer d'associer les factures manquantes
      const updatedLignes = lignes.map(ligne => {
        // Ne pas toucher les lignes qui sont déjà correctement rapprochées avec factures
        if (ligne.factures && ligne.factures.length > 0) {
          return ligne;
        }
        
        // Ne pas toucher les abonnements et déclarations
        if (ligne.abonnementId || ligne.declarationId) {
          return ligne;
        }
        
        // Si la ligne a déjà une facture avec TVA, ne pas toucher
        if (ligne.facture && ligne.facture.total_tva !== undefined && ligne.facture.total_tva > 0) {
          return ligne;
        }

        // Chercher une facture correspondante UNIQUEMENT pour les lignes sans facture
        let factureCorrespondante = null;

        // 1. Recherche par numéro de facture si présent dans le libellé
        if (ligne.facture?.numero_facture) {
          factureCorrespondante = factureMapByNumero.get(ligne.facture.numero_facture);
        }
        
        // 2. Recherche dans le libellé de la transaction
        if (!factureCorrespondante) {
          // Extraire les numéros de facture du libellé (format FAC-XXX, F XXX, etc.)
          const facRegex = /(?:FAC|F)[\s-]*([A-Z0-9-]+)/gi;
          const matches = ligne.transaction_libelle.matchAll(facRegex);
          
          for (const match of matches) {
            const numeroFacture = match[0].replace(/\s+/g, '-').toUpperCase();
            const facture = Array.from(factureMapByNumero.values()).find(f => 
              f.numero_facture.includes(match[1]) || 
              numeroFacture.includes(f.numero_facture)
            );
            if (facture) {
              factureCorrespondante = facture;
              break;
            }
          }
        }

        // 3. Recherche par montant si pas trouvé
        if (!factureCorrespondante) {
          const montantTransaction = Math.abs(ligne.transaction_montant);
          const montantKey = Math.round(montantTransaction * 100) / 100;
          
          // Chercher avec une tolérance de ±2%
          for (let tolerance = 0; tolerance <= 2; tolerance += 0.5) {
            const montantMin = montantKey * (1 - tolerance / 100);
            const montantMax = montantKey * (1 + tolerance / 100);
            
            for (const [key, facturesList] of factureMapByMontant.entries()) {
              if (key >= montantMin && key <= montantMax) {
                // Prendre la première facture correspondante
                const facture = facturesList.find(f => 
                  (ligne.transaction_credit > 0 && f.type_facture === "VENTES") ||
                  (ligne.transaction_debit > 0 && f.type_facture === "ACHATS")
                );
                if (facture) {
                  factureCorrespondante = facture;
                  break;
                }
              }
            }
            if (factureCorrespondante) break;
          }
        }

        // Si une facture a été trouvée, mettre à jour la ligne
        if (factureCorrespondante) {
          console.log(`Facture trouvée pour ${ligne.transaction_libelle}:`, factureCorrespondante);
          return {
            ...ligne,
            facture: {
              numero_facture: factureCorrespondante.numero_facture,
              total_tva: factureCorrespondante.total_tva || 0,
              type_facture: factureCorrespondante.type_facture,
            }
          };
        }

        return ligne;
      });

      setLignes(updatedLignes);

      // Recalculer les stats
      let tva_collectee = 0;
      let tva_deductible = 0;

      updatedLignes.forEach(ligne => {
        if (ligne.statut === "RAPPROCHE") {
          // Si plusieurs factures, utiliser total_tva
          if (ligne.factures && ligne.factures.length > 0) {
            const tva = ligne.total_tva || 0;
            const type = ligne.factures[0].type_facture;
            if (type === "VENTES") {
              tva_collectee += tva;
            } else if (type && type.startsWith("ACHATS")) {
              tva_deductible += tva;
            }
          } else if (ligne.facture) {
            const tva = ligne.facture.total_tva || 0;
            if (ligne.facture.type_facture === "VENTES") {
              tva_collectee += tva;
            } else if (ligne.facture.type_facture && ligne.facture.type_facture.startsWith("ACHATS")) {
              tva_deductible += tva;
            }
          }
        }
      });

      setStats({
        tva_collectee,
        tva_deductible,
        tva_a_payer: tva_collectee - tva_deductible,
      });

      toast({
        title: "Recalcul terminé",
        description: "Les factures et TVA ont été recalculées",
      });
    } catch (error: any) {
      console.error("Erreur recalcul:", error);
      toast({
        title: "Erreur",
        description: "Impossible de recalculer la TVA",
        variant: "destructive",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">TVA Mensuel</h1>
        </div>
      </div>

      {/* Filtres de période */}
      <Card>
        <CardHeader>
          <CardTitle>Sélectionner une période</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Mois" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(new Set(availablePeriods.map(p => p.month)))
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(month => (
                  <SelectItem key={month} value={month}>
                    {getMonthName(month)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(new Set(availablePeriods.map(p => p.year)))
                .sort((a, b) => parseInt(b) - parseInt(a))
                .map(year => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Filtres supplémentaires */}
      {selectedMonth && selectedYear && (
        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Statut</label>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="RAPPROCHE">Rapprochées</SelectItem>
                  <SelectItem value="NON_RAPPROCHE">Non rapprochées</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Type TVA</label>
              <Select value={filterTypeTva} onValueChange={setFilterTypeTva}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="COLLECTEE">TVA Collectée</SelectItem>
                  <SelectItem value="DEDUCTIBLE">TVA Déductible</SelectItem>
                  <SelectItem value="NONE">Sans TVA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques des lignes */}
      {selectedMonth && selectedYear && lignes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistiques des lignes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Total lignes</div>
                <div className="text-2xl font-bold">{lignes.length}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Rapprochées</div>
                <div className="text-2xl font-bold text-green-600">
                  {lignes.filter(l => l.statut === "RAPPROCHE").length}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Non rapprochées</div>
                <div className="text-2xl font-bold text-orange-600">
                  {lignes.filter(l => l.statut === "NON_RAPPROCHE").length}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Sélectionnées</div>
                <div className="text-2xl font-bold text-primary">{selectedLines.size}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résumé TVA */}
      {selectedMonth && selectedYear && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Résumé TVA - {getMonthName(selectedMonth)} {selectedYear}
            </h2>
            <Button
              onClick={recalculerTVA}
              disabled={isRecalculating}
              variant="outline"
              size="sm"
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${isRecalculating ? "animate-spin" : ""}`} />
              Recalculer TVA
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">TVA Collectée</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stats.tva_collectee.toFixed(2)} €
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">TVA Déductible</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {stats.tva_deductible.toFixed(2)} €
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">TVA à Payer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {stats.tva_a_payer.toFixed(2)} €
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Détail des lignes */}
          <Card>
            <CardHeader>
              <CardTitle>Détail des transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={lignes.filter(ligne => {
                  // Filtre par statut
                  if (filterStatut !== "all" && ligne.statut !== filterStatut) {
                    return false;
                  }

                  // Filtre par type TVA
                  if (filterTypeTva !== "all") {
                    // Déterminer le type TVA de la ligne
                    let typeTvaLigne = "NONE";
                    if (ligne.factures && ligne.factures.length > 0) {
                      typeTvaLigne = ligne.factures[0].type_facture === "VENTES" ? "COLLECTEE" : "DEDUCTIBLE";
                    } else if (ligne.facture) {
                      typeTvaLigne = ligne.facture.type_facture === "VENTES" ? "COLLECTEE" : "DEDUCTIBLE";
                    }

                    if (typeTvaLigne !== filterTypeTva) {
                      return false;
                    }
                  }

                  return true;
                })}
                searchPlaceholder="Rechercher une transaction..."
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
