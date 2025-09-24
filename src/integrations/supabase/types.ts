export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      candidats: {
        Row: {
          created_at: string | null
          cv_url: string | null
          email: string | null
          id: string
          nom: string
          prenom: string
          recommandation_url: string | null
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cv_url?: string | null
          email?: string | null
          id?: string
          nom: string
          prenom: string
          recommandation_url?: string | null
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cv_url?: string | null
          email?: string | null
          id?: string
          nom?: string
          prenom?: string
          recommandation_url?: string | null
          telephone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          adresse: string | null
          created_at: string | null
          email: string | null
          id: string
          raison_sociale: string
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          raison_sociale: string
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          raison_sociale?: string
          telephone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      matchings: {
        Row: {
          analysis: string
          candidat_id: string | null
          created_at: string
          created_by: string | null
          cv_content: string | null
          id: string
          match: boolean
          poste_id: string | null
          score: number
          strengths: string[] | null
          weaknesses: string[] | null
        }
        Insert: {
          analysis: string
          candidat_id?: string | null
          created_at?: string
          created_by?: string | null
          cv_content?: string | null
          id?: string
          match: boolean
          poste_id?: string | null
          score: number
          strengths?: string[] | null
          weaknesses?: string[] | null
        }
        Update: {
          analysis?: string
          candidat_id?: string | null
          created_at?: string
          created_by?: string | null
          cv_content?: string | null
          id?: string
          match?: boolean
          poste_id?: string | null
          score?: number
          strengths?: string[] | null
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "matchings_candidat_id_fkey"
            columns: ["candidat_id"]
            isOneToOne: false
            referencedRelation: "candidats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchings_poste_id_fkey"
            columns: ["poste_id"]
            isOneToOne: false
            referencedRelation: "postes"
            referencedColumns: ["id"]
          },
        ]
      }
      postes: {
        Row: {
          client_id: string | null
          competences: string[] | null
          created_at: string | null
          description: string | null
          id: string
          localisation: string | null
          salaire_max: number | null
          salaire_min: number | null
          statut: string | null
          titre: string
          type_contrat: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          competences?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          localisation?: string | null
          salaire_max?: number | null
          salaire_min?: number | null
          statut?: string | null
          titre: string
          type_contrat?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          competences?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          localisation?: string | null
          salaire_max?: number | null
          salaire_min?: number | null
          statut?: string | null
          titre?: string
          type_contrat?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          nom: string
          prenom: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          nom: string
          prenom: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          nom?: string
          prenom?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      rdvs: {
        Row: {
          candidat_id: string | null
          client_id: string | null
          created_at: string | null
          date: string
          id: string
          lieu: string | null
          notes: string | null
          poste_id: string | null
          rdv_type: Database["public"]["Enums"]["rdv_type"]
          recruteur_id: string | null
          referent_id: string | null
          statut: Database["public"]["Enums"]["rdv_statut"]
          teams_link: string | null
          teams_meeting_id: string | null
          type_rdv: string
          updated_at: string | null
        }
        Insert: {
          candidat_id?: string | null
          client_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          lieu?: string | null
          notes?: string | null
          poste_id?: string | null
          rdv_type?: Database["public"]["Enums"]["rdv_type"]
          recruteur_id?: string | null
          referent_id?: string | null
          statut: Database["public"]["Enums"]["rdv_statut"]
          teams_link?: string | null
          teams_meeting_id?: string | null
          type_rdv: string
          updated_at?: string | null
        }
        Update: {
          candidat_id?: string | null
          client_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          lieu?: string | null
          notes?: string | null
          poste_id?: string | null
          rdv_type?: Database["public"]["Enums"]["rdv_type"]
          recruteur_id?: string | null
          referent_id?: string | null
          statut?: Database["public"]["Enums"]["rdv_statut"]
          teams_link?: string | null
          teams_meeting_id?: string | null
          type_rdv?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdvs_candidat_id_fkey"
            columns: ["candidat_id"]
            isOneToOne: false
            referencedRelation: "candidats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdvs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdvs_poste_id_fkey"
            columns: ["poste_id"]
            isOneToOne: false
            referencedRelation: "postes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdvs_recruteur_id_fkey"
            columns: ["recruteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdvs_referent_id_fkey"
            columns: ["referent_id"]
            isOneToOne: false
            referencedRelation: "referents"
            referencedColumns: ["id"]
          },
        ]
      }
      referents: {
        Row: {
          client_id: string | null
          created_at: string | null
          email: string
          id: string
          nom: string
          prenom: string
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          nom: string
          prenom: string
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nom?: string
          prenom?: string
          telephone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      rdv_statut: "ENCOURS" | "REALISE" | "TERMINE" | "ANNULE"
      rdv_type: "RECRUTEUR" | "CLIENT"
      user_role: "ADMIN" | "RECRUTEUR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      rdv_statut: ["ENCOURS", "REALISE", "TERMINE", "ANNULE"],
      rdv_type: ["RECRUTEUR", "CLIENT"],
      user_role: ["ADMIN", "RECRUTEUR"],
    },
  },
} as const
