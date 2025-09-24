import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

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

    // Get API key from Supabase secrets
    const apiKey = Deno.env.get('PARSEUR_API_KEY');
    let mailboxId = Deno.env.get('PARSEUR_MAILBOX_ID');
    
    if (!apiKey) {
      console.error('PARSEUR_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Parseur API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If mailbox ID is not configured, try to get the first one from the API
    if (!mailboxId) {
      console.log('PARSEUR_MAILBOX_ID not configured, fetching list of mailboxes...');
      
      try {
        const listResponse = await fetch('https://api.parseur.com/parser', {
          method: 'GET',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          console.error('Failed to fetch mailboxes:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch Parseur mailboxes' }),
            { 
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        const mailboxes = await listResponse.json();
        console.log('Mailboxes response:', mailboxes);
        
        // Get the first mailbox ID from the list
        if (mailboxes && mailboxes.results && mailboxes.results.length > 0) {
          mailboxId = mailboxes.results[0].id;
          console.log('Using first mailbox ID:', mailboxId);
        } else {
          console.error('No mailboxes found');
          return new Response(
            JSON.stringify({ error: 'No Parseur mailboxes found. Please create one first.' }),
            { 
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      } catch (error) {
        console.error('Error fetching mailboxes:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch Parseur mailboxes' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Convert base64 to blob for upload
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
      fileBlob = new Blob([fileContent], { type: 'text/plain' });
    }

    console.log(`Uploading file to Parseur mailbox ${mailboxId}...`);

    // Create FormData for the upload
    const formData = new FormData();
    formData.append('file', fileBlob, fileName || 'cv.pdf');

    // Upload to Parseur using the correct endpoint
    const uploadResponse = await fetch(`https://api.parseur.com/parser/${mailboxId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Parseur upload error:', errorText);
      throw new Error('Erreur lors de l\'upload du CV vers Parseur');
    }

    const parseurData = await uploadResponse.json();
    console.log('Parseur upload response:', parseurData);

    // Wait a bit for Parseur to process the document
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the document details to extract parsed data
    if (parseurData && parseurData.id) {
      const docResponse = await fetch(`https://api.parseur.com/document/${parseurData.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (docResponse.ok) {
        const docData = await docResponse.json();
        console.log('Document data:', docData);

        // Extract data from the parsed document
        let extractedData = {
          nom: '',
          prenom: '',
          email: '',
          telephone: ''
        };

        // Check if Parseur returned parsed data
        if (docData && docData.extracted_data) {
          const parsed = docData.extracted_data;
          
          // Map common field names from Parseur
          extractedData = {
            nom: parsed.last_name || parsed.nom || parsed.surname || parsed.family_name || '',
            prenom: parsed.first_name || parsed.prenom || parsed.given_name || parsed.firstname || '',
            email: parsed.email || parsed.email_address || parsed.mail || '',
            telephone: parsed.phone || parsed.telephone || parsed.mobile || parsed.phone_number || ''
          };

          // Try to extract from full name if individual fields are missing
          if (!extractedData.nom && !extractedData.prenom && parsed.name) {
            const nameParts = parsed.name.split(' ');
            if (nameParts.length >= 2) {
              extractedData.prenom = nameParts[0];
              extractedData.nom = nameParts.slice(1).join(' ');
            }
          }

          // Look for alternative field names
          for (const key in parsed) {
            const lowerKey = key.toLowerCase();
            if (!extractedData.email && (lowerKey.includes('email') || lowerKey.includes('mail'))) {
              extractedData.email = parsed[key];
            }
            if (!extractedData.telephone && (lowerKey.includes('phone') || lowerKey.includes('tel') || lowerKey.includes('mobile'))) {
              extractedData.telephone = parsed[key];
            }
          }
        }

        console.log('Extracted data:', extractedData);

        // Upload the CV file to Supabase Storage
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
      }
    }

    // If we couldn't get parsed data, still create the candidate with just the CV
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

    // Create the candidate with empty fields
    const candidateData = {
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
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
        extractedData: { nom: '', prenom: '', email: '', telephone: '' },
        message: 'CV uploadé avec succès. Les données seront extraites ultérieurement.' 
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