import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
// Removed unused Resend import

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
      
      // Email functionality temporarily disabled - no email service configured
      console.log('Email notification skipped - no email service configured');
      console.log('Would have sent to:', recipients);
      console.log('Message:', message);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Action traitée (sans envoi d\'email)',
          teamsLink: teamsLink
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error('Error in Teams integration:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Unknown error' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});