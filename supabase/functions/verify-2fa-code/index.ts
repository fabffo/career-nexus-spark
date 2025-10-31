import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const verify2FASchema = z.object({
  userId: z.string().uuid({ message: "Invalid user ID format" }),
  code: z.string().regex(/^\d{6}$/, { message: "Code must be exactly 6 digits" }),
});

// Constant-time string comparison to prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = await req.json();
    
    // Validate input
    const validation = verify2FASchema.safeParse(requestBody);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validation.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, code } = validation.data;

    // Rate limiting - prevent brute force attacks
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const { data: rateLimitResult } = await supabase.rpc('check_rate_limit', {
      _identifier: `${clientIp}:${userId}`,
      _attempt_type: 'verify_code',
      _max_attempts: 5,
      _window_minutes: 15
    });

    if (rateLimitResult && !rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for IP ${clientIp} verifying code for user ${userId}`);
      return new Response(
        JSON.stringify({ error: rateLimitResult.message }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Verify code using constant-time comparison to prevent timing attacks
    if (!constantTimeCompare(codeHash, storedCode.code_hash)) {
      // Add random delay to prevent timing analysis
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
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
