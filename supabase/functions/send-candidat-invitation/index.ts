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

    // Générer un token d'invitation
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_invitation_token');
    
    if (tokenError) throw tokenError;
    const token = tokenData;

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

    // Créer le lien d'invitation
    const invitationLink = `${baseUrl}/candidat/signup?token=${token}`;

    // Envoyer l'email
    const emailResponse = await resend.emails.send({
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