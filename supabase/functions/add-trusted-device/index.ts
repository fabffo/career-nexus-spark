import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AddDeviceRequest {
  userId: string;
  deviceFingerprint: string;
  deviceName: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    const { userId, deviceFingerprint, deviceName, email }: AddDeviceRequest = await req.json();

    console.log('Adding trusted device for user:', userId);

    // Calculate expiration (30 days from now)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Check if device already exists
    const { data: existingDevice } = await supabase
      .from('trusted_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    let result;
    if (existingDevice) {
      // Update existing device
      result = await supabase
        .from('trusted_devices')
        .update({
          expires_at: expiresAt,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existingDevice.id);
    } else {
      // Insert new device
      result = await supabase
        .from('trusted_devices')
        .insert({
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          device_name: deviceName,
          expires_at: expiresAt,
          last_used_at: new Date().toISOString(),
        });

      // Send notification email for new device
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #0066cc; }
              .content { padding: 30px 0; }
              .device-info { background: #f5f5f5; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px 0; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; color: #0066cc;">Nouvelle connexion détectée</h1>
              </div>
              <div class="content">
                <p>Bonjour,</p>
                <p>Une nouvelle connexion à votre compte a été détectée depuis un nouvel appareil :</p>
                <div class="device-info">
                  <p><strong>Appareil :</strong> ${deviceName}</p>
                  <p><strong>Date et heure :</strong> ${new Date().toLocaleString('fr-FR')}</p>
                </div>
                <p>Cet appareil a été ajouté à vos appareils de confiance pour une durée de 30 jours.</p>
                <div class="warning">
                  <strong>⚠️ Ce n'était pas vous ?</strong><br>
                  Si vous ne reconnaissez pas cette connexion, nous vous recommandons de :
                  <ul>
                    <li>Changer immédiatement votre mot de passe</li>
                    <li>Révoquer tous vos appareils de confiance dans vos paramètres</li>
                    <li>Contacter notre support si nécessaire</li>
                  </ul>
                </div>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Wavy Services. Tous droits réservés.</p>
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      await resend.emails.send({
        from: 'Wavy Services <security@wavyservices.fr>',
        to: [email],
        subject: 'Nouvelle connexion à votre compte - Wavy Services',
        html: emailHtml,
      });
    }

    if (result.error) {
      console.error('Database error:', result.error);
      throw result.error;
    }

    console.log('Trusted device added successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in add-trusted-device:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
