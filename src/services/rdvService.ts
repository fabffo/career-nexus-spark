import { supabase } from '@/integrations/supabase/client';
import { Rdv, CrudOperations } from '@/types/models';

class RdvService implements CrudOperations<Rdv> {
  async getAll(): Promise<Rdv[]> {
    const { data, error } = await supabase
      .from('rdvs')
      .select(`
        *,
        candidats (
          id,
          nom,
          prenom,
          email
        ),
        clients (
          id,
          raison_sociale,
          adresse_ligne1,
          code_postal,
          ville,
          pays
        )
      `)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(item => ({
      id: item.id,
      candidatId: item.candidat_id || '',
      clientId: item.client_id || '',
      date: new Date(item.date),
      typeRdv: (item.type_rdv || item.rdv_type || 'TELEPHONE') as Rdv['typeRdv'],
      statut: (item.statut || 'ENCOURS') as Rdv['statut'],
      lieu: item.lieu || '',
      notes: item.notes || '',
      candidat: item.candidats ? {
        id: item.candidats.id,
        nom: item.candidats.nom,
        prenom: item.candidats.prenom,
        mail: item.candidats.email || '',
        telephone: '',
        metier: '',
        adresse: '',
        createdAt: new Date(),
        updatedAt: new Date()
      } : undefined,
      client: item.clients ? {
        id: item.clients.id,
        raisonSociale: item.clients.raison_sociale,
        adresse_ligne1: item.clients.adresse_ligne1 || '',
        code_postal: item.clients.code_postal || '',
        ville: item.clients.ville || '',
        pays: item.clients.pays || 'France',
        telephone: '',
        email: '',
        secteurActivite: '',
        createdAt: new Date(),
        updatedAt: new Date()
      } : undefined,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at || item.created_at),
    }));
  }

  async getById(id: string): Promise<Rdv> {
    const { data, error } = await supabase
      .from('rdvs')
      .select(`
        *,
        candidats (
          id,
          nom,
          prenom,
          email
        ),
        clients (
          id,
          raison_sociale,
          adresse_ligne1,
          code_postal,
          ville,
          pays
        )
      `)
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) throw new Error(`RDV with id ${id} not found`);
    
    return {
      id: data.id,
      candidatId: data.candidat_id || '',
      clientId: data.client_id || '',
      date: new Date(data.date),
      typeRdv: (data.type_rdv || data.rdv_type || 'TELEPHONE') as Rdv['typeRdv'],
      statut: (data.statut || 'ENCOURS') as Rdv['statut'],
      lieu: data.lieu || '',
      notes: data.notes || '',
      candidat: data.candidats ? {
        id: data.candidats.id,
        nom: data.candidats.nom,
        prenom: data.candidats.prenom,
        mail: data.candidats.email || '',
        telephone: '',
        metier: '',
        adresse: '',
        createdAt: new Date(),
        updatedAt: new Date()
      } : undefined,
      client: data.clients ? {
        id: data.clients.id,
        raisonSociale: data.clients.raison_sociale,
        adresse_ligne1: data.clients.adresse_ligne1 || '',
        code_postal: data.clients.code_postal || '',
        ville: data.clients.ville || '',
        pays: data.clients.pays || 'France',
        telephone: '',
        email: '',
        secteurActivite: '',
        createdAt: new Date(),
        updatedAt: new Date()
      } : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at || data.created_at),
    };
  }

  async create(item: Omit<Rdv, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<Rdv> {
    const rdvData = {
      candidat_id: item.candidatId,
      client_id: item.clientId,
      date: item.date.toISOString(),
      type_rdv: item.typeRdv,
      statut: item.statut,
      lieu: item.lieu || null,
      notes: item.notes || null,
      rdv_type: 'RECRUTEUR' as const // Default rdv_type
    };
    
    const { data, error } = await supabase
      .from('rdvs')
      .insert([rdvData])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      candidatId: data.candidat_id || '',
      clientId: data.client_id || '',
      date: new Date(data.date),
      typeRdv: (data.type_rdv || data.rdv_type || 'TELEPHONE') as Rdv['typeRdv'],
      statut: (data.statut || 'ENCOURS') as Rdv['statut'],
      lieu: data.lieu || '',
      notes: data.notes || '',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at || data.created_at),
    };
  }

  async update(id: string, item: Partial<Rdv>): Promise<Rdv> {
    const updateData: any = {};
    if (item.candidatId !== undefined) updateData.candidat_id = item.candidatId;
    if (item.clientId !== undefined) updateData.client_id = item.clientId;
    if (item.date !== undefined) updateData.date = item.date.toISOString();
    if (item.typeRdv !== undefined) updateData.type_rdv = item.typeRdv;
    if (item.statut !== undefined) updateData.statut = item.statut;
    if (item.lieu !== undefined) updateData.lieu = item.lieu;
    if (item.notes !== undefined) updateData.notes = item.notes;
    
    const { data, error } = await supabase
      .from('rdvs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      candidatId: data.candidat_id || '',
      clientId: data.client_id || '',
      date: new Date(data.date),
      typeRdv: (data.type_rdv || data.rdv_type || 'TELEPHONE') as Rdv['typeRdv'],
      statut: (data.statut || 'ENCOURS') as Rdv['statut'],
      lieu: data.lieu || '',
      notes: data.notes || '',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at || data.created_at),
    };
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('rdvs')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  async count(): Promise<number> {
    const { count, error } = await supabase
      .from('rdvs')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  }
}

export const rdvService = new RdvService();