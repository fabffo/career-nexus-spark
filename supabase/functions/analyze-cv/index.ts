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

    // Convert base64 to file for Parseur API
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
      // If it's plain text
      fileBlob = new Blob([fileContent], { type: 'text/plain' });
    }

    // Create FormData for Parseur API
    const formData = new FormData();
    formData.append('file', fileBlob, fileName || 'cv.pdf');

    console.log('Sending CV to Parseur API...');

    // Call Parseur API to analyze the CV
    const response = await fetch('https://api.parseur.com/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${parseurApiKey}`,
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Parseur API error:', error);
      throw new Error('Erreur lors de l\'analyse du CV avec Parseur');
    }

    const parseurData = await response.json();
    console.log('Parseur response:', parseurData);

    // Wait for document to be processed
    let extractedData = {
      nom: '',
      prenom: '',
      email: '',
      telephone: ''
    };

    // Check document status and get parsed data
    if (parseurData.id) {
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get the parsed document
      const parsedResponse = await fetch(`https://api.parseur.com/v1/documents/${parseurData.id}/parsed_data`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${parseurApiKey}`,
        }
      });

      if (parsedResponse.ok) {
        const parsedData = await parsedResponse.json();
        console.log('Parsed data from Parseur:', parsedData);
        
        // Map Parseur fields to our format
        extractedData = {
          nom: parsedData.last_name || parsedData.nom || parsedData.surname || '',
          prenom: parsedData.first_name || parsedData.prenom || parsedData.given_name || '',
          email: parsedData.email || parsedData.email_address || '',
          telephone: parsedData.phone || parsedData.telephone || parsedData.mobile || ''
        };
      }
    }

    console.log('Extracted data:', extractedData);

    // Upload the CV file to Supabase Storage (reuse the fileBlob from above)
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

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