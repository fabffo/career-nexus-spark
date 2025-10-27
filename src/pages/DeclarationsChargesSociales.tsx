import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import AddDeclarationChargeDialog from "@/components/AddDeclarationChargeDialog";
import EditDeclarationChargeDialog from "@/components/EditDeclarationChargeDialog";

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
          {isLoading ? (
            <div>Chargement...</div>
          ) : !declarations?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune déclaration enregistrée
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Organisme</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Périodicité</TableHead>
                  <TableHead>Montant estimé</TableHead>
                  <TableHead>Jour échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {declarations.map((declaration) => (
                  <TableRow key={declaration.id}>
                    <TableCell className="font-medium">{declaration.nom}</TableCell>
                    <TableCell>{declaration.organisme}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TYPE_CHARGE_LABELS[declaration.type_charge as keyof typeof TYPE_CHARGE_LABELS]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {PERIODICITE_LABELS[declaration.periodicite as keyof typeof PERIODICITE_LABELS]}
                    </TableCell>
                    <TableCell>
                      {declaration.montant_estime ? 
                        `${Number(declaration.montant_estime).toFixed(2)} €` : 
                        '-'
                      }
                    </TableCell>
                    <TableCell>{declaration.jour_echeance || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActifMutation.mutate({
                          id: declaration.id,
                          actif: !declaration.actif
                        })}
                      >
                        {declaration.actif ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingDeclaration(declaration)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Êtes-vous sûr de vouloir supprimer cette déclaration ?')) {
                            deleteMutation.mutate(declaration.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
