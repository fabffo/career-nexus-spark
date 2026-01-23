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
    
    const { pdfBase64, prompt, typeFournisseur, fournisseursReferents } = body;

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
    console.log('✓ Type fournisseur:', typeFournisseur || 'non spécifié');
    console.log('✓ Fournisseurs référents:', fournisseursReferents?.length || 0);

    console.log('Checking ANTHROPIC_API_KEY...');
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!anthropicApiKey) {
      console.error('❌ ANTHROPIC_API_KEY non trouvée');
      return new Response(
        JSON.stringify({ 
          error: 'La clé API Anthropic n\'est pas configurée. Cette fonctionnalité nécessite des crédits Anthropic pour analyser les PDFs.',
          action_required: 'Veuillez ajouter des crédits à votre compte Anthropic sur https://console.anthropic.com/settings/billing'
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✓ ANTHROPIC_API_KEY trouvée (longueur:', anthropicApiKey.length, ')');

    console.log('📡 Appel API Anthropic en cours...');
    const anthropicPayload = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    };

    console.log('Payload Anthropic préparé:', {
      model: anthropicPayload.model,
      max_tokens: anthropicPayload.max_tokens
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicPayload)
    });

    console.log('📥 Réponse Anthropic status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur API Anthropic - Status:', response.status);
      console.error('❌ Erreur détails:', errorText);
      
      let errorMessage = 'Erreur API Anthropic';
      let userMessage = errorMessage;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
        console.error('❌ Erreur parsée:', errorJson);
        
        // Message spécifique pour le manque de crédits
        if (errorMessage.includes('credit balance') || errorMessage.includes('billing')) {
          userMessage = 'Votre compte Anthropic n\'a plus de crédits. Veuillez ajouter des crédits sur https://console.anthropic.com/settings/billing';
        }
      } catch (e) {
        console.error('❌ Impossible de parser l\'erreur JSON');
      }
      
      return new Response(
        JSON.stringify({
          error: userMessage,
          status: response.status,
          details: errorText.substring(0, 200)
        }),
        { status: response.status === 400 ? 402 : response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✓ Réponse OK, parsing JSON...');
    const data = await response.json();
    console.log('✓ Tokens utilisés:', data.usage);

    // Extraire et nettoyer le texte (format Anthropic)
    console.log('Extraction du contenu...');
    if (!data.content || !data.content[0]) {
      console.error('❌ Pas de contenu dans la réponse');
      throw new Error('Pas de contenu dans la réponse Anthropic');
    }

    let texteReponse = data.content[0].text.trim();
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
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0
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
