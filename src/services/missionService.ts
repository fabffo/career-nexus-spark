import { supabase } from '@/integrations/supabase/client';
import { Mission, Tva } from '@/types/mission';

class MissionService {
  async getAll(): Promise<Mission[]> {
    const { data, error } = await supabase
      .from('missions')
      .select(`
        *,
        poste:postes(*),
        contrat:contrats(*),
        prestataire:prestataires(*),
        salarie:salaries(*),
        tva:tva(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching missions:', error);
      throw error;
    }

    return (data || []) as Mission[];
  }

  async getById(id: string): Promise<Mission> {
    const { data, error } = await supabase
      .from('missions')
      .select(`
        *,
        poste:postes(*),
        contrat:contrats(*),
        prestataire:prestataires(*),
        salarie:salaries(*),
        tva:tva(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching mission:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Mission not found');
    }

    return data as Mission;
  }

  async create(mission: Omit<Mission, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<Mission> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('missions')
      .insert({
        ...mission,
        created_by: user?.id
      })
      .select(`
        *,
        poste:postes(*),
        contrat:contrats(*),
        prestataire:prestataires(*),
        salarie:salaries(*),
        tva:tva(*)
      `)
      .single();

    if (error) {
      console.error('Error creating mission:', error);
      throw error;
    }

    return data as Mission;
  }

  async update(id: string, mission: Partial<Mission>): Promise<Mission> {
    const { data, error } = await supabase
      .from('missions')
      .update(mission)
      .eq('id', id)
      .select(`
        *,
        poste:postes(*),
        contrat:contrats(*),
        prestataire:prestataires(*),
        salarie:salaries(*),
        tva:tva(*)
      `)
      .single();

    if (error) {
      console.error('Error updating mission:', error);
      throw error;
    }

    return data as Mission;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('missions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting mission:', error);
      throw error;
    }
  }

  async getTvaRates(): Promise<Tva[]> {
    const { data, error } = await supabase
      .from('tva')
      .select('*')
      .order('taux', { ascending: true });

    if (error) {
      console.error('Error fetching TVA rates:', error);
      throw error;
    }

    return data || [];
  }
}

export const missionService = new MissionService();