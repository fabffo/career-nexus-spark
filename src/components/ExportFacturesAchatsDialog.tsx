import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, CalendarIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExportFacturesAchatsDialogProps {
  trigger?: React.ReactNode;
}

const TYPE_FOURNISSEUR_OPTIONS = [
  { value: "SERVICES", label: "Fournisseurs Services" },
  { value: "GENERAUX", label: "Fournisseurs Généraux" },
  { value: "ETAT_ORGANISMES", label: "État & Organismes" },
  { value: "PRESTATAIRE", label: "Prestataires" },
  { value: "SALARIE", label: "Salariés" },
];

const TYPE_LABEL_MAP: Record<string, string> = {
  SERVICES: "Services",
  GENERAUX: "Généraux",
  ETAT_ORGANISMES: "État & Organismes",
  PRESTATAIRE: "Prestataire",
  SALARIE: "Salarié",
};

export default function ExportFacturesAchatsDialog({ trigger }: ExportFacturesAchatsDialogProps) {
  const [open, setOpen] = useState(false);
  const [dateDebut, setDateDebut] = useState<Date | undefined>(undefined);
  const [dateFin, setDateFin] = useState<Date | undefined>(undefined);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(TYPE_FOURNISSEUR_OPTIONS.map(o => o.value)));
  const [isExporting, setIsExporting] = useState(false);

  const toggleType = (value: string) => {
    const newSet = new Set(selectedTypes);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    setSelectedTypes(newSet);
  };

  const toggleAll = () => {
    if (selectedTypes.size === TYPE_FOURNISSEUR_OPTIONS.length) {
      setSelectedTypes(new Set());
    } else {
      setSelectedTypes(new Set(TYPE_FOURNISSEUR_OPTIONS.map(o => o.value)));
    }
  };

  // Helper pour obtenir le type de fournisseur depuis une facture
  const getFactureEmetteurType = (facture: any, fournisseurTypesMap: Map<string, string>): string => {
    // D'abord vérifier emetteur_type directement stocké
    if (facture.emetteur_type === 'PRESTATAIRE') return 'PRESTATAIRE';
    if (facture.emetteur_type === 'SALARIE') return 'SALARIE';
    if (facture.emetteur_type === 'FOURNISSEUR_SERVICE') return 'SERVICES';
    if (facture.emetteur_type === 'FOURNISSEUR_GENERAL') return 'GENERAUX';
    if (facture.emetteur_type === 'FOURNISSEUR_ETAT') return 'ETAT_ORGANISMES';
    
    // Fallback: utiliser le type_facture
    if (facture.type_facture === 'ACHATS_SERVICES') return 'SERVICES';
    if (facture.type_facture === 'ACHATS_ETAT') return 'ETAT_ORGANISMES';
    
    // Dernier recours: chercher dans la map par nom
    if (facture.emetteur_nom) {
      const emetteurKey = facture.emetteur_nom.toLowerCase().trim();
      const type = fournisseurTypesMap.get(emetteurKey);
      if (type) return type;
    }
    
    return 'GENERAUX';
  };

  const handleExport = async () => {
    if (!dateDebut || !dateFin) {
      toast.error("Veuillez sélectionner une plage de dates");
      return;
    }

    if (dateDebut > dateFin) {
      toast.error("La date de début doit être antérieure à la date de fin");
      return;
    }

    setIsExporting(true);
    try {
      const startDate = format(dateDebut, "yyyy-MM-dd");
      const endDate = format(dateFin, "yyyy-MM-dd");

      // Charger la map des types de fournisseurs
      const fournisseurTypesMap = new Map<string, string>();

      // Récupérer les fournisseurs de services
      const { data: services } = await supabase
        .from("fournisseurs_services")
        .select("raison_sociale");
      
      services?.forEach(f => {
        if (f.raison_sociale) {
          fournisseurTypesMap.set(f.raison_sociale.toLowerCase().trim(), "SERVICES");
        }
      });

      // Récupérer les fournisseurs généraux
      const { data: generaux } = await supabase
        .from("fournisseurs_generaux")
        .select("raison_sociale");
      
      generaux?.forEach(f => {
        if (f.raison_sociale) {
          fournisseurTypesMap.set(f.raison_sociale.toLowerCase().trim(), "GENERAUX");
        }
      });

      // Récupérer les fournisseurs État & organismes
      const { data: etatOrganismes } = await supabase
        .from("fournisseurs_etat_organismes")
        .select("raison_sociale");
      
      etatOrganismes?.forEach(f => {
        if (f.raison_sociale) {
          fournisseurTypesMap.set(f.raison_sociale.toLowerCase().trim(), "ETAT_ORGANISMES");
        }
      });

      // Récupérer les prestataires
      const { data: prestataires } = await supabase
        .from("prestataires")
        .select("nom, prenom");
      
      prestataires?.forEach(p => {
        if (p.nom) {
          const fullName = `${p.prenom || ''} ${p.nom}`.toLowerCase().trim();
          fournisseurTypesMap.set(fullName, "PRESTATAIRE");
          const reverseName = `${p.nom} ${p.prenom || ''}`.toLowerCase().trim();
          fournisseurTypesMap.set(reverseName, "PRESTATAIRE");
        }
      });

      // Récupérer les salariés
      const { data: salaries } = await supabase
        .from("salaries")
        .select("nom, prenom");
      
      salaries?.forEach(s => {
        if (s.nom) {
          const fullName = `${s.prenom || ''} ${s.nom}`.toLowerCase().trim();
          fournisseurTypesMap.set(fullName, "SALARIE");
          const reverseName = `${s.nom} ${s.prenom || ''}`.toLowerCase().trim();
          fournisseurTypesMap.set(reverseName, "SALARIE");
        }
      });

      // Récupérer les factures
      const { data, error } = await supabase
        .from("factures")
        .select("numero_facture, date_emission, emetteur_nom, emetteur_type, type_facture, total_ht, total_ttc")
        .in("type_facture", ["ACHATS", "ACHATS_GENERAUX", "ACHATS_SERVICES", "ACHATS_ETAT"])
        .gte("date_emission", startDate)
        .lte("date_emission", endDate)
        .order("date_emission", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning("Aucune facture trouvée pour cette période");
        setIsExporting(false);
        return;
      }

      // Filtrer par types de fournisseur sélectionnés
      let filteredData = data;
      if (selectedTypes.size < TYPE_FOURNISSEUR_OPTIONS.length) {
        filteredData = data.filter(f => {
          const type = getFactureEmetteurType(f, fournisseurTypesMap);
          return selectedTypes.has(type);
        });
      }

      if (filteredData.length === 0) {
        toast.warning("Aucune facture trouvée pour ces critères");
        setIsExporting(false);
        return;
      }

      // Créer le contenu CSV
      const headers = ["Numero Facture", "Date Emission", "Fournisseur", "Type", "HT", "TTC"];
      const csvRows = [
        headers.join(";"),
        ...filteredData.map((f) => {
          const fournisseurType = getFactureEmetteurType(f, fournisseurTypesMap);
          const typeLabel = TYPE_LABEL_MAP[fournisseurType] || fournisseurType;
          
          return [
            f.numero_facture || "",
            f.date_emission ? format(new Date(f.date_emission), "dd/MM/yyyy") : "",
            (f.emetteur_nom || "").replace(/;/g, ","),
            typeLabel,
            (f.total_ht || 0).toFixed(2).replace(".", ","),
            (f.total_ttc || 0).toFixed(2).replace(".", ","),
          ].join(";");
        })
      ];

      const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM pour Excel
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const typeLabel = selectedTypes.size === TYPE_FOURNISSEUR_OPTIONS.length ? "tous" : Array.from(selectedTypes).join("-").toLowerCase();
      link.download = `factures_achats_${typeLabel}_${format(dateDebut, "yyyyMMdd")}_${format(dateFin, "yyyyMMdd")}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${filteredData.length} facture(s) exportée(s)`);
      setOpen(false);
    } catch (error: any) {
      console.error("Erreur export:", error);
      toast.error("Erreur lors de l'export: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exporter les factures d'achat</DialogTitle>
          <DialogDescription>
            Sélectionnez une plage de dates et un type de fournisseur pour exporter les factures au format CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date début</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateDebut && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateDebut ? format(dateDebut, "dd/MM/yyyy") : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateDebut}
                    onSelect={setDateDebut}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date fin</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFin && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFin ? format(dateFin, "dd/MM/yyyy") : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFin}
                    onSelect={setDateFin}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Types de fournisseur</label>
              <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
                {selectedTypes.size === TYPE_FOURNISSEUR_OPTIONS.length ? "Désélectionner tout" : "Tout sélectionner"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_FOURNISSEUR_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.value}
                    checked={selectedTypes.has(option.value)}
                    onCheckedChange={() => toggleType(option.value)}
                  />
                  <label
                    htmlFor={option.value}
                    className="text-sm cursor-pointer"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !dateDebut || !dateFin || selectedTypes.size === 0}>
            {isExporting ? "Export en cours..." : "Exporter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
