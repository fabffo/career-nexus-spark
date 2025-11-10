import { supabase } from '@/integrations/supabase/client';
import { BulletinSalaire, BulletinSalaireCreate } from '@/types/bulletinSalaire';

export const bulletinSalaireService = {
  async getAll(): Promise<BulletinSalaire[]> {
    const { data, error } = await supabase
      .from('bulletins_salaire')
      .select(`
        *,
        salarie:salaries(id, nom, prenom, email)
      `)
      .order('periode_annee', { ascending: false })
      .order('periode_mois', { ascending: false });

    if (error) {
      console.error('Error fetching bulletins:', error);
      throw error;
    }

    return (data || []) as unknown as BulletinSalaire[];
  },

  async getBySalarieId(salarieId: string): Promise<BulletinSalaire[]> {
    const { data, error } = await supabase
      .from('bulletins_salaire')
      .select(`
        *,
        salarie:salaries(id, nom, prenom, email)
      `)
      .eq('salarie_id', salarieId)
      .order('periode_annee', { ascending: false })
      .order('periode_mois', { ascending: false });

    if (error) {
      console.error('Error fetching bulletins:', error);
      throw error;
    }

    return (data || []) as unknown as BulletinSalaire[];
  },

  async getById(id: string): Promise<BulletinSalaire> {
    const { data, error } = await supabase
      .from('bulletins_salaire')
      .select(`
        *,
        salarie:salaries(id, nom, prenom, email)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching bulletin:', error);
      throw error;
    }

    return data as unknown as BulletinSalaire;
  },

  async create(bulletin: BulletinSalaireCreate): Promise<BulletinSalaire> {
    const { data, error } = await supabase
      .from('bulletins_salaire')
      .insert(bulletin)
      .select()
      .single();

    if (error) {
      console.error('Error creating bulletin:', error);
      throw error;
    }

    return data as unknown as BulletinSalaire;
  },

  async update(id: string, bulletin: Partial<BulletinSalaireCreate>): Promise<BulletinSalaire> {
    const { data, error } = await supabase
      .from('bulletins_salaire')
      .update(bulletin)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating bulletin:', error);
      throw error;
    }

    return data as unknown as BulletinSalaire;
  },

  async delete(id: string): Promise<void> {
    // D'abord supprimer le fichier du storage
    const { data: bulletin } = await supabase
      .from('bulletins_salaire')
      .select('fichier_url')
      .eq('id', id)
      .single();

    if (bulletin?.fichier_url) {
      const path = bulletin.fichier_url.split('/').slice(-1)[0];
      await supabase.storage.from('bulletins-salaire').remove([path]);
    }

    // Puis supprimer l'enregistrement
    const { error } = await supabase
      .from('bulletins_salaire')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting bulletin:', error);
      throw error;
    }
  },

  async uploadFile(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('bulletins-salaire')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    // Retourner l'URL signée complète pour accès sécurisé
    const { data: { signedUrl }, error: urlError } = await supabase.storage
      .from('bulletins-salaire')
      .createSignedUrl(filePath, 31536000); // 1 an

    if (urlError) {
      console.error('Error getting signed URL:', urlError);
      throw urlError;
    }

    // Construire l'URL complète en ajoutant le domaine Supabase
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const fullUrl = `${baseUrl}/storage/v1${signedUrl}`;

    return fullUrl;
  },

  async analyserBulletin(pdfBase64: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('analyser-bulletin', {
      body: { pdfBase64 }
    });

    if (error) {
      console.error('Error analyzing bulletin:', error);
      throw error;
    }

    return data;
  }
};
