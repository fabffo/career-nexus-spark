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
    const graphApiKey = Deno.env.get('MICROSOFT_GRAPH_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Teams integration action:', action);

    switch (action) {
      case 'create-meeting': {
        const { rdv, attendeeEmails } = data;
        
        // Format the meeting for Microsoft Graph API
        const meeting = {
          subject: `Rendez-vous - ${rdv.candidatName || 'Candidat'} avec ${rdv.clientName || 'Client'}`,
          body: {
            contentType: "HTML",
            content: `
              <h3>Détails du rendez-vous</h3>
              <p><strong>Date et heure:</strong> ${new Date(rdv.date).toLocaleString('fr-FR')}</p>
              <p><strong>Type:</strong> ${rdv.typeRdv}</p>
              ${rdv.lieu ? `<p><strong>Lieu:</strong> ${rdv.lieu}</p>` : ''}
              ${rdv.notes ? `<p><strong>Notes:</strong> ${rdv.notes}</p>` : ''}
            `
          },
          start: {
            dateTime: rdv.date,
            timeZone: "Europe/Paris"
          },
          end: {
            dateTime: new Date(new Date(rdv.date).getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
            timeZone: "Europe/Paris"
          },
          location: {
            displayName: rdv.lieu || "Microsoft Teams"
          },
          attendees: attendeeEmails?.map((email: string) => ({
            emailAddress: { address: email },
            type: "required"
          })) || [],
          isOnlineMeeting: rdv.typeRdv === 'TEAMS',
          onlineMeetingProvider: rdv.typeRdv === 'TEAMS' ? "teamsForBusiness" : undefined
        };

        console.log('Creating Teams meeting:', meeting);

        // Call Microsoft Graph API to create the meeting
        const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${graphApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(meeting)
        });

        if (!graphResponse.ok) {
          const errorData = await graphResponse.text();
          console.error('Microsoft Graph API error:', errorData);
          throw new Error(`Failed to create Teams meeting: ${errorData}`);
        }

        const meetingData = await graphResponse.json();
        console.log('Teams meeting created successfully:', meetingData);

        // Update the RDV with the Teams meeting link if available
        if (meetingData.onlineMeeting?.joinUrl && rdv.id) {
          const { error: updateError } = await supabase
            .from('rdvs')
            .update({ 
              teams_link: meetingData.onlineMeeting.joinUrl,
              teams_meeting_id: meetingData.id
            })
            .eq('id', rdv.id);

          if (updateError) {
            console.error('Error updating RDV with Teams link:', updateError);
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            meetingId: meetingData.id,
            joinUrl: meetingData.onlineMeeting?.joinUrl,
            webLink: meetingData.webLink
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-invitation': {
        const { rdv, recipients, message } = data;
        
        // Create email invitation
        const emailContent = {
          message: {
            subject: `Invitation: Rendez-vous du ${new Date(rdv.date).toLocaleDateString('fr-FR')}`,
            body: {
              contentType: "HTML",
              content: message.replace(/\n/g, '<br/>')
            },
            toRecipients: recipients.map((email: string) => ({
              emailAddress: { address: email }
            }))
          }
        };

        console.log('Sending invitation email:', emailContent);

        // Send email via Microsoft Graph API
        const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${graphApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailContent)
        });

        if (!graphResponse.ok) {
          const errorData = await graphResponse.text();
          console.error('Microsoft Graph API error:', errorData);
          throw new Error(`Failed to send invitation: ${errorData}`);
        }

        console.log('Invitation sent successfully');

        return new Response(
          JSON.stringify({ success: true, message: 'Invitation envoyée avec succès' }),
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