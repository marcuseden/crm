import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { AppError } from '../lib/errorHandling';

// Kontrollera att miljövariabler finns
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('Saknar Supabase-miljövariabler. Kontrollera .env-filen.');
}

// Skapa klient med typning
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Hjälpfunktion för att hantera Supabase-fel
export const handleSupabaseError = (error: any) => {
  console.error('Supabase Error:', error);
  
  // Mappa Supabase-felkoder till användarvänliga meddelanden
  const errorMessages = {
    '23505': 'En post med denna information finns redan.',
    '23503': 'Refererad post finns inte.',
    '23514': 'Data uppfyller inte valideringskraven.',
    'PGRST116': 'Resurs finns inte.',
    '42501': 'Åtkomst nekad. Kontrollera behörigheter.',
  };
  
  const code = error?.code;
  const message = errorMessages[code] || error?.message || 'Ett oväntat fel inträffade';
  
  return new AppError(message, 400);
}; 