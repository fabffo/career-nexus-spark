import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  candidatId: string;
  baseUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { candidatId, baseUrl }: InvitationRequest = await req.json();
    
    console.log("Received request - candidatId:", candidatId, "baseUrl:", baseUrl);

    // Générer un token d'invitation
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_invitation_token');
    
    if (tokenError) throw tokenError;
    const token = tokenData;
    
    console.log("Generated token:", token);

    // Mettre à jour le candidat avec le token
    const { data: candidat, error: updateError } = await supabase
      .from('candidats')
      .update({ 
        invitation_token: token,
        invitation_sent_at: new Date().toISOString()
      })
      .eq('id', candidatId)
      .select()
      .single();

    if (updateError) throw updateError;
    
    console.log("Updated candidat:", candidat.email);

    // Créer le lien d'invitation
    const invitationLink = `${baseUrl}/candidat/signup?token=${token}&type=CANDIDAT`;
    
    console.log("Generated invitation link:", invitationLink);

    // Envoyer l'email
    let emailStatus = 'sent';
    let emailError = null;
    let emailResponse = null;

    try {
      emailResponse = await resend.emails.send({
        from: "RH Platform <noreply@wavyservices.fr>",
        to: [candidat.email],
        subject: "Invitation à créer votre espace candidat",
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; text-align: center;">Bienvenue ${candidat.prenom} ${candidat.nom} !</h1>
            </div>
            
            <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none;">
              <p style="font-size: 16px;">Nous sommes ravis de vous inviter à créer votre espace candidat personnel.</p>
              
              <p style="font-size: 16px;">Cet espace vous permettra de :</p>
              <ul style="font-size: 16px;">
                <li>Consulter vos candidatures et leur statut</li>
                <li>Voir vos entretiens programmés</li>
                <li>Accéder à l'historique de vos rendez-vous</li>
                <li>Suivre l'évolution de votre processus de recrutement</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold;">
                  Créer mon espace candidat
                </a>
              </div>
              
              <p style="font-size: 12px; color: #888; text-align: center; margin: 20px 0;">
                Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br/>
                <span style="color: #667eea; word-break: break-all;">${invitationLink}</span>
              </p>
              
              <p style="font-size: 14px; color: #666;">Ce lien est valable pendant 7 jours. Si vous n'avez pas demandé cet accès, vous pouvez ignorer cet email.</p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
              <p>© 2024 RH Platform. Tous droits réservés.</p>
            </div>
          </body>
          </html>
        `,
      });
      
      console.log("Email sent successfully:", emailResponse);
    } catch (err: any) {
      emailStatus = 'failed';
      emailError = err.message || 'Erreur lors de l\'envoi';
      console.error("Error sending email:", err);
    }

    // Enregistrer dans l'historique des emails
    try {
      await supabase.from('email_history').insert({
        recipient_email: candidat.email,
        recipient_name: `${candidat.prenom} ${candidat.nom}`,
        subject: "Invitation à créer votre espace candidat",
        email_type: 'invitation_candidat',
        status: emailStatus,
        error_message: emailError,
        metadata: { candidat_id: candidatId, invitation_token: token }
      });
    } catch (historyError) {
      console.error('Error saving email history:', historyError);
    }

    if (emailStatus === 'failed') {
      throw new Error(emailError || 'Erreur lors de l\'envoi de l\'email');
    }

    return new Response(
      JSON.stringify({ success: true, message: "Invitation envoyée avec succès" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);