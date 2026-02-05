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

interface PrevisionAchatsServicesFormProps {
  annee: number;
}

export default function PrevisionAchatsServicesForm({ annee }: PrevisionAchatsServicesFormProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    mois: 1,
    fournisseur_id: "",
    prestataire_id: "",
    fournisseur_nom: "",
    activite: "",
    tjm: 0,
    quantite: 1,
    taux_tva: 20,
    date_emission: "",
    date_echeance: "",
  });

  // Récupérer les fournisseurs de services
  const { data: fournisseurs = [] } = useQuery({
    queryKey: ["fournisseurs-services-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fournisseurs_services")
        .select("id, raison_sociale")
        .order("raison_sociale");
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les prestataires
  const { data: prestataires = [] } = useQuery({
    queryKey: ["prestataires-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestataires")
        .select("id, nom, prenom")
        .eq("actif", true)
        .order("nom");
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
    queryKey: ["previsions-achats-services", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsions_achats_services")
        .select("*")
        .eq("annee", annee)
        .eq("actif", true)
        .order("mois");
      if (error) throw error;
      return data || [];
    },
  });

  const calculateTotals = (tjm: number, quantite: number, tauxTva: number) => {
    const ht = tjm * quantite;
    const tva = ht * (tauxTva / 100);
    const ttc = ht + tva;
    return { total_ht: ht, total_tva: tva, total_ttc: ttc };
  };

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const totals = calculateTotals(data.tjm, data.quantite, data.taux_tva);
      const { error } = await supabase.from("previsions_achats_services").insert({
        annee,
        mois: data.mois,
        fournisseur_id: data.fournisseur_id || null,
        prestataire_id: data.prestataire_id || null,
        fournisseur_nom: data.fournisseur_nom,
        activite: data.activite || null,
        tjm: data.tjm,
        quantite: data.quantite,
        total_ht: totals.total_ht,
        taux_tva: data.taux_tva,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
        date_emission: data.date_emission || null,
        date_echeance: data.date_echeance || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-achats-services", annee] });
      toast.success("Prévision ajoutée");
      resetForm();
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const totals = calculateTotals(data.tjm, data.quantite, data.taux_tva);
      const { error } = await supabase
        .from("previsions_achats_services")
        .update({
          mois: data.mois,
          fournisseur_id: data.fournisseur_id || null,
          prestataire_id: data.prestataire_id || null,
          fournisseur_nom: data.fournisseur_nom,
          activite: data.activite || null,
          tjm: data.tjm,
          quantite: data.quantite,
          total_ht: totals.total_ht,
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
      queryClient.invalidateQueries({ queryKey: ["previsions-achats-services", annee] });
      toast.success("Prévision mise à jour");
      setEditingId(null);
      resetForm();
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("previsions_achats_services")
        .update({ actif: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-achats-services", annee] });
      toast.success("Prévision supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const resetForm = () => {
    setFormData({
      mois: 1,
      fournisseur_id: "",
      prestataire_id: "",
      fournisseur_nom: "",
      activite: "",
      tjm: 0,
      quantite: 1,
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
      prestataire_id: "",
      fournisseur_nom: fournisseur?.raison_sociale || "",
    }));
  };

  const handlePrestataireChange = (prestataireId: string) => {
    const prestataire = prestataires.find(p => p.id === prestataireId);
    setFormData(prev => ({
      ...prev,
      prestataire_id: prestataireId,
      fournisseur_id: "",
      fournisseur_nom: prestataire ? `${prestataire.prenom} ${prestataire.nom}` : "",
    }));
  };

  const handleEdit = (prevision: any) => {
    setEditingId(prevision.id);
    setFormData({
      mois: prevision.mois,
      fournisseur_id: prevision.fournisseur_id || "",
      prestataire_id: prevision.prestataire_id || "",
      fournisseur_nom: prevision.fournisseur_nom || "",
      activite: prevision.activite || "",
      tjm: Number(prevision.tjm) || 0,
      quantite: Number(prevision.quantite) || 1,
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
        <h3 className="text-lg font-semibold">Prévisions d'Achats de Services</h3>
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
              <Label>Fournisseur de services</Label>
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
              <Label>Ou Prestataire</Label>
              <Select
                value={formData.prestataire_id}
                onValueChange={handlePrestataireChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {prestataires.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
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
              <Label>TJM (€)</Label>
              <Input
                type="number"
                value={formData.tjm}
                onChange={(e) => setFormData(prev => ({ ...prev, tjm: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Quantité (jours)</Label>
              <Input
                type="number"
                value={formData.quantite}
                onChange={(e) => setFormData(prev => ({ ...prev, quantite: parseFloat(e.target.value) || 1 }))}
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
              <span className="font-medium">{formatCurrency(formData.tjm * formData.quantite)}</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span className="text-muted-foreground">TTC: </span>
              <span className="font-medium">
                {formatCurrency(formData.tjm * formData.quantite * (1 + formData.taux_tva / 100))}
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
            <TableHead>Fournisseur / Prestataire</TableHead>
            <TableHead>Activité</TableHead>
            <TableHead className="text-right">TJM</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">HT</TableHead>
            <TableHead className="text-right">TTC</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {previsions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                Aucune prévision d'achat de services pour {annee}
              </TableCell>
            </TableRow>
          ) : (
            previsions.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{moisLabels[p.mois - 1]}</TableCell>
                <TableCell>{p.fournisseur_nom || "—"}</TableCell>
                <TableCell>{activites.find(a => a.code === p.activite)?.libelle || p.activite || "—"}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(p.tjm))}</TableCell>
                <TableCell className="text-right">{p.quantite}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(p.total_ht))}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(p.total_ttc))}</TableCell>
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
