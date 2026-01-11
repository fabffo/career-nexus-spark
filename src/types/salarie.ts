// Salarie model - same structure as Candidat
export type SalarieRole = 'RECRUTEUR' | 'PRESTATAIRE';

export interface Salarie {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  metier?: string;
  fonction?: string;
  role?: SalarieRole;
  detail_cv?: string;
  cv_url?: string;
  recommandation_url?: string;
  mots_cles_rapprochement?: string | null;
  user_id?: string;
  invitation_token?: string;
  invitation_sent_at?: string;
  created_at?: string;
  updated_at?: string;
}