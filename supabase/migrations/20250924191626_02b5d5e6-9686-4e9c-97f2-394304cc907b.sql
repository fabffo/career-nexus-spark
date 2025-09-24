-- Ajouter une colonne user_id aux candidats pour lier au système d'authentification
ALTER TABLE public.candidats 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Créer un index pour la performance
CREATE INDEX idx_candidats_user_id ON public.candidats(user_id);

-- Ajouter une colonne invitation_token pour gérer les invitations
ALTER TABLE public.candidats 
ADD COLUMN invitation_token TEXT UNIQUE,
ADD COLUMN invitation_sent_at TIMESTAMP WITH TIME ZONE;

-- Créer une fonction pour générer un token d'invitation unique
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour le trigger handle_new_user pour gérer les candidats
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Si c'est un candidat qui s'inscrit avec un token
  IF new.raw_user_meta_data->>'invitation_token' IS NOT NULL THEN
    -- Mettre à jour le candidat avec l'user_id
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
  ELSE
    -- Comportement par défaut pour les autres utilisateurs
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

-- Ajouter le rôle CANDIDAT à l'enum user_role s'il n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'CANDIDAT' 
    AND enumtypid = 'user_role'::regtype
  ) THEN
    ALTER TYPE user_role ADD VALUE 'CANDIDAT';
  END IF;
END $$;