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
    const { candidatId, posteId, cvUrl, detailCv, posteDetails, userId } = await req.json();
    
    console.log('Starting matching analysis for:', { candidatId, posteId });
    console.log('Detail CV length:', detailCv ? detailCv.length : 0);
    console.log('Poste details:', JSON.stringify(posteDetails, null, 2));

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let cvText = '';
    
    // First check if we have detail_cv
    if (detailCv) {
      console.log('Using detail_cv field directly');
      cvText = detailCv;
    } else if (cvUrl) {
      // Fallback to fetching CV file if detail_cv is not available
      console.log('Fetching CV file from storage');
      
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

      // Convert CV to text - try to parse as PDF first
      try {
        // Try to read as text first
        cvText = await cvData.text();
        
        // If the text looks like binary data (PDF), try to extract text differently
        if (cvText.includes('%PDF') || cvText.length < 100) {
          console.log('PDF detected, attempting to extract text...');
          // For now, we'll use a simple approach - in production, use a proper PDF parser
          // Extract any readable text from the binary
          const textMatch = cvText.match(/[\x20-\x7E\n\r\t]+/g);
          cvText = textMatch ? textMatch.join(' ') : '';
        }
      } catch (error) {
        console.error('Error parsing CV:', error);
        cvText = 'Unable to extract text from CV';
      }
    } else {
      throw new Error('Aucun CV ou détail CV disponible pour ce candidat');
    }
    
    console.log('CV text length:', cvText.length);
    console.log('CV preview:', cvText.substring(0, 500));
    
    // Prepare the full CV text for analysis (no truncation)
    const fullCvContent = cvText;
    
    // Prepare the prompt for GPT
    const prompt = `
    Tu es un expert en recrutement. Analyse la correspondance entre ce CV et ce poste.
    
    POSTE:
    - Titre: ${posteDetails.titre}
    - Description: ${posteDetails.description}
    - Compétences recherchées: ${posteDetails.competences?.join(', ') || 'Non spécifiées'}
    - Type de contrat: ${posteDetails.type_contrat || 'Non spécifié'}
    - Localisation: ${posteDetails.localisation || 'Non spécifiée'}
    
    CV DU CANDIDAT (TEXTE COMPLET):
    ${fullCvContent}
    
    IMPORTANT: Analyse TOUT le contenu du CV ci-dessus, sans limitation.
    
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
        max_tokens: 2500,
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

    // Save the complete analysis to the new table
    if (userId) {
      // First save to analyse_poste_candidat with full text
      const { data: analyseData, error: analyseError } = await supabase
        .from('analyse_poste_candidat')
        .insert({
          candidat_id: candidatId,
          poste_id: posteId,
          detail_cv: fullCvContent, // Store FULL CV content
          detail_poste: posteDetails, // Store complete job details as JSONB
          score: analysisResult.score,
          match: analysisResult.match,
          analysis: analysisResult.analysis,
          strengths: analysisResult.strengths,
          weaknesses: analysisResult.weaknesses,
          created_by: userId
        })
        .select()
        .single();

      if (analyseError) {
        console.error('Error saving to analyse_poste_candidat:', analyseError);
        // Continue anyway - we don't want to fail the whole request
      } else {
        console.log('Analysis saved to analyse_poste_candidat successfully');
        console.log('Saved CV length:', fullCvContent.length);
        console.log('Saved poste details:', JSON.stringify(posteDetails));
        console.log('Saved analysis ID:', analyseData.id);
      }

      // No longer save to matchings table as it has foreign key issues
    }

    return new Response(
      JSON.stringify({
        ...analysisResult,
        cvExtract: fullCvContent // Return the full CV content that was analyzed
      }),
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