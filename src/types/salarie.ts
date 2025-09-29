// Salarie model - same structure as Candidat
export interface Salarie {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  metier?: string;
  fonction?: string;
  detail_cv?: string;
  cv_url?: string;
  recommandation_url?: string;
  user_id?: string;
  invitation_token?: string;
  invitation_sent_at?: string;
  created_at?: string;
  updated_at?: string;
}