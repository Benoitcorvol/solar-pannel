import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, User, Mail, Phone, MapPin } from 'lucide-react';

interface AddressInputProps {
  onAnalyze: (address: string) => void;
  isLoading: boolean;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
}

interface ValidationErrors {
  phone?: string;
}

export function AddressInput({ onAnalyze, isLoading }: AddressInputProps) {
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: ''
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    const initAutocomplete = () => {
      if (!addressInputRef.current || !window.google?.maps?.places) {
        console.warn('Google Maps Places API not loaded yet');
        return;
      }

      try {
        autocompleteRef.current = new google.maps.places.Autocomplete(addressInputRef.current, {
          componentRestrictions: { country: 'fr' },
          fields: ['formatted_address', 'geometry'],
          types: ['address']
        });

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (place?.formatted_address) {
            setFormData(prev => ({
              ...prev,
              address: place.formatted_address || ''
            }));
          }
        });
      } catch (error) {
        console.error('Error initializing Places Autocomplete:', error);
      }
    };

    // Initialize immediately if Google Maps is already loaded
    if (window.google?.maps?.places) {
      initAutocomplete();
    } else {
      // Otherwise wait for the API to load
      const checkGoogleMapsInterval = setInterval(() => {
        if (window.google?.maps?.places) {
          initAutocomplete();
          clearInterval(checkGoogleMapsInterval);
        }
      }, 100);

      // Clean up interval
      return () => clearInterval(checkGoogleMapsInterval);
    }
  }, []);

  const validatePhoneNumber = (phone: string): string | undefined => {
    // Format français: 06 12 34 56 78 ou +33 6 12 34 56 78
    const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
    
    if (!phone) {
      return 'Le numéro de téléphone est requis';
    }
    
    if (!phoneRegex.test(phone)) {
      return 'Format invalide. Exemple: 06 12 34 56 78 ou +33 6 12 34 56 78';
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Supprimer tous les caractères non numériques
    const numbers = phone.replace(/\D/g, '');
    
    // Format français
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    }
    
    // Format international
    if (numbers.startsWith('33')) {
      return '+' + numbers.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    }
    
    return phone;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhone = formatPhoneNumber(e.target.value);
    setFormData(prev => ({
      ...prev,
      phone: formattedPhone
    }));
    
    const error = validatePhoneNumber(formattedPhone);
    setErrors(prev => ({
      ...prev,
      phone: error
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all required fields
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.address.trim()) {
      return;
    }

    // Check if there are any existing errors
    if (errors.phone) {
      return;
    }

    // Submit the form
    onAnalyze(formData.address.trim());
    console.log('Form data:', formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Analysez votre potentiel solaire
        </h1>
        <p className="text-lg text-gray-600">
          Découvrez la puissance solaire de votre toiture et recevez une estimation personnalisée
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Prénom */}
          <div className="relative">
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              Prénom
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-3 text-gray-900 rounded-lg border-2 border-gray-200
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder-gray-400 transition-all duration-300"
                placeholder="Jean"
                required
              />
            </div>
          </div>

          {/* Nom */}
          <div className="relative">
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Nom
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-3 text-gray-900 rounded-lg border-2 border-gray-200
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder-gray-400 transition-all duration-300"
                placeholder="Dupont"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="relative">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-3 text-gray-900 rounded-lg border-2 border-gray-200
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder-gray-400 transition-all duration-300"
                placeholder="jean.dupont@example.com"
                required
              />
            </div>
          </div>

          {/* Téléphone */}
          <div className="relative">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                className={`block w-full pl-10 pr-3 py-3 text-gray-900 rounded-lg border-2
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder-gray-400 transition-all duration-300
                         ${errors.phone ? 'border-red-300' : 'border-gray-200'}`}
                placeholder="06 12 34 56 78"
                required
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Adresse - Pleine largeur */}
        <div className="relative mt-6">
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
            Adresse complète
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin className="h-5 w-5 text-gray-400" />
            </div>
            <input
              ref={addressInputRef}
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="123 rue de Paris, 75001 Paris"
              className="block w-full pl-10 pr-32 py-4 text-gray-900 rounded-lg border-2 border-gray-200
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder-gray-400 transition-all duration-300"
              required
              disabled={isLoading}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              <button
                type="submit"
                disabled={isLoading || !formData.address.trim() || !!errors.phone}
                className="inline-flex items-center px-6 py-2.5 mr-2 rounded-lg bg-blue-600 
                         text-white font-medium hover:bg-blue-700 focus:outline-none 
                         focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 shadow-md hover:shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-5 w-5" />
                    Analyser
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          <p className="text-center">
            En soumettant ce formulaire, vous acceptez d'être recontacté pour plus d'informations
          </p>
        </div>
      </form>
    </div>
  );
}
