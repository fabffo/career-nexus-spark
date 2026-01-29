import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import CompanyTypeSelector from "./CompanyTypeSelector";
import TaxCardDisplay from "./TaxCardDisplay";

interface TaxCardField {
  id: string;
  label: string;
  value: string;
  display_order: number;
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
  fields?: TaxCardField[];
}

export default function TypesImpotsNew() {
  const [selectedCompanyType, setSelectedCompanyType] = useState<string>("SASU");
  const [taxCards, setTaxCards] = useState<TaxCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedCompanyType) {
      loadTaxCards();
    }
  }, [selectedCompanyType]);

  const loadTaxCards = async () => {
    setLoading(true);
    try {
      // Récupérer le type de société
      const { data: companyType, error: ctError } = await supabase
        .from("company_types")
        .select("id")
        .eq("code", selectedCompanyType)
        .maybeSingle();

      if (ctError) throw ctError;
      if (!companyType) {
        setTaxCards([]);
        return;
      }

      // Récupérer les cartes fiscales associées
      const { data: mappings, error: mapError } = await supabase
        .from("company_type_tax_cards")
        .select(`
          display_order,
          is_active,
          tax_card_id
        `)
        .eq("company_type_id", companyType.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (mapError) throw mapError;

      if (!mappings || mappings.length === 0) {
        setTaxCards([]);
        return;
      }

      // Récupérer les détails des cartes fiscales
      const taxCardIds = mappings.map(m => m.tax_card_id);
      const { data: cards, error: cardsError } = await supabase
        .from("tax_cards")
        .select("*")
        .in("id", taxCardIds)
        .eq("is_active", true);

      if (cardsError) throw cardsError;

      // Récupérer les champs des cartes
      const { data: fields, error: fieldsError } = await supabase
        .from("tax_card_fields")
        .select("*")
        .in("tax_card_id", taxCardIds)
        .order("display_order", { ascending: true });

      if (fieldsError) throw fieldsError;

      // Assembler les données
      const cardsWithFields = cards?.map(card => ({
        ...card,
        fields: fields?.filter(f => f.tax_card_id === card.id) || []
      })) || [];

      // Trier selon l'ordre du mapping
      const sortedCards = cardsWithFields.sort((a, b) => {
        const orderA = mappings.find(m => m.tax_card_id === a.id)?.display_order || 0;
        const orderB = mappings.find(m => m.tax_card_id === b.id)?.display_order || 0;
        return orderA - orderB;
      });

      setTaxCards(sortedCards);
    } catch (error) {
      console.error("Erreur lors du chargement des cartes fiscales:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Obligations fiscales par type de société</h2>
        <p className="text-muted-foreground mt-1">
          Sélectionnez votre forme juridique pour voir les obligations fiscales applicables
        </p>
      </div>

      <CompanyTypeSelector
        value={selectedCompanyType}
        onChange={setSelectedCompanyType}
      />

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : taxCards.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {taxCards.map((card) => (
            <TaxCardDisplay key={card.id} taxCard={card} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Aucune obligation fiscale configurée pour ce type de société
        </div>
      )}

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Les informations présentées sont indicatives et doivent être validées avec un expert-comptable.
        </AlertDescription>
      </Alert>
    </div>
  );
}
