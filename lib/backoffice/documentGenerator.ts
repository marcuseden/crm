import { PDFDocument, StandardFonts } from 'pdf-lib';
import { supabase } from '../supabaseClient';
import { Vehicle, Bid, User, DocumentType } from '../../types';

// Dokumentgenerator med mallar
export async function generateDocument(
  vehicleId: string, 
  bidId: string, 
  documentType: DocumentType
) {
  // Hämta all nödvändig data
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .single();
    
  const { data: bid } = await supabase
    .from('bids')
    .select('*, user:users(*)')
    .eq('id', bidId)
    .single();
    
  const { data: seller } = await supabase
    .from('users')
    .select('*')
    .eq('id', vehicle.seller_id)
    .single();
    
  // Välj rätt mall baserat på dokumenttyp
  const templatePath = getTemplatePath(documentType, vehicle.country_code);
  
  // Skapa PDF-dokument
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Lägg till företagslogotyp
  const logoImage = await pdfDoc.embedPng(companyLogo);
  page.drawImage(logoImage, {
    x: 50,
    y: height - 100,
    width: 100,
    height: 50,
  });
  
  // Fyll i dokumentspecifika fält
  switch (documentType) {
    case 'PURCHASE_AGREEMENT':
      fillPurchaseAgreement(page, font, vehicle, bid, seller);
      break;
    case 'TRANSPORT_ORDER':
      fillTransportOrder(page, font, vehicle, bid.user);
      break;
    case 'INVOICE':
      fillInvoice(page, font, vehicle, bid, seller);
      break;
  }
  
  // Lägg till unik QR-kod för verifiering
  const verificationCode = generateVerificationCode(vehicleId, bidId, documentType);
  const qrCodeImage = await generateQRCode(verificationCode);
  const embeddedQrCode = await pdfDoc.embedPng(qrCodeImage);
  
  page.drawImage(embeddedQrCode, {
    x: width - 100,
    y: 50,
    width: 80,
    height: 80,
  });
  
  // Spara dokumentet
  const pdfBytes = await pdfDoc.save();
  
  // Ladda upp till Supabase Storage
  const filePath = `documents/${vehicleId}/${documentType.toLowerCase()}_${Date.now()}.pdf`;
  
  const { data, error } = await supabase
    .storage
    .from('documents')
    .upload(filePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false
    });
    
  if (error) {
    throw new Error(`Failed to upload document: ${error.message}`);
  }
  
  // Registrera dokumentet i databasen
  await supabase
    .from('documents')
    .insert({
      vehicle_id: vehicleId,
      bid_id: bidId,
      type: documentType,
      file_path: filePath,
      verification_code: verificationCode,
      created_at: new Date().toISOString()
    });
    
  // Returnera URL till dokumentet
  const { data: publicUrl } = supabase
    .storage
    .from('documents')
    .getPublicUrl(filePath);
    
  return publicUrl;
}

// Momsberäkning för olika länder
export function calculateVAT(amount: number, countryCode: string) {
  const vatRates = {
    'SE': 0.25, // Sverige 25%
    'NO': 0.25, // Norge 25%
    'DK': 0.25, // Danmark 25%
    'FI': 0.24, // Finland 24%
    'DE': 0.19, // Tyskland 19%
    // Fler länder...
  };
  
  const rate = vatRates[countryCode] || 0.25; // Default till 25%
  return amount * rate;
} 