import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import AddDeclarationChargeDialog from "@/components/AddDeclarationChargeDialog";
import EditDeclarationChargeDialog from "@/components/EditDeclarationChargeDialog";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

const PERIODICITE_LABELS = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  ANNUEL: "Annuel"
};

const TYPE_CHARGE_LABELS = {
  SALAIRE: "Salaire",
  CHARGES_SOCIALES: "Charges sociales",
  RETRAITE: "Retraite",
  MUTUELLE: "Mutuelle"
};

type Declaration = {
  id: string;
  nom: string;
  organisme: string;
  type_charge: string;
  periodicite: string;
  montant_estime: number;
  jour_echeance: number;
  actif: boolean;
};

export default function DeclarationsChargesSociales() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingDeclaration, setEditingDeclaration] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: declarations, isLoading } = useQuery({
    queryKey: ['declarations-charges-sociales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('declarations_charges_sociales')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('declarations_charges_sociales')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declarations-charges-sociales'] });
      toast.success("Déclaration supprimée");
    },
    onError: (error) => {
      console.error('Error deleting declaration:', error);
      toast.error("Erreur lors de la suppression");
    }
  });

  const toggleActifMutation = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase
        .from('declarations_charges_sociales')
        .update({ actif })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declarations-charges-sociales'] });
      toast.success("Statut mis à jour");
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast.error("Erreur lors de la mise à jour");
    }
  });

  const columns: ColumnDef<Declaration>[] = [
    {
      accessorKey: "nom",
      header: "Nom",
      cell: ({ row }) => <span className="font-medium">{row.original.nom}</span>,
    },
    {
      accessorKey: "organisme",
      header: "Organisme",
    },
    {
      accessorKey: "type_charge",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">
          {TYPE_CHARGE_LABELS[row.original.type_charge as keyof typeof TYPE_CHARGE_LABELS]}
        </Badge>
      ),
    },
    {
      accessorKey: "periodicite",
      header: "Périodicité",
      cell: ({ row }) => PERIODICITE_LABELS[row.original.periodicite as keyof typeof PERIODICITE_LABELS],
    },
    {
      accessorKey: "montant_estime",
      header: "Montant estimé",
      cell: ({ row }) =>
        row.original.montant_estime
          ? `${Number(row.original.montant_estime).toFixed(2)} €`
          : "-",
    },
    {
      accessorKey: "jour_echeance",
      header: "Jour échéance",
      cell: ({ row }) => row.original.jour_echeance || "-",
    },
    {
      id: "statut",
      header: "Statut",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            toggleActifMutation.mutate({
              id: row.original.id,
              actif: !row.original.actif,
            })
          }
        >
          {row.original.actif ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-gray-400" />
          )}
        </Button>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingDeclaration(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Êtes-vous sûr de vouloir supprimer cette déclaration ?")) {
                deleteMutation.mutate(row.original.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      meta: { className: "text-right" },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Déclarations de Charges Sociales</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les déclarations récurrentes de charges sociales
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle déclaration
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des déclarations</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={declarations || []}
            searchPlaceholder="Rechercher une déclaration..."
          />
        </CardContent>
      </Card>

      <AddDeclarationChargeDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />

      {editingDeclaration && (
        <EditDeclarationChargeDialog
          open={!!editingDeclaration}
          onOpenChange={(open) => !open && setEditingDeclaration(null)}
          declaration={editingDeclaration}
        />
      )}
    </div>
  );
}
