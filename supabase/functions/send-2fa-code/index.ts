import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const send2FASchema = z.object({
  email: z.string().email({ message: "Invalid email format" }).max(255),
  userId: z.string().uuid({ message: "Invalid user ID format" }),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    const requestBody = await req.json();
    
    // Validate input
    const validation = send2FASchema.safeParse(requestBody);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validation.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, userId } = validation.data;

    // Rate limiting - prevent email spam
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const { data: rateLimitResult } = await supabase.rpc('check_rate_limit', {
      _identifier: `${clientIp}:${userId}`,
      _attempt_type: 'send_code',
      _max_attempts: 3,
      _window_minutes: 15
    });

    if (rateLimitResult && !rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for IP ${clientIp} sending code to user ${userId}`);
      return new Response(
        JSON.stringify({ error: rateLimitResult.message }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the userId exists and email matches
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData.user || userData.user.email !== email) {
      console.error(`Invalid user/email combination: ${userId} / ${email}`);
      return new Response(
        JSON.stringify({ error: 'Invalid user or email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating 2FA code for user:', userId);

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash the code using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const codeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Calculate expiration time (10 minutes from now)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete any existing codes for this user
    await supabase
      .from('two_factor_codes')
      .delete()
      .eq('user_id', userId);

    // Store the hashed code
    const { error: dbError } = await supabase
      .from('two_factor_codes')
      .insert({
        user_id: userId,
        code_hash: codeHash,
        method: 'email',
        expires_at: expiresAt,
        attempts: 0,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store 2FA code');
    }

    // Send email with code
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #0066cc; }
            .content { padding: 30px 0; }
            .code-box { background: #f5f5f5; border: 2px dashed #0066cc; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0066cc; }
            .info { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px 0; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; color: #0066cc;">Code de vérification</h1>
            </div>
            <div class="content">
              <p>Bonjour,</p>
              <p>Voici votre code de vérification pour vous connecter à votre compte :</p>
              <div class="code-box">
                <div class="code">${code}</div>
                <p style="margin: 10px 0 0 0; color: #666;">Valide pendant 10 minutes</p>
              </div>
              <div class="info">
                <strong>⚠️ Sécurité :</strong> Si vous n'avez pas demandé ce code, ignorez cet email et changez votre mot de passe immédiatement.
              </div>
              <p>Ce code ne peut être utilisé qu'une seule fois et expire dans 10 minutes.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Wavy Services. Tous droits réservés.</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: 'Wavy Services <noreply@wavyservices.fr>',
      to: [email],
      subject: 'Code de vérification - Wavy Services',
      html: emailHtml,
    });

    if (emailError) {
      console.error('Email error:', emailError);
      throw new Error('Failed to send email');
    }

    console.log('2FA code sent successfully to:', email);

    return new Response(
      JSON.stringify({ success: true, expiresAt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-2fa-code:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
