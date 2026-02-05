import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit2, Save, X, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PrevisionAchatsGenerauxFormProps {
  annee: number;
}

export default function PrevisionAchatsGenerauxForm({ annee }: PrevisionAchatsGenerauxFormProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    mois: 1,
    fournisseur_id: "",
    fournisseur_nom: "",
    activite: "",
    total_ht: 0,
    taux_tva: 20,
    date_emission: "",
    date_echeance: "",
  });

  // Récupérer les fournisseurs généraux
  const { data: fournisseurs = [] } = useQuery({
    queryKey: ["fournisseurs-generaux-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fournisseurs_generaux")
        .select("id, raison_sociale, activite")
        .order("raison_sociale");
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les activités
  const { data: activites = [] } = useQuery({
    queryKey: ["param-activites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("param_activite")
        .select("code, libelle")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les prévisions existantes
  const { data: previsions = [] } = useQuery({
    queryKey: ["previsions-achats-generaux", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsions_achats_generaux")
        .select("*")
        .eq("annee", annee)
        .eq("actif", true)
        .order("mois");
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les prévisions de l'année précédente
  const { data: previsionsAnneePrecedente = [] } = useQuery({
    queryKey: ["previsions-achats-generaux", annee - 1],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsions_achats_generaux")
        .select("*")
        .eq("annee", annee - 1)
        .eq("actif", true)
        .order("mois");
      if (error) throw error;
      return data || [];
    },
  });

  const calculateTotals = (ht: number, tauxTva: number) => {
    const tva = ht * (tauxTva / 100);
    const ttc = ht + tva;
    return { total_tva: tva, total_ttc: ttc };
  };

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const totals = calculateTotals(data.total_ht, data.taux_tva);
      const { error } = await supabase.from("previsions_achats_generaux").insert({
        annee,
        mois: data.mois,
        fournisseur_id: data.fournisseur_id || null,
        fournisseur_nom: data.fournisseur_nom,
        activite: data.activite || null,
        total_ht: data.total_ht,
        taux_tva: data.taux_tva,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
        date_emission: data.date_emission || null,
        date_echeance: data.date_echeance || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-achats-generaux", annee] });
      toast.success("Prévision ajoutée");
      resetForm();
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const totals = calculateTotals(data.total_ht, data.taux_tva);
      const { error } = await supabase
        .from("previsions_achats_generaux")
        .update({
          mois: data.mois,
          fournisseur_id: data.fournisseur_id || null,
          fournisseur_nom: data.fournisseur_nom,
          activite: data.activite || null,
          total_ht: data.total_ht,
          taux_tva: data.taux_tva,
          total_tva: totals.total_tva,
          total_ttc: totals.total_ttc,
          date_emission: data.date_emission || null,
          date_echeance: data.date_echeance || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-achats-generaux", annee] });
      toast.success("Prévision mise à jour");
      setEditingId(null);
      resetForm();
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("previsions_achats_generaux")
        .update({ actif: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-achats-generaux", annee] });
      toast.success("Prévision supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const toInsert = previsionsAnneePrecedente.map((p: any) => {
        const totals = calculateTotals(Number(p.total_ht), Number(p.taux_tva));
        return {
          annee,
          mois: p.mois,
          fournisseur_id: p.fournisseur_id,
          fournisseur_nom: p.fournisseur_nom,
          activite: p.activite,
          total_ht: p.total_ht,
          taux_tva: p.taux_tva,
          total_tva: totals.total_tva,
          total_ttc: totals.total_ttc,
          date_emission: null, // On ne reporte pas les dates
          date_echeance: null,
        };
      });
      if (toInsert.length === 0) throw new Error("Aucune donnée à importer");
      const { error } = await supabase.from("previsions_achats_generaux").insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-achats-generaux", annee] });
      toast.success(`${previsionsAnneePrecedente.length} prévision(s) importée(s) depuis ${annee - 1}`);
    },
    onError: (error: any) => toast.error(error.message || "Erreur lors de l'import"),
  });

  const copyMutation = useMutation({
    mutationFn: async (prevision: any) => {
      const totals = calculateTotals(Number(prevision.total_ht), Number(prevision.taux_tva));
      const { error } = await supabase.from("previsions_achats_generaux").insert({
        annee,
        mois: prevision.mois,
        fournisseur_id: prevision.fournisseur_id,
        fournisseur_nom: prevision.fournisseur_nom ? `${prevision.fournisseur_nom} (copie)` : "(copie)",
        activite: prevision.activite,
        total_ht: prevision.total_ht,
        taux_tva: prevision.taux_tva,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
        date_emission: prevision.date_emission,
        date_echeance: prevision.date_echeance,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-achats-generaux", annee] });
      toast.success("Prévision dupliquée");
    },
    onError: () => toast.error("Erreur lors de la copie"),
  });

  const resetForm = () => {
    setFormData({
      mois: 1,
      fournisseur_id: "",
      fournisseur_nom: "",
      activite: "",
      total_ht: 0,
      taux_tva: 20,
      date_emission: "",
      date_echeance: "",
    });
    setIsAdding(false);
  };

  const handleFournisseurChange = (fournisseurId: string) => {
    const fournisseur = fournisseurs.find(f => f.id === fournisseurId);
    setFormData(prev => ({
      ...prev,
      fournisseur_id: fournisseurId,
      fournisseur_nom: fournisseur?.raison_sociale || "",
      activite: fournisseur?.activite || prev.activite,
    }));
  };

  const handleEdit = (prevision: any) => {
    setEditingId(prevision.id);
    setFormData({
      mois: prevision.mois,
      fournisseur_id: prevision.fournisseur_id || "",
      fournisseur_nom: prevision.fournisseur_nom || "",
      activite: prevision.activite || "",
      total_ht: Number(prevision.total_ht) || 0,
      taux_tva: Number(prevision.taux_tva) || 20,
      date_emission: prevision.date_emission || "",
      date_echeance: prevision.date_echeance || "",
    });
  };

  const handleSubmit = () => {
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
        <h3 className="text-lg font-semibold">Prévisions d'Achats Généraux</h3>
        <div className="flex gap-2">
          {previsionsAnneePrecedente.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Importer {annee - 1}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Importer depuis {annee - 1}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action importera {previsionsAnneePrecedente.length} prévision(s) d'achats généraux de l'année {annee - 1}.
                    Les dates d'émission et d'échéance ne seront pas reportées. Les prévisions existantes ne seront pas supprimées.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => importMutation.mutate()}>
                    Importer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!isAdding && (
            <Button size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          )}
        </div>
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
              <Label>Fournisseur général</Label>
              <Select
                value={formData.fournisseur_id}
                onValueChange={handleFournisseurChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {fournisseurs.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.raison_sociale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Activité</Label>
              <Select
                value={formData.activite}
                onValueChange={(v) => setFormData(prev => ({ ...prev, activite: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {activites.map((act) => (
                    <SelectItem key={act.code} value={act.code}>{act.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Montant HT (€)</Label>
              <Input
                type="number"
                value={formData.total_ht}
                onChange={(e) => setFormData(prev => ({ ...prev, total_ht: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Taux TVA (%)</Label>
              <Input
                type="number"
                value={formData.taux_tva}
                onChange={(e) => setFormData(prev => ({ ...prev, taux_tva: parseFloat(e.target.value) || 20 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Date émission</Label>
              <Input
                type="date"
                value={formData.date_emission}
                onChange={(e) => setFormData(prev => ({ ...prev, date_emission: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Date échéance</Label>
              <Input
                type="date"
                value={formData.date_echeance}
                onChange={(e) => setFormData(prev => ({ ...prev, date_echeance: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Total HT: </span>
              <span className="font-medium">{formatCurrency(formData.total_ht)}</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span className="text-muted-foreground">TTC: </span>
              <span className="font-medium">
                {formatCurrency(formData.total_ht * (1 + formData.taux_tva / 100))}
              </span>
            </div>
            <div className="flex gap-2">
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
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mois</TableHead>
            <TableHead>Fournisseur</TableHead>
            <TableHead>Activité</TableHead>
            <TableHead className="text-right">HT</TableHead>
            <TableHead className="text-right">TVA</TableHead>
            <TableHead className="text-right">TTC</TableHead>
            <TableHead className="w-[120px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {previsions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Aucune prévision d'achat général pour {annee}
              </TableCell>
            </TableRow>
          ) : (
            previsions.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{moisLabels[p.mois - 1]}</TableCell>
                <TableCell>{p.fournisseur_nom || "—"}</TableCell>
                <TableCell>{activites.find(a => a.code === p.activite)?.libelle || p.activite || "—"}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(p.total_ht))}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(p.total_tva))}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(p.total_ttc))}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyMutation.mutate(p)} title="Dupliquer">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} title="Modifier">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)} title="Supprimer">
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
