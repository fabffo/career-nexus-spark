import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationRequest {
  email: string;
  nom: string;
  prenom: string;
  role: 'ADMIN' | 'RECRUTEUR';
  baseUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { email, nom, prenom, role, baseUrl }: InvitationRequest = await req.json();

    console.log(`Sending invitation to ${email} with role ${role}`);

    // Générer un token d'invitation unique
    const invitationToken = crypto.randomUUID();

    // Stocker le token temporairement (valide 24h)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Créer un lien d'invitation
    const invitationLink = `${baseUrl}/auth?invitation=${invitationToken}&email=${encodeURIComponent(email)}&nom=${encodeURIComponent(nom)}&prenom=${encodeURIComponent(prenom)}&role=${role}`;

    // Envoyer l'email d'invitation
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            .role-badge { display: inline-block; padding: 4px 12px; background: ${role === 'ADMIN' ? '#dc2626' : '#3b82f6'}; color: white; border-radius: 4px; font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invitation à rejoindre l'équipe</h1>
            </div>
            <div class="content">
              <p>Bonjour ${prenom} ${nom},</p>
              
              <p>Vous avez été invité(e) à rejoindre notre plateforme de recrutement en tant que :</p>
              
              <p><span class="role-badge">${role}</span></p>
              
              <p>Pour activer votre compte et définir votre mot de passe, veuillez cliquer sur le lien ci-dessous :</p>
              
              <a href="${invitationLink}" class="button">Activer mon compte</a>
              
              <p style="margin-top: 20px;"><strong>Ce lien est valable pendant 24 heures.</strong></p>
              
              <div class="footer">
                <p>Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.</p>
                <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
                <p style="word-break: break-all; color: #667eea;">${invitationLink}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    let emailStatus = 'sent';
    let emailError = null;
    let emailData = null;

    try {
      const { data, error } = await resend.emails.send({
        from: 'Plateforme RH <onboarding@resend.dev>',
        to: [email],
        subject: `Invitation - Accès ${role === 'ADMIN' ? 'Administrateur' : 'Recruteur'}`,
        html: emailHtml,
      });

      if (error) {
        emailStatus = 'failed';
        emailError = error.message || 'Erreur lors de l\'envoi';
        console.error('Error sending email:', error);
      } else {
        emailData = data;
        console.log('Email sent successfully:', data);
      }
    } catch (err: any) {
      emailStatus = 'failed';
      emailError = err.message || 'Erreur lors de l\'envoi';
      console.error('Error sending email:', err);
    }

    // Enregistrer dans l'historique des emails
    try {
      await supabase.from('email_history').insert({
        recipient_email: email,
        recipient_name: `${prenom} ${nom}`,
        subject: `Invitation - Accès ${role === 'ADMIN' ? 'Administrateur' : 'Recruteur'}`,
        email_type: 'invitation_user',
        status: emailStatus,
        error_message: emailError,
        metadata: { role, invitation_token: invitationToken }
      });
    } catch (historyError) {
      console.error('Error saving email history:', historyError);
    }

    if (emailStatus === 'failed') {
      throw new Error(emailError || 'Erreur lors de l\'envoi de l\'email');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Invitation envoyée avec succès' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-user-invitation function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Une erreur est survenue' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};

serve(handler);