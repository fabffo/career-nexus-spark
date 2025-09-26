-- Modifier le trigger handle_new_user pour mieux gérer les inscriptions candidats
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $$
BEGIN
  -- Si c'est un candidat qui s'inscrit (soit avec token, soit via metadata)
  IF new.raw_user_meta_data->>'invitation_token' IS NOT NULL THEN
    -- Candidat avec invitation token
    UPDATE public.candidats 
    SET user_id = new.id,
        invitation_token = NULL,
        invitation_sent_at = NULL
    WHERE invitation_token = new.raw_user_meta_data->>'invitation_token';
    
    -- Créer le profil avec le rôle CANDIDAT
    INSERT INTO public.profiles (id, email, nom, prenom, role)
    SELECT 
      new.id,
      new.email,
      c.nom,
      c.prenom,
      'CANDIDAT'::user_role
    FROM public.candidats c
    WHERE c.user_id = new.id;
    
  ELSIF new.raw_user_meta_data->>'role' = 'CANDIDAT' THEN
    -- Candidat qui s'inscrit directement
    -- Créer ou mettre à jour l'enregistrement candidat
    INSERT INTO public.candidats (nom, prenom, email, user_id)
    VALUES (
      COALESCE(new.raw_user_meta_data->>'nom', 'À renseigner'),
      COALESCE(new.raw_user_meta_data->>'prenom', 'À renseigner'),
      new.email,
      new.id
    )
    ON CONFLICT (email) DO UPDATE
    SET user_id = new.id;
    
    -- Créer le profil avec le rôle CANDIDAT
    INSERT INTO public.profiles (id, email, nom, prenom, role)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'nom', 'À renseigner'),
      COALESCE(new.raw_user_meta_data->>'prenom', 'À renseigner'),
      'CANDIDAT'::user_role
    );
    
  ELSE
    -- Comportement par défaut pour les recruteurs/admins
    INSERT INTO public.profiles (id, email, nom, prenom, role)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'nom', 'À renseigner'),
      COALESCE(new.raw_user_meta_data->>'prenom', 'À renseigner'),
      COALESCE((new.raw_user_meta_data->>'role')::user_role, 'RECRUTEUR')
    );
  END IF;
  
  RETURN new;
END;
$$;