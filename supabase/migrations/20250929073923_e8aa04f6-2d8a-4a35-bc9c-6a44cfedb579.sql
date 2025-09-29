-- Ajouter la gestion des salariés avec rôle dans le trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    
    -- Créer le profil avec le rôle PRESTATAIRE
    INSERT INTO public.profiles (id, email, nom, prenom, role)
    SELECT 
      new.id,
      new.email,
      p.nom,
      p.prenom,
      'PRESTATAIRE'::user_role
    FROM public.prestataires p
    WHERE p.user_id = new.id;
    
  -- Si c'est un salarié recruteur qui s'inscrit avec invitation token
  ELSIF new.raw_user_meta_data->>'invitation_token' IS NOT NULL AND new.raw_user_meta_data->>'type' = 'SALARIE' THEN
    -- Salarié recruteur avec invitation token
    UPDATE public.salaries 
    SET user_id = new.id,
        invitation_token = NULL,
        invitation_sent_at = NULL
    WHERE invitation_token = new.raw_user_meta_data->>'invitation_token'
      AND role = 'RECRUTEUR';
    
    -- Créer le profil avec le rôle RECRUTEUR
    INSERT INTO public.profiles (id, email, nom, prenom, role)
    SELECT 
      new.id,
      new.email,
      s.nom,
      s.prenom,
      'RECRUTEUR'::user_role
    FROM public.salaries s
    WHERE s.user_id = new.id;
    
  -- Si c'est un salarié prestataire qui s'inscrit avec invitation token
  ELSIF new.raw_user_meta_data->>'invitation_token' IS NOT NULL AND new.raw_user_meta_data->>'type' = 'SALARIE_PRESTATAIRE' THEN
    -- Salarié prestataire avec invitation token
    UPDATE public.salaries 
    SET user_id = new.id,
        invitation_token = NULL,
        invitation_sent_at = NULL
    WHERE invitation_token = new.raw_user_meta_data->>'invitation_token'
      AND role = 'PRESTATAIRE';
    
    -- Créer le profil avec le rôle PRESTATAIRE et ajouter dans la table prestataires
    INSERT INTO public.profiles (id, email, nom, prenom, role)
    SELECT 
      new.id,
      new.email,
      s.nom,
      s.prenom,
      'PRESTATAIRE'::user_role
    FROM public.salaries s
    WHERE s.user_id = new.id;
    
    -- Créer aussi l'enregistrement dans prestataires
    INSERT INTO public.prestataires (nom, prenom, email, telephone, user_id)
    SELECT 
      s.nom,
      s.prenom,
      s.email,
      s.telephone,
      new.id
    FROM public.salaries s
    WHERE s.user_id = new.id
    ON CONFLICT (email) DO UPDATE
    SET user_id = new.id;
    
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