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

    const prompt = `Tu es un moteur d'extraction et d'analyse de bulletins de paie français à usage DAF / contrôle de paie.
Le document fourni est un bulletin de paie mensuel.

⚠️ RÈGLE ABSOLUE : aucune hallucination.
Chaque montant doit provenir explicitement du document.
Si une valeur est absente ou ambiguë, retourne null + un confidence < 0.7.

🎯 OBJECTIF
Extraire toutes les lignes de paie, les classifier par flux financier, recalculer les totaux par destinataire, et produire une sortie structurée.

📋 INSTRUCTIONS D'EXTRACTION

1. Normaliser les montants :
   - "1 286,55" → 1286.55
   - "8 500.00" → 8500.00

2. Pour chaque ligne du tableau "Éléments de paie", extraire :
   - section (ex : Santé, Retraite, Famille, Chômage…)
   - libelle
   - base
   - taux
   - montant_salarial (colonne "À déduire")
   - montant_patronal (colonne "Charges patronales")

3. Créer 1 ligne par flux réel :
   - une ligne salariale si montant salarié ≠ 0
   - une ligne patronale si montant patronal ≠ 0

🧭 RÈGLES DE CLASSIFICATION

- Net payé → organisme_type="salarie", nature="salariale", sens="ajout"
- Impôt sur le revenu (PAS) → organisme_type="impots", organisme_nom="DGFiP", nature="impot", sens="deduction"
- CSG/CRDS → organisme_type="urssaf", nature="salariale", sens="deduction"
- Sécurité sociale (maladie, famille, chômage, APEC, allocations familiales, vieillesse) → organisme_type="urssaf"
- ⚠️ RÈGLE CRITIQUE POUR LA SECTION RETRAITE:
  - Si le libellé CONTIENT "Sécurité Sociale" (plafonnée ou déplafonnée) → organisme_type="urssaf" (même si dans section Retraite!)
  - Si le libellé CONTIENT "Complémentaire" (Tranche 1, Tranche 2, etc.) → organisme_type="retraite", organisme_nom="Humanis Retraite"
  - AGIRC-ARRCO, CEG, CET → organisme_type="retraite", organisme_nom="Humanis Retraite"
- ADESATT → organisme_type="autre", organisme_nom="ADESATT"
- MUTUELLE / Complémentaire santé / Prévoyance / Frais de santé → organisme_type="mutuelle", organisme_nom=libellé exact (ex: "Mutuelle", "Frais de santé", "Prévoyance")
- Charges patronales URSSAF → organisme_type="urssaf", nature="patronale", sens="ajout"
- Charges patronales Retraite complémentaire → organisme_type="retraite", nature="patronale", sens="ajout"
- Charges patronales Mutuelle → organisme_type="mutuelle", nature="patronale", sens="ajout"

📊 TOTAUX À EXTRAIRE EXPLICITEMENT DU DOCUMENT
- salaire_brut
- total_cotisations_salariales
- total_charges_patronales  
- net_avant_impot
- pas (impôt prélevé à la source)
- net_paye

📈 CALCULS À EFFECTUER
- total_urssaf = somme(montants où organisme_type = "urssaf")
- total_retraite = somme(montants où organisme_type = "retraite")
- total_impots = somme(montants où organisme_type = "impots")
- total_mutuelle = somme(montants où organisme_type = "mutuelle")
- total_autres = somme(montants où organisme_type = "autre")
- total_salarie = net_paye
- cout_employeur = salaire_brut + total_charges_patronales

Si écart > 1€ entre totaux recalculés et affichés → confidence < 0.8

🎯 FORMAT DE SORTIE JSON STRICT

{
  "periode_mois": 1,
  "periode_annee": 2025,
  "nom_salarie": "NOM PRENOM",
  "salaire_brut": 8500.00,
  "total_cotisations_salariales": 1738.71,
  "total_charges_patronales": 3624.81,
  "net_avant_impot": 6827.89,
  "pas": 1286.55,
  "net_paye": 5541.34,
  "total_urssaf": 3500.00,
  "total_retraite": 1863.52,
  "total_impots": 1286.55,
  "total_mutuelle": 85.00,
  "total_autres": 1.70,
  "cout_employeur": 12124.81,
  "confidence": 0.95,
  "lignes": [
    {
      "section": "Retraite",
      "libelle": "Sécurité Sociale plafonnée",
      "base": 3925.00,
      "taux": 6.90,
      "montant": 270.83,
      "sens": "deduction",
      "nature": "salariale",
      "organisme_type": "retraite",
      "organisme_nom": "Retraite",
      "raw_text": "Sécurité Sociale plafonnée 3 925.00 6.9000 270.83",
      "confidence": 0.97
    }
  ]
}

RETOURNE UNIQUEMENT UN OBJET JSON VALIDE, sans texte avant ou après.
Les montants doivent être des nombres (pas de guillemets, pas de symboles €).
Utilise des points décimaux (pas de virgules) pour les montants.
Si une information n'est pas trouvée, utilise null.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 8192,
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
    console.log('Anthropic response received');

    const extractedText = result.content[0].text;
    console.log('Extracted text length:', extractedText.length);

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
      console.error('Attempted to parse:', jsonText.substring(0, 500));
      throw new Error('Failed to parse extracted data as JSON');
    }

    // Validation et calculs de vérification
    const validation = validateExtraction(extractedData);
    
    // Calculer le coût estimé
    const inputTokens = result.usage?.input_tokens || 0;
    const outputTokens = result.usage?.output_tokens || 0;
    const estimatedCost = (inputTokens * 0.003 / 1000) + (outputTokens * 0.015 / 1000);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        validation,
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

// Fonction de validation des données extraites
function validateExtraction(data: any): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Vérifier les champs obligatoires
  if (!data.periode_mois || !data.periode_annee) {
    errors.push('Période manquante');
  }
  
  if (!data.net_paye) {
    errors.push('Net à payer manquant');
  }
  
  // Vérifier la cohérence des totaux
  if (data.lignes && Array.isArray(data.lignes)) {
    // Calculer total_urssaf à partir des lignes
    const calculatedUrssaf = data.lignes
      .filter((l: any) => l.organisme_type === 'urssaf')
      .reduce((sum: number, l: any) => sum + Math.abs(l.montant || 0), 0);
    
    if (data.total_urssaf && Math.abs(calculatedUrssaf - data.total_urssaf) > 1) {
      warnings.push(`Écart URSSAF: calculé=${calculatedUrssaf.toFixed(2)}, extrait=${data.total_urssaf}`);
    }
    
    // Calculer total_impots à partir des lignes
    const calculatedImpots = data.lignes
      .filter((l: any) => l.organisme_type === 'impots')
      .reduce((sum: number, l: any) => sum + Math.abs(l.montant || 0), 0);
    
    if (data.total_impots && Math.abs(calculatedImpots - data.total_impots) > 1) {
      warnings.push(`Écart Impôts: calculé=${calculatedImpots.toFixed(2)}, extrait=${data.total_impots}`);
    }
    
    // Calculer total_autres à partir des lignes
    const calculatedAutres = data.lignes
      .filter((l: any) => l.organisme_type === 'autre')
      .reduce((sum: number, l: any) => sum + Math.abs(l.montant || 0), 0);
    
    if (data.total_autres && Math.abs(calculatedAutres - data.total_autres) > 1) {
      warnings.push(`Écart Autres: calculé=${calculatedAutres.toFixed(2)}, extrait=${data.total_autres}`);
    }
  }
  
  // Vérifier le coût employeur
  if (data.salaire_brut && data.total_charges_patronales && data.cout_employeur) {
    const expectedCout = data.salaire_brut + data.total_charges_patronales;
    if (Math.abs(expectedCout - data.cout_employeur) > 1) {
      warnings.push(`Écart coût employeur: calculé=${expectedCout.toFixed(2)}, extrait=${data.cout_employeur}`);
    }
  }
  
  // Vérifier la confidence globale
  if (data.confidence && data.confidence < 0.8) {
    warnings.push(`Confidence faible: ${data.confidence}`);
  }
  
  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}
