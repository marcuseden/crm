import { useState, useRef } from 'react';
import { Camera } from 'react-camera-pro';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { SpeechRecognition } from '../utils/speechRecognition';

export default function CarInputForm() {
  const [step, setStep] = useState(1);
  const [carData, setCarData] = useState({});
  const cameraRef = useRef(null);
  const supabase = useSupabaseClient();
  
  // OCR för registreringsskylt
  const scanLicensePlate = async () => {
    const image = cameraRef.current.takePhoto();
    // Anropa OCR-API för att extrahera registreringsnummer
    const response = await fetch('/api/ocr', {
      method: 'POST',
      body: JSON.stringify({ image }),
    });
    
    const { registrationNumber } = await response.json();
    
    // Hämta bildata från bilregister-API
    const carDetails = await fetch(`/api/vehicle-data?reg=${registrationNumber}`);
    setCarData(await carDetails.json());
    setStep(2);
  };
  
  // Röststyrning för inmatning
  const startVoiceInput = () => {
    SpeechRecognition.start({
      onResult: (text) => {
        // Parsning av röstinmatning till strukturerad data
        const parsedData = parseVoiceInput(text);
        setCarData({...carData, ...parsedData});
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