import { supabase } from '@/integrations/supabase/client';
import { PosteClient, CrudOperations } from '@/types/models';

class PosteService implements CrudOperations<PosteClient> {
  async getAll(): Promise<PosteClient[]> {
    const { data, error } = await supabase
      .from('postes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(item => ({
      id: item.id,
      clientId: item.client_id || '',
      nomPoste: item.titre,
      dateCreation: new Date(item.created_at),
      dateEcheance: item.updated_at ? new Date(item.updated_at) : undefined,
      statut: (item.statut === 'OUVERT' ? 'ENCOURS' : item.statut || 'ENCOURS') as PosteClient['statut'],
      detail: item.description || '',
      pourvuPar: item.pourvu_par || '',
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }));
  }

  async getById(id: string): Promise<PosteClient> {
    const { data, error } = await supabase
      .from('postes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) throw new Error(`Poste with id ${id} not found`);
    
    return {
      id: data.id,
      clientId: data.client_id || '',
      nomPoste: data.titre,
      dateCreation: new Date(data.created_at),
      dateEcheance: data.updated_at ? new Date(data.updated_at) : undefined,
      statut: (data.statut || 'ENCOURS') as PosteClient['statut'],
      detail: data.description || '',
      pourvuPar: data.pourvu_par || '',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async create(item: Omit<PosteClient, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<PosteClient> {
    const posteData = {
      client_id: item.clientId,
      titre: item.nomPoste,
      description: item.detail,
      statut: item.statut || 'ENCOURS',
      pourvu_par: item.pourvuPar || null,
    };
    
    const { data, error } = await supabase
      .from('postes')
      .insert(posteData)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      clientId: data.client_id || '',
      nomPoste: data.titre,
      dateCreation: new Date(data.created_at),
      dateEcheance: data.updated_at ? new Date(data.updated_at) : undefined,
      statut: (data.statut || 'ENCOURS') as PosteClient['statut'],
      detail: data.description || '',
      pourvuPar: data.pourvu_par || '',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async update(id: string, item: Partial<PosteClient>): Promise<PosteClient> {
    const updateData: any = {};
    if (item.clientId !== undefined) updateData.client_id = item.clientId;
    if (item.nomPoste !== undefined) updateData.titre = item.nomPoste;
    if (item.detail !== undefined) updateData.description = item.detail;
    if (item.statut !== undefined) updateData.statut = item.statut;
    if (item.pourvuPar !== undefined) updateData.pourvu_par = item.pourvuPar;
    
    const { data, error } = await supabase
      .from('postes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      clientId: data.client_id || '',
      nomPoste: data.titre,
      dateCreation: new Date(data.created_at),
      dateEcheance: data.updated_at ? new Date(data.updated_at) : undefined,
      statut: (data.statut || 'ENCOURS') as PosteClient['statut'],
      detail: data.description || '',
      pourvuPar: data.pourvu_par || '',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('postes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  async count(): Promise<number> {
    const { count, error } = await supabase
      .from('postes')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  }
}

export const posteService = new PosteService();