// src/screens/HomeScreen/hooks/useDevices.ts
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../context/AuthContext';

interface Assignment {
  id: string;
  device: {
    id: string;
    identifier: string;
    device_type: string;
    current_assignment?: {
      id: string;
    };
  };
  user: string;
  location: any;
  assigned_date: string;
  returned_date?: string;
}

interface UseDevicesReturn {
  assignments: Assignment[];
  loading: boolean;
  fetchDevices: () => Promise<void>;
  handleDeviceReturn: (assignmentId: string, locationId: string) => Promise<void>;
  fetchDevicesByLocation: (locationId: string) => Promise<any[]>;
}

export const useDevices = (): UseDevicesReturn => {
  const { deviceService, userData, logout } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = userData?.userId;

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

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const myAssignments = await deviceService.getMyActiveAssignments();
      
      // Transform the data if necessary to match the expected format
      const formattedAssignments = myAssignments.map((assignment: any) => ({
        id: assignment.id,
        device: assignment.device,
        user: userId,
        location: assignment.location,
        assigned_date: assignment.assigned_date,
        returned_date: assignment.returned_date
      }));
      
      setAssignments(formattedAssignments);
    } catch (error) {
      handleApiError(error, 'Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  }, [deviceService, userId, handleApiError]);

  const handleDeviceReturn = useCallback(async (assignmentId: string, locationId: string) => {
    try {
      // Using the updated returnDeviceToLocation method from deviceService
      await deviceService.returnDeviceToLocation(assignmentId, {
        location: locationId
      });
      
      Alert.alert(
        'Success',
        'Device has been returned successfully',
        [{ text: 'OK', onPress: () => fetchDevices() }]
      );
    } catch (error) {
      let errorMessage = 'Failed to return device. Please try again.';
      
      if (error.response && error.response.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      Alert.alert('Error', errorMessage);
      throw error; // Re-throw to let the component handle loading states
    }
  }, [deviceService, fetchDevices]);

  const fetchDevicesByLocation = useCallback(async (locationId: string) => {
    try {
      // Use the getLocationAssignments method to get devices by location
      const assignments = await deviceService.getLocationAssignments(locationId);
      
      // Process the assignments to extract available devices
      const availableDevices = assignments
        .filter((assignment: any) => {
          // Filter for available devices or devices assigned to location that haven't been returned
          return assignment.device && 
            !assignment.returned_date && // Exclude returned devices
            (assignment.device.status === 'available' || 
             (assignment.location && assignment.location.id === parseInt(locationId)));
        })
        .map((assignment: any) => assignment.device);
        
      return availableDevices;
    } catch (error) {
      handleApiError(error, 'Failed to fetch devices for the selected location');
      return [];
    }
  }, [deviceService, handleApiError]);

  return {
    assignments,
    loading,
    fetchDevices,
    handleDeviceReturn,
    fetchDevicesByLocation,
  };
};