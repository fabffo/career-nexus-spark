import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandidatCreate {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  metier?: string;
  adresse?: string;
  cv_url?: string;
  recommandation_url?: string;
  detail_cv?: string;
}

interface CandidatUpdate extends Partial<CandidatCreate> {}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/api-candidats')[1] || '/';
    const method = req.method;

    console.log(`API Request: ${method} ${path}`);

    // GET /api-candidats - List all candidats
    if (method === 'GET' && path === '/') {
      const { data, error } = await supabase
        .from('candidats')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-candidats/:id - Get single candidat
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
      const id = path.substring(1);
      const { data, error } = await supabase
        .from('candidats')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-candidats - Create candidat
    if (method === 'POST' && path === '/') {
      const body: CandidatCreate = await req.json();
      
      const { data, error } = await supabase
        .from('candidats')
        .insert(body)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { 
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // PUT /api-candidats/:id - Update candidat
    if (method === 'PUT' && path.match(/^\/[a-f0-9-]+$/)) {
      const id = path.substring(1);
      console.log(`Updating candidat ${id}`);
      
      const body: CandidatUpdate = await req.json();
      console.log('Update data:', JSON.stringify(body));
      
      const { data, error } = await supabase
        .from('candidats')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      console.log('Update successful:', data);
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-candidats/:id - Delete candidat
    if (method === 'DELETE' && path.match(/^\/[a-f0-9-]+$/)) {
      const id = path.substring(1);
      
      const { error } = await supabase
        .from('candidats')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Candidat deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-candidats/count - Count candidats
    if (method === 'GET' && path === '/count') {
      const { count, error } = await supabase
        .from('candidats')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: { count } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route not found
    return new Response(
      JSON.stringify({ success: false, error: 'Route not found' }),
      { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('API Error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
