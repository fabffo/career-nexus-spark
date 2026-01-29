import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, RotateCcw, Save, Building2, FileText, Link2 } from "lucide-react";

interface CompanyType {
  id: string;
  code: string;
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  ir_possible: boolean;
  is_possible: boolean;
  tva_option: string;
  display_order: number;
  is_active: boolean;
}

interface TaxCard {
  id: string;
  code: string;
  title: string;
  subtitle: string | null;
  frequency: string;
  organism: string | null;
  icon: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

interface CompanyTypeTaxCard {
  id: string;
  company_type_id: string;
  tax_card_id: string;
  is_active: boolean;
  display_order: number;
}

export default function FiscaliteParametrage() {
  const [companyTypes, setCompanyTypes] = useState<CompanyType[]>([]);
  const [taxCards, setTaxCards] = useState<TaxCard[]>([]);
  const [mappings, setMappings] = useState<CompanyTypeTaxCard[]>([]);
  const [selectedCompanyType, setSelectedCompanyType] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ctResult, tcResult, mapResult] = await Promise.all([
        supabase.from("company_types").select("*").order("display_order"),
        supabase.from("tax_cards").select("*").order("display_order"),
        supabase.from("company_type_tax_cards").select("*")
      ]);

      if (ctResult.error) throw ctResult.error;
      if (tcResult.error) throw tcResult.error;
      if (mapResult.error) throw mapResult.error;

      setCompanyTypes(ctResult.data || []);
      setTaxCards(tcResult.data || []);
      setMappings(mapResult.data || []);

      if (ctResult.data && ctResult.data.length > 0) {
        setSelectedCompanyType(ctResult.data[0].id);
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const toggleTaxCardForCompany = async (taxCardId: string) => {
    if (!selectedCompanyType) return;

    const existingMapping = mappings.find(
      m => m.company_type_id === selectedCompanyType && m.tax_card_id === taxCardId
    );

    try {
      if (existingMapping) {
        // Toggle l'état actif
        const { error } = await supabase
          .from("company_type_tax_cards")
          .update({ is_active: !existingMapping.is_active })
          .eq("id", existingMapping.id);

        if (error) throw error;

        setMappings(prev => prev.map(m => 
          m.id === existingMapping.id 
            ? { ...m, is_active: !m.is_active }
            : m
        ));
      } else {
        // Créer un nouveau mapping
        const { data, error } = await supabase
          .from("company_type_tax_cards")
          .insert({
            company_type_id: selectedCompanyType,
            tax_card_id: taxCardId,
            is_active: true,
            display_order: mappings.filter(m => m.company_type_id === selectedCompanyType).length + 1
          })
          .select()
          .single();

        if (error) throw error;

        setMappings(prev => [...prev, data]);
      }

      toast.success("Mise à jour effectuée");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const updateTaxCard = async (cardId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("tax_cards")
        .update({ [field]: value })
        .eq("id", cardId);

      if (error) throw error;

      setTaxCards(prev => prev.map(c => 
        c.id === cardId ? { ...c, [field]: value } : c
      ));

      toast.success("Carte mise à jour");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const getCardMappingStatus = (taxCardId: string) => {
    const mapping = mappings.find(
      m => m.company_type_id === selectedCompanyType && m.tax_card_id === taxCardId
    );
    return mapping?.is_active ?? false;
  };

  const selectedCompanyTypeData = companyTypes.find(ct => ct.id === selectedCompanyType);

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Paramétrage fiscal</h2>
        <p className="text-muted-foreground mt-1">
          Configurez les obligations fiscales par type de société
        </p>
      </div>

      <Tabs defaultValue="mapping" className="space-y-6">
        <TabsList>
          <TabsTrigger value="mapping" className="gap-2">
            <Link2 className="h-4 w-4" />
            Association
          </TabsTrigger>
          <TabsTrigger value="cards" className="gap-2">
            <FileText className="h-4 w-4" />
            Cartes fiscales
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            Types de sociétés
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapping" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Association Type de société / Obligations</CardTitle>
              <CardDescription>
                Activez ou désactivez les obligations fiscales pour chaque type de société
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Label>Type de société :</Label>
                <Select value={selectedCompanyType} onValueChange={setSelectedCompanyType}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {companyTypes.map(ct => (
                      <SelectItem key={ct.id} value={ct.id}>
                        {ct.code} - {ct.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCompanyTypeData && (
                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                  <strong>{selectedCompanyTypeData.label}</strong>
                  <p className="text-muted-foreground">{selectedCompanyTypeData.description}</p>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                {taxCards.map(card => {
                  const isActive = getCardMappingStatus(card.id);
                  return (
                    <div
                      key={card.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        isActive ? "bg-green-50 border-green-200" : "bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: card.color }}
                        />
                        <div>
                          <span className="font-medium">{card.title}</span>
                          <p className="text-xs text-muted-foreground">{card.frequency}</p>
                        </div>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => toggleTaxCardForCompany(card.id)}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tableau récapitulatif */}
          <Card>
            <CardHeader>
              <CardTitle>Tableau récapitulatif</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Forme</TableHead>
                      <TableHead className="text-center">IR</TableHead>
                      <TableHead className="text-center">IS</TableHead>
                      <TableHead className="text-center">TVA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyTypes.filter(ct => ct.is_active).map(ct => (
                      <TableRow key={ct.id}>
                        <TableCell className="font-medium">{ct.code}</TableCell>
                        <TableCell className="text-center">
                          {ct.ir_possible ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-red-400 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {ct.is_possible ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-red-400 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {ct.tva_option}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des cartes fiscales</CardTitle>
              <CardDescription>
                Modifiez les informations des cartes fiscales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {taxCards.map(card => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: card.color }}
                      />
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs">Titre</Label>
                          <Input
                            value={card.title}
                            onChange={(e) => updateTaxCard(card.id, "title", e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fréquence</Label>
                          <Select
                            value={card.frequency}
                            onValueChange={(v) => updateTaxCard(card.id, "frequency", v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="MENSUEL">Mensuel</SelectItem>
                              <SelectItem value="TRIMESTRIEL">Trimestriel</SelectItem>
                              <SelectItem value="ANNUEL">Annuel</SelectItem>
                              <SelectItem value="PONCTUEL">Ponctuel</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Organisme</Label>
                          <Input
                            value={card.organism || ""}
                            onChange={(e) => updateTaxCard(card.id, "organism", e.target.value)}
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={card.is_active}
                      onCheckedChange={(v) => updateTaxCard(card.id, "is_active", v)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Types de sociétés</CardTitle>
              <CardDescription>
                Aperçu des formes juridiques disponibles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">IR</TableHead>
                      <TableHead className="text-center">IS</TableHead>
                      <TableHead className="text-center">TVA</TableHead>
                      <TableHead className="text-center">Actif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyTypes.map(ct => (
                      <TableRow key={ct.id}>
                        <TableCell className="font-medium">{ct.code}</TableCell>
                        <TableCell>{ct.label}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{ct.description}</TableCell>
                        <TableCell className="text-center">
                          {ct.ir_possible ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-red-400 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {ct.is_possible ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-red-400 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{ct.tva_option}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {ct.is_active ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-red-400 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
