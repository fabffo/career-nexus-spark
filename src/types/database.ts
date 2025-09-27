// Extended types for our models with Supabase integration
export type UserRole = 'ADMIN' | 'RECRUTEUR';
export type RdvType = 'RECRUTEUR' | 'CLIENT';

export interface Profile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

export interface Referent {
  id: string;
  client_id?: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  fonction?: string;
  created_at?: string;
  updated_at?: string;
}