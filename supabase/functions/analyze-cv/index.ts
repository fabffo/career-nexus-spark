import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const parseurApiKey = Deno.env.get('PARSEUR_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
    const { fileContent, fileName, fileType } = await req.json();

    if (!fileContent) {
      throw new Error('Le contenu du fichier est requis');
    }

    console.log('Analyzing CV with Parseur:', fileName);
    console.log('File type:', fileType);

    // Convert base64 to raw data for Parseur API
    let fileData: string;
    if (fileContent.includes('base64,')) {
      // Keep base64 data for Parseur
      fileData = fileContent.split('base64,')[1];
    } else {
      // Convert text to base64
      fileData = btoa(fileContent);
    }

    console.log('Sending CV to Parseur API...');

    // Create document in Parseur
    const parseurPayload = {
      file_content: fileData,
      file_name: fileName || 'cv.pdf',
      media_type: fileType || 'application/pdf'
    };

    // Call Parseur API to create and parse the document
    const response = await fetch('https://api.parseur.com/v1/document', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${parseurApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parseurPayload)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Parseur API error:', error);
      throw new Error('Erreur lors de l\'analyse du CV avec Parseur');
    }

    const parseurData = await response.json();
    console.log('Parseur response:', parseurData);

    // Extract data from Parseur response
    let extractedData = {
      nom: '',
      prenom: '',
      email: '',
      telephone: ''
    };

    // Check if Parseur returned parsed data
    if (parseurData && parseurData.parsed_data) {
      const parsed = parseurData.parsed_data;
      
      // Map common field names from Parseur
      extractedData = {
        nom: parsed.last_name || parsed.nom || parsed.surname || parsed.family_name || '',
        prenom: parsed.first_name || parsed.prenom || parsed.given_name || parsed.firstname || '',
        email: parsed.email || parsed.email_address || parsed.mail || '',
        telephone: parsed.phone || parsed.telephone || parsed.mobile || parsed.phone_number || ''
      };

      // Try to extract from full name if individual fields are missing
      if (!extractedData.nom && !extractedData.prenom && parsed.name) {
        const nameParts = parsed.name.split(' ');
        if (nameParts.length >= 2) {
          extractedData.prenom = nameParts[0];
          extractedData.nom = nameParts.slice(1).join(' ');
        }
      }

      // Look for alternative field names
      for (const key in parsed) {
        const lowerKey = key.toLowerCase();
        if (!extractedData.email && (lowerKey.includes('email') || lowerKey.includes('mail'))) {
          extractedData.email = parsed[key];
        }
        if (!extractedData.telephone && (lowerKey.includes('phone') || lowerKey.includes('tel') || lowerKey.includes('mobile'))) {
          extractedData.telephone = parsed[key];
        }
      }
    }

    console.log('Extracted data:', extractedData);

    // Upload the CV file to Supabase Storage
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    // Convert base64 back to blob for storage
    let fileBlob: Blob;
    if (fileContent.includes('base64,')) {
      const base64Data = fileContent.split('base64,')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      fileBlob = new Blob([byteArray], { type: fileType || 'application/pdf' });
    } else {
      fileBlob = new Blob([fileContent], { type: 'text/plain' });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = fileName?.split('.').pop() || 'pdf';
    const storagePath = `cv/${timestamp}_${randomString}.${extension}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('candidats-files')
      .upload(storagePath, fileBlob, {
        contentType: fileType || 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error('Erreur lors de l\'upload du CV');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('candidats-files')
      .getPublicUrl(storagePath);

    console.log('CV uploaded to:', publicUrl);

    // Create the candidate in the database
    const candidateData = {
      nom: extractedData.nom || '',
      prenom: extractedData.prenom || '',
      email: extractedData.email || '',
      telephone: extractedData.telephone || '',
      cv_url: publicUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: candidat, error: insertError } = await supabase
      .from('candidats')
      .insert(candidateData)
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Erreur lors de la création du candidat');
    }

    console.log('Candidate created:', candidat);

    return new Response(
      JSON.stringify({ 
        success: true,
        candidat,
        extractedData,
        message: 'CV analysé et candidat créé avec succès' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error in analyze-cv function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});