import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.1";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FactureData {
  facture_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { facture_id }: FactureData = await req.json();
    console.log("Generating PDF for facture:", facture_id);

    // Récupérer les données de la facture
    const { data: facture, error: factureError } = await supabase
      .from("factures")
      .select("*")
      .eq("id", facture_id)
      .single();

    if (factureError || !facture) {
      console.error("Error fetching facture:", factureError);
      throw new Error("Facture non trouvée");
    }

    // Récupérer les lignes de la facture
    const { data: lignes, error: lignesError } = await supabase
      .from("facture_lignes")
      .select("*")
      .eq("facture_id", facture_id)
      .order("ordre");

    if (lignesError) {
      console.error("Error fetching lignes:", lignesError);
      throw new Error("Erreur lors de la récupération des lignes");
    }

    // Récupérer les informations de la société interne
    const { data: societe } = await supabase
      .from("societe_interne")
      .select("*")
      .single();

    // Récupérer les informations du client
    let clientData = null;
    console.log("Facture destinataire info:", {
      destinataire_id: facture.destinataire_id,
      destinataire_type: facture.destinataire_type,
      destinataire_nom: facture.destinataire_nom
    });
    
    if (facture.destinataire_type === 'CLIENT') {
      if (facture.destinataire_id) {
        // Récupérer par ID si disponible
        console.log("Fetching client data by ID:", facture.destinataire_id);
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("*")
          .eq("id", facture.destinataire_id)
          .single();
        
        if (clientError) {
          console.error("Error fetching client by ID:", clientError);
        } else {
          clientData = client;
          console.log("Client data fetched by ID:", clientData);
        }
      } else if (facture.destinataire_nom) {
        // Fallback: rechercher par nom si pas d'ID
        console.log("Fetching client data by name:", facture.destinataire_nom);
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("*")
          .ilike("raison_sociale", facture.destinataire_nom)
          .single();
        
        if (clientError) {
          console.error("Error fetching client by name:", clientError);
        } else {
          clientData = client;
          console.log("Client data fetched by name:", clientData);
        }
      }
    } else {
      console.log("Destinataire is not a CLIENT, skipping client fetch");
    }

    // Créer le document PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = 800;
    const leftMargin = 50;
    const rightMargin = 545;

    // Titre
    page.drawText("FACTURE", {
      x: leftMargin,
      y,
      size: 20,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Numéro de facture
    page.drawText(`N° ${facture.numero_facture}`, {
      x: rightMargin - 150,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    y -= 40;

    // Informations de l'émetteur
    if (societe) {
      page.drawText("ÉMETTEUR", {
        x: leftMargin,
        y,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      y -= 20;
      
      page.drawText(societe.raison_sociale || facture.emetteur_nom, {
        x: leftMargin,
        y,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      y -= 15;
      
      if (societe.adresse || facture.emetteur_adresse) {
        const adresse = societe.adresse || facture.emetteur_adresse;
        const lines = adresse.split('\n');
        for (const line of lines) {
          page.drawText(line, {
            x: leftMargin,
            y,
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });
          y -= 15;
        }
      }
      
      if (societe.telephone || facture.emetteur_telephone) {
        page.drawText(`Tél: ${societe.telephone || facture.emetteur_telephone}`, {
          x: leftMargin,
          y,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        y -= 15;
      }
      
      if (societe.email || facture.emetteur_email) {
        page.drawText(`Email: ${societe.email || facture.emetteur_email}`, {
          x: leftMargin,
          y,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        y -= 15;
      }

      if (societe.siren) {
        page.drawText(`SIREN: ${societe.siren}`, {
          x: leftMargin,
          y,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        y -= 15;
      }

      if (societe.tva) {
        page.drawText(`TVA Intracommunautaire: ${societe.tva}`, {
          x: leftMargin,
          y,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        y -= 15;
      }
    }

    // Informations du destinataire
    let destY = 680;
    page.drawText("DESTINATAIRE", {
      x: 350,
      y: destY,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    destY -= 20;

    page.drawText(facture.destinataire_nom, {
      x: 350,
      y: destY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
    destY -= 15;

    // Utiliser l'adresse du client si disponible (nouveau format structuré)
    if (clientData?.adresse_ligne1) {
      page.drawText(clientData.adresse_ligne1, {
        x: 350,
        y: destY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      destY -= 15;
    }
    
    // Ligne 2: code postal + ville
    const codePostalVille = [clientData?.code_postal, clientData?.ville].filter(Boolean).join(' ');
    if (codePostalVille) {
      page.drawText(codePostalVille, {
        x: 350,
        y: destY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      destY -= 15;
    }
    
    // Ligne 3: pays
    if (clientData?.pays) {
      page.drawText(clientData.pays, {
        x: 350,
        y: destY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      destY -= 15;
    }
    
    // Fallback sur l'ancien format si pas de nouveau format
    if (!clientData?.adresse_ligne1 && facture.destinataire_adresse) {
      const lines = facture.destinataire_adresse.split('\n');
      for (const line of lines) {
        page.drawText(line, {
          x: 350,
          y: destY,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        destY -= 15;
      }
    }

    // Utiliser le téléphone du client si disponible
    const destinataireTel = clientData?.telephone || facture.destinataire_telephone;
    if (destinataireTel) {
      page.drawText(`Tél: ${destinataireTel}`, {
        x: 350,
        y: destY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      destY -= 15;
    }

    // Utiliser l'email du client si disponible
    const destinataireEmail = clientData?.email || facture.destinataire_email;
    if (destinataireEmail) {
      page.drawText(`Email: ${destinataireEmail}`, {
        x: 350,
        y: destY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      destY -= 15;
    }

    // Dates
    y = Math.min(y, destY) - 30;
    page.drawText(`Date d'émission: ${new Date(facture.date_emission).toLocaleDateString('fr-FR')}`, {
      x: leftMargin,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Date d'échéance: ${new Date(facture.date_echeance).toLocaleDateString('fr-FR')}`, {
      x: 350,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    y -= 40;

    // Tableau des lignes (7 colonnes comme dans la visualisation)
    const tableTop = y;
    const columnWidths = [180, 50, 70, 70, 45, 65, 65];
    const columnPositions = [leftMargin, 230, 280, 350, 420, 465, 530];
    
    // En-têtes du tableau
    page.drawRectangle({
      x: leftMargin,
      y: tableTop - 25,
      width: rightMargin - leftMargin,
      height: 25,
      color: rgb(0.95, 0.95, 0.95),
    });

    page.drawText("Description", {
      x: columnPositions[0],
      y: tableTop - 18,
      size: 9,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Quantité", {
      x: columnPositions[1],
      y: tableTop - 18,
      size: 9,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Prix unit. HT", {
      x: columnPositions[2],
      y: tableTop - 18,
      size: 8,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Mont. HT", {
      x: columnPositions[3],
      y: tableTop - 18,
      size: 8,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("TVA %", {
      x: columnPositions[4],
      y: tableTop - 18,
      size: 8,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Mont. TVA", {
      x: columnPositions[5],
      y: tableTop - 18,
      size: 8,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Mont. TTC", {
      x: columnPositions[6],
      y: tableTop - 18,
      size: 8,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Lignes du tableau
    let lineY = tableTop - 40;
    for (const ligne of lignes || []) {
      // Description (avec retour à la ligne si nécessaire)
      const description = ligne.description || "";
      const maxWidth = columnWidths[0];
      const descLines = [];
      const words = description.split(" ");
      let currentLine = "";
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, 8);
        if (width > maxWidth && currentLine) {
          descLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) descLines.push(currentLine);

      for (let i = 0; i < descLines.length; i++) {
        page.drawText(descLines[i], {
          x: columnPositions[0],
          y: lineY - (i * 10),
          size: 8,
          font,
          color: rgb(0, 0, 0),
        });
      }

      // Quantité
      page.drawText((ligne.quantite || 1).toFixed(2), {
        x: columnPositions[1],
        y: lineY,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });

      // Prix unitaire HT
      page.drawText(`${(ligne.prix_unitaire_ht || 0).toFixed(2)} €`, {
        x: columnPositions[2],
        y: lineY,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });

      // Montant HT
      page.drawText(`${(ligne.prix_ht || 0).toFixed(2)} €`, {
        x: columnPositions[3],
        y: lineY,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });

      // TVA %
      page.drawText(`${(ligne.taux_tva || 0).toFixed(1)}%`, {
        x: columnPositions[4],
        y: lineY,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });

      // Montant TVA
      page.drawText(`${(ligne.montant_tva || 0).toFixed(2)} €`, {
        x: columnPositions[5],
        y: lineY,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });

      // Montant TTC
      page.drawText(`${(ligne.prix_ttc || 0).toFixed(2)} €`, {
        x: columnPositions[6],
        y: lineY,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });

      lineY -= Math.max(25, descLines.length * 10 + 10);
    }

    // Totaux
    const totalsY = lineY - 20;
    
    // Ligne de séparation
    page.drawLine({
      start: { x: 350, y: totalsY + 10 },
      end: { x: rightMargin, y: totalsY + 10 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText("Total HT:", {
      x: 400,
      y: totalsY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText(`${facture.total_ht?.toFixed(2) || "0.00"} €`, {
      x: 480,
      y: totalsY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText("Total TVA:", {
      x: 400,
      y: totalsY - 20,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText(`${facture.total_tva?.toFixed(2) || "0.00"} €`, {
      x: 480,
      y: totalsY - 20,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    // Total TTC en gras
    page.drawRectangle({
      x: 395,
      y: totalsY - 45,
      width: 150,
      height: 20,
      color: rgb(0.95, 0.95, 0.95),
    });

    page.drawText("TOTAL TTC:", {
      x: 400,
      y: totalsY - 40,
      size: 11,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(`${facture.total_ttc?.toFixed(2) || "0.00"} €`, {
      x: 480,
      y: totalsY - 40,
      size: 11,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Informations bancaires (si disponibles)
    if (societe && (societe.iban || societe.bic)) {
      let bankY = 100;
      page.drawText("Coordonnées bancaires:", {
        x: leftMargin,
        y: bankY,
        size: 10,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      bankY -= 20;

      if (societe.etablissement_bancaire) {
        page.drawText(`Banque: ${societe.etablissement_bancaire}`, {
          x: leftMargin,
          y: bankY,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        bankY -= 15;
      }

      if (societe.iban) {
        page.drawText(`IBAN: ${societe.iban}`, {
          x: leftMargin,
          y: bankY,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        bankY -= 15;
      }

      if (societe.bic) {
        page.drawText(`BIC: ${societe.bic}`, {
          x: leftMargin,
          y: bankY,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }

    // Générer le PDF
    const pdfBytes = await pdfDoc.save();
    
    // Créer un nom de fichier unique
    const fileName = `facture_${facture.numero_facture.replace(/\//g, '-')}_${Date.now()}.pdf`;
    
    // Créer le bucket s'il n'existe pas
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === 'factures');
    
    if (!bucketExists) {
      await supabase.storage.createBucket('factures', {
        public: false,
        allowedMimeTypes: ['application/pdf']
      });
    }

    // Sauvegarder dans Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('factures')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      // Continuer quand même pour retourner le PDF
    } else {
      console.log("PDF uploaded successfully:", uploadData);
      
      // Mettre à jour la facture avec l'URL du PDF
      const { data: { publicUrl } } = supabase.storage
        .from('factures')
        .getPublicUrl(fileName);
      
      // Note: Vous pourriez vouloir ajouter un champ pdf_url dans la table factures
      // await supabase.from('factures').update({ pdf_url: publicUrl }).eq('id', facture_id);
    }

    // Retourner le PDF pour téléchargement immédiat
    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});