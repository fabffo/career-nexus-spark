import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Copy, Eye, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Tva {
  id: string;
  taux: number;
  libelle: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface TypeMission {
  id: string;
  code: string;
  libelle: string;
  is_active?: boolean;
  ordre?: number;
  created_at?: string;
  updated_at?: string;
}

interface TypeIntervenant {
  id: string;
  code: string;
  libelle: string;
  is_active?: boolean;
  ordre?: number;
  created_at?: string;
  updated_at?: string;
}

export default function Parametres() {
  const [tvaList, setTvaList] = useState<Tva[]>([]);
  const [typeMissionList, setTypeMissionList] = useState<TypeMission[]>([]);
  const [typeIntervenantList, setTypeIntervenantList] = useState<TypeIntervenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [tvaDialog, setTvaDialog] = useState({ open: false, mode: 'create' as 'create' | 'edit' | 'view', item: null as Tva | null });
  const [typeMissionDialog, setTypeMissionDialog] = useState({ open: false, mode: 'create' as 'create' | 'edit' | 'view', item: null as TypeMission | null });
  const [typeIntervenantDialog, setTypeIntervenantDialog] = useState({ open: false, mode: 'create' as 'create' | 'edit' | 'view', item: null as TypeIntervenant | null });

  // Form states
  const [tvaForm, setTvaForm] = useState({ taux: 20, libelle: '', is_default: false });
  const [typeMissionForm, setTypeMissionForm] = useState({ code: '', libelle: '', is_active: true, ordre: 0 });
  const [typeIntervenantForm, setTypeIntervenantForm] = useState({ code: '', libelle: '', is_active: true, ordre: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load TVA
      const { data: tvaData, error: tvaError } = await supabase
        .from('tva')
        .select('*')
        .order('taux', { ascending: true });
      
      if (tvaError) throw tvaError;
      setTvaList(tvaData || []);

      // Load Type Mission - using type assertion to handle missing tables
      const { data: missionData, error: missionError } = await supabase
        .from('param_type_mission' as any)
        .select('*')
        .order('ordre', { ascending: true });
      
      if (missionError) {
        console.warn('Table param_type_mission not found yet:', missionError);
        setTypeMissionList([]);
      } else {
        setTypeMissionList((missionData as any) || []);
      }

      // Load Type Intervenant - using type assertion to handle missing tables
      const { data: intervenantData, error: intervenantError } = await supabase
        .from('param_type_intervenant' as any)
        .select('*')
        .order('ordre', { ascending: true });
      
      if (intervenantError) {
        console.warn('Table param_type_intervenant not found yet:', intervenantError);
        setTypeIntervenantList([]);
      } else {
        setTypeIntervenantList((intervenantData as any) || []);
      }

    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // TVA Functions
  const handleTvaSubmit = async () => {
    try {
      if (tvaDialog.mode === 'view') return;

      if (tvaDialog.mode === 'edit' && tvaDialog.item) {
        const { error } = await supabase
          .from('tva')
          .update(tvaForm)
          .eq('id', tvaDialog.item.id);
        
        if (error) throw error;
        toast({ title: "TVA modifiée avec succès" });
      } else {
        const { error } = await supabase
          .from('tva')
          .insert([tvaForm]);
        
        if (error) throw error;
        toast({ title: "TVA créée avec succès" });
      }

      setTvaDialog({ open: false, mode: 'create', item: null });
      setTvaForm({ taux: 20, libelle: '', is_default: false });
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  const handleTvaDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette TVA ?')) return;
    
    try {
      const { error } = await supabase
        .from('tva')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "TVA supprimée avec succès" });
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer cette TVA",
        variant: "destructive",
      });
    }
  };

  const openTvaDialog = (mode: 'create' | 'edit' | 'view' | 'copy', item?: Tva) => {
    if (item) {
      setTvaForm({
        taux: item.taux,
        libelle: mode === 'copy' ? `${item.libelle} (copie)` : item.libelle,
        is_default: mode === 'copy' ? false : item.is_default || false,
      });
    } else {
      setTvaForm({ taux: 20, libelle: '', is_default: false });
    }
    setTvaDialog({ 
      open: true, 
      mode: mode === 'copy' ? 'create' : mode, 
      item: mode === 'copy' ? null : item || null 
    });
  };

  // Type Mission Functions
  const handleTypeMissionSubmit = async () => {
    try {
      if (typeMissionDialog.mode === 'view') return;

      if (typeMissionDialog.mode === 'edit' && typeMissionDialog.item) {
        const { error } = await supabase
          .from('param_type_mission' as any)
          .update(typeMissionForm)
          .eq('id', typeMissionDialog.item.id);
        
        if (error) throw error;
        toast({ title: "Type de mission modifié avec succès" });
      } else {
        const { error } = await supabase
          .from('param_type_mission' as any)
          .insert([typeMissionForm]);
        
        if (error) throw error;
        toast({ title: "Type de mission créé avec succès" });
      }

      setTypeMissionDialog({ open: false, mode: 'create', item: null });
      setTypeMissionForm({ code: '', libelle: '', is_active: true, ordre: 0 });
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  const handleTypeMissionDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce type de mission ?')) return;
    
    try {
      const { error } = await supabase
        .from('param_type_mission' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Type de mission supprimé avec succès" });
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer ce type de mission",
        variant: "destructive",
      });
    }
  };

  const openTypeMissionDialog = (mode: 'create' | 'edit' | 'view' | 'copy', item?: TypeMission) => {
    if (item) {
      setTypeMissionForm({
        code: mode === 'copy' ? `${item.code}_COPIE` : item.code,
        libelle: mode === 'copy' ? `${item.libelle} (copie)` : item.libelle,
        is_active: item.is_active !== undefined ? item.is_active : true,
        ordre: item.ordre || 0,
      });
    } else {
      setTypeMissionForm({ code: '', libelle: '', is_active: true, ordre: 0 });
    }
    setTypeMissionDialog({ 
      open: true, 
      mode: mode === 'copy' ? 'create' : mode, 
      item: mode === 'copy' ? null : item || null 
    });
  };

  // Type Intervenant Functions
  const handleTypeIntervenantSubmit = async () => {
    try {
      if (typeIntervenantDialog.mode === 'view') return;

      if (typeIntervenantDialog.mode === 'edit' && typeIntervenantDialog.item) {
        const { error } = await supabase
          .from('param_type_intervenant' as any)
          .update(typeIntervenantForm)
          .eq('id', typeIntervenantDialog.item.id);
        
        if (error) throw error;
        toast({ title: "Type d'intervenant modifié avec succès" });
      } else {
        const { error } = await supabase
          .from('param_type_intervenant' as any)
          .insert([typeIntervenantForm]);
        
        if (error) throw error;
        toast({ title: "Type d'intervenant créé avec succès" });
      }

      setTypeIntervenantDialog({ open: false, mode: 'create', item: null });
      setTypeIntervenantForm({ code: '', libelle: '', is_active: true, ordre: 0 });
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  const handleTypeIntervenantDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce type d'intervenant ?")) return;
    
    try {
      const { error } = await supabase
        .from('param_type_intervenant' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Type d'intervenant supprimé avec succès" });
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer ce type d'intervenant",
        variant: "destructive",
      });
    }
  };

  const openTypeIntervenantDialog = (mode: 'create' | 'edit' | 'view' | 'copy', item?: TypeIntervenant) => {
    if (item) {
      setTypeIntervenantForm({
        code: mode === 'copy' ? `${item.code}_COPIE` : item.code,
        libelle: mode === 'copy' ? `${item.libelle} (copie)` : item.libelle,
        is_active: item.is_active !== undefined ? item.is_active : true,
        ordre: item.ordre || 0,
      });
    } else {
      setTypeIntervenantForm({ code: '', libelle: '', is_active: true, ordre: 0 });
    }
    setTypeIntervenantDialog({ 
      open: true, 
      mode: mode === 'copy' ? 'create' : mode, 
      item: mode === 'copy' ? null : item || null 
    });
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Paramètres</h1>

        <Tabs defaultValue="tva" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tva">TVA</TabsTrigger>
            <TabsTrigger value="type-mission">Types de Mission</TabsTrigger>
            <TabsTrigger value="type-intervenant">Types d'Intervenant</TabsTrigger>
          </TabsList>

          {/* TVA Tab */}
          <TabsContent value="tva">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Gestion des TVA</CardTitle>
                <Button onClick={() => openTvaDialog('create')}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter une TVA
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Taux (%)</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Par défaut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tvaList.map((tva) => (
                      <TableRow key={tva.id}>
                        <TableCell className="font-medium">{tva.taux}%</TableCell>
                        <TableCell>{tva.libelle}</TableCell>
                        <TableCell>
                          {tva.is_default ? (
                            <span className="text-green-600">✓</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTvaDialog('view', tva)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTvaDialog('edit', tva)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTvaDialog('copy', tva)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTvaDelete(tva.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Type Mission Tab */}
          <TabsContent value="type-mission">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Gestion des Types de Mission</CardTitle>
                <Button onClick={() => openTypeMissionDialog('create')}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter un type
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Ordre</TableHead>
                      <TableHead>Actif</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeMissionList.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-medium">{type.code}</TableCell>
                        <TableCell>{type.libelle}</TableCell>
                        <TableCell>{type.ordre}</TableCell>
                        <TableCell>
                          {type.is_active ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTypeMissionDialog('view', type)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTypeMissionDialog('edit', type)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTypeMissionDialog('copy', type)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTypeMissionDelete(type.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Type Intervenant Tab */}
          <TabsContent value="type-intervenant">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Gestion des Types d'Intervenant</CardTitle>
                <Button onClick={() => openTypeIntervenantDialog('create')}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter un type
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Ordre</TableHead>
                      <TableHead>Actif</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeIntervenantList.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-medium">{type.code}</TableCell>
                        <TableCell>{type.libelle}</TableCell>
                        <TableCell>{type.ordre}</TableCell>
                        <TableCell>
                          {type.is_active ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTypeIntervenantDialog('view', type)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTypeIntervenantDialog('edit', type)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTypeIntervenantDialog('copy', type)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTypeIntervenantDelete(type.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* TVA Dialog */}
        <Dialog open={tvaDialog.open} onOpenChange={(open) => setTvaDialog({ ...tvaDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {tvaDialog.mode === 'create' && 'Créer une TVA'}
                {tvaDialog.mode === 'edit' && 'Modifier la TVA'}
                {tvaDialog.mode === 'view' && 'Détails de la TVA'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="taux">Taux (%)</Label>
                <Input
                  id="taux"
                  type="number"
                  value={tvaForm.taux}
                  onChange={(e) => setTvaForm({ ...tvaForm, taux: parseFloat(e.target.value) })}
                  disabled={tvaDialog.mode === 'view'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="libelle">Libellé</Label>
                <Input
                  id="libelle"
                  value={tvaForm.libelle}
                  onChange={(e) => setTvaForm({ ...tvaForm, libelle: e.target.value })}
                  disabled={tvaDialog.mode === 'view'}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={tvaForm.is_default}
                  onCheckedChange={(checked) => setTvaForm({ ...tvaForm, is_default: checked })}
                  disabled={tvaDialog.mode === 'view'}
                />
                <Label htmlFor="is_default">Par défaut</Label>
              </div>
            </div>
            <DialogFooter>
              {tvaDialog.mode !== 'view' && (
                <Button onClick={handleTvaSubmit}>
                  {tvaDialog.mode === 'edit' ? 'Modifier' : 'Créer'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Type Mission Dialog */}
        <Dialog open={typeMissionDialog.open} onOpenChange={(open) => setTypeMissionDialog({ ...typeMissionDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {typeMissionDialog.mode === 'create' && 'Créer un type de mission'}
                {typeMissionDialog.mode === 'edit' && 'Modifier le type de mission'}
                {typeMissionDialog.mode === 'view' && 'Détails du type de mission'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={typeMissionForm.code}
                  onChange={(e) => setTypeMissionForm({ ...typeMissionForm, code: e.target.value })}
                  disabled={typeMissionDialog.mode === 'view'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="libelle">Libellé</Label>
                <Input
                  id="libelle"
                  value={typeMissionForm.libelle}
                  onChange={(e) => setTypeMissionForm({ ...typeMissionForm, libelle: e.target.value })}
                  disabled={typeMissionDialog.mode === 'view'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ordre">Ordre</Label>
                <Input
                  id="ordre"
                  type="number"
                  value={typeMissionForm.ordre}
                  onChange={(e) => setTypeMissionForm({ ...typeMissionForm, ordre: parseInt(e.target.value) })}
                  disabled={typeMissionDialog.mode === 'view'}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={typeMissionForm.is_active}
                  onCheckedChange={(checked) => setTypeMissionForm({ ...typeMissionForm, is_active: checked })}
                  disabled={typeMissionDialog.mode === 'view'}
                />
                <Label htmlFor="is_active">Actif</Label>
              </div>
            </div>
            <DialogFooter>
              {typeMissionDialog.mode !== 'view' && (
                <Button onClick={handleTypeMissionSubmit}>
                  {typeMissionDialog.mode === 'edit' ? 'Modifier' : 'Créer'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Type Intervenant Dialog */}
        <Dialog open={typeIntervenantDialog.open} onOpenChange={(open) => setTypeIntervenantDialog({ ...typeIntervenantDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {typeIntervenantDialog.mode === 'create' && "Créer un type d'intervenant"}
                {typeIntervenantDialog.mode === 'edit' && "Modifier le type d'intervenant"}
                {typeIntervenantDialog.mode === 'view' && "Détails du type d'intervenant"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={typeIntervenantForm.code}
                  onChange={(e) => setTypeIntervenantForm({ ...typeIntervenantForm, code: e.target.value })}
                  disabled={typeIntervenantDialog.mode === 'view'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="libelle">Libellé</Label>
                <Input
                  id="libelle"
                  value={typeIntervenantForm.libelle}
                  onChange={(e) => setTypeIntervenantForm({ ...typeIntervenantForm, libelle: e.target.value })}
                  disabled={typeIntervenantDialog.mode === 'view'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ordre">Ordre</Label>
                <Input
                  id="ordre"
                  type="number"
                  value={typeIntervenantForm.ordre}
                  onChange={(e) => setTypeIntervenantForm({ ...typeIntervenantForm, ordre: parseInt(e.target.value) })}
                  disabled={typeIntervenantDialog.mode === 'view'}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={typeIntervenantForm.is_active}
                  onCheckedChange={(checked) => setTypeIntervenantForm({ ...typeIntervenantForm, is_active: checked })}
                  disabled={typeIntervenantDialog.mode === 'view'}
                />
                <Label htmlFor="is_active">Actif</Label>
              </div>
            </div>
            <DialogFooter>
              {typeIntervenantDialog.mode !== 'view' && (
                <Button onClick={handleTypeIntervenantSubmit}>
                  {typeIntervenantDialog.mode === 'edit' ? 'Modifier' : 'Créer'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}