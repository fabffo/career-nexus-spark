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
      console.log('Creating meeting invitation for:', rdv);
      
      // Generate a simple meeting ID
      const meetingId = crypto.randomUUID();
      
      // Generate Teams meeting link placeholder
      const teamsLink = `https://teams.microsoft.com/l/meetup-join/${meetingId}`;
      
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
        subject: `Rendez-vous - ${rdv.candidatName || 'Candidat'} avec Client`,
        date: new Date(rdv.date).toLocaleString('fr-FR'),
        type: rdv.typeRdv,
        teamsLink: teamsLink
      };

      return new Response(
        JSON.stringify({
          success: true,
          meetingId,
          joinUrl: teamsLink,
          meetingDetails
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send-invitation') {
      const { rdv, recipients, message } = data;
      const teamsLink = rdv.teams_link || 'https://teams.microsoft.com/l/meetup-join/placeholder';
      
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
      // Use 'onboarding@resend.dev' for testing or your verified domain for production
      const fromAddress = 'onboarding@resend.dev'; // Change to 'noreply@yourdomain.com' after domain verification
      
      // Create HTML email content
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
              .teams-link { 
                display: inline-block; 
                background-color: #5558AF; 
                color: white; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 4px; 
                margin: 20px 0;
              }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Invitation Teams Meeting</h2>
              <div>${message ? message.replace(/\n/g, '<br>') : 'Vous êtes invité(e) à une réunion Teams.'}</div>
              ${teamsLink ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${teamsLink}" class="teams-link">Rejoindre la réunion Teams</a>
                </div>
              ` : ''}
              <div class="footer">
                <p>Cordialement,<br>L'équipe de recrutement</p>
              </div>
            </div>
          </body>
        </html>
      `;
      
      try {
        // Send email using Resend
        const emailResponse = await resend.emails.send({
          from: fromAddress, // Uses the configured from address
          to: recipients,
          subject: 'Invitation Teams Meeting',
          html: htmlContent,
          text: message || 'Vous êtes invité(e) à une réunion Teams.'
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