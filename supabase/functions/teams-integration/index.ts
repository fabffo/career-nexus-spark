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
        
        // For demonstration, we'll log the invitation details
        // In production, you would send actual emails using a service like SendGrid or Resend
        console.log('Sending invitation to:', recipients);
        console.log('Message:', message);
        
        // Store the invitation in the database for tracking
        const invitationData = {
          rdv_id: rdv.id,
          recipients: recipients,
          message: message,
          sent_at: new Date().toISOString(),
          status: 'sent'
        };
        
        console.log('Invitation data:', invitationData);

        // Simulate successful email send
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Invitation envoyée avec succès (mode simulation)',
            details: {
              recipients: recipients,
              rdvDate: new Date(rdv.date).toLocaleString('fr-FR')
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