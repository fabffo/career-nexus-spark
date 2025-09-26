// Script temporaire pour créer un compte candidat de test
// Ce fichier peut être supprimé après utilisation

import { supabase } from '@/integrations/supabase/client';

export async function createTestCandidat() {
  const email = 'candidat.test@example.com';
  const password = 'Test123456!';
  
  // Créer le compte dans Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nom: 'Test',
        prenom: 'Candidat',
        role: 'CANDIDAT'
      },
      emailRedirectTo: `${window.location.origin}/candidat/dashboard`
    }
  });

  if (error) {
    console.error('Erreur lors de la création du compte:', error);
    return { error };
  }

  console.log('Compte candidat créé avec succès:', data);
  
  // Associer le candidat existant au nouveau compte utilisateur
  if (data.user) {
    const { error: updateError } = await supabase
      .from('candidats')
      .update({ user_id: data.user.id })
      .eq('email', email);
      
    if (updateError) {
      console.error('Erreur lors de la mise à jour du candidat:', updateError);
    }
  }
  
  return { data };
}

// Pour l'exécuter dans la console : createTestCandidat()