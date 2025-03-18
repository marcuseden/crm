import type { NextApiRequest, NextApiResponse } from 'next';
import { AppError, apiErrorHandler } from '../../lib/errorHandling';
import { supabase } from '../../lib/supabaseClient';

// Timeout-hantering för externa API-anrop
const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new AppError('Timeout vid API-anrop', 408)), ms)
  );
  return Promise.race([promise, timeout]);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Validera request
    if (req.method !== 'GET') {
      throw new AppError('Metod ej tillåten', 405);
    }
    
    const { reg } = req.query;
    
    if (!reg || typeof reg !== 'string') {
      throw new AppError('Registreringsnummer krävs', 400);
    }
    
    // Kontrollera cache först
    const { data: cachedData } = await supabase
      .from('vehicle_data_cache')
      .select('*')
      .eq('registration_number', reg)
      .single();
      
    if (cachedData && 
        new Date().getTime() - new Date(cachedData.updated_at).getTime() < 86400000) {
      return res.status(200).json(cachedData.data);
    }
    
    // Hämta data från externt API med timeout
    const apiCall = fetch(`https://external-vehicle-api.example.com/data?reg=${reg}`)
      .then(response => {
        if (!response.ok) {
          throw new AppError(`API svarade med status: ${response.status}`, response.status);
        }
        return response.json();
      });
      
    const vehicleData = await withTimeout(apiCall, 5000);
    
    // Spara i cache
    await supabase
      .from('vehicle_data_cache')
      .upsert({
        registration_number: reg,
        data: vehicleData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'registration_number' });
      
    return res.status(200).json(vehicleData);
  } catch (error) {
    return apiErrorHandler(error, req, res, null);
  }
} 