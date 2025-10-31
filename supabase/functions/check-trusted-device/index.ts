import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckDeviceRequest {
  userId: string;
  deviceFingerprint: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, deviceFingerprint }: CheckDeviceRequest = await req.json();

    console.log('Checking trusted device for user:', userId);

    // Check if device exists and is not expired
    const { data: device, error } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('device_fingerprint', deviceFingerprint)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Database error:', error);
      throw error;
    }

    const isTrusted = !!device;

    console.log('Device trusted status:', isTrusted);

    return new Response(
      JSON.stringify({ isTrusted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-trusted-device:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
