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
      abonnements_consommations: {
        Row: {
          abonnement_id: string
          created_at: string
          created_by: string | null
          date_consommation: string
          description: string | null
          id: string
          libelle: string
          montant: number
          rapprochement_id: string | null
          updated_at: string
        }
        Insert: {
          abonnement_id: string
          created_at?: string
          created_by?: string | null
          date_consommation: string
          description?: string | null
          id?: string
          libelle: string
          montant: number
          rapprochement_id?: string | null
          updated_at?: string
        }
        Update: {
          abonnement_id?: string
          created_at?: string
          created_by?: string | null
          date_consommation?: string
          description?: string | null
          id?: string
          libelle?: string
          montant?: number
          rapprochement_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abonnements_consommations_abonnement_id_fkey"
            columns: ["abonnement_id"]
            isOneToOne: false
            referencedRelation: "abonnements_partenaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonnements_consommations_rapprochement_id_fkey"
            columns: ["rapprochement_id"]
            isOneToOne: false
            referencedRelation: "rapprochements_bancaires"
            referencedColumns: ["id"]
          },
        ]
      }
      abonnements_documents: {
        Row: {
          abonnement_id: string
          created_at: string | null
          created_by: string | null
          document_url: string
          id: string
          nom_fichier: string
        }
        Insert: {
          abonnement_id: string
          created_at?: string | null
          created_by?: string | null
          document_url: string
          id?: string
          nom_fichier: string
        }
        Update: {
          abonnement_id?: string
          created_at?: string | null
          created_by?: string | null
          document_url?: string
          id?: string
          nom_fichier?: string
        }
        Relationships: [
          {
            foreignKeyName: "abonnements_documents_abonnement_id_fkey"
            columns: ["abonnement_id"]
            isOneToOne: false
            referencedRelation: "abonnements_partenaires"
            referencedColumns: ["id"]
          },
        ]
      }
      abonnements_partenaires: {
        Row: {
          actif: boolean | null
          created_at: string | null
          created_by: string | null
          document_url: string | null
          id: string
          jour_prelevement: number | null
          montant_mensuel: number | null
          nature: string
          nom: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          created_by?: string | null
          document_url?: string | null
          id?: string
          jour_prelevement?: number | null
          montant_mensuel?: number | null
          nature: string
          nom: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          created_by?: string | null
          document_url?: string | null
          id?: string
          jour_prelevement?: number | null
          montant_mensuel?: number | null
          nature?: string
          nom?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      analyse_poste_candidat: {
        Row: {
          analysis: string | null
          candidat_id: string | null
          created_at: string
          created_by: string | null
          detail_cv: string
          detail_poste: Json
          id: string
          match: boolean | null
          poste_id: string | null
          score: number | null
          strengths: string[] | null
          weaknesses: string[] | null
        }
        Insert: {
          analysis?: string | null
          candidat_id?: string | null
          created_at?: string
          created_by?: string | null
          detail_cv: string
          detail_poste: Json
          id?: string
          match?: boolean | null
          poste_id?: string | null
          score?: number | null
          strengths?: string[] | null
          weaknesses?: string[] | null
        }
        Update: {
          analysis?: string | null
          candidat_id?: string | null
          created_at?: string
          created_by?: string | null
          detail_cv?: string
          detail_poste?: Json
          id?: string
          match?: boolean | null
          poste_id?: string | null
          score?: number | null
          strengths?: string[] | null
          weaknesses?: string[] | null
        }
        Relationships: []
      }
      candidats: {
        Row: {
          created_at: string | null
          cv_url: string | null
          detail_cv: string | null
          email: string | null
          id: string
          invitation_sent_at: string | null
          invitation_token: string | null
          metier: string | null
          nom: string
          prenom: string
          recommandation_url: string | null
          telephone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          cv_url?: string | null
          detail_cv?: string | null
          email?: string | null
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          metier?: string | null
          nom: string
          prenom: string
          recommandation_url?: string | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          cv_url?: string | null
          detail_cv?: string | null
          email?: string | null
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          metier?: string | null
          nom?: string
          prenom?: string
          recommandation_url?: string | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      charges_salaries: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_paiement: string
          id: string
          montant: number
          notes: string | null
          rapprochement_id: string | null
          salarie_id: string
          type_charge: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_paiement: string
          id?: string
          montant: number
          notes?: string | null
          rapprochement_id?: string | null
          salarie_id: string
          type_charge: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_paiement?: string
          id?: string
          montant?: number
          notes?: string | null
          rapprochement_id?: string | null
          salarie_id?: string
          type_charge?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_salaries_rapprochement_id_fkey"
            columns: ["rapprochement_id"]
            isOneToOne: false
            referencedRelation: "fichiers_rapprochement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_salaries_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          adresse: string | null
          created_at: string | null
          delai_paiement_jours: number | null
          email: string | null
          id: string
          raison_sociale: string
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          created_at?: string | null
          delai_paiement_jours?: number | null
          email?: string | null
          id?: string
          raison_sociale: string
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          created_at?: string | null
          delai_paiement_jours?: number | null
          email?: string | null
          id?: string
          raison_sociale?: string
          telephone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contrat_sequences: {
        Row: {
          created_at: string | null
          last_number: number
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          last_number?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          last_number?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      contrats: {
        Row: {
          client_id: string | null
          created_at: string | null
          created_by: string | null
          date_debut: string
          date_fin: string | null
          description: string | null
          fournisseur_etat_organisme_id: string | null
          fournisseur_general_id: string | null
          fournisseur_services_id: string | null
          id: string
          montant: number | null
          numero_contrat: string
          parent_id: string | null
          piece_jointe_url: string | null
          prestataire_id: string | null
          statut: Database["public"]["Enums"]["contrat_statut"]
          type: Database["public"]["Enums"]["contrat_type"]
          updated_at: string | null
          version: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_debut: string
          date_fin?: string | null
          description?: string | null
          fournisseur_etat_organisme_id?: string | null
          fournisseur_general_id?: string | null
          fournisseur_services_id?: string | null
          id?: string
          montant?: number | null
          numero_contrat: string
          parent_id?: string | null
          piece_jointe_url?: string | null
          prestataire_id?: string | null
          statut?: Database["public"]["Enums"]["contrat_statut"]
          type: Database["public"]["Enums"]["contrat_type"]
          updated_at?: string | null
          version?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_debut?: string
          date_fin?: string | null
          description?: string | null
          fournisseur_etat_organisme_id?: string | null
          fournisseur_general_id?: string | null
          fournisseur_services_id?: string | null
          id?: string
          montant?: number | null
          numero_contrat?: string
          parent_id?: string | null
          piece_jointe_url?: string | null
          prestataire_id?: string | null
          statut?: Database["public"]["Enums"]["contrat_statut"]
          type?: Database["public"]["Enums"]["contrat_type"]
          updated_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrats_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_fournisseur_etat_organisme_id_fkey"
            columns: ["fournisseur_etat_organisme_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_etat_organismes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_fournisseur_general_id_fkey"
            columns: ["fournisseur_general_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_generaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_fournisseur_services_id_fkey"
            columns: ["fournisseur_services_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
        ]
      }
      declarations_charges_sociales: {
        Row: {
          actif: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          jour_echeance: number | null
          montant_estime: number | null
          nom: string
          notes: string | null
          organisme: string
          periodicite: string
          type_charge: string
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          jour_echeance?: number | null
          montant_estime?: number | null
          nom: string
          notes?: string | null
          organisme: string
          periodicite?: string
          type_charge: string
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          jour_echeance?: number | null
          montant_estime?: number | null
          nom?: string
          notes?: string | null
          organisme?: string
          periodicite?: string
          type_charge?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      echeances_fiscales: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_echeance: string
          date_paiement: string | null
          description: string | null
          id: string
          justificatif_url: string | null
          libelle: string
          montant_estime: number | null
          montant_paye: number | null
          notes: string | null
          statut: string
          type_impot_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_echeance: string
          date_paiement?: string | null
          description?: string | null
          id?: string
          justificatif_url?: string | null
          libelle: string
          montant_estime?: number | null
          montant_paye?: number | null
          notes?: string | null
          statut?: string
          type_impot_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_echeance?: string
          date_paiement?: string | null
          description?: string | null
          id?: string
          justificatif_url?: string | null
          libelle?: string
          montant_estime?: number | null
          montant_paye?: number | null
          notes?: string | null
          statut?: string
          type_impot_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "echeances_fiscales_type_impot_id_fkey"
            columns: ["type_impot_id"]
            isOneToOne: false
            referencedRelation: "types_impots"
            referencedColumns: ["id"]
          },
        ]
      }
      email_history: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          recipient_name: string | null
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          recipient_name?: string | null
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      facture_lignes: {
        Row: {
          created_at: string | null
          description: string
          facture_id: string
          id: string
          montant_tva: number | null
          ordre: number
          prix_ht: number
          prix_ttc: number | null
          prix_unitaire_ht: number
          quantite: number
          taux_tva: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          facture_id: string
          id?: string
          montant_tva?: number | null
          ordre?: number
          prix_ht: number
          prix_ttc?: number | null
          prix_unitaire_ht: number
          quantite?: number
          taux_tva?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          facture_id?: string
          id?: string
          montant_tva?: number | null
          ordre?: number
          prix_ht?: number
          prix_ttc?: number | null
          prix_unitaire_ht?: number
          quantite?: number
          taux_tva?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facture_lignes_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      facture_sequences: {
        Row: {
          annee: number | null
          created_at: string | null
          format: string
          id: string
          prefixe: string
          prochain_numero: number
          type_facture: string
          updated_at: string | null
        }
        Insert: {
          annee?: number | null
          created_at?: string | null
          format?: string
          id?: string
          prefixe?: string
          prochain_numero?: number
          type_facture?: string
          updated_at?: string | null
        }
        Update: {
          annee?: number | null
          created_at?: string | null
          format?: string
          id?: string
          prefixe?: string
          prochain_numero?: number
          type_facture?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      factures: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_echeance: string
          date_emission: string
          date_rapprochement: string | null
          destinataire_adresse: string | null
          destinataire_email: string | null
          destinataire_id: string | null
          destinataire_nom: string
          destinataire_telephone: string | null
          destinataire_type: string
          emetteur_adresse: string | null
          emetteur_email: string | null
          emetteur_id: string | null
          emetteur_nom: string
          emetteur_telephone: string | null
          emetteur_type: string
          id: string
          informations_paiement: string | null
          numero_facture: string
          numero_rapprochement: string | null
          reference_societe: string | null
          statut: string | null
          total_ht: number | null
          total_ttc: number | null
          total_tva: number | null
          type_facture: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_echeance: string
          date_emission?: string
          date_rapprochement?: string | null
          destinataire_adresse?: string | null
          destinataire_email?: string | null
          destinataire_id?: string | null
          destinataire_nom: string
          destinataire_telephone?: string | null
          destinataire_type: string
          emetteur_adresse?: string | null
          emetteur_email?: string | null
          emetteur_id?: string | null
          emetteur_nom: string
          emetteur_telephone?: string | null
          emetteur_type: string
          id?: string
          informations_paiement?: string | null
          numero_facture: string
          numero_rapprochement?: string | null
          reference_societe?: string | null
          statut?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          type_facture: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_echeance?: string
          date_emission?: string
          date_rapprochement?: string | null
          destinataire_adresse?: string | null
          destinataire_email?: string | null
          destinataire_id?: string | null
          destinataire_nom?: string
          destinataire_telephone?: string | null
          destinataire_type?: string
          emetteur_adresse?: string | null
          emetteur_email?: string | null
          emetteur_id?: string | null
          emetteur_nom?: string
          emetteur_telephone?: string | null
          emetteur_type?: string
          id?: string
          informations_paiement?: string | null
          numero_facture?: string
          numero_rapprochement?: string | null
          reference_societe?: string | null
          statut?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          type_facture?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fichiers_rapprochement: {
        Row: {
          created_at: string
          created_by: string | null
          date_debut: string
          date_fin: string
          fichier_data: Json
          id: string
          lignes_rapprochees: number
          numero_rapprochement: string
          statut: string
          total_lignes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_debut: string
          date_fin: string
          fichier_data: Json
          id?: string
          lignes_rapprochees?: number
          numero_rapprochement: string
          statut?: string
          total_lignes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_debut?: string
          date_fin?: string
          fichier_data?: Json
          id?: string
          lignes_rapprochees?: number
          numero_rapprochement?: string
          statut?: string
          total_lignes?: number
          updated_at?: string
        }
        Relationships: []
      }
      fournisseurs_etat_organismes: {
        Row: {
          adresse: string | null
          created_at: string | null
          email: string | null
          id: string
          raison_sociale: string
          secteur_activite: string | null
          site_web: string | null
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          raison_sociale: string
          secteur_activite?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          raison_sociale?: string
          secteur_activite?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fournisseurs_generaux: {
        Row: {
          adresse: string | null
          created_at: string | null
          email: string | null
          id: string
          raison_sociale: string
          secteur_activite: string | null
          site_web: string | null
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          raison_sociale: string
          secteur_activite?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          raison_sociale?: string
          secteur_activite?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fournisseurs_services: {
        Row: {
          adresse: string | null
          created_at: string | null
          email: string | null
          id: string
          raison_sociale: string
          secteur_activite: string | null
          site_web: string | null
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          raison_sociale: string
          secteur_activite?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          raison_sociale?: string
          secteur_activite?: string | null
          site_web?: string | null
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
      mission_sequences: {
        Row: {
          created_at: string | null
          last_number: number
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          last_number?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          last_number?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      missions: {
        Row: {
          competences: string[] | null
          contrat_id: string | null
          created_at: string
          created_by: string | null
          date_debut: string | null
          date_fin: string | null
          description: string | null
          id: string
          localisation: string | null
          nombre_jours: number | null
          numero_mission: string | null
          poste_id: string | null
          prestataire_id: string | null
          prix_ht: number | null
          prix_ttc: number | null
          salarie_id: string | null
          statut: string | null
          taux_tva: number | null
          titre: string
          tjm: number | null
          tva_id: string | null
          type_intervenant: string
          type_mission: string
          updated_at: string
        }
        Insert: {
          competences?: string[] | null
          contrat_id?: string | null
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description?: string | null
          id?: string
          localisation?: string | null
          nombre_jours?: number | null
          numero_mission?: string | null
          poste_id?: string | null
          prestataire_id?: string | null
          prix_ht?: number | null
          prix_ttc?: number | null
          salarie_id?: string | null
          statut?: string | null
          taux_tva?: number | null
          titre: string
          tjm?: number | null
          tva_id?: string | null
          type_intervenant: string
          type_mission: string
          updated_at?: string
        }
        Update: {
          competences?: string[] | null
          contrat_id?: string | null
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description?: string | null
          id?: string
          localisation?: string | null
          nombre_jours?: number | null
          numero_mission?: string | null
          poste_id?: string | null
          prestataire_id?: string | null
          prix_ht?: number | null
          prix_ttc?: number | null
          salarie_id?: string | null
          statut?: string | null
          taux_tva?: number | null
          titre?: string
          tjm?: number | null
          tva_id?: string | null
          type_intervenant?: string
          type_mission?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_poste_id_fkey"
            columns: ["poste_id"]
            isOneToOne: false
            referencedRelation: "postes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_salarie_id_fkey"
            columns: ["salarie_id"]
            isOneToOne: false
            referencedRelation: "salaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_tva_id_fkey"
            columns: ["tva_id"]
            isOneToOne: false
            referencedRelation: "tva"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements_abonnements: {
        Row: {
          abonnement_id: string
          created_at: string | null
          created_by: string | null
          date_paiement: string
          id: string
          montant: number
          notes: string | null
          rapprochement_id: string | null
          updated_at: string | null
        }
        Insert: {
          abonnement_id: string
          created_at?: string | null
          created_by?: string | null
          date_paiement: string
          id?: string
          montant: number
          notes?: string | null
          rapprochement_id?: string | null
          updated_at?: string | null
        }
        Update: {
          abonnement_id?: string
          created_at?: string | null
          created_by?: string | null
          date_paiement?: string
          id?: string
          montant?: number
          notes?: string | null
          rapprochement_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_abonnements_abonnement_id_fkey"
            columns: ["abonnement_id"]
            isOneToOne: false
            referencedRelation: "abonnements_partenaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_abonnements_rapprochement_id_fkey"
            columns: ["rapprochement_id"]
            isOneToOne: false
            referencedRelation: "rapprochements_bancaires"
            referencedColumns: ["id"]
          },
        ]
      }
      param_type_intervenant: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          libelle: string
          ordre: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          libelle: string
          ordre?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          libelle?: string
          ordre?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      param_type_mission: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          libelle: string
          ordre: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          libelle: string
          ordre?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          libelle?: string
          ordre?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      param_type_prestation: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          libelle: string
          ordre: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          libelle: string
          ordre?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          libelle?: string
          ordre?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      postes: {
        Row: {
          client_id: string | null
          competences: string[] | null
          created_at: string | null
          description: string | null
          id: string
          localisation: string | null
          pourvu_par: string | null
          salaire_max: number | null
          salaire_min: number | null
          statut: string | null
          titre: string
          type_contrat: string | null
          type_prestation: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          competences?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          localisation?: string | null
          pourvu_par?: string | null
          salaire_max?: number | null
          salaire_min?: number | null
          statut?: string | null
          titre: string
          type_contrat?: string | null
          type_prestation?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          competences?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          localisation?: string | null
          pourvu_par?: string | null
          salaire_max?: number | null
          salaire_min?: number | null
          statut?: string | null
          titre?: string
          type_contrat?: string | null
          type_prestation?: string | null
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
      prestataires: {
        Row: {
          created_at: string | null
          cv_url: string | null
          detail_cv: string | null
          email: string | null
          fournisseur_services_id: string | null
          id: string
          invitation_sent_at: string | null
          invitation_token: string | null
          nom: string
          prenom: string
          recommandation_url: string | null
          telephone: string | null
          type_prestataire: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          cv_url?: string | null
          detail_cv?: string | null
          email?: string | null
          fournisseur_services_id?: string | null
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          nom: string
          prenom: string
          recommandation_url?: string | null
          telephone?: string | null
          type_prestataire?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          cv_url?: string | null
          detail_cv?: string | null
          email?: string | null
          fournisseur_services_id?: string | null
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          nom?: string
          prenom?: string
          recommandation_url?: string | null
          telephone?: string | null
          type_prestataire?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prestataires_fournisseur_services_id_fkey"
            columns: ["fournisseur_services_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_services"
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
      rappels_fiscaux: {
        Row: {
          created_at: string | null
          date_envoi: string | null
          date_rappel: string
          echeance_id: string
          envoye: boolean | null
          id: string
          jours_avant: number
        }
        Insert: {
          created_at?: string | null
          date_envoi?: string | null
          date_rappel: string
          echeance_id: string
          envoye?: boolean | null
          id?: string
          jours_avant: number
        }
        Update: {
          created_at?: string | null
          date_envoi?: string | null
          date_rappel?: string
          echeance_id?: string
          envoye?: boolean | null
          id?: string
          jours_avant?: number
        }
        Relationships: [
          {
            foreignKeyName: "rappels_fiscaux_echeance_id_fkey"
            columns: ["echeance_id"]
            isOneToOne: false
            referencedRelation: "echeances_fiscales"
            referencedColumns: ["id"]
          },
        ]
      }
      rapprochement_sequences: {
        Row: {
          created_at: string | null
          last_number: number
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          last_number?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          last_number?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      rapprochements_bancaires: {
        Row: {
          abonnement_id: string | null
          created_at: string
          created_by: string | null
          facture_id: string | null
          id: string
          notes: string | null
          transaction_credit: number | null
          transaction_date: string
          transaction_debit: number | null
          transaction_libelle: string
          transaction_montant: number
          updated_at: string
        }
        Insert: {
          abonnement_id?: string | null
          created_at?: string
          created_by?: string | null
          facture_id?: string | null
          id?: string
          notes?: string | null
          transaction_credit?: number | null
          transaction_date: string
          transaction_debit?: number | null
          transaction_libelle: string
          transaction_montant: number
          updated_at?: string
        }
        Update: {
          abonnement_id?: string | null
          created_at?: string
          created_by?: string | null
          facture_id?: string | null
          id?: string
          notes?: string | null
          transaction_credit?: number | null
          transaction_date?: string
          transaction_debit?: number | null
          transaction_libelle?: string
          transaction_montant?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rapprochements_bancaires_abonnement_id_fkey"
            columns: ["abonnement_id"]
            isOneToOne: false
            referencedRelation: "abonnements_partenaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapprochements_bancaires_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapprochements_bancaires_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      rdv_referents: {
        Row: {
          created_at: string
          id: string
          rdv_id: string
          referent_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rdv_id: string
          referent_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rdv_id?: string
          referent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdv_referents_rdv_id_fkey"
            columns: ["rdv_id"]
            isOneToOne: false
            referencedRelation: "rdvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdv_referents_referent_id_fkey"
            columns: ["referent_id"]
            isOneToOne: false
            referencedRelation: "referents"
            referencedColumns: ["id"]
          },
        ]
      }
      rdvs: {
        Row: {
          additional_emails: string | null
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
          additional_emails?: string | null
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
          additional_emails?: string | null
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
          fonction: string | null
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
          fonction?: string | null
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
          fonction?: string | null
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
      salaries: {
        Row: {
          created_at: string | null
          cv_url: string | null
          detail_cv: string | null
          email: string | null
          fonction: string | null
          id: string
          invitation_sent_at: string | null
          invitation_token: string | null
          metier: string | null
          nom: string
          prenom: string
          recommandation_url: string | null
          role: Database["public"]["Enums"]["salarie_role"] | null
          telephone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          cv_url?: string | null
          detail_cv?: string | null
          email?: string | null
          fonction?: string | null
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          metier?: string | null
          nom: string
          prenom: string
          recommandation_url?: string | null
          role?: Database["public"]["Enums"]["salarie_role"] | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          cv_url?: string | null
          detail_cv?: string | null
          email?: string | null
          fonction?: string | null
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          metier?: string | null
          nom?: string
          prenom?: string
          recommandation_url?: string | null
          role?: Database["public"]["Enums"]["salarie_role"] | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      societe_interne: {
        Row: {
          adresse: string | null
          bic: string | null
          capital_social: number | null
          created_at: string | null
          email: string | null
          etablissement_bancaire: string | null
          iban: string | null
          id: string
          raison_sociale: string
          reference_bancaire: string | null
          siren: string | null
          telephone: string | null
          tva: string | null
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          bic?: string | null
          capital_social?: number | null
          created_at?: string | null
          email?: string | null
          etablissement_bancaire?: string | null
          iban?: string | null
          id?: string
          raison_sociale: string
          reference_bancaire?: string | null
          siren?: string | null
          telephone?: string | null
          tva?: string | null
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          bic?: string | null
          capital_social?: number | null
          created_at?: string | null
          email?: string | null
          etablissement_bancaire?: string | null
          iban?: string | null
          id?: string
          raison_sociale?: string
          reference_bancaire?: string | null
          siren?: string | null
          telephone?: string | null
          tva?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tva: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          libelle: string
          taux: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          libelle: string
          taux: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          libelle?: string
          taux?: number
          updated_at?: string
        }
        Relationships: []
      }
      types_impots: {
        Row: {
          code: string
          couleur: string
          created_at: string | null
          description: string | null
          icone: string | null
          id: string
          is_active: boolean | null
          libelle: string
          ordre: number | null
          periodicite: string
          updated_at: string | null
        }
        Insert: {
          code: string
          couleur?: string
          created_at?: string | null
          description?: string | null
          icone?: string | null
          id?: string
          is_active?: boolean | null
          libelle: string
          ordre?: number | null
          periodicite: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          couleur?: string
          created_at?: string | null
          description?: string | null
          icone?: string | null
          id?: string
          is_active?: boolean | null
          libelle?: string
          ordre?: number | null
          periodicite?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_factures_storage: { Args: never; Returns: boolean }
      check_dates_already_reconciled: {
        Args: { p_date_debut: string; p_date_fin: string }
        Returns: {
          is_reconciled: boolean
          numero_rapprochement: string
        }[]
      }
      generate_invitation_token: { Args: never; Returns: string }
      generate_numero_facture: { Args: { p_type: string }; Returns: string }
      get_next_avenant_number: {
        Args: { p_parent_numero: string }
        Returns: string
      }
      get_next_contract_number: { Args: { p_year: number }; Returns: string }
      get_next_facture_numero: {
        Args: { p_type_facture?: string }
        Returns: string
      }
      get_next_rapprochement_numero: { Args: never; Returns: string }
      user_has_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["user_role"][]
          user_id: string
        }
        Returns: boolean
      }
      validate_salarie_invitation_token: {
        Args: {
          p_role?: Database["public"]["Enums"]["salarie_role"]
          p_token: string
        }
        Returns: Json
      }
    }
    Enums: {
      contrat_statut: "BROUILLON" | "ACTIF" | "TERMINE" | "ANNULE" | "ARCHIVE"
      contrat_type:
        | "CLIENT"
        | "PRESTATAIRE"
        | "FOURNISSEUR_SERVICES"
        | "FOURNISSEUR_GENERAL"
      rdv_statut: "ENCOURS" | "REALISE" | "TERMINE" | "ANNULE"
      rdv_type: "RECRUTEUR" | "CLIENT"
      salarie_role: "RECRUTEUR" | "PRESTATAIRE"
      user_role: "ADMIN" | "RECRUTEUR" | "CANDIDAT" | "CONTRAT" | "PRESTATAIRE"
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
      contrat_statut: ["BROUILLON", "ACTIF", "TERMINE", "ANNULE", "ARCHIVE"],
      contrat_type: [
        "CLIENT",
        "PRESTATAIRE",
        "FOURNISSEUR_SERVICES",
        "FOURNISSEUR_GENERAL",
      ],
      rdv_statut: ["ENCOURS", "REALISE", "TERMINE", "ANNULE"],
      rdv_type: ["RECRUTEUR", "CLIENT"],
      salarie_role: ["RECRUTEUR", "PRESTATAIRE"],
      user_role: ["ADMIN", "RECRUTEUR", "CANDIDAT", "CONTRAT", "PRESTATAIRE"],
    },
  },
} as const
