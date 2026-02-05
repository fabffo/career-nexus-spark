-- Table pour les paramètres de trésorerie
CREATE TABLE public.parametres_tresorerie (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annee INTEGER NOT NULL UNIQUE,
  solde_debut NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.parametres_tresorerie ENABLE ROW LEVEL SECURITY;

-- Policies pour les utilisateurs authentifiés
CREATE POLICY "Users can view parametres_tresorerie"
  ON public.parametres_tresorerie
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert parametres_tresorerie"
  ON public.parametres_tresorerie
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update parametres_tresorerie"
  ON public.parametres_tresorerie
  FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger pour updated_at
CREATE TRIGGER update_parametres_tresorerie_updated_at
  BEFORE UPDATE ON public.parametres_tresorerie
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();