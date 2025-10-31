import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RevokeDeviceRequest {
  deviceId?: string;
  revokeAll?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { deviceId, revokeAll }: RevokeDeviceRequest = await req.json();

    console.log('Revoking device(s) for user:', user.id);

    let result;
    if (revokeAll) {
      // Delete all devices for the user
      result = await supabase
        .from('trusted_devices')
        .delete()
        .eq('user_id', user.id);
    } else if (deviceId) {
      // Delete specific device
      result = await supabase
        .from('trusted_devices')
        .delete()
        .eq('id', deviceId)
        .eq('user_id', user.id); // Security check: ensure user owns the device
    } else {
      throw new Error('Must provide deviceId or revokeAll');
    }

    if (result.error) {
      console.error('Database error:', result.error);
      throw result.error;
    }

    console.log('Device(s) revoked successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in revoke-trusted-device:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
