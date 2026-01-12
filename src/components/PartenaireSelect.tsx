import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, User, Briefcase, Landmark, Package, Settings, Users } from "lucide-react";

export const PARTENAIRE_TYPES = [
  { value: "CLIENT", label: "Clients", icon: Building2 },
  { value: "PRESTATAIRE", label: "Prestataires", icon: Briefcase },
  { value: "SALARIE", label: "Salariés", icon: User },
  { value: "BANQUE", label: "Banques", icon: Landmark },
  { value: "FOURNISSEUR_GENERAL", label: "Fournisseurs généraux", icon: Package },
  { value: "FOURNISSEUR_SERVICES", label: "Fournisseurs de services", icon: Settings },
  { value: "FOURNISSEUR_ETAT_ORGANISME", label: "Fournisseurs État & organismes sociaux", icon: Users },
];

interface PartenaireSelectProps {
  partenaireType: string | null;
  partenaireId: string | null;
  onTypeChange: (type: string | null) => void;
  onIdChange: (id: string | null) => void;
  disabled?: boolean;
}

export function PartenaireSelect({
  partenaireType,
  partenaireId,
  onTypeChange,
  onIdChange,
  disabled = false,
}: PartenaireSelectProps) {
  // Fetch entities based on selected type
  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["partenaire-entities", partenaireType],
    queryFn: async () => {
      if (!partenaireType) return [];

      let result: { id: string; label: string }[] = [];

      switch (partenaireType) {
        case "CLIENT": {
          const { data, error } = await supabase
            .from("clients")
            .select("id, raison_sociale")
            .order("raison_sociale");
          if (error) throw error;
          result = (data || []).map((item) => ({
            id: item.id,
            label: item.raison_sociale,
          }));
          break;
        }
        case "PRESTATAIRE": {
          const { data, error } = await supabase
            .from("prestataires")
            .select("id, nom, prenom")
            .order("nom");
          if (error) throw error;
          result = (data || []).map((item) => ({
            id: item.id,
            label: `${item.nom} ${item.prenom}`,
          }));
          break;
        }
        case "SALARIE": {
          const { data, error } = await supabase
            .from("salaries")
            .select("id, nom, prenom")
            .order("nom");
          if (error) throw error;
          result = (data || []).map((item) => ({
            id: item.id,
            label: `${item.nom} ${item.prenom}`,
          }));
          break;
        }
        case "BANQUE": {
          const { data, error } = await supabase
            .from("banques")
            .select("id, raison_sociale")
            .order("raison_sociale");
          if (error) throw error;
          result = (data || []).map((item) => ({
            id: item.id,
            label: item.raison_sociale,
          }));
          break;
        }
        case "FOURNISSEUR_GENERAL": {
          const { data, error } = await supabase
            .from("fournisseurs_generaux")
            .select("id, raison_sociale")
            .order("raison_sociale");
          if (error) throw error;
          result = (data || []).map((item) => ({
            id: item.id,
            label: item.raison_sociale,
          }));
          break;
        }
        case "FOURNISSEUR_SERVICES": {
          const { data, error } = await supabase
            .from("fournisseurs_services")
            .select("id, raison_sociale")
            .order("raison_sociale");
          if (error) throw error;
          result = (data || []).map((item) => ({
            id: item.id,
            label: item.raison_sociale,
          }));
          break;
        }
        case "FOURNISSEUR_ETAT_ORGANISME": {
          const { data, error } = await supabase
            .from("fournisseurs_etat_organismes")
            .select("id, raison_sociale")
            .order("raison_sociale");
          if (error) throw error;
          result = (data || []).map((item) => ({
            id: item.id,
            label: item.raison_sociale,
          }));
          break;
        }
        default:
          return [];
      }

      return result;
    },
    enabled: !!partenaireType,
  });

  // Reset entity when type changes
  useEffect(() => {
    if (partenaireType === null) {
      onIdChange(null);
    }
  }, [partenaireType, onIdChange]);

  const handleTypeChange = (value: string) => {
    if (value === "none") {
      onTypeChange(null);
      onIdChange(null);
    } else {
      onTypeChange(value);
      onIdChange(null); // Reset entity when type changes
    }
  };

  const handleEntityChange = (value: string) => {
    if (value === "none") {
      onIdChange(null);
    } else {
      onIdChange(value);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Type de partenaire</Label>
        <Select
          value={partenaireType || "none"}
          onValueChange={handleTypeChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Aucun --</SelectItem>
            {PARTENAIRE_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <SelectItem key={type.value} value={type.value}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {type.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Partenaire</Label>
        <Select
          value={partenaireId || "none"}
          onValueChange={handleEntityChange}
          disabled={disabled || !partenaireType || isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "Chargement..." : "Sélectionner"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Aucun --</SelectItem>
            {entities.map((entity: { id: string; label: string }) => (
              <SelectItem key={entity.id} value={entity.id}>
                {entity.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Helper function to get partenaire label for display
export function usePartenaireLabel(partenaireType: string | null, partenaireId: string | null) {
  const { data: label } = useQuery({
    queryKey: ["partenaire-label", partenaireType, partenaireId],
    queryFn: async (): Promise<string | null> => {
      if (!partenaireType || !partenaireId) return null;

      switch (partenaireType) {
        case "CLIENT": {
          const { data, error } = await supabase
            .from("clients")
            .select("raison_sociale")
            .eq("id", partenaireId)
            .single();
          if (error) return null;
          return data?.raison_sociale || null;
        }
        case "PRESTATAIRE": {
          const { data, error } = await supabase
            .from("prestataires")
            .select("nom, prenom")
            .eq("id", partenaireId)
            .single();
          if (error) return null;
          return data ? `${data.nom} ${data.prenom}` : null;
        }
        case "SALARIE": {
          const { data, error } = await supabase
            .from("salaries")
            .select("nom, prenom")
            .eq("id", partenaireId)
            .single();
          if (error) return null;
          return data ? `${data.nom} ${data.prenom}` : null;
        }
        case "BANQUE": {
          const { data, error } = await supabase
            .from("banques")
            .select("raison_sociale")
            .eq("id", partenaireId)
            .single();
          if (error) return null;
          return data?.raison_sociale || null;
        }
        case "FOURNISSEUR_GENERAL": {
          const { data, error } = await supabase
            .from("fournisseurs_generaux")
            .select("raison_sociale")
            .eq("id", partenaireId)
            .single();
          if (error) return null;
          return data?.raison_sociale || null;
        }
        case "FOURNISSEUR_SERVICES": {
          const { data, error } = await supabase
            .from("fournisseurs_services")
            .select("raison_sociale")
            .eq("id", partenaireId)
            .single();
          if (error) return null;
          return data?.raison_sociale || null;
        }
        case "FOURNISSEUR_ETAT_ORGANISME": {
          const { data, error } = await supabase
            .from("fournisseurs_etat_organismes")
            .select("raison_sociale")
            .eq("id", partenaireId)
            .single();
          if (error) return null;
          return data?.raison_sociale || null;
        }
        default:
          return null;
      }
    },
    enabled: !!partenaireType && !!partenaireId,
  });

  return label;
}

export function getPartenaireTypeLabel(type: string | null): string {
  if (!type) return "-";
  const found = PARTENAIRE_TYPES.find(t => t.value === type);
  return found ? found.label : type;
}
