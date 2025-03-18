import { supabase } from '../supabaseClient';
import { Vehicle, User, UserPreference, MatchScore } from '../../types';
import { calculateSimilarity } from './similarityAlgorithms';

// AI-driven matchning av bilar till kunder
export async function matchVehiclesToUsers(vehicleIds: string[]) {
  // Hämta fordon som ska matchas
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .in('id', vehicleIds)
    .eq('status', 'ready_to_go');
    
  if (!vehicles || vehicles.length === 0) return [];
  
  // Hämta aktiva köpare och deras preferenser
  const { data: users } = await supabase
    .from('users')
    .select(`
      *,
      preferences:user_preferences(*),
      purchase_history:purchases(*)
    `)
    .eq('role', 'buyer')
    .eq('status', 'active');
    
  if (!users || users.length === 0) return [];
  
  // Beräkna matchningspoäng för varje fordon-användare-kombination
  const matches = [];
  
  for (const vehicle of vehicles) {
    const vehicleMatches = [];
    
    for (const user of users) {
      // Beräkna grundläggande matchningspoäng baserat på explicita preferenser
      let score = calculateBaseMatchScore(vehicle, user.preferences);
      
      // Förbättra matchningen baserat på köphistorik
      if (user.purchase_history && user.purchase_history.length > 0) {
        score += calculateHistoricalMatchBonus(vehicle, user.purchase_history);
      }
      
      // Justera baserat på säsongsbaserade faktorer
      score += calculateSeasonalAdjustment(vehicle, new Date());
      
      // Lägg till prisbaserad justering
      score += calculatePriceMatchScore(vehicle, user.preferences);
      
      vehicleMatches.push({
        vehicle_id: vehicle.id,
        user_id: user.id,
        score,
        created_at: new Date().toISOString()
      });
    }
    
    // Sortera matchningar för detta fordon efter poäng
    vehicleMatches.sort((a, b) => b.score - a.score);
    
    // Spara de bästa matchningarna (top 10)
    const topMatches = vehicleMatches.slice(0, 10);
    matches.push(...topMatches);
  }
  
  // Spara matchningar i databasen
  if (matches.length > 0) {
    await supabase
      .from('vehicle_user_matches')
      .insert(matches);
  }
  
  return matches;
}

// Inkrementell AI-implementation - börja med regelbaserad matchning
function calculateBaseMatchScore(vehicle: Vehicle, preferences: UserPreference[]): number {
  let score = 50; // Baspoäng
  
  // Gå igenom användarens preferenser
  for (const pref of preferences) {
    switch (pref.type) {
      case 'make':
        if (pref.value === vehicle.make) {
          score += 15;
        }
        break;
      case 'model':
        if (pref.value === vehicle.model) {
          score += 10;
        }
        break;
      case 'year_min':
        if (vehicle.year >= parseInt(pref.value)) {
          score += 5;
        }
        break;
      case 'fuel_type':
        if (pref.value === vehicle.fuel_type) {
          score += 8;
        }
        break;
      // Fler preferenstyper...
    }
  }
  
  return score;
}

// Mer avancerad matchning baserad på köphistorik
function calculateHistoricalMatchBonus(vehicle: Vehicle, purchaseHistory: any[]): number {
  let bonus = 0;
  
  // Analysera tidigare köp för att hitta mönster
  const boughtMakes = purchaseHistory.map(p => p.vehicle_make);
  const boughtModels = purchaseHistory.map(p => p.vehicle_model);
  
  // Bonus för tidigare köpta märken
  if (boughtMakes.includes(vehicle.make)) {
    bonus += 10;
    
    // Extra bonus om användaren köpt samma modell tidigare
    if (boughtModels.includes(vehicle.model)) {
      bonus += 5;
    }
  }
  
  // Analysera prissegment
  const avgPurchasePrice = purchaseHistory.reduce((sum, p) => sum + p.price, 0) / purchaseHistory.length;
  const priceDifference = Math.abs(vehicle.price - avgPurchasePrice);
  const pricePercentDiff = priceDifference / avgPurchasePrice;
  
  // Bonus om priset ligger inom 15% av genomsnittligt köppris
  if (pricePercentDiff <= 0.15) {
    bonus += 8;
  }
  
  return bonus;
} 