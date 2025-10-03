// Base audit fields for all models
export interface AuditFields {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Candidat model
export interface Candidat extends AuditFields {
  nom: string;
  prenom: string;
  metier: string;
  mail: string;
  telephone: string;
  adresse: string;
  cvUrl?: string;
  recommandationUrl?: string;
  detail_cv?: string;
}

// Client model
export interface Client extends AuditFields {
  raisonSociale: string;
  secteurActivite: string;
  adresse: string;
  telephone: string;
  email: string;
  siteWeb?: string;
  pieceJointes?: string[];
}

// RDV model
export type TypeRdv = 'TEAMS' | 'PRESENTIEL_CLIENT' | 'TELEPHONE';
export type StatutRdv = 'ENCOURS' | 'REALISE' | 'TERMINE' | 'ANNULE';

export interface Rdv extends AuditFields {
  candidatId: string;
  clientId: string;
  date: Date;
  typeRdv: TypeRdv;
  statut: StatutRdv;
  lieu?: string;
  notes?: string;
  candidat?: Candidat;
  client?: Client;
}

// Commentaire models
export interface CommentaireCandidatParCollaborateur extends AuditFields {
  candidatId: string;
  commentaire: string;
  collaborateurNom: string;
  candidat?: Candidat;
}

export interface CommentaireCandidatParClient extends AuditFields {
  candidatId: string;
  clientId: string;
  commentaire: string;
  candidat?: Candidat;
  client?: Client;
}

// PosteClient model
export type StatutPoste = 'ENCOURS' | 'REALISE' | 'ANNULE';
export type TypePrestation = string; // Types dynamiques gérés par param_type_prestation

export interface PosteClient extends AuditFields {
  clientId: string;
  nomPoste: string;
  dateCreation: Date;
  dateEcheance?: Date;
  statut: StatutPoste;
  typePrestation: TypePrestation;
  detail: string;
  pieceJointes?: string[];
  pourvuPar?: string;
  client?: Client;
  rdvs?: Rdv[];
}

// Generic CRUD operations interface
export interface CrudOperations<T> {
  getAll: () => Promise<T[]>;
  getById: (id: string) => Promise<T>;
  create: (data: Omit<T, keyof AuditFields>) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<T>;
  delete: (id: string) => Promise<void>;
}