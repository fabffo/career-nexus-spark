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
import { Receipt, RefreshCcw, Save, CheckCircle } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

type TypeOperation = 'VENTES' | 'ACHAT_GENERAUX' | 'ACHAT_SERVICES' | 'ABONNEMENT' | 'CHARGES_SOCIALES';

interface TvaMensuelDetail {
  id: string;
  ligne_rapprochement_id?: string;
  date_operation: string;
  libelle: string;
  numero_facture?: string;
  type_operation: TypeOperation;
  type_partenaire?: string;
  partenaire_nom?: string;
  montant_ht: number;
  tva_deductible: number;
  tva_collectee: number;
}

interface TvaMensuelEntete {
  id: string;
  annee: number;
  mois: number;
  tva_collectee: number;
  tva_deductible: number;
  tva_a_payer: number;
  statut: 'BROUILLON' | 'VALIDE';
  date_validation?: string;
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
  const [lignes, setLignes] = useState<TvaMensuelDetail[]>([]);
  const [stats, setStats] = useState<PeriodeStat>({ tva_collectee: 0, tva_deductible: 0, tva_a_payer: 0 });
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [filterTypeTva, setFilterTypeTva] = useState<string>("all");
  const [entete, setEntete] = useState<TvaMensuelEntete | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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

  const columns: ColumnDef<TvaMensuelDetail>[] = [
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
      accessorKey: "date_operation",
      header: "Date",
      cell: ({ row }) => 
        row.original.date_operation 
          ? format(new Date(row.original.date_operation), "dd/MM/yyyy", { locale: fr })
          : "",
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.original.date_operation);
        const dateB = new Date(rowB.original.date_operation);
        return dateA.getTime() - dateB.getTime();
      },
      enableSorting: true,
    },
    {
      accessorKey: "libelle",
      header: "Libellé",
      enableSorting: true,
    },
    {
      accessorKey: "numero_facture",
      header: "Facture",
      cell: ({ row }) => row.original.numero_facture || "—",
      enableSorting: true,
    },
    {
      accessorKey: "type_operation",
      header: "Type",
      cell: ({ row }) => {
        const typeLabels: Record<TypeOperation, string> = {
          'VENTES': 'Vente',
          'ACHAT_GENERAUX': 'Achat Généraux',
          'ACHAT_SERVICES': 'Achat Services',
          'ABONNEMENT': 'Abonnement',
          'CHARGES_SOCIALES': 'Charges Sociales',
        };
        return typeLabels[row.original.type_operation] || row.original.type_operation;
      },
      enableSorting: true,
    },
    {
      accessorKey: "type_partenaire",
      header: "Type Partenaire",
      cell: ({ row }) => row.original.type_partenaire || "—",
      enableSorting: true,
    },
    {
      accessorKey: "partenaire_nom",
      header: "Partenaire",
      cell: ({ row }) => row.original.partenaire_nom || "—",
      enableSorting: true,
    },
    {
      accessorKey: "montant_ht",
      header: "HT",
      cell: ({ row }) => 
        new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
        }).format(row.original.montant_ht),
      sortingFn: (rowA, rowB) => rowA.original.montant_ht - rowB.original.montant_ht,
      enableSorting: true,
    },
    {
      accessorKey: "tva_deductible",
      header: "TVA Déductible",
      cell: ({ row }) => 
        row.original.tva_deductible > 0
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(row.original.tva_deductible)
          : "—",
      sortingFn: (rowA, rowB) => rowA.original.tva_deductible - rowB.original.tva_deductible,
      enableSorting: true,
    },
    {
      accessorKey: "tva_collectee",
      header: "TVA Collectée",
      cell: ({ row }) => 
        row.original.tva_collectee > 0
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(row.original.tva_collectee)
          : "—",
      sortingFn: (rowA, rowB) => rowA.original.tva_collectee - rowB.original.tva_collectee,
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

      // 1. Vérifier si l'entête existe déjà
      const { data: existingEntete, error: enteteError } = await supabase
        .from("tva_mensuel_entete")
        .select("*")
        .eq("annee", year)
        .eq("mois", month)
        .maybeSingle();

      if (enteteError) throw enteteError;

      if (existingEntete) {
        // Charger depuis les tables TVA
        setEntete(existingEntete as TvaMensuelEntete);
        
        const { data: details, error: detailsError } = await supabase
          .from("tva_mensuel_detail")
          .select("*")
          .eq("entete_id", existingEntete.id)
          .order("date_operation", { ascending: true });

        if (detailsError) throw detailsError;

        setLignes(details as TvaMensuelDetail[] || []);
        setStats({
          tva_collectee: existingEntete.tva_collectee,
          tva_deductible: existingEntete.tva_deductible,
          tva_a_payer: existingEntete.tva_a_payer,
        });
        setHasUnsavedChanges(false);
      } else {
        // Pas de données sauvegardées, charger depuis lignes_rapprochement
        setEntete(null);
        await recalculerTVAFromLignesRapprochement();
      }
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

  const determineTypeOperation = (ligne: any, facture: any): TypeOperation => {
    // Si c'est un abonnement
    if (ligne.abonnement_id) {
      return 'ABONNEMENT';
    }
    
    // Si c'est une déclaration de charges sociales
    if (ligne.declaration_charge_id) {
      return 'CHARGES_SOCIALES';
    }
    
    // Si c'est une facture
    if (facture) {
      if (facture.type_facture === 'VENTES') {
        return 'VENTES';
      }
      // Pour les achats, déterminer si c'est généraux ou services
      if (facture.type_fournisseur === 'Services' || facture.type_fournisseur === 'SERVICES') {
        return 'ACHAT_SERVICES';
      }
      return 'ACHAT_GENERAUX';
    }
    
    // Par défaut pour les lignes sans association (débits = achats généraux)
    if (ligne.transaction_debit > 0) {
      return 'ACHAT_GENERAUX';
    }
    
    return 'VENTES';
  };

  const recalculerTVAFromLignesRapprochement = async () => {
    setIsRecalculating(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

      // Charger le fichier de rapprochement validé
      const { data: fichier, error: fichierError } = await supabase
        .from("fichiers_rapprochement")
        .select("id")
        .eq("statut", "VALIDE")
        .gte("date_debut", startDate)
        .lte("date_fin", endDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fichierError) throw fichierError;

      if (!fichier) {
        setLignes([]);
        setStats({ tva_collectee: 0, tva_deductible: 0, tva_a_payer: 0 });
        setHasUnsavedChanges(false);
        return;
      }

      // Charger les lignes de rapprochement avec leurs associations
      const { data: lignesRapprochement, error: lignesError } = await supabase
        .from("lignes_rapprochement")
        .select(`
          *,
          abonnements_partenaires (id, nom, type),
          declarations_charges_sociales (id, nom, organisme)
        `)
        .eq("fichier_rapprochement_id", fichier.id)
        .order("transaction_date", { ascending: true });

      if (lignesError) throw lignesError;

      // Collecter tous les IDs de factures
      const factureIds = new Set<string>();
      lignesRapprochement?.forEach((ligne: any) => {
        if (ligne.facture_id) factureIds.add(ligne.facture_id);
        if (Array.isArray(ligne.factures_ids)) {
          ligne.factures_ids.forEach((id: string) => factureIds.add(id));
        }
      });

      // Charger les factures
      let facturesMap = new Map<string, any>();
      if (factureIds.size > 0) {
        const { data: factures } = await supabase
          .from("factures")
          .select("id, numero_facture, type_facture, total_tva, total_ht, total_ttc, emetteur_nom, destinataire_nom")
          .in("id", Array.from(factureIds));
        
        factures?.forEach(f => facturesMap.set(f.id, f));
      }

      // Charger les types de fournisseurs
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

      // Construire les lignes TVA
      const nouvLignes: TvaMensuelDetail[] = [];
      let totalTvaCollectee = 0;
      let totalTvaDeductible = 0;

      lignesRapprochement?.forEach((ligne: any, index: number) => {
        // Récupérer toutes les factures liées (single ou multi)
        const facturesLiees: any[] = [];
        
        // Facture unique
        if (ligne.facture_id) {
          const f = facturesMap.get(ligne.facture_id);
          if (f) facturesLiees.push(f);
        }
        
        // Multi-factures
        if (Array.isArray(ligne.factures_ids)) {
          ligne.factures_ids.forEach((fid: string) => {
            const f = facturesMap.get(fid);
            // Éviter les doublons si facture_id est aussi dans factures_ids
            if (f && !facturesLiees.some(fl => fl.id === f.id)) {
              facturesLiees.push(f);
            }
          });
        }

        // Prendre la première facture pour les métadonnées (type, partenaire)
        const facturePrincipale = facturesLiees.length > 0 ? facturesLiees[0] : null;

        // Déterminer le type d'opération
        const typeOperation = determineTypeOperation(ligne, facturePrincipale);

        // Déterminer le type de partenaire et le nom
        let typePartenaire = '';
        let partenaireNom = '';
        
        if (ligne.abonnement_id && ligne.abonnements_partenaires) {
          typePartenaire = ligne.abonnements_partenaires.type || 'Abonnement';
          partenaireNom = ligne.abonnements_partenaires.nom || '';
        } else if (ligne.declaration_charge_id && ligne.declarations_charges_sociales) {
          typePartenaire = 'Charges Sociales';
          partenaireNom = ligne.declarations_charges_sociales.organisme || ligne.declarations_charges_sociales.nom || '';
        } else if (facturePrincipale) {
          // Pour les VENTES: utiliser destinataire_nom (le client)
          // Pour les ACHATS: utiliser emetteur_nom (le fournisseur)
          if (facturePrincipale.type_facture === 'VENTES') {
            typePartenaire = 'Client';
            partenaireNom = facturePrincipale.destinataire_nom || '';
          } else {
            const nomFournisseur = facturePrincipale.emetteur_nom || '';
            typePartenaire = fournisseurTypesMap.get(nomFournisseur.toLowerCase().trim()) || 'Fournisseur';
            partenaireNom = nomFournisseur;
          }
        }

        // Calculer les montants HT et TVA en cumulant toutes les factures liées
        let montantHt = 0;
        let tva = 0;
        
        if (facturesLiees.length > 0) {
          // Cumuler HT et TVA de toutes les factures
          facturesLiees.forEach(f => {
            montantHt += f.total_ht || 0;
            tva += f.total_tva || 0;
          });
        } else {
          // Fallback sur les valeurs de la ligne ou montant brut
          montantHt = ligne.total_ht || Math.abs(ligne.transaction_debit - ligne.transaction_credit);
          tva = ligne.total_tva || 0;
        }

        // Construire le numéro de facture (liste si plusieurs)
        const numerosFactures = facturesLiees
          .map(f => f.numero_facture)
          .filter(Boolean)
          .join(', ') || ligne.numero_facture || '';

        // Répartir la TVA selon le type d'opération
        let tvaDeductible = 0;
        let tvaCollectee = 0;

        if (typeOperation === 'VENTES') {
          tvaCollectee = tva;
          totalTvaCollectee += tva;
        } else {
          // ACHAT_GENERAUX, ACHAT_SERVICES, ABONNEMENT, CHARGES_SOCIALES = TVA déductible
          tvaDeductible = tva;
          totalTvaDeductible += tva;
        }

        const ligneDetail: TvaMensuelDetail = {
          id: ligne.id || `${ligne.transaction_date}_${index}`,
          ligne_rapprochement_id: ligne.id,
          date_operation: ligne.transaction_date,
          libelle: ligne.transaction_libelle || '',
          numero_facture: numerosFactures,
          type_operation: typeOperation,
          type_partenaire: typePartenaire,
          partenaire_nom: partenaireNom,
          montant_ht: montantHt,
          tva_deductible: tvaDeductible,
          tva_collectee: tvaCollectee,
        };

        nouvLignes.push(ligneDetail);
      });

      setLignes(nouvLignes);
      setStats({
        tva_collectee: totalTvaCollectee,
        tva_deductible: totalTvaDeductible,
        tva_a_payer: totalTvaCollectee - totalTvaDeductible,
      });
      setHasUnsavedChanges(true);

      toast({
        title: "Recalcul terminé",
        description: `${nouvLignes.length} lignes chargées depuis le rapprochement bancaire`,
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

  const sauvegarderTVA = async () => {
    if (!selectedMonth || !selectedYear || lignes.length === 0) return;
    
    setIsSaving(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);

      // Supprimer l'ancienne entête et ses détails si existant
      if (entete?.id) {
        await supabase
          .from("tva_mensuel_detail")
          .delete()
          .eq("entete_id", entete.id);
        
        await supabase
          .from("tva_mensuel_entete")
          .delete()
          .eq("id", entete.id);
      }

      // Créer la nouvelle entête
      const { data: newEntete, error: enteteError } = await supabase
        .from("tva_mensuel_entete")
        .insert({
          annee: year,
          mois: month,
          tva_collectee: stats.tva_collectee,
          tva_deductible: stats.tva_deductible,
          statut: 'BROUILLON',
        })
        .select()
        .single();

      if (enteteError) throw enteteError;

      // Créer les détails
      const detailsToInsert = lignes.map(ligne => ({
        entete_id: newEntete.id,
        ligne_rapprochement_id: ligne.ligne_rapprochement_id,
        date_operation: ligne.date_operation,
        libelle: ligne.libelle,
        numero_facture: ligne.numero_facture,
        type_operation: ligne.type_operation,
        type_partenaire: ligne.type_partenaire,
        partenaire_nom: ligne.partenaire_nom,
        montant_ht: ligne.montant_ht,
        tva_deductible: ligne.tva_deductible,
        tva_collectee: ligne.tva_collectee,
      }));

      const { error: detailsError } = await supabase
        .from("tva_mensuel_detail")
        .insert(detailsToInsert);

      if (detailsError) throw detailsError;

      setEntete(newEntete as TvaMensuelEntete);
      setHasUnsavedChanges(false);

      toast({
        title: "Sauvegarde réussie",
        description: `TVA du mois ${getMonthName(selectedMonth)} ${selectedYear} sauvegardée`,
      });
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la TVA",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const validerTVA = async () => {
    if (!entete?.id) {
      toast({
        title: "Attention",
        description: "Veuillez d'abord sauvegarder les données avant de valider",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("tva_mensuel_entete")
        .update({
          statut: 'VALIDE',
          date_validation: new Date().toISOString(),
        })
        .eq("id", entete.id);

      if (error) throw error;

      setEntete({ ...entete, statut: 'VALIDE', date_validation: new Date().toISOString() });

      toast({
        title: "Validation réussie",
        description: `TVA du mois ${getMonthName(selectedMonth)} ${selectedYear} validée`,
      });
    } catch (error: any) {
      console.error("Erreur validation:", error);
      toast({
        title: "Erreur",
        description: "Impossible de valider la TVA",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">TVA Mensuel</h1>
        </div>
        {entete?.statut === 'VALIDE' && (
          <Badge variant="default" className="text-sm">
            <CheckCircle className="h-4 w-4 mr-1" />
            Validé le {format(new Date(entete.date_validation!), "dd/MM/yyyy", { locale: fr })}
          </Badge>
        )}
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
              <label className="text-sm font-medium">Type d'opération</label>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="VENTES">Ventes</SelectItem>
                  <SelectItem value="ACHAT_GENERAUX">Achats Généraux</SelectItem>
                  <SelectItem value="ACHAT_SERVICES">Achats Services</SelectItem>
                  <SelectItem value="ABONNEMENT">Abonnements</SelectItem>
                  <SelectItem value="CHARGES_SOCIALES">Charges Sociales</SelectItem>
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Total lignes</div>
                <div className="text-2xl font-bold">{lignes.length}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Ventes</div>
                <div className="text-2xl font-bold text-green-600">
                  {lignes.filter(l => l.type_operation === 'VENTES').length}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Achats</div>
                <div className="text-2xl font-bold text-blue-600">
                  {lignes.filter(l => l.type_operation === 'ACHAT_GENERAUX' || l.type_operation === 'ACHAT_SERVICES').length}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Abonnements</div>
                <div className="text-2xl font-bold text-purple-600">
                  {lignes.filter(l => l.type_operation === 'ABONNEMENT').length}
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
            <div className="flex gap-2">
              <Button
                onClick={recalculerTVAFromLignesRapprochement}
                disabled={isRecalculating || entete?.statut === 'VALIDE'}
                variant="outline"
                size="sm"
              >
                <RefreshCcw className={`h-4 w-4 mr-2 ${isRecalculating ? "animate-spin" : ""}`} />
                Recalculer TVA
              </Button>
              <Button
                onClick={sauvegarderTVA}
                disabled={isSaving || !hasUnsavedChanges || entete?.statut === 'VALIDE'}
                variant="outline"
                size="sm"
              >
                <Save className={`h-4 w-4 mr-2 ${isSaving ? "animate-spin" : ""}`} />
                Sauvegarder
              </Button>
              <Button
                onClick={validerTVA}
                disabled={!entete || hasUnsavedChanges || entete?.statut === 'VALIDE'}
                size="sm"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Valider TVA
              </Button>
            </div>
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
                <div className={`text-3xl font-bold ${stats.tva_a_payer >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
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
                  // Filtre par type d'opération
                  if (filterStatut !== "all" && ligne.type_operation !== filterStatut) {
                    return false;
                  }

                  // Filtre par type TVA
                  if (filterTypeTva !== "all") {
                    if (filterTypeTva === "COLLECTEE" && ligne.tva_collectee <= 0) {
                      return false;
                    }
                    if (filterTypeTva === "DEDUCTIBLE" && ligne.tva_deductible <= 0) {
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
