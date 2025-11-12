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

    if (facture.destinataire_adresse) {
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

    if (facture.destinataire_telephone) {
      page.drawText(`Tél: ${facture.destinataire_telephone}`, {
        x: 350,
        y: destY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      destY -= 15;
    }

    if (facture.destinataire_email) {
      page.drawText(`Email: ${facture.destinataire_email}`, {
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

    // Tableau des lignes
    const tableTop = y;
    const columnWidths = [250, 60, 80, 60, 80];
    const columnPositions = [leftMargin, 300, 360, 440, 500];
    
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
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Quantité", {
      x: columnPositions[1],
      y: tableTop - 18,
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Prix unitaire", {
      x: columnPositions[2],
      y: tableTop - 18,
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("TVA %", {
      x: columnPositions[3],
      y: tableTop - 18,
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Total HT", {
      x: columnPositions[4],
      y: tableTop - 18,
      size: 10,
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
        const width = font.widthOfTextAtSize(testLine, 9);
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
          y: lineY - (i * 12),
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
      }

      page.drawText(ligne.quantite?.toString() || "1", {
        x: columnPositions[1],
        y: lineY,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });

      page.drawText(`${ligne.prix_unitaire_ht?.toFixed(2) || "0.00"} €`, {
        x: columnPositions[2],
        y: lineY,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });

      page.drawText(`${ligne.taux_tva?.toFixed(1) || "0.0"}%`, {
        x: columnPositions[3],
        y: lineY,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });

      page.drawText(`${ligne.prix_ht?.toFixed(2) || "0.00"} €`, {
        x: columnPositions[4],
        y: lineY,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });

      lineY -= Math.max(25, descLines.length * 12 + 10);
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