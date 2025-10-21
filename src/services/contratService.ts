import { supabase } from '@/integrations/supabase/client';
import { Contrat, Prestataire, FournisseurServices, FournisseurGeneral, FournisseurEtatOrganisme } from '@/types/contrat';

// Service pour les contrats
export const contratService = {
  async getAll() {
    const { data, error } = await (supabase as any)
      .from('contrats')
      .select(`
        *,
        client:clients(*),
        prestataire:prestataires(*),
        fournisseur_services:fournisseurs_services(*),
        fournisseur_general:fournisseurs_generaux(*),
        fournisseur_etat_organisme:fournisseurs_etat_organismes(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await (supabase as any)
      .from('contrats')
      .select(`
        *,
        client:clients(*),
        prestataire:prestataires(*),
        fournisseur_services:fournisseurs_services(*),
        fournisseur_general:fournisseurs_generaux(*),
        fournisseur_etat_organisme:fournisseurs_etat_organismes(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(contrat: Omit<Contrat, 'id' | 'created_at' | 'updated_at'>) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('contrats')
      .insert({ ...contrat, created_by: user?.id } as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, contrat: Partial<Contrat>) {
    const { data, error } = await supabase
      .from('contrats')
      .update(contrat as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('contrats')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Méthodes spécifiques pour les contrats
  async createAvenant(parentId: string, contrat: Omit<Contrat, 'id' | 'created_at' | 'updated_at'>) {
    // Récupérer le contrat parent
    const parent = await this.getById(parentId);
    
    // Calculer la nouvelle version
    const currentVersion = parent.version;
    const versionParts = currentVersion.split('.');
    const minorVersion = parseInt(versionParts[1] || '0') + 1;
    const newVersion = `${versionParts[0]}.${minorVersion}`;

    // Archiver l'ancienne version
    await this.update(parentId, {
      statut: 'ARCHIVE',
      date_fin: new Date().toISOString().split('T')[0]
    });

    // Créer l'avenant
    return this.create({
      ...contrat,
      parent_id: parentId,
      version: newVersion
    });
  },

  async terminer(id: string) {
    return this.update(id, {
      statut: 'TERMINE',
      date_fin: new Date().toISOString().split('T')[0]
    });
  },

  async annuler(id: string) {
    return this.update(id, {
      statut: 'ANNULE',
      date_fin: new Date().toISOString().split('T')[0]
    });
  },

  async activer(id: string) {
    return this.update(id, {
      statut: 'ACTIF'
    });
  }
};

// Service pour les prestataires
export const prestataireService = {
  async getAll() {
    const { data, error } = await supabase
      .from('prestataires')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('prestataires')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(prestataire: Omit<Prestataire, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('prestataires')
      .insert(prestataire)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, prestataire: Partial<Prestataire>) {
    const { data, error } = await supabase
      .from('prestataires')
      .update(prestataire)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('prestataires')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async count() {
    const { count, error } = await supabase
      .from('prestataires')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  }
};

// Service pour les fournisseurs de services
export const fournisseurServicesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('fournisseurs_services')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('fournisseurs_services')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(fournisseur: Omit<FournisseurServices, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('fournisseurs_services')
      .insert(fournisseur)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, fournisseur: Partial<FournisseurServices>) {
    const { data, error } = await supabase
      .from('fournisseurs_services')
      .update(fournisseur)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('fournisseurs_services')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// Service pour les fournisseurs généraux
export const fournisseurGeneralService = {
  async getAll() {
    const { data, error } = await supabase
      .from('fournisseurs_generaux')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('fournisseurs_generaux')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(fournisseur: Omit<FournisseurGeneral, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('fournisseurs_generaux')
      .insert(fournisseur)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, fournisseur: Partial<FournisseurGeneral>) {
    const { data, error } = await supabase
      .from('fournisseurs_generaux')
      .update(fournisseur)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('fournisseurs_generaux')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// Service pour les fournisseurs État & organismes sociaux
export const fournisseurEtatOrganismeService = {
  async getAll() {
    const { data, error } = await (supabase as any)
      .from('fournisseurs_etat_organismes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as FournisseurEtatOrganisme[];
  },

  async getById(id: string) {
    const { data, error } = await (supabase as any)
      .from('fournisseurs_etat_organismes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as FournisseurEtatOrganisme;
  },

  async create(fournisseur: Omit<FournisseurEtatOrganisme, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await (supabase as any)
      .from('fournisseurs_etat_organismes')
      .insert(fournisseur)
      .select()
      .single();

    if (error) throw error;
    return data as FournisseurEtatOrganisme;
  },

  async update(id: string, fournisseur: Partial<FournisseurEtatOrganisme>) {
    const { data, error } = await (supabase as any)
      .from('fournisseurs_etat_organismes')
      .update(fournisseur)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as FournisseurEtatOrganisme;
  },

  async delete(id: string) {
    const { error } = await (supabase as any)
      .from('fournisseurs_etat_organismes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};