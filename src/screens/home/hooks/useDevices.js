// useDevices.js
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';

/**
 * Custom hook for managing device data and operations
 * @returns {Object} Device-related data and functions
 */
const useDevices = () => {
  // State Management
  const [devices, setDevices] = useState([]);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Auth Context
  const { getAccessToken, logout } = useAuth();

  /**
   * Handles API errors with appropriate user feedback
   * @param {Error} error - The error object from the API call
   * @param {string} customMessage - Custom error message to display
   */
  const handleApiError = (error, customMessage = 'Failed to fetch devices') => {
    console.error('API Error:', error);

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
   * Fetches all device assignments
   */
  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        await logout();
        return;
      }

      console.log('Fetching devices with token:', token ? 'Token exists' : 'No token');

      const response = await axios.get(
        'https://test.gmayersservices.com/api/device-assignments/',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Device fetch response status:', response.status);

      if (response.data) {
        // Filter to show only active (non-returned) assignments
        const activeAssignments = response.data.filter(
          assignment => !assignment.returned_date
        );
        setDevices(activeAssignments);
        console.log('Active assignments count:', activeAssignments.length);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, logout]);

  /**
   * Fetches devices available at a specific location
   * @param {string} locationId - The ID of the location
   */
  const fetchDevicesByLocation = async (locationId) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      console.log('Fetching devices for location:', locationId);

      const response = await axios.get(
        `https://test.gmayersservices.com/api/devices/?location=${locationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Location devices count:', response.data.length);
      setAvailableDevices(response.data);
    } catch (error) {
      handleApiError(error, 'Failed to fetch devices for the selected location');
      setAvailableDevices([]);
    }
  };

  /**
   * Assigns a device to a user
   * @param {Object} assignmentData - The assignment data
   * @returns {Promise<boolean>} Success status of the assignment
   */
  const assignDevice = async (assignmentData) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      console.log('Assigning device with data:', assignmentData);

      const response = await axios.post(
        'https://test.gmayersservices.com/api/assign-device/',
        assignmentData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Device assignment success:', response.status === 200);
      
      if (response.status === 200) {
        await fetchDevices(); // Refresh device list
        return true;
      }
      return false;
    } catch (error) {
      handleApiError(error, 'Failed to assign device');
      return false;
    }
  };

  /**
   * Returns a device
   * @param {Object} returnData - The return data including device and location
   * @returns {Promise<boolean>} Success status of the return
   */
  const returnDevice = async (returnData) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      console.log('Returning device with data:', returnData);

      // Update assignment status
      await axios.patch(
        `https://test.gmayersservices.com/api/device-assignments/${returnData.deviceId}/`,
        {
          returned_date: new Date().toISOString().split('T')[0],
          returned_time: new Date().toISOString().split('T')[1].split('.')[0],
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Create return record
      await axios.post(
        'https://test.gmayersservices.com/api/device-returns/',
        {
          device_id: returnData.deviceId,
          location: returnData.locationId,
          returned_date_time: new Date().toISOString(),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Device return successful');
      await fetchDevices(); // Refresh device list
      return true;
    } catch (error) {
      handleApiError(error, 'Failed to return device');
      return false;
    }
  };

  /**
   * Handles pull-to-refresh functionality
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return {
    devices,
    availableDevices,
    loading,
    refreshing,
    fetchDevices,
    fetchDevicesByLocation,
    assignDevice,
    returnDevice,
    handleRefresh,
  };
};

export default useDevices;