// src/screens/HomeScreen/hooks/useLocations.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../context/AuthContext';

interface Location {
  id: string;
  name: string;
}

interface LocationOption {
  label: string;
  value: string;
}

interface UseLocationsReturn {
  locations: Location[];
  locationOptions: LocationOption[];
  selectedReturnLocation: string;
  setSelectedReturnLocation: (location: string) => void;
  fetchLocations: () => Promise<void>;
  resetSelection: () => void;
}

export const useLocations = (): UseLocationsReturn => {
  const { deviceService, logout } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedReturnLocation, setSelectedReturnLocation] = useState<string>('');

  const handleApiError = useCallback((error: any, defaultMessage: string) => {
    if (error.response) {
      const errorMessage = error.response.data.detail || defaultMessage;
      Alert.alert('Error', errorMessage);
    } else if (error.request) {
      Alert.alert('Error', 'No response from server. Please try again later.');
    } else {
      Alert.alert('Error', error.message || defaultMessage);
    }

    if (error.response?.status === 401) {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please login again.',
        [{ text: 'OK', onPress: async () => await logout() }]
      );
    }
  }, [logout]);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await deviceService.getLocations();
      setLocations(data);
    } catch (error) {
      handleApiError(error, 'Failed to fetch locations');
    }
  }, [deviceService, handleApiError]);

  // Transform locations into dropdown format
  useEffect(() => {
    if (locations.length > 0) {
      const options = locations.map(location => ({
        label: location.name,
        value: location.id
      }));
      setLocationOptions(options);
      
      // Set a default location if we have options and none is selected yet
      if (options.length > 0 && (!selectedReturnLocation || selectedReturnLocation === '')) {
        setSelectedReturnLocation(options[0].value);
      }
    }
  }, [locations, selectedReturnLocation]);

  const resetSelection = useCallback(() => {
    setSelectedReturnLocation('');
  }, []);

  return {
    locations,
    locationOptions,
    selectedReturnLocation,
    setSelectedReturnLocation,
    fetchLocations,
    resetSelection,
  };
};