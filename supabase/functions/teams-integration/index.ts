import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    console.log('Teams integration action:', action);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (action === 'create-meeting') {
      const { rdv, attendeeEmails } = data;
      console.log('Creating Teams meeting for:', rdv);
      
      // Generate a unique meeting ID
      const meetingId = crypto.randomUUID();
      
      // Create a properly formatted Teams meeting link
      // Note: This creates a link format that Teams recognizes for quick meetings
      const startDateTime = new Date(rdv.date);
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(endDateTime.getHours() + 1); // 1 hour meeting
      
      // Format the meeting subject
      const subject = encodeURIComponent(`Rendez-vous - ${rdv.candidatName || rdv.candidat?.prenom + ' ' + rdv.candidat?.nom || 'Candidat'}`);
      const content = encodeURIComponent(`Entretien de recrutement avec ${rdv.candidatName || 'le candidat'}`);
      
      // Create Teams meeting URL with deep link format
      // This will open Teams and prompt to create a meeting
      const teamsLink = `https://teams.microsoft.com/l/meeting/new?subject=${subject}&content=${content}&startTime=${startDateTime.toISOString()}&endTime=${endDateTime.toISOString()}`;
      
      console.log('Generated Teams link:', teamsLink);
      
      // Update the RDV with the Teams link
      if (rdv.id) {
        const { error: updateError } = await supabase
          .from('rdvs')
          .update({ 
            teams_link: teamsLink,
            teams_meeting_id: meetingId 
          })
          .eq('id', rdv.id);

        if (updateError) {
          console.error('Error updating RDV:', updateError);
        }
      }
      
      // Prepare meeting details for response
      const meetingDetails = {
        subject: `Rendez-vous - ${rdv.candidatName || 'Candidat'}`,
        date: new Date(rdv.date).toLocaleString('fr-FR'),
        type: rdv.typeRdv,
        teamsLink: teamsLink
      };

      return new Response(
        JSON.stringify({
          success: true,
          meetingId,
          joinUrl: teamsLink,
          meetingDetails,
          info: 'Lien Teams généré. L\'organisateur devra créer la réunion dans Teams.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send-invitation') {
      const { rdv, recipients, message } = data;
      const teamsLink = rdv.teams_link || `https://teams.microsoft.com/l/meeting/new?subject=${encodeURIComponent('Rendez-vous')}`;
      
      console.log('Sending invitation to:', recipients);
      console.log('Message:', message);
      
      // Initialize Resend with API key
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      
      if (!resendApiKey) {
        throw new Error('RESEND_API_KEY not configured');
      }
      
      const resend = new Resend(resendApiKey);
      
      console.log('Using Resend to send email');
      
      // Determine the from address based on environment
      const fromAddress = 'onboarding@resend.dev'; // Change to 'noreply@yourdomain.com' after domain verification
      
      // Create HTML email content with Teams meeting details
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #5558AF 0%, #7B5FFA 100%); color: white; padding: 30px 20px; text-align: center; }
              .header h2 { margin: 0; font-size: 24px; }
              .content { padding: 30px 20px; }
              .teams-button { 
                display: inline-block; 
                background-color: #5558AF; 
                color: white; 
                padding: 14px 28px; 
                text-decoration: none; 
                border-radius: 4px; 
                margin: 25px 0;
                font-weight: 600;
                font-size: 16px;
              }
              .teams-button:hover { background-color: #464B9F; }
              .meeting-details { 
                background: #f8f9fa; 
                border-left: 4px solid #5558AF; 
                padding: 15px; 
                margin: 20px 0;
                border-radius: 4px;
              }
              .meeting-details p { margin: 8px 0; }
              .meeting-details strong { color: #5558AF; }
              .instructions { 
                background: #e8f4fd; 
                padding: 15px; 
                border-radius: 4px; 
                margin: 20px 0;
              }
              .instructions h3 { color: #2c3e50; margin-top: 0; }
              .instructions ol { margin: 10px 0; padding-left: 20px; }
              .footer { 
                background: #f8f9fa; 
                padding: 20px; 
                text-align: center; 
                color: #666; 
                font-size: 14px; 
                border-top: 1px solid #e0e0e0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>📅 Invitation Microsoft Teams</h2>
              </div>
              <div class="content">
                <div>${message ? message.replace(/\n/g, '<br>') : 'Vous êtes invité(e) à une réunion Microsoft Teams.'}</div>
                
                ${teamsLink ? `
                  <div style="text-align: center;">
                    <a href="${teamsLink}" class="teams-button">🎥 Créer/Rejoindre la réunion Teams</a>
                  </div>
                  
                  <div class="instructions">
                    <h3>Comment utiliser ce lien :</h3>
                    <ol>
                      <li>Cliquez sur le bouton ci-dessus</li>
                      <li>Teams s'ouvrira (dans votre navigateur ou l'application)</li>
                      <li>Si vous êtes l'organisateur, créez la réunion avec les participants</li>
                      <li>Si vous êtes invité, attendez que l'organisateur partage le lien de réunion final</li>
                    </ol>
                  </div>
                  
                  <div class="meeting-details">
                    <p><strong>Note importante :</strong></p>
                    <p>Ce lien permet de préparer une réunion Teams. L'organisateur devra finaliser la création dans Teams et partager le lien de réunion définitif avec les participants.</p>
                  </div>
                ` : ''}
                
                <p style="margin-top: 30px;">Si vous avez des questions ou des problèmes de connexion, n'hésitez pas à nous contacter.</p>
              </div>
              <div class="footer">
                <p>Cordialement,<br><strong>L'équipe de recrutement</strong></p>
                <p style="font-size: 12px; color: #999; margin-top: 15px;">
                  Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
                </p>
              </div>
            </div>
          </body>
        </html>
      `;
      
      try {
        // Send email using Resend
        const emailResponse = await resend.emails.send({
          from: fromAddress,
          to: recipients,
          subject: 'Invitation - Réunion Microsoft Teams',
          html: htmlContent,
          text: message || 'Vous êtes invité(e) à une réunion Microsoft Teams.'
        });
        
        console.log('Email sent successfully via Resend:', emailResponse);
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Invitation envoyée avec succès',
            details: emailResponse
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (sendError) {
        console.error('Resend error:', sendError);
        throw new Error(`Erreur d'envoi email: ${sendError.message}`);
      }
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error('Error in Teams integration:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});