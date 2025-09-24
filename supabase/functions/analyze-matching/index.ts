import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    const { candidatId, posteId, cvUrl, posteDetails } = await req.json();
    
    console.log('Starting matching analysis for:', { candidatId, posteId });

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract the file path from the full URL
    let filePath = cvUrl;
    
    // If cvUrl is a full URL, extract just the path
    if (cvUrl.includes('storage/v1/object/public/candidats-files/')) {
      filePath = cvUrl.split('storage/v1/object/public/candidats-files/')[1];
    } else if (cvUrl.includes('/candidats-files/')) {
      filePath = cvUrl.split('/candidats-files/')[1];
    }
    
    console.log('CV file path:', filePath);

    // Fetch CV content from storage
    const { data: cvData, error: cvError } = await supabase
      .storage
      .from('candidats-files')
      .download(filePath);

    if (cvError) {
      console.error('Error fetching CV:', cvError);
      console.error('Attempted path:', filePath);
      throw new Error('Impossible de récupérer le CV');
    }

    // Convert CV to text (simplified - in production you'd use a PDF parser)
    const cvText = await cvData.text();
    
    // Prepare the prompt for GPT
    const prompt = `
    Tu es un expert en recrutement. Analyse la correspondance entre ce CV et ce poste.
    
    POSTE:
    - Titre: ${posteDetails.titre}
    - Description: ${posteDetails.description}
    
    CV DU CANDIDAT:
    ${cvText.substring(0, 3000)} // Limit to avoid token issues
    
    Réponds avec une analyse structurée incluant:
    1. Un score de correspondance de 0 à 100
    2. Une analyse détaillée de la correspondance
    3. Les points forts du candidat pour ce poste
    4. Les points faibles ou manquants
    5. Une recommandation claire (match ou pas)
    
    Format de réponse JSON:
    {
      "score": number,
      "match": boolean,
      "analysis": "string",
      "strengths": ["string"],
      "weaknesses": ["string"]
    }
    `;

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
            content: 'Tu es un expert en recrutement qui analyse objectivement les correspondances entre CV et postes. Réponds toujours en JSON valide.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error('Erreur lors de l\'analyse avec l\'IA');
    }

    const data = await response.json();
    const analysisResult = JSON.parse(data.choices[0].message.content);

    console.log('Analysis completed:', analysisResult);

    return new Response(
      JSON.stringify(analysisResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in analyze-matching function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur interne du serveur' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});