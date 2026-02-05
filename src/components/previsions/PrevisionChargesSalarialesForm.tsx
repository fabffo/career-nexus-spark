import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { toast } from "sonner";

interface PrevisionChargesSalarialesFormProps {
  annee: number;
}

const TYPES_CHARGES = [
  { value: "SALAIRE", label: "Salaire" },
  { value: "CHARGES_SOCIALES", label: "Charges sociales" },
  { value: "RETRAITE", label: "Retraite" },
  { value: "MUTUELLE", label: "Mutuelle" },
];

export default function PrevisionChargesSalarialesForm({ annee }: PrevisionChargesSalarialesFormProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    mois: 1,
    nom: "",
    type_charge: "SALAIRE",
    montant: 0,
  });

  // Récupérer les prévisions existantes
  const { data: previsions = [] } = useQuery({
    queryKey: ["previsions-charges-salariales", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsions_charges_salariales")
        .select("*")
        .eq("annee", annee)
        .eq("actif", true)
        .order("mois");
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("previsions_charges_salariales").insert({
        annee,
        mois: data.mois,
        nom: data.nom,
        type_charge: data.type_charge,
        montant: data.montant,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-charges-salariales", annee] });
      toast.success("Prévision ajoutée");
      resetForm();
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("previsions_charges_salariales")
        .update({
          mois: data.mois,
          nom: data.nom,
          type_charge: data.type_charge,
          montant: data.montant,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-charges-salariales", annee] });
      toast.success("Prévision mise à jour");
      setEditingId(null);
      resetForm();
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("previsions_charges_salariales")
        .update({ actif: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-charges-salariales", annee] });
      toast.success("Prévision supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const resetForm = () => {
    setFormData({
      mois: 1,
      nom: "",
      type_charge: "SALAIRE",
      montant: 0,
    });
    setIsAdding(false);
  };

  const handleEdit = (prevision: any) => {
    setEditingId(prevision.id);
    setFormData({
      mois: prevision.mois,
      nom: prevision.nom || "",
      type_charge: prevision.type_charge || "SALAIRE",
      montant: Number(prevision.montant) || 0,
    });
  };

  const handleSubmit = () => {
    if (!formData.nom) {
      toast.error("Le nom est requis");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  const moisLabels = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Prévisions de Charges Salariales</h3>
        {!isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        )}
      </div>

      {(isAdding || editingId) && (
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Mois</Label>
              <Select
                value={formData.mois.toString()}
                onValueChange={(v) => setFormData(prev => ({ ...prev, mois: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {moisLabels.map((label, idx) => (
                    <SelectItem key={idx} value={(idx + 1).toString()}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={formData.nom}
                onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                placeholder="Ex: Salaire Jean Dupont"
              />
            </div>

            <div className="space-y-2">
              <Label>Type de charge</Label>
              <Select
                value={formData.type_charge}
                onValueChange={(v) => setFormData(prev => ({ ...prev, type_charge: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_CHARGES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Montant (€)</Label>
              <Input
                type="number"
                value={formData.montant}
                onChange={(e) => setFormData(prev => ({ ...prev, montant: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setEditingId(null); }}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              <Save className="h-4 w-4 mr-2" />
              {editingId ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mois</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Type de charge</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {previsions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                Aucune prévision de charge salariale pour {annee}
              </TableCell>
            </TableRow>
          ) : (
            previsions.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{moisLabels[p.mois - 1]}</TableCell>
                <TableCell>{p.nom}</TableCell>
                <TableCell>{TYPES_CHARGES.find(t => t.value === p.type_charge)?.label || p.type_charge}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(p.montant))}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
