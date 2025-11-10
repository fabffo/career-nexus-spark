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
      // Si fichier_url contient une URL complète, extraire le nom du fichier
      // Sinon c'est déjà le chemin du fichier
      let filePath = bulletin.fichier_url;
      if (filePath.includes('/storage/v1/object/')) {
        filePath = filePath.split('/').slice(-1)[0];
      }
      await supabase.storage.from('bulletins-salaire').remove([filePath]);
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

    // Retourner uniquement le chemin du fichier, pas l'URL
    return filePath;
  },

  async getSignedUrl(filePath: string): Promise<string> {
    // Si fichier_url contient une URL complète (anciens bulletins), extraire le nom du fichier
    let actualFilePath = filePath;
    if (filePath.includes('/storage/v1/object/')) {
      actualFilePath = filePath.split('/').slice(-1)[0];
    }

    const { data, error } = await supabase.storage
      .from('bulletins-salaire')
      .createSignedUrl(actualFilePath, 3600); // URL valide 1 heure

    if (error || !data) {
      console.error('Error creating signed URL:', error);
      throw error || new Error('Impossible de générer l\'URL du fichier');
    }

    // createSignedUrl retourne un chemin relatif, construire l'URL complète
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/storage/v1${data.signedUrl}`;
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
