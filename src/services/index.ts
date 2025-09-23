import { GenericCrudService } from './genericCrudService';
import {
  Candidat,
  Client,
  Rdv,
  PosteClient,
  CommentaireCandidatParCollaborateur,
  CommentaireCandidatParClient,
} from '@/types/models';
import {
  mockCandidats,
  mockClients,
  mockRdvs,
  mockPostes,
  mockCommentairesCollaborateur,
  mockCommentairesClient,
} from '@/lib/mockData';

// Initialize services with mock data
export const candidatService = new GenericCrudService<Candidat>('candidats', mockCandidats);
export const clientService = new GenericCrudService<Client>('clients', mockClients);
export const rdvService = new GenericCrudService<Rdv>('rdvs', mockRdvs);
export const posteService = new GenericCrudService<PosteClient>('postes', mockPostes);
export const commentaireCollaborateurService = new GenericCrudService<CommentaireCandidatParCollaborateur>(
  'commentaires_collaborateur',
  mockCommentairesCollaborateur
);
export const commentaireClientService = new GenericCrudService<CommentaireCandidatParClient>(
  'commentaires_client',
  mockCommentairesClient
);