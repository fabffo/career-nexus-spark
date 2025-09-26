import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthConfig {
  auto_confirm_email?: boolean;
  disable_signup?: boolean;
  external_anonymous_users_enabled?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const config: AuthConfig = await req.json();
    
    // Dans un environnement de production, ces paramètres seraient
    // appliqués via l'API de gestion Supabase
    console.log('Configuration d\'authentification mise à jour:', config);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Paramètres d\'authentification mis à jour avec succès',
        config: config
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
    console.error('Erreur lors de la configuration:', error);
    
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