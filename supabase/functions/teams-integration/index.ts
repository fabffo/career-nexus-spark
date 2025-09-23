import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

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
      
      // Get Mailtrap API key
      const mailtrapApiKey = Deno.env.get('MAILTRAP_API_KEY');
      
      if (!mailtrapApiKey) {
        throw new Error('MAILTRAP_API_KEY not configured');
      }
      
      // Debug: Log API key info
      console.log('MAILTRAP_API_KEY present:', !!mailtrapApiKey);
      console.log('Key length:', mailtrapApiKey.length);
      console.log('First 8 chars:', mailtrapApiKey.substring(0, 8));
      
      // Create a very simple email payload
      const emailPayload = {
        from: {
          email: "hello@demomailtrap.com",
          name: "Team Recruitment"
        },
        to: recipients.map((email: string) => ({
          email: email.trim()
        })),
        subject: "Invitation Teams Meeting",
        text: message || "You have been invited to a Teams meeting.",
        html: `
          <html>
            <body>
              <h2>Teams Meeting Invitation</h2>
              <p>${message ? message.replace(/\n/g, '<br>') : 'You have been invited to a Teams meeting.'}</p>
              ${teamsLink ? `<p><a href="${teamsLink}">Join Teams Meeting</a></p>` : ''}
            </body>
          </html>
        `
      };
      
      console.log('Email payload:', JSON.stringify(emailPayload, null, 2));
      
      // Make the API call
      try {
        const response = await fetch('https://send.api.mailtrap.io/api/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Token': mailtrapApiKey.trim()
          },
          body: JSON.stringify(emailPayload)
        });
        
        const responseText = await response.text();
        console.log('Mailtrap response status:', response.status);
        console.log('Mailtrap response headers:', JSON.stringify([...response.headers.entries()]));
        console.log('Mailtrap response body:', responseText);
        
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse response:', responseText);
          throw new Error(`Invalid Mailtrap response: ${responseText}`);
        }
        
        if (!response.ok) {
          console.error('Mailtrap error details:', {
            status: response.status,
            statusText: response.statusText,
            body: result,
            apiKeyPreview: mailtrapApiKey.substring(0, 10) + '...'
          });
          
          // Check if it's an auth error
          if (response.status === 401) {
            throw new Error('Mailtrap authentication failed. Please check your API key has Email Sending permissions.');
          }
          
          throw new Error(`Mailtrap API error: ${JSON.stringify(result)}`);
        }
        
        console.log('Email sent successfully:', result);
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Invitation sent successfully',
            details: result
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        throw fetchError;
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