-- Créer le type enum pour les rôles
CREATE TYPE public.user_role AS ENUM ('ADMIN', 'RECRUTEUR');

-- Créer le type enum pour le type de RDV
CREATE TYPE public.rdv_type AS ENUM ('RECRUTEUR', 'CLIENT');

-- Créer la table profiles pour les utilisateurs
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'RECRUTEUR',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Créer la table referents pour les référents clients
CREATE TABLE public.referents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Modifier la table rdvs pour ajouter les nouvelles colonnes
ALTER TABLE public.rdvs 
  ADD COLUMN recruteur_id UUID REFERENCES public.profiles(id),
  ADD COLUMN referent_id UUID REFERENCES public.referents(id),
  ADD COLUMN rdv_type rdv_type NOT NULL DEFAULT 'RECRUTEUR';

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referents ENABLE ROW LEVEL SECURITY;

-- Policies pour profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Policies pour referents
CREATE POLICY "Authenticated users can view referents"
  ON public.referents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert referents"
  ON public.referents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update referents"
  ON public.referents FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete referents"
  ON public.referents FOR DELETE
  TO authenticated
  USING (true);

-- Mettre à jour les policies de rdvs pour l'authentification
DROP POLICY IF EXISTS "Public can view rdvs" ON public.rdvs;
DROP POLICY IF EXISTS "Public can insert rdvs" ON public.rdvs;
DROP POLICY IF EXISTS "Public can update rdvs" ON public.rdvs;
DROP POLICY IF EXISTS "Public can delete rdvs" ON public.rdvs;

CREATE POLICY "Authenticated users can view rdvs"
  ON public.rdvs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert rdvs"
  ON public.rdvs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rdvs"
  ON public.rdvs FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete rdvs"
  ON public.rdvs FOR DELETE
  TO authenticated
  USING (true);

-- Mettre à jour les policies des autres tables pour l'authentification
-- Candidats
DROP POLICY IF EXISTS "Public can view candidats" ON public.candidats;
DROP POLICY IF EXISTS "Public can insert candidats" ON public.candidats;
DROP POLICY IF EXISTS "Public can update candidats" ON public.candidats;
DROP POLICY IF EXISTS "Public can delete candidats" ON public.candidats;

CREATE POLICY "Authenticated users can view candidats"
  ON public.candidats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert candidats"
  ON public.candidats FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update candidats"
  ON public.candidats FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete candidats"
  ON public.candidats FOR DELETE
  TO authenticated
  USING (true);

-- Clients
DROP POLICY IF EXISTS "Public can view clients" ON public.clients;
DROP POLICY IF EXISTS "Public can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Public can update clients" ON public.clients;
DROP POLICY IF EXISTS "Public can delete clients" ON public.clients;

CREATE POLICY "Authenticated users can view clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (true);

-- Fonction pour créer automatiquement un profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nom', 'À renseigner'),
    COALESCE(new.raw_user_meta_data->>'prenom', 'À renseigner'),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'RECRUTEUR')
  );
  RETURN new;
END;
$$;

-- Trigger pour créer le profil automatiquement
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referents_updated_at
  BEFORE UPDATE ON public.referents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();