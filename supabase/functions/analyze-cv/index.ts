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
    console.log('File type:', fileType);

    // Extract text content from base64 PDF or text
    let textContent = '';
    
    if (fileContent.includes('base64,')) {
      // For PDF files, we need to extract text differently
      // For now, we'll try to decode and use the raw content
      const base64Data = fileContent.split('base64,')[1];
      
      // Try to decode as text first (for text-based PDFs)
      try {
        const decodedBytes = atob(base64Data);
        // Try to extract readable text from the PDF content
        textContent = decodedBytes.replace(/[^\x20-\x7E\n\r\t\xC0-\xFF]/g, ' ');
        // Clean up excessive spaces
        textContent = textContent.replace(/\s+/g, ' ').trim();
      } catch (e) {
        console.error('Error decoding PDF content:', e);
        textContent = fileContent;
      }
    } else {
      textContent = fileContent;
    }

    console.log('Text content length:', textContent.length);
    console.log('First 500 chars of extracted text:', textContent.substring(0, 500));

    // Prepare the prompt for OpenAI with more guidance
    const systemPrompt = `Tu es un expert en analyse de CV. Extrais les informations suivantes du texte fourni.
    
    INSTRUCTIONS IMPORTANTES:
    1. Cherche le nom et prénom en haut du document (souvent en gros caractères)
    2. L'email contient @ et se termine par .com, .fr, etc.
    3. Le téléphone commence souvent par 06, 07, 01, 02, +33 ou contient 10 chiffres
    4. Si le texte est mal formaté, essaie quand même d'identifier ces informations
    
    Retourne UNIQUEMENT un objet JSON avec ces champs:
    {
      "nom": "nom de famille",
      "prenom": "prénom", 
      "email": "adresse@email.com",
      "telephone": "numéro de téléphone"
    }
    
    Si une information n'est pas trouvée, mets une chaîne vide.`;

    // Truncate content if too large
    const maxContentLength = 6000;
    const truncatedContent = textContent.length > maxContentLength 
      ? textContent.substring(0, maxContentLength)
      : textContent;

    console.log('Sending to OpenAI, content length:', truncatedContent.length);

    // Call OpenAI API to analyze the CV
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: systemPrompt 
          },
          { 
            role: 'user', 
            content: `Voici le contenu du CV à analyser. Extrais le nom, prénom, email et téléphone:\n\n${truncatedContent}` 
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
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