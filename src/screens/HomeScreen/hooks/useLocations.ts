import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { sites as sitesApi } from '../../../api/endpoints';
import { ApiError } from '../../../api/errors';
import { toLegacyLocation, type LegacyLocation } from '../../../api/adapters';

export interface LocationOption {
  label: string;
  value: string;
}

export interface UseLocationsReturn {
  locations: LegacyLocation[];
  locationOptions: LocationOption[];
  selectedReturnLocation: string;
  setSelectedReturnLocation: (location: string) => void;
  fetchLocations: () => Promise<void>;
  resetSelection: () => void;
}

function reportError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    Alert.alert('Error', error.message || fallback);
  } else if (error instanceof Error) {
    Alert.alert('Error', error.message || fallback);
  } else {
    Alert.alert('Error', fallback);
  }
}

export const useLocations = (): UseLocationsReturn => {
  const [locations, setLocations] = useState<LegacyLocation[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedReturnLocation, setSelectedReturnLocation] = useState<string>('');

  const fetchLocations = useCallback(async () => {
    try {
      const page = await sitesApi.listSites();
      setLocations(page.items.map(toLegacyLocation));
    } catch (error) {
      reportError(error, 'Failed to fetch locations');
    }
  }, []);

  useEffect(() => {
    if (locations.length === 0) return;
    const options: LocationOption[] = locations.map((loc) => ({
      label: loc.name,
      value: String(loc.id),
    }));
    setLocationOptions(options);
    if (options.length > 0 && !selectedReturnLocation) {
      setSelectedReturnLocation(options[0].value);
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
