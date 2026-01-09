import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

interface ChargeLigne {
  id: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_montant: number;
  transaction_credit: number;
  transaction_debit: number;
  statut: string;
  facture?: {
    numero_facture: string;
    total_ht: number;
    total_ttc: number;
    total_tva: number;
    type_facture: string;
    activite?: string;
    type_frais?: string;
    type_fournisseur?: string;
    emetteur_nom?: string;
  };
  factures?: {
    numero_facture: string;
    total_ht: number;
    total_ttc: number;
    total_tva: number;
    type_facture: string;
    activite?: string;
    type_frais?: string;
    type_fournisseur?: string;
    emetteur_nom?: string;
  }[];
  total_ht?: number;
  total_ttc?: number;
  total_tva?: number;
  type: string;
  activite: string;
}

export default function ChargesMensuelles() {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<{ month: string; year: string }[]>([]);
  const [lignes, setLignes] = useState<ChargeLigne[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Statistiques
  const stats = {
    total: lignes.reduce((sum, l) => sum + Math.abs(l.transaction_montant), 0),
    count: lignes.length,
    totalHt: lignes.reduce((sum, l) => sum + (l.total_ht ?? 0), 0),
    totalTtc: lignes.reduce((sum, l) => sum + (l.total_ttc ?? 0), 0),
    totalTva: lignes.reduce((sum, l) => sum + (l.total_tva ?? 0), 0),
  };

  const columns: ColumnDef<ChargeLigne>[] = [
    {
      accessorKey: "transaction_date",
      header: "Date",
      cell: ({ row }) => 
        row.original.transaction_date 
          ? format(new Date(row.original.transaction_date), "dd MMM yyyy", { locale: fr })
          : "",
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
      cell: ({ row }) => (
        <span className="font-semibold">
          {new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
          }).format(row.original.transaction_montant)}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: "total_ht",
      header: "HT",
      cell: ({ row }) => {
        const ht = row.original.total_ht;
        return ht !== undefined
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(ht)
          : "—";
      },
      enableSorting: true,
    },
    {
      id: "total_ttc",
      header: "TTC",
      cell: ({ row }) => {
        const ttc = row.original.total_ttc;
        return ttc !== undefined
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(ttc)
          : "—";
      },
      enableSorting: true,
    },
    {
      id: "total_tva",
      header: "TVA",
      cell: ({ row }) => {
        const tva = row.original.total_tva;
        return tva !== undefined
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(tva)
          : "—";
      },
      enableSorting: true,
    },
    {
      id: "facture",
      header: "Facture",
      cell: ({ row }) => {
        if (row.original.factures && row.original.factures.length > 0) {
          return row.original.factures.map(f => f.numero_facture).join(", ");
        }
        if (row.original.facture?.numero_facture) {
          return row.original.facture.numero_facture;
        }
        return "facDefaut";
      },
      enableSorting: false,
    },
    {
      accessorKey: "type",
      header: "Type",
      enableSorting: true,
    },
    {
      accessorKey: "activite",
      header: "Activité",
      enableSorting: true,
    },
  ];

  useEffect(() => {
    loadAvailablePeriods();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      loadData();
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

      // Charger le fichier de rapprochement validé pour cette période
      // On cherche les fichiers dont la période chevauche le mois sélectionné
      const { data: fichiers, error: fichierError } = await supabase
        .from("fichiers_rapprochement")
        .select("*")
        .eq("statut", "VALIDE")
        .lte("date_debut", endDate)
        .gte("date_fin", startDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fichierError) throw fichierError;

      if (!fichiers) {
        setLignes([]);
        return;
      }

      // Charger les rapprochements bancaires
      const { data: allRapprochementsDetails } = await supabase
        .from("rapprochements_bancaires")
        .select(`
          id,
          numero_ligne,
          transaction_date,
          transaction_libelle,
          transaction_montant,
          transaction_credit,
          transaction_debit,
          facture_id,
          abonnement_id,
          declaration_charge_id,
          notes
        `)
        .gte("transaction_date", fichiers.date_debut)
        .lte("transaction_date", fichiers.date_fin);

      const rapprochementIds = (allRapprochementsDetails || []).map(r => r.id);

      // Récupérer les factures associées via la table de liaison
      const { data: rapprochementsViaLiaison } = await supabase
        .from("rapprochements_factures")
        .select(`
          id,
          rapprochement_id,
          factures (
            id,
            numero_facture,
            type_facture,
            total_ht,
            total_ttc,
            total_tva,
            destinataire_nom,
            emetteur_nom,
            activite,
            type_frais
          )
        `)
        .in("rapprochement_id", rapprochementIds.length > 0 ? rapprochementIds : ["00000000-0000-0000-0000-000000000000"]);

      // Récupérer les abonnements
      const { data: abonnementsData } = await supabase
        .from("abonnements_partenaires")
        .select("id, type, nom");

      const abonnementsMap = new Map<string, any>();
      abonnementsData?.forEach(a => abonnementsMap.set(a.id, a));

      // Récupérer les déclarations de charges
      const { data: declarationsData } = await supabase
        .from("declarations_charges_sociales")
        .select("id, organisme, nom");

      const declarationsMap = new Map<string, any>();
      declarationsData?.forEach(d => declarationsMap.set(d.id, d));

      // Récupérer les fournisseurs pour déterminer le type
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

      // Construire la map des factures par rapprochement_id
      const facturesParRapprochement = new Map<string, any[]>();
      rapprochementsViaLiaison?.forEach(rf => {
        if (rf.factures) {
          const existing = facturesParRapprochement.get(rf.rapprochement_id) || [];
          const factureWithType = {
            ...rf.factures,
            type_fournisseur: rf.factures.emetteur_nom 
              ? fournisseurTypesMap.get(rf.factures.emetteur_nom.toLowerCase().trim()) || "Généraux"
              : "Généraux"
          };
          existing.push(factureWithType);
          facturesParRapprochement.set(rf.rapprochement_id, existing);
        }
      });

      // Parser les données du fichier
      const fichierData = fichiers.fichier_data as { lignes: any[] };
      const lignesFromFichier = fichierData?.lignes || [];

      // Créer la map des rapprochements pour accès rapide
      const rapprochementDetailsMap = new Map<string, any>();
      allRapprochementsDetails?.forEach(r => {
        rapprochementDetailsMap.set(r.numero_ligne, r);
      });

      // Construire les lignes finales et filtrer
      const allLignes: ChargeLigne[] = lignesFromFichier.map((ligne: any) => {
        const rapprochement = rapprochementDetailsMap.get(ligne.numero_ligne);
        const factures = rapprochement ? facturesParRapprochement.get(rapprochement.id) : undefined;

        let statut = "NON_RAPPROCHE";
        if (rapprochement && factures?.length > 0) {
          statut = "RAPPROCHE";
        }

        // Calculer les totaux si plusieurs factures
        let totalHt: number | undefined;
        let totalTtc: number | undefined;
        let totalTva: number | undefined;
        if (factures && factures.length > 0) {
          totalHt = factures.reduce((sum: number, f: any) => sum + (f.total_ht || 0), 0);
          totalTtc = factures.reduce((sum: number, f: any) => sum + (f.total_ttc || 0), 0);
          totalTva = factures.reduce((sum: number, f: any) => sum + (f.total_tva || 0), 0);
        }

        // Déterminer le type
        let type = "Achat";
        if (factures && factures.length > 0) {
          type = factures[0].type_facture === "VENTES" ? "Vente" : "Achat";
        }

        // Déterminer l'activité
        let activite = "Généraux";
        if (factures && factures.length > 0) {
          const firstFacture = factures[0];
          if (firstFacture.type_facture === "VENTES") {
            activite = firstFacture.activite || "—";
          } else {
            activite = firstFacture.type_fournisseur || "Généraux";
          }
        }

        return {
          id: ligne.numero_ligne,
          transaction_date: ligne.date,
          transaction_libelle: ligne.libelle,
          transaction_montant: ligne.montant,
          transaction_credit: ligne.credit || 0,
          transaction_debit: ligne.debit || 0,
          statut,
          factures: factures,
          total_ht: totalHt,
          total_ttc: totalTtc,
          total_tva: totalTva,
          type,
          activite,
        };
      });

      // Filtrer uniquement les lignes type=Achat et activité=Généraux
      const filteredLignes = allLignes.filter(ligne => 
        ligne.type === "Achat" && ligne.activite === "Généraux"
      );

      setLignes(filteredLignes);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getMonthLabel = (month: string) => {
    const months = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    return months[parseInt(month) - 1] || month;
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Charges Mensuelles</h1>
          <p className="text-muted-foreground mt-1">
            Détail des transactions issues des rapprochements bancaires
          </p>
        </div>
        <div className="flex gap-4">
          <Select value={`${selectedYear}-${selectedMonth}`} onValueChange={(value) => {
            const [year, month] = value.split("-");
            setSelectedYear(year);
            setSelectedMonth(month);
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sélectionner une période" />
            </SelectTrigger>
            <SelectContent>
              {availablePeriods.map(period => (
                <SelectItem key={`${period.year}-${period.month}`} value={`${period.year}-${period.month}`}>
                  {getMonthLabel(period.month)} {period.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Nombre de lignes</div>
          <div className="text-2xl font-bold">{stats.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total HT</div>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(stats.totalHt)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total TTC</div>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(stats.totalTtc)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">TVA totale</div>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(stats.totalTva)}
          </div>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={lignes}
        searchPlaceholder="Rechercher une transaction..."
      />
    </div>
  );
}
