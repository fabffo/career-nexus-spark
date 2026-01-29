import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, X } from "lucide-react";

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
}

interface CompanyTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CompanyTypeSelector({ value, onChange }: CompanyTypeSelectorProps) {
  const [companyTypes, setCompanyTypes] = useState<CompanyType[]>([]);
  const [selectedType, setSelectedType] = useState<CompanyType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanyTypes();
  }, []);

  useEffect(() => {
    if (value && companyTypes.length > 0) {
      const found = companyTypes.find(ct => ct.code === value);
      setSelectedType(found || null);
    }
  }, [value, companyTypes]);

  const loadCompanyTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("company_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setCompanyTypes(data || []);
      
      // Sélectionner SASU par défaut
      if (!value && data && data.length > 0) {
        const sasu = data.find(ct => ct.code === 'SASU');
        if (sasu) {
          onChange(sasu.code);
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement des types de sociétés:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="h-10 bg-muted animate-pulse rounded-md" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Sélectionner un type de société" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            {companyTypes.map((type) => (
              <SelectItem key={type.id} value={type.code}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{type.code}</span>
                  <span className="text-muted-foreground">- {type.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedType && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div>
            <h4 className="font-semibold">{selectedType.label}</h4>
            <p className="text-sm text-muted-foreground">{selectedType.description}</p>
          </div>
          
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">IR:</span>
              {selectedType.ir_possible ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Check className="h-3 w-3 mr-1" /> Possible
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <X className="h-3 w-3 mr-1" /> Non
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">IS:</span>
              {selectedType.is_possible ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Check className="h-3 w-3 mr-1" /> Possible
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <X className="h-3 w-3 mr-1" /> Non
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">TVA:</span>
              <Badge variant="secondary">{selectedType.tva_option}</Badge>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {selectedType.pros && selectedType.pros.length > 0 && (
              <div>
                <span className="text-sm font-medium text-green-700">Avantages</span>
                <ul className="mt-1 space-y-1">
                  {selectedType.pros.map((pro, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedType.cons && selectedType.cons.length > 0 && (
              <div>
                <span className="text-sm font-medium text-red-700">Inconvénients</span>
                <ul className="mt-1 space-y-1">
                  {selectedType.cons.map((con, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
