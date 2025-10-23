import { useState } from "react";
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

const NATURE_LABELS: Record<string, string> = {
  RELEVE_BANQUE: "Relevé Banque",
  ASSURANCE: "Assurance",
  LOA_VOITURE: "LOA Voiture",
  LOYER: "Loyer",
  AUTRE: "Autre",
};

export default function PaiementsAbonnements() {
  const { data: paiements = [], isLoading } = useQuery({
    queryKey: ["paiements-abonnements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_abonnements")
        .select(`
          *,
          abonnement:abonnements_partenaires(id, nom, nature),
          rapprochement:rapprochements_bancaires(id, transaction_libelle)
        `)
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculs des statistiques
  const stats = {
    total: paiements.reduce((sum, p) => sum + Number(p.montant), 0),
    count: paiements.length,
    parNature: paiements.reduce((acc, p) => {
      const nature = p.abonnement?.nature || "AUTRE";
      acc[nature] = (acc[nature] || 0) + Number(p.montant);
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Paiements Abonnements</h1>
        <p className="text-muted-foreground mt-1">
          Historique des paiements d'abonnements issus des rapprochements bancaires
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total paiements</div>
          <div className="text-2xl font-bold">{stats.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Montant total</div>
          <div className="text-2xl font-bold">{stats.total.toFixed(2)} €</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Mois en cours</div>
          <div className="text-2xl font-bold">
            {paiements
              .filter(
                (p) =>
                  new Date(p.date_paiement).getMonth() === new Date().getMonth()
              )
              .reduce((sum, p) => sum + Number(p.montant), 0)
              .toFixed(2)}{" "}
            €
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Moyenne / paiement</div>
          <div className="text-2xl font-bold">
            {stats.count > 0 ? (stats.total / stats.count).toFixed(2) : "0.00"} €
          </div>
        </Card>
      </div>

      {/* Tableau des paiements */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Abonnement</TableHead>
              <TableHead>Nature</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Rapprochement</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : paiements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Aucun paiement enregistré
                </TableCell>
              </TableRow>
            ) : (
              paiements.map((paiement) => (
                <TableRow key={paiement.id}>
                  <TableCell>
                    {format(new Date(paiement.date_paiement), "dd MMM yyyy", {
                      locale: fr,
                    })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {paiement.abonnement?.nom || "-"}
                  </TableCell>
                  <TableCell>
                    {paiement.abonnement?.nature && (
                      <Badge variant="outline">
                        {NATURE_LABELS[paiement.abonnement.nature]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {Number(paiement.montant).toFixed(2)} €
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {paiement.rapprochement?.transaction_libelle || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {paiement.notes || "-"}
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
