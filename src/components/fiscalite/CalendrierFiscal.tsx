import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, Euro, Plus } from "lucide-react";
import AddEcheanceDialog from "./AddEcheanceDialog";
import EcheanceDetailsDialog from "./EcheanceDetailsDialog";

interface TypeImpot {
  id: string;
  code: string;
  libelle: string;
  couleur: string;
}

interface Echeance {
  id: string;
  libelle: string;
  date_echeance: string;
  montant_estime: number;
  montant_paye: number | null;
  statut: string;
  description: string | null;
  date_paiement: string | null;
  notes: string | null;
  type_impot: TypeImpot;
}

interface Props {
  selectedYear: number;
}

export default function CalendrierFiscal({ selectedYear }: Props) {
  const [date, setDate] = useState<Date | undefined>(new Date(selectedYear, new Date().getMonth(), 1));
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [selectedEcheances, setSelectedEcheances] = useState<Echeance[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedEcheance, setSelectedEcheance] = useState<Echeance | null>(null);

  useEffect(() => {
    // Mettre à jour la date quand l'année change
    setDate(new Date(selectedYear, date?.getMonth() ?? 0, 1));
  }, [selectedYear]);

  useEffect(() => {
    if (date) {
      loadEcheances(date);
    }
  }, [date]);

  useEffect(() => {
    if (date) {
      const dayEcheances = echeances.filter(e =>
        isSameDay(new Date(e.date_echeance), date)
      );
      setSelectedEcheances(dayEcheances);
    }
  }, [date, echeances]);

  const loadEcheances = async (selectedDate: Date) => {
    try {
      const start = startOfMonth(selectedDate);
      const end = endOfMonth(selectedDate);

      const { data, error } = await supabase
        .from("echeances_fiscales")
        .select(`
          *,
          type_impot:types_impots(*)
        `)
        .gte("date_echeance", start.toISOString())
        .lte("date_echeance", end.toISOString())
        .order("date_echeance", { ascending: true });

      if (error) throw error;
      setEcheances(data as unknown as Echeance[]);
    } catch (error) {
      console.error("Erreur lors du chargement des échéances:", error);
    }
  };

  const getDayModifiers = () => {
    const modifiers: { [key: string]: Date[] } = {};
    
    echeances.forEach(e => {
      const date = new Date(e.date_echeance);
      const key = e.statut === "PAYE" ? "paye" : e.statut === "RETARD" ? "retard" : "apayer";
      
      if (!modifiers[key]) {
        modifiers[key] = [];
      }
      modifiers[key].push(date);
    });

    return modifiers;
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case "PAYE":
        return <Badge className="bg-green-600">Payé</Badge>;
      case "RETARD":
        return <Badge variant="destructive">En retard</Badge>;
      case "A_PAYER":
        return <Badge variant="secondary">À payer</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[400px,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Calendrier</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            locale={fr}
            className="rounded-md border"
            modifiers={getDayModifiers()}
            modifiersClassNames={{
              paye: "bg-green-100 text-green-900 font-bold",
              retard: "bg-red-100 text-red-900 font-bold",
              apayer: "bg-blue-100 text-blue-900 font-bold",
            }}
          />
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded" />
              <span>Payé</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 rounded" />
              <span>À payer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 rounded" />
              <span>En retard</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Échéances du {date && format(date, "dd MMMM yyyy", { locale: fr })}
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          {selectedEcheances.length > 0 ? (
            <div className="space-y-4">
              {selectedEcheances.map((echeance) => (
                <div
                  key={echeance.id}
                  className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => setSelectedEcheance(echeance)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: echeance.type_impot.couleur }}
                        />
                        <h3 className="font-semibold">{echeance.libelle}</h3>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{echeance.type_impot.libelle}</Badge>
                        {getStatutBadge(echeance.statut)}
                      </div>

                      {echeance.description && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {echeance.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                        <Euro className="h-3 w-3" />
                        <span>Estimé</span>
                      </div>
                      <div className="font-bold">
                        {(echeance.montant_estime || 0).toLocaleString("fr-FR")} €
                      </div>
                      {echeance.montant_paye && (
                        <>
                          <div className="text-xs text-muted-foreground mt-1">
                            Payé: {echeance.montant_paye.toLocaleString("fr-FR")} €
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune échéance pour cette date</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddEcheanceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          if (date) loadEcheances(date);
        }}
        defaultDate={date}
      />

      {selectedEcheance && (
        <EcheanceDetailsDialog
          echeance={selectedEcheance}
          open={!!selectedEcheance}
          onOpenChange={(open) => !open && setSelectedEcheance(null)}
          onSuccess={() => {
            if (date) loadEcheances(date);
            setSelectedEcheance(null);
          }}
        />
      )}
    </div>
  );
}
