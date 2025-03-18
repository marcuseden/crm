import { useState, useRef, useCallback } from 'react';
import { Camera } from 'react-camera-pro';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { SpeechRecognition } from '../utils/speechRecognition';
import { useMutation } from '@tanstack/react-query';
import { debounce } from 'lodash';

export default function CarInputForm() {
  const [step, setStep] = useState(1);
  const [carData, setCarData] = useState({});
  const cameraRef = useRef(null);
  const supabase = useSupabaseClient();
  
  // Använd React Query för API-anrop
  const scanMutation = useMutation({
    mutationFn: async (image) => {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: JSON.stringify({ image }),
      });
      
      if (!response.ok) {
        throw new Error('OCR-tjänsten svarade inte');
      }
      
      return response.json();
    },
    onSuccess: async (data) => {
      const { registrationNumber } = data;
      
      try {
        const carDetails = await fetch(`/api/vehicle-data?reg=${registrationNumber}`);
        const vehicleData = await carDetails.json();
        setCarData(vehicleData);
        setStep(2);
      } catch (error) {
        console.error('Fel vid hämtning av fordonsdata:', error);
        // Visa felmeddelande till användaren
      }
    },
    onError: (error) => {
      console.error('OCR-fel:', error);
      // Visa felmeddelande till användaren
    }
  });
  
  // OCR för registreringsskylt med förbättrad felhantering
  const scanLicensePlate = async () => {
    try {
      const image = cameraRef.current.takePhoto();
      scanMutation.mutate(image);
    } catch (error) {
      console.error('Kunde inte ta foto:', error);
      // Visa felmeddelande till användaren
    }
  };
  
  // Debounce röstinmatning för bättre prestanda
  const debouncedVoiceProcessing = useCallback(
    debounce((text) => {
      try {
        const parsedData = parseVoiceInput(text);
        setCarData(prevData => ({...prevData, ...parsedData}));
      } catch (error) {
        console.error('Fel vid parsning av röstinmatning:', error);
      }
    }, 300),
    []
  );
  
  // Röststyrning för inmatning
  const startVoiceInput = () => {
    SpeechRecognition.start({
      onResult: debouncedVoiceProcessing,
      onError: (error) => {
        console.error('Röstinmatningsfel:', error);
        // Visa felmeddelande till användaren
      }
    });
  };
  
  // Stegvis inmatningsprocess
  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="p-4">
            <h2>Steg 1: Fotografera bilen</h2>
            <Camera ref={cameraRef} />
            <button onClick={scanLicensePlate} className="btn-primary mt-4">
              Scanna registreringsskylt
            </button>
            <button onClick={() => setStep(2)} className="btn-secondary mt-2">
              Mata in manuellt
            </button>
          </div>
        );
      case 2:
        // Visa förhandsifyllt formulär med data från OCR/API
        // ...
      // Fler steg...
    }
  };
  
  return (
    <div className="car-input-container">
      {renderStep()}
    </div>
  );
} 