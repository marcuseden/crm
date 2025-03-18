import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Vehicle, Bid } from '../types';
import { sendNotification } from '../utils/notifications';

export default function BiddingSystem({ vehicle }: { vehicle: Vehicle }) {
  const [bids, setBids] = useState<Bid[]>([]);
  const [highestBid, setHighestBid] = useState<Bid | null>(null);
  const [newBidAmount, setNewBidAmount] = useState('');
  const supabase = useSupabaseClient();
  
  // Realtidsuppdateringar för bud
  useEffect(() => {
    // Hämta befintliga bud
    const fetchBids = async () => {
      const { data } = await supabase
        .from('bids')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('amount', { ascending: false });
        
      if (data && data.length > 0) {
        setBids(data);
        setHighestBid(data[0]);
      }
    };
    
    fetchBids();
    
    // Prenumerera på nya bud
    const subscription = supabase
      .channel(`vehicle-bids-${vehicle.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'bids',
        filter: `vehicle_id=eq.${vehicle.id}`
      }, (payload) => {
        const newBid = payload.new as Bid;
        setBids(prevBids => [newBid, ...prevBids].sort((a, b) => b.amount - a.amount));
        
        // Uppdatera högsta bud om det nya budet är högre
        if (!highestBid || newBid.amount > highestBid.amount) {
          setHighestBid(newBid);
          
          // Notifiera säljare om nytt högsta bud
          sendNotification({
            userId: vehicle.seller_id,
            type: 'NEW_HIGHEST_BID',
            message: `Nytt högsta bud på ${vehicle.make} ${vehicle.model}: ${newBid.amount} kr`
          });
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [vehicle.id, supabase]);
  
  // Lägg bud
  const placeBid = async () => {
    const amount = parseInt(newBidAmount);
    
    if (isNaN(amount) || amount <= 0) {
      alert('Ange ett giltigt belopp');
      return;
    }
    
    if (highestBid && amount <= highestBid.amount) {
      alert('Budet måste vara högre än det nuvarande högsta budet');
      return;
    }
    
    const { data, error } = await supabase
      .from('bids')
      .insert({
        vehicle_id: vehicle.id,
        user_id: 'current-user-id', // Ersätt med faktisk användar-ID
        amount,
        status: 'pending',
        created_at: new Date().toISOString()
      });
      
    if (error) {
      console.error('Error placing bid:', error);
      alert('Kunde inte lägga bud. Försök igen.');
    } else {
      setNewBidAmount('');
      
      // Auktionsläge - automatiskt acceptera bud om det når reservationspris
      if (amount >= vehicle.reserve_price) {
        await acceptBid(data[0].id);
      }
    }
  };
  
  // Acceptera bud
  const acceptBid = async (bidId: string) => {
    // Uppdatera budstatus
    await supabase
      .from('bids')
      .update({ status: 'accepted' })
      .eq('id', bidId);
      
    // Uppdatera fordonsstatus
    await supabase
      .from('vehicles')
      .update({ status: 'sold', sold_bid_id: bidId })
      .eq('id', vehicle.id);
      
    // Notifiera köpare
    const acceptedBid = bids.find(bid => bid.id === bidId);
    if (acceptedBid) {
      sendNotification({
        userId: acceptedBid.user_id,
        type: 'BID_ACCEPTED',
        message: `Ditt bud på ${vehicle.make} ${vehicle.model} har accepterats!`
      });
      
      // Starta backoffice-processen
      await fetch('/api/backoffice/start-process', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: vehicle.id,
          bidId: bidId
        })
      });
    }
  };
  
  // Rendering av komponenten...
} 