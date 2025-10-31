import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyCodeRequest {
  userId: string;
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, code }: VerifyCodeRequest = await req.json();

    console.log('Verifying 2FA code for user:', userId);

    // Get the stored code
    const { data: storedCode, error: fetchError } = await supabase
      .from('two_factor_codes')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !storedCode) {
      console.error('Code not found:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Code invalide ou expiré' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if code has expired
    if (new Date(storedCode.expires_at) < new Date()) {
      await supabase.from('two_factor_codes').delete().eq('id', storedCode.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Code expiré' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempts
    if (storedCode.attempts >= 3) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nombre maximum de tentatives atteint. Demandez un nouveau code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the provided code
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const codeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Verify code
    if (codeHash !== storedCode.code_hash) {
      // Increment attempts
      await supabase
        .from('two_factor_codes')
        .update({ attempts: storedCode.attempts + 1 })
        .eq('id', storedCode.id);

      const remainingAttempts = 3 - (storedCode.attempts + 1);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Code incorrect. ${remainingAttempts} tentative${remainingAttempts > 1 ? 's' : ''} restante${remainingAttempts > 1 ? 's' : ''}.`,
          remainingAttempts 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Code is valid - delete it
    await supabase.from('two_factor_codes').delete().eq('id', storedCode.id);

    console.log('2FA code verified successfully for user:', userId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in verify-2fa-code:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
