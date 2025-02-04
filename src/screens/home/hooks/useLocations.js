// useLocations.js
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';

/**
 * Custom hook for managing location data and operations
 * @returns {Object} Location-related data and functions
 */
const useLocations = () => {
  // State Management
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Auth Context
  const { getAccessToken, logout } = useAuth();

  /**
   * Handles API errors with appropriate user feedback
   * @param {Error} error - The error object from the API call
   * @param {string} customMessage - Custom error message to display
   */
  const handleApiError = (error, customMessage = 'Failed to fetch locations') => {
    console.error('Location API Error:', error);

    if (error.response?.status === 401) {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please login again.',
        [{ text: 'OK', onPress: () => logout() }]
      );
      return;
    }

    Alert.alert(
      'Error',
      error.response?.data?.detail || customMessage
    );
  };

  /**
   * Fetches all locations
   */
  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        await logout();
        return;
      }

      console.log('Fetching locations with token:', token ? 'Token exists' : 'No token');

      const response = await axios.get(
        'https://test.gmayersservices.com/api/locations/',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Location fetch response status:', response.status);
      console.log('Locations count:', response.data.length);

      setLocations(response.data);
    } catch (error) {
      handleApiError(error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, logout]);

  /**
   * Creates a new location
   * @param {Object} locationData - The location data to create
   * @returns {Promise<Object|null>} Created location or null if failed
   */
  const createLocation = async (locationData) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token available');

      console.log('Creating location with data:', locationData);

      const response = await axios.post(
        'https://test.gmayersservices.com/api/locations/',
        locationData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Location creation success:', response.status === 201);
      
      if (response.status === 201) {
        await fetchLocations(); // Refresh locations list
        return response.data;
      }
      return null;
    } catch (error) {
      handleApiError(error, 'Failed to create location');
      return null;
    }
  };

  /**
   * Updates an existing location
   * @param {string} locationId - The ID of the location to update
   * @param {Object} updateData - The update data
   * @returns {Promise<boolean>} Success status of the update
   */
  const updateLocation = async (locationId, updateData) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token available');

      console.log('Updating location:', locationId, 'with data:', updateData);

      const response = await axios.patch(
        `https://test.gmayersservices.com/api/locations/${locationId}/`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Location update success:', response.status === 200);

      if (response.status === 200) {
        await fetchLocations(); // Refresh locations list
        return true;
      }
      return false;
    } catch (error) {
      handleApiError(error, 'Failed to update location');
      return false;
    }
  };

  /**
   * Deletes a location
   * @param {string} locationId - The ID of the location to delete
   * @returns {Promise<boolean>} Success status of the deletion
   */
  const deleteLocation = async (locationId) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token available');

      console.log('Deleting location:', locationId);

      const response = await axios.delete(
        `https://test.gmayersservices.com/api/locations/${locationId}/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Location deletion success:', response.status === 204);

      if (response.status === 204) {
        await fetchLocations(); // Refresh locations list
        return true;
      }
      return false;
    } catch (error) {
      handleApiError(error, 'Failed to delete location');
      return false;
    }
  };

  /**
   * Gets details for a specific location
   * @param {string} locationId - The ID of the location
   * @returns {Promise<Object|null>} Location details or null if failed
   */
  const getLocationDetails = async (locationId) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token available');

      console.log('Fetching details for location:', locationId);

      const response = await axios.get(
        `https://test.gmayersservices.com/api/locations/${locationId}/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Location details fetch success:', response.status === 200);
      return response.data;
    } catch (error) {
      handleApiError(error, 'Failed to fetch location details');
      return null;
    }
  };

  /**
   * Handles pull-to-refresh functionality
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLocations();
    setRefreshing(false);
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Reset selected location when locations change
  useEffect(() => {
    if (selectedLocation && !locations.find(loc => loc.id === selectedLocation.id)) {
      setSelectedLocation(null);
    }
  }, [locations, selectedLocation]);

  return {
    locations,
    selectedLocation,
    setSelectedLocation,
    loading,
    refreshing,
    fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation,
    getLocationDetails,
    handleRefresh,
  };
};

export default useLocations;