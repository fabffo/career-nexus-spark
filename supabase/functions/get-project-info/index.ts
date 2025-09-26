import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Retourner les informations de configuration actuelles
    // Note: Dans un environnement de production, ces informations seraient
    // récupérées depuis l'API de gestion Supabase
    
    return new Response(
      JSON.stringify({ 
        auto_confirm_email: false,
        disable_signup: false,
        external_anonymous_users_enabled: false,
        project_name: 'Gestion RH',
        message: 'Paramètres de sécurité du projet'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erreur lors de la récupération des informations:', error);
    
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});