-- Mettre à jour le trigger pour gérer aussi les prestataires
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Si c'est un candidat qui s'inscrit avec invitation token
  IF new.raw_user_meta_data->>'invitation_token' IS NOT NULL AND new.raw_user_meta_data->>'type' = 'CANDIDAT' THEN
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
    
  -- Si c'est un prestataire qui s'inscrit avec invitation token
  ELSIF new.raw_user_meta_data->>'invitation_token' IS NOT NULL AND new.raw_user_meta_data->>'type' = 'PRESTATAIRE' THEN
    -- Prestataire avec invitation token
    UPDATE public.prestataires 
    SET user_id = new.id,
        invitation_token = NULL,
        invitation_sent_at = NULL
    WHERE invitation_token = new.raw_user_meta_data->>'invitation_token';
    
    -- Créer le profil avec le rôle PRESTATAIRE (on ajoute d'abord la valeur à l'enum si elle n'existe pas)
    INSERT INTO public.profiles (id, email, nom, prenom, role)
    SELECT 
      new.id,
      new.email,
      p.nom,
      p.prenom,
      'PRESTATAIRE'::user_role
    FROM public.prestataires p
    WHERE p.user_id = new.id;
    
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
    
  ELSIF new.raw_user_meta_data->>'role' = 'PRESTATAIRE' THEN
    -- Prestataire qui s'inscrit directement
    -- Créer ou mettre à jour l'enregistrement prestataire
    INSERT INTO public.prestataires (nom, prenom, email, user_id)
    VALUES (
      COALESCE(new.raw_user_meta_data->>'nom', 'À renseigner'),
      COALESCE(new.raw_user_meta_data->>'prenom', 'À renseigner'),
      new.email,
      new.id
    )
    ON CONFLICT (email) DO UPDATE
    SET user_id = new.id;
    
    -- Créer le profil avec le rôle PRESTATAIRE
    INSERT INTO public.profiles (id, email, nom, prenom, role)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'nom', 'À renseigner'),
      COALESCE(new.raw_user_meta_data->>'prenom', 'À renseigner'),
      'PRESTATAIRE'::user_role
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
$function$;

-- Ajouter PRESTATAIRE au type enum user_role si ce n'est pas déjà fait
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'PRESTATAIRE' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PRESTATAIRE';
  END IF;
END $$;