import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { Resend } from 'https://esm.sh/resend@2.0.0';

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
      const { rdv, recipients, message, isUpdate } = data;
      const teamsLink = rdv.teams_link || `https://teams.microsoft.com/l/meeting/new?subject=${encodeURIComponent('Rendez-vous')}`;
      
      console.log('Sending invitation to:', recipients, 'isUpdate:', isUpdate);
      console.log('Message:', message);
      
      // Initialiser Resend
      const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
      
      // Déterminer le sujet et le titre selon si c'est une mise à jour ou non
      const emailSubject = isUpdate ? 'Mise à jour - Réunion Teams' : 'Invitation à une réunion Teams';
      const emailTitle = isUpdate ? 'Mise à jour de la réunion Teams' : 'Invitation à une réunion Teams';
      const updateNotice = isUpdate ? '<div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #F59E0B;"><p style="margin: 0; color: #92400E; font-weight: bold;">⚠️ Cette réunion a été modifiée</p></div>' : '';
      
      // Envoyer les emails et enregistrer dans l'historique
      const sendPromises = recipients.map(async (recipient: string) => {
        try {
          // Envoyer l'email via Resend
          const emailResponse = await resend.emails.send({
            from: 'RH Platform <noreply@wavyservices.fr>',
            to: [recipient],
            subject: emailSubject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #5B21B6;">${emailTitle}</h2>
                ${updateNotice}
                <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  ${message.replace(/\n/g, '<br>')}
                </div>
                <div style="margin-top: 20px; padding: 15px; background-color: #EDE9FE; border-radius: 8px;">
                  <p style="margin: 0; font-weight: bold; color: #5B21B6;">Rejoindre la réunion :</p>
                  <a href="${teamsLink}" style="display: inline-block; margin-top: 10px; padding: 10px 20px; background-color: #5B21B6; color: white; text-decoration: none; border-radius: 5px;">Cliquer ici pour rejoindre</a>
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #6B7280;">
                  Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur : <br>
                  <a href="${teamsLink}" style="color: #5B21B6;">${teamsLink}</a>
                </p>
              </div>
            `
          });
          
          // Vérifier si l'email a vraiment été envoyé
          if (emailResponse.error) {
            throw new Error(emailResponse.error.message || 'Erreur lors de l\'envoi de l\'email');
          }
          
          console.log('Email sent successfully to:', recipient, emailResponse);
          
          // Enregistrer dans l'historique avec le statut "sent"
          await supabase.from('email_history').insert({
            recipient_email: recipient,
            subject: emailSubject,
            email_type: isUpdate ? 'teams_invitation_update' : 'teams_invitation',
            status: 'sent',
            metadata: { rdv_id: rdv.id, message, email_response: emailResponse, isUpdate }
          });
          
          return { recipient, success: true };
        } catch (emailError) {
          console.error('Error sending email to:', recipient, emailError);
          
          // Enregistrer dans l'historique avec le statut "failed"
          await supabase.from('email_history').insert({
            recipient_email: recipient,
            subject: emailSubject,
            email_type: isUpdate ? 'teams_invitation_update' : 'teams_invitation',
            status: 'failed',
            error_message: (emailError as Error).message,
            metadata: { rdv_id: rdv.id, message, isUpdate }
          });
          
          return { recipient, success: false, error: (emailError as Error).message };
        }
      });
      
      const results = await Promise.all(sendPromises);
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      
      console.log(`Emails sent: ${successCount} success, ${failedCount} failed`);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Invitations envoyées: ${successCount} réussies${failedCount > 0 ? `, ${failedCount} échouées` : ''}`,
          teamsLink: teamsLink,
          results
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