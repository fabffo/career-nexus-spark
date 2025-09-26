import { supabase } from '@/integrations/supabase/client';
import {
  Candidat,
  Client,
  Rdv,
  PosteClient,
  CommentaireCandidatParCollaborateur,
  CommentaireCandidatParClient,
  CrudOperations,
} from '@/types/models';

// Candidat Service using Supabase
class CandidatService implements CrudOperations<Candidat> {
  async getAll(): Promise<Candidat[]> {
    const { data, error } = await supabase
      .from('candidats')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(item => ({
      id: item.id,
      nom: item.nom,
      prenom: item.prenom,
      mail: item.email || '',
      telephone: item.telephone || '',
      metier: '',
      adresse: '',
      cvUrl: item.cv_url || '',
      recommandationUrl: item.recommandation_url || '',
      detail_cv: item.detail_cv || '',
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }));
  }

  async getById(id: string): Promise<Candidat> {
    const { data, error } = await supabase
      .from('candidats')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) throw new Error(`Candidat with id ${id} not found`);
    
    return {
      id: data.id,
      nom: data.nom,
      prenom: data.prenom,
      mail: data.email || '',
      telephone: data.telephone || '',
      metier: '',
      adresse: '',
      cvUrl: data.cv_url || '',
      recommandationUrl: data.recommandation_url || '',
      detail_cv: data.detail_cv || '',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async create(item: Omit<Candidat, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<Candidat> {
    const candidatData = {
      nom: item.nom,
      prenom: item.prenom,
      email: item.mail || '',
      telephone: item.telephone || '',
      cv_url: item.cvUrl || null,
      recommandation_url: item.recommandationUrl || null,
      detail_cv: item.detail_cv || null
    };
    
    const { data, error } = await supabase
      .from('candidats')
      .insert(candidatData)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      nom: data.nom,
      prenom: data.prenom,
      mail: data.email || '',
      telephone: data.telephone || '',
      metier: item.metier || '',
      adresse: item.adresse || '',
      cvUrl: data.cv_url || '',
      recommandationUrl: data.recommandation_url || '',
      detail_cv: data.detail_cv || '',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async update(id: string, item: Partial<Candidat>): Promise<Candidat> {
    const updateData: any = {};
    if (item.nom !== undefined) updateData.nom = item.nom;
    if (item.prenom !== undefined) updateData.prenom = item.prenom;
    if (item.mail !== undefined) updateData.email = item.mail;
    if (item.telephone !== undefined) updateData.telephone = item.telephone;
    if (item.cvUrl !== undefined) updateData.cv_url = item.cvUrl;
    if (item.recommandationUrl !== undefined) updateData.recommandation_url = item.recommandationUrl;
    if (item.detail_cv !== undefined) updateData.detail_cv = item.detail_cv;
    
    const { data, error } = await supabase
      .from('candidats')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      nom: data.nom,
      prenom: data.prenom,
      mail: data.email || '',
      telephone: data.telephone || '',
      metier: item.metier || '',
      adresse: item.adresse || '',
      cvUrl: data.cv_url || '',
      recommandationUrl: data.recommandation_url || '',
      detail_cv: data.detail_cv || '',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('candidats')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  async count(): Promise<number> {
    const { count, error } = await supabase
      .from('candidats')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  }
}

// Client Service using Supabase
class ClientService implements CrudOperations<Client> {
  async getAll(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(item => ({
      id: item.id,
      raisonSociale: item.raison_sociale,
      adresse: item.adresse || '',
      telephone: item.telephone || '',
      email: item.email || '',
      secteurActivite: '',
      siteWeb: '',
      pieceJointes: [],
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }));
  }

  async getById(id: string): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) throw new Error(`Client with id ${id} not found`);
    
    return {
      id: data.id,
      raisonSociale: data.raison_sociale,
      adresse: data.adresse || '',
      telephone: data.telephone || '',
      email: data.email || '',
      secteurActivite: '',
      siteWeb: '',
      pieceJointes: [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async create(item: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<Client> {
    const clientData = {
      raison_sociale: item.raisonSociale,
      adresse: item.adresse,
      telephone: item.telephone,
      email: item.email
    };
    
    const { data, error } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      raisonSociale: data.raison_sociale,
      adresse: data.adresse || '',
      telephone: data.telephone || '',
      email: data.email || '',
      secteurActivite: item.secteurActivite || '',
      siteWeb: item.siteWeb,
      pieceJointes: item.pieceJointes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async update(id: string, item: Partial<Client>): Promise<Client> {
    const updateData: any = {};
    if (item.raisonSociale !== undefined) updateData.raison_sociale = item.raisonSociale;
    if (item.adresse !== undefined) updateData.adresse = item.adresse;
    if (item.telephone !== undefined) updateData.telephone = item.telephone;
    if (item.email !== undefined) updateData.email = item.email;
    
    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      raisonSociale: data.raison_sociale,
      adresse: data.adresse || '',
      telephone: data.telephone || '',
      email: data.email || '',
      secteurActivite: item.secteurActivite || '',
      siteWeb: item.siteWeb,
      pieceJointes: item.pieceJointes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  async count(): Promise<number> {
    const { count, error } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  }
}

// Export service instances
export const candidatService = new CandidatService();
export const clientService = new ClientService();

// Import Supabase services
import { posteService } from './posteService';
import { rdvService } from './rdvService';
export { posteService, rdvService };

// Mock services for other entities (to be migrated later)
import { GenericCrudService } from './genericCrudService';
import {
  mockCommentairesCollaborateur,
  mockCommentairesClient,
} from '@/lib/mockData';

export const commentaireCollaborateurService = new GenericCrudService<CommentaireCandidatParCollaborateur>(
  'commentaires_collaborateur',
  mockCommentairesCollaborateur
);
export const commentaireClientService = new GenericCrudService<CommentaireCandidatParClient>(
  'commentaires_client',
  mockCommentairesClient
);