import { supabase } from './supabaseClient';
import { VehicleData, DataSource, ProcessingStatus } from '../types';

// Statusdriven arkitektur för bildata
const STATUS_FLOW = {
  SUBMITTED: 'submitted',
  DATA_COLLECTED: 'data_collected',
  VERIFIED: 'verified',
  READY_TO_GO: 'ready_to_go',
  LISTED: 'listed',
  SOLD: 'sold'
};

// Batch-bearbetning av bilar
export async function processPendingVehicles() {
  // Hämta bilar som behöver bearbetas (max 50 åt gången)
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('status', STATUS_FLOW.SUBMITTED)
    .limit(50);
    
  if (!vehicles || vehicles.length === 0) return;
  
  // Bearbeta bilar i batch
  const processPromises = vehicles.map(async (vehicle) => {
    try {
      // Uppdatera status för att undvika dubbel bearbetning
      await updateVehicleStatus(vehicle.id, STATUS_FLOW.DATA_COLLECTED);
      
      // Parallell datainsamling från olika API:er
      const [registryData, insuranceData, marketData] = await Promise.all([
        fetchRegistryData(vehicle.registration_number),
        fetchInsuranceData(vehicle.vin),
        fetchMarketPriceData(vehicle.make, vehicle.model, vehicle.year)
      ]);
      
      // Sammanställ och spara data
      const enrichedData = mergeVehicleData(vehicle, registryData, insuranceData, marketData);
      await saveEnrichedVehicleData(vehicle.id, enrichedData);
      
      // Kontrollera om bilen uppfyller "Ready to Go"-kriterier
      const isReadyToGo = checkReadyToGoStatus(enrichedData);
      
      if (isReadyToGo) {
        await updateVehicleStatus(vehicle.id, STATUS_FLOW.READY_TO_GO);
      } else {
        await updateVehicleStatus(vehicle.id, STATUS_FLOW.VERIFIED);
      }
      
      return { id: vehicle.id, success: true };
    } catch (error) {
      console.error(`Error processing vehicle ${vehicle.id}:`, error);
      return { id: vehicle.id, success: false, error };
    }
  });
  
  return Promise.all(processPromises);
}

// Implementera caching för externa API-anrop
const apiCache = new Map();
const CACHE_TTL = 3600000; // 1 timme

async function fetchWithCache(key: string, fetchFn: () => Promise<any>) {
  const cachedData = apiCache.get(key);
  
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
    return cachedData.data;
  }
  
  const data = await fetchFn();
  apiCache.set(key, { data, timestamp: Date.now() });
  return data;
} 