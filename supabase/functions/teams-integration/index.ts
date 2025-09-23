import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Teams integration action:', action);

    switch (action) {
      case 'create-meeting': {
        const { rdv, attendeeEmails } = data;
        
        // For now, we'll generate a simple meeting link format
        // In production, you would integrate with Teams API using proper OAuth2
        const meetingId = crypto.randomUUID();
        const teamsLink = `https://teams.microsoft.com/l/meetup-join/${meetingId}`;
        
        console.log('Creating meeting invitation for:', rdv);

        // Update the RDV with the generated Teams link
        if (rdv.id) {
          const { error: updateError } = await supabase
            .from('rdvs')
            .update({ 
              teams_link: teamsLink,
              teams_meeting_id: meetingId
            })
            .eq('id', rdv.id);

          if (updateError) {
            console.error('Error updating RDV with Teams link:', updateError);
          }
        }

        // Create meeting details for email
        const meetingDetails = {
          subject: `Rendez-vous - ${rdv.candidatName || 'Candidat'} avec ${rdv.clientName || 'Client'}`,
          date: new Date(rdv.date).toLocaleString('fr-FR'),
          type: rdv.typeRdv,
          lieu: rdv.lieu,
          notes: rdv.notes,
          teamsLink: rdv.typeRdv === 'TEAMS' ? teamsLink : null
        };

        return new Response(
          JSON.stringify({ 
            success: true, 
            meetingId: meetingId,
            joinUrl: teamsLink,
            meetingDetails: meetingDetails
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-invitation': {
        const { rdv, recipients, message } = data;
        
        console.log('Sending invitation to:', recipients);
        console.log('Message:', message);
        
        // Send real email using Mailtrap
        const mailtrapApiKey = Deno.env.get('MAILTRAP_API_KEY');
        
        if (!mailtrapApiKey) {
          throw new Error('MAILTRAP_API_KEY not configured');
        }

        // Prepare email data for Mailtrap
        const emailData = {
          from: {
            email: "hello@demomailtrap.com",
            name: "Équipe de Recrutement"
          },
          to: recipients.map((email: string) => ({ email })),
          subject: `Invitation Teams - Rendez-vous du ${new Date(rdv.date).toLocaleDateString('fr-FR')}`,
          text: message,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
              <div style="max-width: 600px; margin: 20px auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="background-color: #5558DD; color: white; padding: 30px; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 24px;">Invitation Teams</h1>
                  <p style="margin: 10px 0 0 0; opacity: 0.9;">Rendez-vous de recrutement</p>
                </div>
                <div style="padding: 30px;">
                  <div style="white-space: pre-wrap; line-height: 1.8; color: #333;">${message.replace(/\n/g, '<br>')}</div>
                  
                  ${rdv.teams_link ? `
                    <div style="margin-top: 30px; padding: 20px; background-color: #f0f2ff; border-radius: 8px; border-left: 4px solid #5558DD;">
                      <h3 style="margin: 0 0 10px 0; color: #5558DD;">Rejoindre la réunion</h3>
                      <a href="${rdv.teams_link}" style="display: inline-block; padding: 12px 24px; background-color: #5558DD; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Cliquer ici pour rejoindre</a>
                    </div>
                  ` : ''}
                </div>
                <div style="padding: 20px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center; color: #666; font-size: 12px;">
                  <p style="margin: 0;">Cet email a été envoyé depuis notre plateforme de recrutement</p>
                  <p style="margin: 5px 0 0 0;">© 2025 - Tous droits réservés</p>
                </div>
              </div>
            </body>
            </html>
          `,
          category: "Integration Test"
        };

        console.log('Sending email with Mailtrap API...');
        
        // Send email via Mailtrap API
        const mailtrapResponse = await fetch('https://send.api.mailtrap.io/api/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Api-Token': mailtrapApiKey,
          },
          body: JSON.stringify(emailData),
        });

        const mailtrapResult = await mailtrapResponse.json();
        
        if (!mailtrapResponse.ok) {
          console.error('Mailtrap API error:', mailtrapResult);
          console.error('Status:', mailtrapResponse.status);
          console.error('Headers used:', {
            'Api-Token': mailtrapApiKey ? 'Present' : 'Missing',
            'Token length': mailtrapApiKey ? mailtrapApiKey.length : 0
          });
          throw new Error(`Failed to send email: ${JSON.stringify(mailtrapResult)}`);
        }

        console.log('Email sent successfully via Mailtrap:', mailtrapResult);
        
        // Store invitation record
        const invitationData = {
          rdv_id: rdv.id,
          recipients: recipients,
          message: message,
          sent_at: new Date().toISOString(),
          status: 'sent',
          mailtrap_response: mailtrapResult
        };
        
        console.log('Invitation data:', invitationData);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Invitation envoyée avec succès via Mailtrap!',
            details: {
              recipients: recipients,
              rdvDate: new Date(rdv.date).toLocaleString('fr-FR'),
              mailtrap_message_id: mailtrapResult.message_ids
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
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