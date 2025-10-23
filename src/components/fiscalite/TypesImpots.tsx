import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as LucideIcons from "lucide-react";

interface TypeImpot {
  id: string;
  code: string;
  libelle: string;
  description: string;
  periodicite: string;
  couleur: string;
  icone: string;
}

export default function TypesImpots() {
  const [types, setTypes] = useState<TypeImpot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("types_impots")
        .select("*")
        .eq("is_active", true)
        .order("ordre", { ascending: true });

      if (error) throw error;
      setTypes(data);
    } catch (error) {
      console.error("Erreur lors du chargement des types d'impôts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName.split("-").map((w: string) => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join("")];
    return IconComponent || LucideIcons.FileText;
  };

  const getPeriodiciteLabel = (periodicite: string) => {
    switch (periodicite) {
      case "MENSUEL": return "Mensuel";
      case "TRIMESTRIEL": return "Trimestriel";
      case "ANNUEL": return "Annuel";
      case "PONCTUEL": return "Ponctuel";
      default: return periodicite;
    }
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Types d'impôts et taxes</h2>
        <p className="text-muted-foreground mt-1">
          Guide des différentes obligations fiscales de votre SASU
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {types.map((type) => {
          const Icon = getIcon(type.icone);
          
          return (
            <Card key={type.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${type.couleur}20` }}
                  >
                    <Icon 
                      className="h-6 w-6" 
                      style={{ color: type.couleur }}
                    />
                  </div>
                  <Badge variant="secondary">
                    {getPeriodiciteLabel(type.periodicite)}
                  </Badge>
                </div>
                <CardTitle className="mt-4">{type.libelle}</CardTitle>
                <CardDescription>{type.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {type.code === "IS" && (
                    <>
                      <div>
                        <strong>Taux:</strong> 15% jusqu'à 42 500€, puis 25%
                      </div>
                      <div>
                        <strong>Déclaration:</strong> Dans les 3 mois suivant la clôture
                      </div>
                      <div>
                        <strong>Acomptes:</strong> 4 acomptes trimestriels si IS &gt; 3 000€
                      </div>
                    </>
                  )}
                  
                  {type.code === "TVA" && (
                    <>
                      <div>
                        <strong>Régime normal:</strong> Déclaration mensuelle CA3
                      </div>
                      <div>
                        <strong>Mini-réel:</strong> Déclaration annuelle CA12
                      </div>
                      <div>
                        <strong>Date limite:</strong> 24 du mois suivant
                      </div>
                    </>
                  )}

                  {type.code === "COTISATIONS" && (
                    <>
                      <div>
                        <strong>Base:</strong> Rémunération du président
                      </div>
                      <div>
                        <strong>Taux:</strong> ~65-75% du salaire brut
                      </div>
                      <div>
                        <strong>Organisme:</strong> URSSAF
                      </div>
                    </>
                  )}

                  {type.code === "DIVIDENDES" && (
                    <>
                      <div>
                        <strong>PFU:</strong> 30% (17,2% prélèvements + 12,8% IR)
                      </div>
                      <div>
                        <strong>Option:</strong> Barème progressif possible
                      </div>
                      <div>
                        <strong>Versement:</strong> À la distribution
                      </div>
                    </>
                  )}

                  {type.code === "CFE" && (
                    <>
                      <div>
                        <strong>Base:</strong> Valeur locative des locaux
                      </div>
                      <div>
                        <strong>Date:</strong> 15 décembre
                      </div>
                      <div>
                        <strong>Exonération:</strong> 1ère année d'activité
                      </div>
                    </>
                  )}

                  {type.code === "TVS" && (
                    <>
                      <div>
                        <strong>Véhicules:</strong> VP et VU affectés
                      </div>
                      <div>
                        <strong>Barème:</strong> Selon CO2 et âge
                      </div>
                      <div>
                        <strong>Date:</strong> Janvier N+1
                      </div>
                    </>
                  )}

                  {type.code === "TAXE_APPRENTISSAGE" && (
                    <>
                      <div>
                        <strong>Taux:</strong> 0,68% masse salariale
                      </div>
                      <div>
                        <strong>Contribution:</strong> + 1% CPF (+ 11 salariés)
                      </div>
                      <div>
                        <strong>Date:</strong> Via DSN mensuelle
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
