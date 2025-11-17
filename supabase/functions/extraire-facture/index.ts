import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== Début traitement requête extraire-facture ===');
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request - returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Parsing request body...');
    const body = await req.json();
    console.log('Body parsed, keys:', Object.keys(body));
    
    const { pdfBase64, prompt } = body;

    if (!pdfBase64) {
      console.error('❌ PDF base64 manquant');
      return new Response(
        JSON.stringify({ error: 'PDF base64 requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!prompt) {
      console.error('❌ Prompt manquant');
      return new Response(
        JSON.stringify({ error: 'Prompt requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✓ PDF base64 size:', pdfBase64.length, 'bytes');
    console.log('✓ Prompt length:', prompt.length, 'chars');

    console.log('Checking LOVABLE_API_KEY...');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      console.error('❌ LOVABLE_API_KEY non trouvée dans les variables d\'environnement');
      return new Response(
        JSON.stringify({ 
          error: 'Clé API Lovable non configurée sur le serveur.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✓ LOVABLE_API_KEY trouvée (longueur:', lovableApiKey.length, ')');

    console.log('📡 Appel API Lovable AI en cours...');
    const lovablePayload = {
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:application/pdf;base64,${pdfBase64}`
            }
          }
        ]
      }],
      max_tokens: 4096
    };

    console.log('Payload Lovable AI préparé:', {
      model: lovablePayload.model,
      max_tokens: lovablePayload.max_tokens,
      message_content_types: lovablePayload.messages[0].content.map((c: any) => c.type)
    });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`
      },
      body: JSON.stringify(lovablePayload)
    });

    console.log('📥 Réponse Lovable AI status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur API Lovable AI - Status:', response.status);
      console.error('❌ Erreur détails:', errorText);
      
      let errorMessage = 'Erreur API Lovable AI';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
        console.error('❌ Erreur parsée:', errorJson);
      } catch (e) {
        console.error('❌ Impossible de parser l\'erreur JSON');
      }
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          status: response.status,
          details: errorText.substring(0, 200)
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✓ Réponse OK, parsing JSON...');
    const data = await response.json();
    console.log('✓ Réponse complète:', JSON.stringify(data, null, 2));

    // Extraire et nettoyer le texte (format OpenAI)
    console.log('Extraction du contenu...');
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Pas de contenu dans la réponse');
      throw new Error('Pas de contenu dans la réponse Lovable AI');
    }

    let texteReponse = data.choices[0].message.content.trim();
    console.log('Texte brut (100 premiers chars):', texteReponse.substring(0, 100));
    
    if (texteReponse.includes('```')) {
      console.log('Nettoyage des marqueurs markdown...');
      texteReponse = texteReponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    console.log('Parsing JSON...');
    const donnees = JSON.parse(texteReponse);
    console.log('✓ JSON parsé avec succès:', Object.keys(donnees));

    const result = {
      donnees,
      tokens: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0
      }
    };

    console.log('✅ Succès!');
    console.log('=== Fin traitement (succès) ===');

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('❌❌❌ ERREUR FATALE ❌❌❌');
    console.error('Type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Message:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('=== Fin traitement (erreur) ===');
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        type: error instanceof Error ? error.constructor.name : typeof error
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
