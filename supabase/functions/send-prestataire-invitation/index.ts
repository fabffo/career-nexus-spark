import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  prestataireId: string;
  email: string;
  nom: string;
  prenom: string;
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
    const { prestataireId, email, nom, prenom, baseUrl }: InvitationRequest = await req.json();
    
    console.log("Received request for prestataire:", { prestataireId, email, nom, prenom });

    // Générer un token d'invitation
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_invitation_token');
    
    if (tokenError) throw tokenError;
    const token = tokenData;
    
    console.log("Generated token:", token);

    // Mettre à jour le prestataire avec le token
    const { data: prestataire, error: updateError } = await supabase
      .from('prestataires')
      .update({ 
        invitation_token: token,
        invitation_sent_at: new Date().toISOString()
      })
      .eq('id', prestataireId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating prestataire:", updateError);
      throw updateError;
    }

    console.log("Updated prestataire:", prestataire);

    // Construire l'URL d'inscription - utiliser le domaine de l'application
    const signupUrl = `${baseUrl}/candidat-signup?token=${token}&type=PRESTATAIRE`;

    // Envoyer l'email avec Resend
    const emailResponse = await resend.emails.send({
      from: "RH Platform <noreply@wavyservices.fr>",
      to: [email],
      subject: "Invitation à rejoindre la plateforme RH en tant que Prestataire",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                padding: 40px;
                margin: 20px 0;
              }
              .header {
                text-align: center;
                margin-bottom: 40px;
              }
              .header h1 {
                color: #2563eb;
                font-size: 28px;
                margin: 0;
              }
              .content {
                margin-bottom: 30px;
              }
              .content p {
                margin: 16px 0;
              }
              .button-container {
                text-align: center;
                margin: 40px 0;
              }
              .button {
                display: inline-block;
                background: #2563eb;
                color: white !important;
                text-decoration: none;
                padding: 14px 32px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;
              }
              .button:hover {
                background: #1d4ed8;
              }
              .footer {
                text-align: center;
                color: #666;
                font-size: 14px;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
              }
              .warning {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 6px;
                padding: 12px;
                margin: 20px 0;
                font-size: 14px;
                color: #92400e;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Invitation Prestataire</h1>
              </div>
              
              <div class="content">
                <p>Bonjour ${prenom} ${nom},</p>
                
                <p>Vous avez été invité(e) à rejoindre notre plateforme RH en tant que <strong>Prestataire</strong>.</p>
                
                <p>Cette invitation vous permettra de :</p>
                <ul>
                  <li>Accéder à votre espace personnel</li>
                  <li>Consulter les contrats qui vous concernent</li>
                  <li>Gérer vos documents (CV, recommandations)</li>
                  <li>Suivre vos missions et prestations</li>
                </ul>
                
                <div class="button-container">
                  <a href="${signupUrl}" class="button" style="display: inline-block; background: #2563eb; color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">Créer mon compte</a>
                </div>
                
                <p style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
                  Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br/>
                  <a href="${signupUrl}" style="color: #2563eb; word-break: break-all;">${signupUrl}</a>
                </p>
                
                <div class="warning">
                  <strong>Important :</strong> Ce lien d'invitation est unique et sécurisé. Il expirera dans 7 jours.
                </div>
                
                <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
              </div>
              
              <div class="footer">
                <p>Cet email a été envoyé par la plateforme RH.</p>
                <p>Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Enregistrer l'historique de l'email
    await supabase
      .from('email_history')
      .insert({
        recipient_email: email,
        recipient_name: `${prenom} ${nom}`,
        subject: "Invitation à rejoindre la plateforme RH en tant que Prestataire",
        email_type: 'prestataire_invitation',
        status: 'sent',
        metadata: {
          prestataire_id: prestataireId,
          resend_id: (emailResponse as any).id || null
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invitation envoyée avec succès",
        data: emailResponse 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-prestataire-invitation function:", error);
    
    // Enregistrer l'échec dans l'historique
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { email, nom, prenom } = await req.json();
        
        await supabase
          .from('email_history')
          .insert({
            recipient_email: email || 'unknown',
            recipient_name: `${prenom || ''} ${nom || ''}`,
            subject: "Invitation à rejoindre la plateforme RH en tant que Prestataire",
            email_type: 'prestataire_invitation',
            status: 'failed',
            error_message: error.message
          });
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);