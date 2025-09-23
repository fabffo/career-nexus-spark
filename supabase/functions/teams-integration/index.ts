import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Microsoft Graph API configuration
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

// Function to get access token from Microsoft
async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get('AZURE_TENANT_ID');
  const clientId = Deno.env.get('AZURE_CLIENT_ID');
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET');

  console.log('Azure credentials check:', {
    tenantId: tenantId ? `${tenantId.substring(0, 8)}...` : 'NOT SET',
    clientId: clientId ? `${clientId.substring(0, 8)}...` : 'NOT SET',
    clientSecret: clientSecret ? 'SET (length: ' + clientSecret.length + ')' : 'NOT SET'
  });

  if (!tenantId || !clientId || !clientSecret) {
    const missing = [];
    if (!tenantId) missing.push('AZURE_TENANT_ID');
    if (!clientId) missing.push('AZURE_CLIENT_ID');
    if (!clientSecret) missing.push('AZURE_CLIENT_SECRET');
    throw new Error(`Azure AD credentials missing: ${missing.join(', ')}`);
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  try {
    console.log('Requesting token from:', tokenUrl);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: GRAPH_SCOPE,
        grant_type: 'client_credentials',
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Token request failed with status:', response.status);
      console.error('Error response:', responseText);
      
      // Parse error for more details
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error_description) {
          throw new Error(`Azure AD: ${errorData.error_description}`);
        }
      } catch {
        // If not JSON, use raw text
      }
      
      throw new Error(`Failed to authenticate with Microsoft: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    console.log('Successfully obtained access token');
    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

// Function to create Teams meeting
async function createTeamsMeeting(rdv: any): Promise<any> {
  try {
    const accessToken = await getAccessToken();
    
    // Get the first user to create meeting on behalf of
    const usersResponse = await fetch(`${GRAPH_API_URL}/users?$top=1&$select=id,mail,displayName`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!usersResponse.ok) {
      const error = await usersResponse.text();
      console.error('Failed to get users:', error);
      throw new Error('Failed to get users from Microsoft Graph');
    }

    const usersData = await usersResponse.json();
    if (!usersData.value || usersData.value.length === 0) {
      throw new Error('No users found in the organization');
    }

    const organizerUser = usersData.value[0];
    console.log('Creating meeting for organizer:', organizerUser.mail);

    // Calculate meeting times
    const startDateTime = new Date(rdv.date);
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1); // 1 hour meeting by default

    // Create the online meeting
    const meetingResponse = await fetch(`${GRAPH_API_URL}/users/${organizerUser.id}/onlineMeetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        subject: `Rendez-vous - ${rdv.candidatName || 'Candidat'}`,
        participants: {
          organizer: {
            identity: {
              user: {
                id: organizerUser.id
              }
            }
          }
        },
        allowedPresenters: 'everyone',
        isEntryExitAnnounced: true,
        lobbyBypassSettings: {
          scope: 'everyone',
          isDialInBypassEnabled: true
        }
      }),
    });

    if (!meetingResponse.ok) {
      const error = await meetingResponse.text();
      console.error('Failed to create meeting:', error);
      throw new Error('Failed to create Teams meeting');
    }

    const meetingData = await meetingResponse.json();
    console.log('Teams meeting created successfully:', meetingData.id);
    return meetingData;
  } catch (error) {
    console.error('Error creating Teams meeting:', error);
    throw error;
  }
}

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
      console.log('Creating real Teams meeting for:', rdv);
      
      try {
        // Create real Teams meeting using Microsoft Graph API
        const meeting = await createTeamsMeeting(rdv);
        
        // Extract the join URL and meeting ID
        const teamsLink = meeting.joinUrl || meeting.joinWebUrl;
        const meetingId = meeting.id;
        
        console.log('Meeting created with link:', teamsLink);
        
        // Update the RDV with the real Teams link
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
          subject: meeting.subject,
          date: new Date(rdv.date).toLocaleString('fr-FR'),
          type: rdv.typeRdv,
          teamsLink: teamsLink,
          audioConferencing: meeting.audioConferencing
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
      } catch (meetingError) {
        console.error('Failed to create Teams meeting, using fallback:', meetingError);
        
        // Fallback to placeholder if Graph API fails
        const meetingId = crypto.randomUUID();
        const teamsLink = `https://teams.microsoft.com/l/meetup-join/${meetingId}`;
        
        if (rdv.id) {
          await supabase
            .from('rdvs')
            .update({ 
              teams_link: teamsLink,
              teams_meeting_id: meetingId 
            })
            .eq('id', rdv.id);
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            meetingId,
            joinUrl: teamsLink,
            meetingDetails: {
              subject: `Rendez-vous - ${rdv.candidatName || 'Candidat'}`,
              date: new Date(rdv.date).toLocaleString('fr-FR'),
              type: rdv.typeRdv,
              teamsLink: teamsLink
            },
            warning: 'Using fallback Teams link due to API error'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
                    <a href="${teamsLink}" class="teams-button">🎥 Rejoindre la réunion Teams</a>
                  </div>
                  
                  <div class="instructions">
                    <h3>Comment rejoindre la réunion :</h3>
                    <ol>
                      <li>Cliquez sur le bouton "Rejoindre la réunion Teams" ci-dessus</li>
                      <li>Choisissez de rejoindre via votre navigateur ou l'application Teams</li>
                      <li>Entrez votre nom si demandé</li>
                      <li>Activez votre caméra et microphone</li>
                      <li>Cliquez sur "Rejoindre maintenant"</li>
                    </ol>
                  </div>
                  
                  <div class="meeting-details">
                    <p><strong>Lien de la réunion :</strong></p>
                    <p style="word-break: break-all; color: #5558AF;">${teamsLink}</p>
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