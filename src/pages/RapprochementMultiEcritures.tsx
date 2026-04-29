import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, Search, Trash2, Save } from "lucide-react";

interface FactureAchat {
  id: string;
  numero_facture: string;
  date_emission: string;
  destinataire_nom: string | null;
  total_ttc: number;
}

interface LigneRapprochement {
  id: string;
  numero_ligne: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_debit: number;
  transaction_credit: number;
}

interface PaiementMulti {
  id: string;
  facture_id: string;
  ligne_rapprochement_id: string;
  montant_alloue: number;
  notes: string | null;
}

interface SelectedLigne {
  ligne: LigneRapprochement;
  montant_alloue: number;
}

export default function RapprochementMultiEcritures() {
  const [factures, setFactures] = useState<FactureAchat[]>([]);
  const [searchFacture, setSearchFacture] = useState("");
  const [selectedFacture, setSelectedFacture] = useState<FactureAchat | null>(null);
  const [existingPaiements, setExistingPaiements] = useState<PaiementMulti[]>([]);

  const [lignes, setLignes] = useState<LigneRapprochement[]>([]);
  const [searchLigne, setSearchLigne] = useState("");
  const [selectedLignes, setSelectedLignes] = useState<Map<string, SelectedLigne>>(new Map());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Charger toutes les factures d'achat (paginé)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const all: FactureAchat[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("factures")
          .select("id, numero_facture, date_emission, destinataire_nom, total_ttc")
          .like("type_facture", "ACHATS%")
          .order("date_emission", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) {
          toast({ title: "Erreur", description: error.message, variant: "destructive" });
          break;
        }
        if (!data || data.length === 0) break;
        all.push(...(data as FactureAchat[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      setFactures(all);
      setLoading(false);
    })();
  }, []);

  // Charger toutes les lignes de rapprochement
  useEffect(() => {
    (async () => {
      const all: LigneRapprochement[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("rapprochements_bancaires")
          .select("id, numero_ligne, transaction_date, transaction_libelle, transaction_debit, transaction_credit")
          .order("transaction_date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) {
          toast({ title: "Erreur", description: error.message, variant: "destructive" });
          break;
        }
        if (!data || data.length === 0) break;
        all.push(...(data as LigneRapprochement[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      setLignes(all);
    })();
  }, []);

  // Quand on sélectionne une facture, charger ses paiements multi existants
  useEffect(() => {
    if (!selectedFacture) {
      setExistingPaiements([]);
      setSelectedLignes(new Map());
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("paiements_factures_multi")
        .select("*")
        .eq("facture_id", selectedFacture.id);
      if (error) {
        toast({ title: "Erreur chargement paiements", description: error.message, variant: "destructive" });
        return;
      }
      setExistingPaiements((data as PaiementMulti[]) || []);
      // pré-remplir selectedLignes avec l'existant
      const map = new Map<string, SelectedLigne>();
      (data as PaiementMulti[]).forEach((p) => {
        const ligne = lignes.find((l) => l.id === p.ligne_rapprochement_id);
        if (ligne) {
          map.set(ligne.id, { ligne, montant_alloue: Number(p.montant_alloue) });
        }
      });
      setSelectedLignes(map);
    })();
  }, [selectedFacture, lignes]);

  const filteredFactures = useMemo(() => {
    if (!searchFacture) return factures.slice(0, 50);
    const q = searchFacture.toLowerCase();
    return factures
      .filter(
        (f) =>
          f.numero_facture?.toLowerCase().includes(q) ||
          f.destinataire_nom?.toLowerCase().includes(q) ||
          String(f.total_ttc).includes(q)
      )
      .slice(0, 50);
  }, [factures, searchFacture]);

  const filteredLignes = useMemo(() => {
    if (!searchLigne) return lignes.slice(0, 100);
    const q = searchLigne.toLowerCase();
    return lignes
      .filter(
        (l) =>
          l.numero_ligne?.toLowerCase().includes(q) ||
          l.transaction_libelle?.toLowerCase().includes(q) ||
          String(l.transaction_debit).includes(q) ||
          String(l.transaction_credit).includes(q)
      )
      .slice(0, 100);
  }, [lignes, searchLigne]);

  const totalAlloue = useMemo(() => {
    return Array.from(selectedLignes.values()).reduce((sum, s) => sum + (Number(s.montant_alloue) || 0), 0);
  }, [selectedLignes]);

  const totalTTC = selectedFacture ? Number(selectedFacture.total_ttc) : 0;
  const reste = totalTTC - totalAlloue;
  const statutFacture =
    Math.abs(reste) <= 0.01 ? "PAYEE" : totalAlloue > totalTTC ? "ERREUR" : totalAlloue > 0 ? "PARTIELLEMENT_PAYEE" : "NON_PAYEE";

  const toggleLigne = (ligne: LigneRapprochement) => {
    const next = new Map(selectedLignes);
    if (next.has(ligne.id)) {
      next.delete(ligne.id);
    } else {
      const montantDefaut = Number(ligne.transaction_debit) || Number(ligne.transaction_credit) || 0;
      next.set(ligne.id, { ligne, montant_alloue: montantDefaut });
    }
    setSelectedLignes(next);
  };

  const updateMontant = (ligneId: string, montant: number) => {
    const next = new Map(selectedLignes);
    const cur = next.get(ligneId);
    if (cur) {
      next.set(ligneId, { ...cur, montant_alloue: montant });
      setSelectedLignes(next);
    }
  };

  const handleSave = async () => {
    if (!selectedFacture) return;
    if (statutFacture === "ERREUR") {
      toast({
        title: "Montant invalide",
        description: `La somme allouée (${totalAlloue.toFixed(2)} €) dépasse le TTC de la facture (${totalTTC.toFixed(2)} €).`,
        variant: "destructive",
      });
      return;
    }
    if (selectedLignes.size === 0) {
      toast({ title: "Aucune écriture sélectionnée", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Supprimer tous les paiements existants pour cette facture, puis recréer
      const { error: delError } = await supabase
        .from("paiements_factures_multi")
        .delete()
        .eq("facture_id", selectedFacture.id);
      if (delError) throw delError;

      const rows = Array.from(selectedLignes.values()).map((s) => ({
        facture_id: selectedFacture.id,
        ligne_rapprochement_id: s.ligne.id,
        montant_alloue: s.montant_alloue,
      }));
      const { error: insError } = await supabase.from("paiements_factures_multi").insert(rows);
      if (insError) throw insError;

      toast({
        title: "Rapprochement enregistré",
        description: `${rows.length} écriture(s) liée(s). Statut : ${statutFacture}`,
      });

      // Recharger
      const { data } = await supabase
        .from("paiements_factures_multi")
        .select("*")
        .eq("facture_id", selectedFacture.id);
      setExistingPaiements((data as PaiementMulti[]) || []);
    } catch (e: any) {
      toast({ title: "Erreur enregistrement", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!selectedFacture) return;
    if (!confirm("Supprimer tous les rapprochements multi-écritures de cette facture ?")) return;
    const { error } = await supabase
      .from("paiements_factures_multi")
      .delete()
      .eq("facture_id", selectedFacture.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setSelectedLignes(new Map());
    setExistingPaiements([]);
    toast({ title: "Rapprochements supprimés" });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Rapprochement multi-écritures</h1>
        <p className="text-muted-foreground mt-1">
          Lier une facture d'achat à plusieurs lignes bancaires (paiements échelonnés / acomptes)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sélection facture */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Sélectionner la facture d'achat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="N° facture, fournisseur, montant..."
                value={searchFacture}
                onChange={(e) => setSearchFacture(e.target.value)}
                className="pl-9"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="max-h-80 overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead className="text-right">TTC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFactures.map((f) => (
                      <TableRow
                        key={f.id}
                        className={`cursor-pointer ${selectedFacture?.id === f.id ? "bg-primary/10" : ""}`}
                        onClick={() => setSelectedFacture(f)}
                      >
                        <TableCell className="font-mono text-xs">{f.numero_facture}</TableCell>
                        <TableCell className="text-xs">{f.date_emission}</TableCell>
                        <TableCell className="text-xs">{f.destinataire_nom || "-"}</TableCell>
                        <TableCell className="text-right text-xs">{Number(f.total_ttc).toFixed(2)} €</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedFacture && (
              <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-sm">
                <div className="font-semibold">{selectedFacture.numero_facture}</div>
                <div className="text-muted-foreground">{selectedFacture.destinataire_nom}</div>
                <div className="flex justify-between mt-2">
                  <span>TTC :</span>
                  <span className="font-mono font-semibold">{totalTTC.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Alloué :</span>
                  <span className="font-mono">{totalAlloue.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Reste :</span>
                  <span className={`font-mono ${reste < -0.01 ? "text-destructive" : ""}`}>
                    {reste.toFixed(2)} €
                  </span>
                </div>
                <div className="pt-2">
                  <Badge
                    variant={
                      statutFacture === "PAYEE"
                        ? "default"
                        : statutFacture === "ERREUR"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {statutFacture}
                  </Badge>
                  {existingPaiements.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {existingPaiements.length} écriture(s) déjà liée(s)
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sélection écritures */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Sélectionner les écritures bancaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Libellé, n° ligne, montant..."
                value={searchLigne}
                onChange={(e) => setSearchLigne(e.target.value)}
                className="pl-9"
                disabled={!selectedFacture}
              />
            </div>
            <div className="max-h-80 overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Débit</TableHead>
                    <TableHead className="text-right">Crédit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLignes.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLignes.has(l.id)}
                          onCheckedChange={() => toggleLigne(l)}
                          disabled={!selectedFacture}
                        />
                      </TableCell>
                      <TableCell className="text-xs">{l.transaction_date}</TableCell>
                      <TableCell className="text-xs truncate max-w-[180px]" title={l.transaction_libelle}>
                        {l.transaction_libelle}
                      </TableCell>
                      <TableCell className="text-right text-xs">{Number(l.transaction_debit).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs">{Number(l.transaction_credit).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Récap des écritures sélectionnées + montants alloués */}
      {selectedFacture && selectedLignes.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Ajuster les montants alloués</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° ligne</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Montant écriture</TableHead>
                  <TableHead className="text-right">Montant alloué (€)</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(selectedLignes.values()).map((s) => {
                  const montantEcriture = Number(s.ligne.transaction_debit) || Number(s.ligne.transaction_credit) || 0;
                  return (
                    <TableRow key={s.ligne.id}>
                      <TableCell className="font-mono text-xs">{s.ligne.numero_ligne}</TableCell>
                      <TableCell className="text-xs">{s.ligne.transaction_date}</TableCell>
                      <TableCell className="text-xs truncate max-w-[300px]">{s.ligne.transaction_libelle}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{montantEcriture.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={s.montant_alloue}
                          onChange={(e) => updateMontant(s.ligne.id, parseFloat(e.target.value) || 0)}
                          className="w-32 ml-auto text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => toggleLigne(s.ligne)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="space-y-1 text-sm">
                <div>
                  Total alloué : <span className="font-mono font-semibold">{totalAlloue.toFixed(2)} €</span> /{" "}
                  <span className="font-mono">{totalTTC.toFixed(2)} €</span>
                </div>
                <Badge
                  variant={
                    statutFacture === "PAYEE"
                      ? "default"
                      : statutFacture === "ERREUR"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  Statut résultant : {statutFacture}
                </Badge>
              </div>
              <div className="flex gap-2">
                {existingPaiements.length > 0 && (
                  <Button variant="outline" onClick={handleDeleteAll} disabled={saving}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer tout
                  </Button>
                )}
                <Button onClick={handleSave} disabled={saving || statutFacture === "ERREUR"}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
