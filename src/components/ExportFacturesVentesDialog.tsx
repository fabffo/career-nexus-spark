import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, CalendarIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Client {
  id: string;
  raison_sociale: string;
}

interface ExportFacturesVentesDialogProps {
  trigger?: React.ReactNode;
}

export default function ExportFacturesVentesDialog({ trigger }: ExportFacturesVentesDialogProps) {
  const [open, setOpen] = useState(false);
  const [dateDebut, setDateDebut] = useState<Date | undefined>(undefined);
  const [dateFin, setDateFin] = useState<Date | undefined>(undefined);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [clients, setClients] = useState<Client[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadClients = async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, raison_sociale")
        .order("raison_sociale");
      if (data) setClients(data);
    };
    if (open) loadClients();
  }, [open]);

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

      let query = supabase
        .from("factures")
        .select("numero_facture, date_emission, destinataire_nom, destinataire_id, activite, total_ht, total_ttc")
        .eq("type_facture", "VENTES")
        .gte("date_emission", startDate)
        .lte("date_emission", endDate)
        .order("date_emission", { ascending: true });

      if (selectedClientId !== "all") {
        query = query.eq("destinataire_id", selectedClientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning("Aucune facture trouvée pour cette période");
        setIsExporting(false);
        return;
      }

      // Créer le contenu CSV
      const headers = ["Numero Facture", "Date Emission", "Client", "Activite", "HT", "TTC"];
      const csvRows = [
        headers.join(";"),
        ...data.map((f) => [
          f.numero_facture || "",
          f.date_emission ? format(new Date(f.date_emission), "dd/MM/yyyy") : "",
          (f.destinataire_nom || "").replace(/;/g, ","),
          (f.activite || "").replace(/;/g, ","),
          (f.total_ht || 0).toFixed(2).replace(".", ","),
          (f.total_ttc || 0).toFixed(2).replace(".", ","),
        ].join(";"))
      ];

      const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM pour Excel
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const clientSuffix = selectedClientId !== "all" 
        ? `_${clients.find(c => c.id === selectedClientId)?.raison_sociale?.replace(/\s+/g, "_") || "client"}`
        : "";
      link.download = `factures_ventes_${format(dateDebut, "yyyyMMdd")}_${format(dateFin, "yyyyMMdd")}${clientSuffix}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${data.length} facture(s) exportée(s)`);
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
          <DialogTitle>Exporter les factures de vente</DialogTitle>
          <DialogDescription>
            Sélectionnez une plage de dates et optionnellement un client pour exporter les factures au format CSV.
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Client (optionnel)</label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tous les clients" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">Tous les clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.raison_sociale}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !dateDebut || !dateFin}>
            {isExporting ? "Export en cours..." : "Exporter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
