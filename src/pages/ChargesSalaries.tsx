import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const TYPE_CHARGE_LABELS: Record<string, string> = {
  SALAIRE: "Salaire",
  COTISATIONS: "Cotisations",
  CHARGES_PATRONALES: "Charges Patronales",
  AUTRES: "Autres",
};

export default function ChargesSalaries() {
  const { data: charges = [], isLoading } = useQuery({
    queryKey: ["paiements-declarations-charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_declarations_charges")
        .select(`
          *,
          declaration:declarations_charges_sociales(id, nom, organisme, type_charge),
          rapprochement:rapprochements_bancaires(id, transaction_libelle)
        `)
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculs des statistiques
  const stats = {
    total: charges.reduce((sum, c) => sum + Number(c.montant), 0),
    count: charges.length,
    parType: charges.reduce((acc, c) => {
      const type = c.declaration?.type_charge || "AUTRES";
      acc[type] = (acc[type] || 0) + Number(c.montant);
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Charges Salariales</h1>
        <p className="text-muted-foreground mt-1">
          Historique des paiements de déclarations de charges sociales
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total charges</div>
          <div className="text-2xl font-bold">{stats.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Montant total</div>
          <div className="text-2xl font-bold">{stats.total.toFixed(2)} €</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Mois en cours</div>
          <div className="text-2xl font-bold">
            {charges
              .filter(
                (c) =>
                  new Date(c.date_paiement).getMonth() === new Date().getMonth()
              )
              .reduce((sum, c) => sum + Number(c.montant), 0)
              .toFixed(2)}{" "}
            €
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Moyenne / charge</div>
          <div className="text-2xl font-bold">
            {stats.count > 0 ? (stats.total / stats.count).toFixed(2) : "0.00"} €
          </div>
        </Card>
      </div>

      {/* Tableau des charges */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Déclaration</TableHead>
              <TableHead>Organisme</TableHead>
              <TableHead>Type de charge</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Rapprochement</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : charges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Aucune charge enregistrée
                </TableCell>
              </TableRow>
            ) : (
              charges.map((charge) => (
                <TableRow key={charge.id}>
                  <TableCell>
                    {format(new Date(charge.date_paiement), "dd MMM yyyy", {
                      locale: fr,
                    })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {charge.declaration?.nom || "-"}
                  </TableCell>
                  <TableCell>
                    {charge.declaration?.organisme || "-"}
                  </TableCell>
                  <TableCell>
                    {charge.declaration?.type_charge && (
                      <Badge variant="outline">
                        {TYPE_CHARGE_LABELS[charge.declaration.type_charge] || charge.declaration.type_charge}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {Number(charge.montant).toFixed(2)} €
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {charge.rapprochement?.transaction_libelle || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {charge.notes || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
