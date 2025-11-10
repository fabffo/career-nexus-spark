import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'pdfBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const prompt = `Analyse ce bulletin de salaire et extrait les informations suivantes au format JSON strict :
{
  "nom_salarie": "nom complet du salarié",
  "periode_mois": numéro du mois (1-12),
  "periode_annee": année (ex: 2024),
  "salaire_brut": montant en euros (nombre décimal),
  "charges_sociales_salariales": montant en euros,
  "charges_sociales_patronales": montant en euros,
  "impot_source": montant de l'impôt prélevé à la source en euros,
  "net_a_payer": montant net à payer en euros
}

RÈGLES IMPORTANTES :
- Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après
- Les montants doivent être des nombres (pas de guillemets, pas de symboles)
- periode_mois doit être un nombre entre 1 et 12
- periode_annee doit être un nombre de 4 chiffres
- Si une information n'est pas trouvée, utilise null au lieu de 0
- Ne pas inclure de virgules ou points dans les noms de champs
- Utilise des points décimaux (pas de virgules) pour les montants`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Anthropic response:', JSON.stringify(result, null, 2));

    const extractedText = result.content[0].text;
    console.log('Extracted text:', extractedText);

    // Nettoyer le texte pour extraire uniquement le JSON
    let jsonText = extractedText.trim();
    
    // Supprimer les balises markdown si présentes
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Trouver le premier { et le dernier }
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    }

    let extractedData;
    try {
      extractedData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonText);
      throw new Error('Failed to parse extracted data as JSON');
    }

    // Calculer le coût estimé (approximatif)
    const inputTokens = result.usage?.input_tokens || 0;
    const outputTokens = result.usage?.output_tokens || 0;
    const estimatedCost = (inputTokens * 0.003 / 1000) + (outputTokens * 0.015 / 1000);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        usage: result.usage,
        estimatedCost: estimatedCost.toFixed(4),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in analyser-bulletin function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
