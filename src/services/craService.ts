import { supabase } from "@/integrations/supabase/client";
import { CRA, CRAJour, JourFerie, HistoriqueTJM } from "@/types/cra";

class CRAService {
  // Récupérer tous les CRA avec relations
  async getAll(): Promise<CRA[]> {
    const { data, error } = await (supabase as any)
      .from('cra')
      .select(`
        *,
        mission:missions(
          id,
          titre,
          tjm,
          date_debut,
          date_fin,
          statut,
          contrat:contrats(
            client:client_id(raison_sociale)
          )
        ),
        prestataire:prestataires(id, nom, prenom, email),
        salarie:salaries(id, nom, prenom, email),
        cra_jours(*)
      `)
      .order('annee', { ascending: false })
      .order('mois', { ascending: false });

    if (error) throw error;
    return data as CRA[];
  }

  // Récupérer un CRA par ID
  async getById(id: string): Promise<CRA> {
    const { data, error } = await (supabase as any)
      .from('cra')
      .select(`
        *,
        mission:missions(
          id,
          titre,
          tjm,
          date_debut,
          date_fin,
          statut,
          contrat:contrats(
            client:client_id(raison_sociale)
          )
        ),
        prestataire:prestataires(id, nom, prenom, email),
        salarie:salaries(id, nom, prenom, email),
        cra_jours(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as CRA;
  }

  // Récupérer un CRA par mission, année et mois
  async getByMissionPeriod(missionId: string, annee: number, mois: number): Promise<CRA | null> {
    const { data, error } = await (supabase as any)
      .from('cra')
      .select(`
        *,
        mission:missions(
          id,
          titre,
          tjm,
          date_debut,
          date_fin,
          statut,
          contrat:contrats(
            client:client_id(raison_sociale)
          )
        ),
        prestataire:prestataires(id, nom, prenom, email),
        salarie:salaries(id, nom, prenom, email),
        cra_jours(*)
      `)
      .eq('mission_id', missionId)
      .eq('annee', annee)
      .eq('mois', mois)
      .maybeSingle();

    if (error) throw error;
    return data as CRA | null;
  }

  // Créer un CRA
  async create(cra: Omit<CRA, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<CRA> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('cra')
      .insert([{
        ...cra,
        created_by: user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data as CRA;
  }

  // Mettre à jour un CRA
  async update(id: string, cra: Partial<CRA>): Promise<CRA> {
    const { data, error } = await supabase
      .from('cra')
      .update(cra)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CRA;
  }

  // Supprimer un CRA
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('cra')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Gestion des jours de CRA
  async getJoursByCRA(craId: string): Promise<CRAJour[]> {
    const { data, error } = await supabase
      .from('cra_jours')
      .select('*')
      .eq('cra_id', craId)
      .order('date', { ascending: true });

    if (error) throw error;
    return data as CRAJour[];
  }

  async createJour(jour: Omit<CRAJour, 'id' | 'created_at' | 'updated_at'>): Promise<CRAJour> {
    const { data, error } = await supabase
      .from('cra_jours')
      .insert([jour])
      .select()
      .single();

    if (error) throw error;
    return data as CRAJour;
  }

  async updateJour(id: string, jour: Partial<CRAJour>): Promise<CRAJour> {
    const { data, error } = await supabase
      .from('cra_jours')
      .update(jour)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CRAJour;
  }

  async deleteJour(id: string): Promise<void> {
    const { error } = await supabase
      .from('cra_jours')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Créer ou mettre à jour plusieurs jours à la fois
  async upsertJours(jours: Omit<CRAJour, 'id' | 'created_at' | 'updated_at'>[]): Promise<CRAJour[]> {
    const { data, error } = await supabase
      .from('cra_jours')
      .upsert(jours, { onConflict: 'cra_id,date' })
      .select();

    if (error) throw error;
    return data as CRAJour[];
  }

  // Jours fériés
  async getJoursFeries(annee: number): Promise<JourFerie[]> {
    const { data, error } = await supabase
      .from('jours_feries')
      .select('*')
      .eq('annee', annee)
      .order('date', { ascending: true });

    if (error) throw error;
    return data as JourFerie[];
  }

  // Historique TMJ
  async getHistoriqueTJM(missionId: string): Promise<HistoriqueTJM[]> {
    const { data, error } = await supabase
      .from('historique_tjm')
      .select('*')
      .eq('mission_id', missionId)
      .order('date_changement', { ascending: false });

    if (error) throw error;
    return data as HistoriqueTJM[];
  }

  async createHistoriqueTJM(historique: Omit<HistoriqueTJM, 'id' | 'created_at' | 'created_by'>): Promise<HistoriqueTJM> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('historique_tjm')
      .insert([{
        ...historique,
        created_by: user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data as HistoriqueTJM;
  }

  // Stats globales
  async getStatsGlobales(annee: number, mois?: number) {
    // Récupérer les missions actives
    const { data: missions } = await (supabase as any)
      .from('missions')
      .select(`
        *,
        prestataire:prestataires(id, nom, prenom),
        salarie:salaries(id, nom, prenom),
        contrat:contrats(
          client:client_id(raison_sociale)
        )
      `)
      .eq('statut', 'EN_COURS');

    // Récupérer les CRA de la période
    let query = supabase
      .from('cra')
      .select('*')
      .eq('annee', annee);
    
    if (mois) {
      query = query.eq('mois', mois);
    }

    const { data: cras } = await query;

    return {
      missions: missions || [],
      cras: cras || []
    };
  }
}

export const craService = new CRAService();
