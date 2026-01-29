import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Plus,
  Euro
} from "lucide-react";
import { format, differenceInDays, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import AddEcheanceDialog from "./AddEcheanceDialog";

interface TypeImpot {
  id: string;
  code: string;
  libelle: string;
  couleur: string;
  description: string;
}

interface Echeance {
  id: string;
  libelle: string;
  date_echeance: string;
  montant_estime: number;
  montant_paye: number | null;
  statut: string;
  type_impot: TypeImpot;
}

interface Stats {
  total_a_payer: number;
  total_paye: number;
  en_retard: number;
  prochaines_echeances: number;
}

interface Props {
  selectedYear: number;
}

export default function FiscaliteDashboard({ selectedYear }: Props) {
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_a_payer: 0,
    total_paye: 0,
    en_retard: 0,
    prochaines_echeances: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const loadData = async () => {
    try {
      const startDate = new Date(selectedYear, 0, 1);
      const endDate = new Date(selectedYear, 11, 31, 23, 59, 59);

      const { data, error } = await supabase
        .from("echeances_fiscales")
        .select(`
          *,
          type_impot:types_impots(*)
        `)
        .gte("date_echeance", startDate.toISOString())
        .lte("date_echeance", endDate.toISOString())
        .order("date_echeance", { ascending: true });

      if (error) throw error;

      const echeancesData = data as unknown as Echeance[];
      setEcheances(echeancesData);

      // Calculer les stats
      const now = new Date();
      const stats = {
        total_a_payer: 0,
        total_paye: 0,
        en_retard: 0,
        prochaines_echeances: 0,
      };

      echeancesData.forEach((e) => {
        const dateEcheance = new Date(e.date_echeance);
        
        if (e.statut === "PAYE") {
          stats.total_paye += e.montant_paye || 0;
        } else if (e.statut === "A_PAYER") {
          stats.total_a_payer += e.montant_estime || 0;
          
          if (dateEcheance < now) {
            stats.en_retard++;
          } else if (differenceInDays(dateEcheance, now) <= 30) {
            stats.prochaines_echeances++;
          }
        } else if (e.statut === "RETARD") {
          stats.en_retard++;
          stats.total_a_payer += e.montant_estime || 0;
        }
      });

      setStats(stats);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    } finally {
      setLoading(false);
    }
  };

  // Préparer les données pour le graphique
  const chartData = echeances
    .filter(e => e.statut === "PAYE" || e.statut === "A_PAYER")
    .reduce((acc, e) => {
      const existing = acc.find(item => item.name === e.type_impot.libelle);
      const montant = e.statut === "PAYE" ? (e.montant_paye || 0) : (e.montant_estime || 0);
      
      if (existing) {
        existing.value += montant;
      } else {
        acc.push({
          name: e.type_impot.libelle,
          value: montant,
          color: e.type_impot.couleur,
        });
      }
      return acc;
    }, [] as { name: string; value: number; color: string }[]);

  const prochainesEcheances = echeances
    .filter(e => {
      const dateEcheance = new Date(e.date_echeance);
      const now = new Date();
      return e.statut === "A_PAYER" && dateEcheance >= now;
    })
    .slice(0, 5);

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À payer</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_a_payer.toLocaleString("fr-FR")} €
            </div>
            <p className="text-xs text-muted-foreground">
              Échéances en cours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payé</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_paye.toLocaleString("fr-FR")} €
            </div>
            <p className="text-xs text-muted-foreground">
              Déjà acquitté cette année
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En retard</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.en_retard}</div>
            <p className="text-xs text-muted-foreground">
              Échéances dépassées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prochaines</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.prochaines_echeances}</div>
            <p className="text-xs text-muted-foreground">
              Dans les 30 jours
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Graphique répartition */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition des impôts</CardTitle>
            <CardDescription>Vue d'ensemble de la charge fiscale</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `${value.toLocaleString("fr-FR")} €`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prochaines échéances */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Prochaines échéances</CardTitle>
              <CardDescription>À venir dans les semaines suivantes</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {prochainesEcheances.length > 0 ? (
              prochainesEcheances.map((echeance) => {
                const joursRestants = differenceInDays(
                  new Date(echeance.date_echeance),
                  new Date()
                );
                return (
                  <div
                    key={echeance.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: echeance.type_impot.couleur }}
                        />
                        <span className="font-medium">{echeance.libelle}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>
                          {format(new Date(echeance.date_echeance), "dd MMMM yyyy", { locale: fr })}
                        </span>
                        {joursRestants <= 7 && (
                          <Badge variant="destructive" className="text-xs">
                            J-{joursRestants}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {(echeance.montant_estime || 0).toLocaleString("fr-FR")} €
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {echeance.type_impot.libelle}
                      </Badge>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Aucune échéance à venir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertes */}
      {stats.en_retard > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Vous avez {stats.en_retard} échéance{stats.en_retard > 1 ? "s" : ""} en retard.
            Veuillez régulariser votre situation au plus vite.
          </AlertDescription>
        </Alert>
      )}

      <AddEcheanceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={loadData}
      />
    </div>
  );
}
