import { supabase } from '@/integrations/supabase/client';
import { Salarie } from '@/types/salarie';

export const salarieService = {
  async getAll(): Promise<Salarie[]> {
    const { data, error } = await supabase
      .from('salaries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching salaries:', error);
      throw error;
    }

    return data || [];
  },

  async getById(id: string): Promise<Salarie> {
    const { data, error } = await supabase
      .from('salaries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching salarie:', error);
      throw error;
    }

    return data;
  },

  async create(salarie: Omit<Salarie, 'id' | 'created_at' | 'updated_at'>): Promise<Salarie> {
    const { data, error } = await supabase
      .from('salaries')
      .insert(salarie)
      .select()
      .single();

    if (error) {
      console.error('Error creating salarie:', error);
      throw error;
    }

    return data;
  },

  async update(id: string, salarie: Partial<Omit<Salarie, 'id' | 'created_at' | 'updated_at'>>): Promise<Salarie> {
    const { data, error } = await supabase
      .from('salaries')
      .update(salarie)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating salarie:', error);
      throw error;
    }

    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('salaries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting salarie:', error);
      throw error;
    }
  },

  async count(): Promise<number> {
    const { count, error } = await supabase
      .from('salaries')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error counting salaries:', error);
      throw error;
    }

    return count || 0;
  }
};