import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, prompt } = await req.json();

    if (!pdfBase64 || !prompt) {
      return new Response(
        JSON.stringify({ error: 'PDF base64 et prompt requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY manquante');
      return new Response(
        JSON.stringify({ error: 'Configuration serveur manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Appel API Anthropic...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
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
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Erreur API Anthropic:', error);
      return new Response(
        JSON.stringify({ error: error.error?.message || 'Erreur API Anthropic' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Réponse reçue:', data.usage);

    // Extraire et nettoyer le texte
    let texteReponse = data.content[0].text.trim();
    if (texteReponse.includes('```')) {
      texteReponse = texteReponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    // Parser le JSON
    const donnees = JSON.parse(texteReponse);

    // Calculer les coûts
    const coutInput = (data.usage.input_tokens / 1_000_000) * 3;
    const coutOutput = (data.usage.output_tokens / 1_000_000) * 15;
    const coutTotal = coutInput + coutOutput;

    return new Response(
      JSON.stringify({
        donnees,
        tokens: {
          input: data.usage.input_tokens,
          output: data.usage.output_tokens
        },
        cout_estime: coutTotal
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erreur extraction facture:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
