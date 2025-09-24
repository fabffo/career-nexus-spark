import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
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

    console.log('Analyzing CV:', fileName);

    // Prepare the prompt for OpenAI
    const systemPrompt = `Tu es un assistant RH expert en analyse de CV. 
    Analyse le CV fourni et extrais les informations suivantes en format JSON:
    - nom (string): Le nom de famille du candidat
    - prenom (string): Le prénom du candidat
    - email (string): L'adresse email du candidat
    - telephone (string): Le numéro de téléphone du candidat
    
    Cherche bien ces informations dans tout le document. Les noms sont souvent en haut du CV en gros caractères.
    
    Retourne UNIQUEMENT un objet JSON valide avec ces champs. 
    Si une information n'est pas trouvée, mets une chaîne vide.
    Ne mets aucun texte avant ou après le JSON.`;

    // Truncate file content if it's too large (limit to ~8000 characters for safety)
    const maxContentLength = 8000;
    const truncatedContent = fileContent.length > maxContentLength 
      ? fileContent.substring(0, maxContentLength) + '...[contenu tronqué]'
      : fileContent;

    console.log('Content length:', fileContent.length, 'Truncated:', fileContent.length > maxContentLength);

    // Call OpenAI API to analyze the CV
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',  // Using gpt-4o-mini which handles tokens better
        messages: [
          { 
            role: 'system', 
            content: systemPrompt 
          },
          { 
            role: 'user', 
            content: `Voici le contenu du CV à analyser:\n\n${truncatedContent}` 
          }
        ],
        max_tokens: 500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error('Erreur lors de l\'analyse du CV');
    }

    const data = await response.json();
    console.log('OpenAI response:', data);

    const extractedData = JSON.parse(data.choices[0].message.content);
    console.log('Extracted data:', extractedData);

    // Upload the CV file to Supabase Storage
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    // Convert base64 to blob if needed
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