
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';


const API_BASE_URL = 'https://battwrapz.gmayersservices.com/api/';

// Create the main axios instance
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add interceptor to include auth token in requests
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Create mobile-specific API instance (uses API key auth instead of token)
const mobileApiInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add interceptor to include API key in requests
mobileApiInstance.interceptors.request.use(
  async (config) => {
    const apiKey = await SecureStore.getItemAsync(AUTH_KEYS.API_KEY);
    if (apiKey) {
      config.headers['X-API-KEY'] = apiKey;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const AuthContext = createContext(null);

const AUTH_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
  TOKEN_DATA: 'tokenData',
  API_KEY: 'apiKey',
};




// Mobile-specific service using API key authentication
const mobileService = {
  // Submit feature suggestion
  submitFeatureSuggestion: async (suggestionData) => {
    // Ensure required fields are present based on API schema
    const requiredFields = ['feature_description'];
    const missingFields = requiredFields.filter(field => !suggestionData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    try {
      const response = await mobileApiInstance.post('/mobile/feature-suggestions/', suggestionData);
      return response.data;
    } catch (error) {
      console.error('Feature suggestion submission error:', error);
      throw error;
    }
  },
};

// Updated deviceService to match the API schema endpoints
const deviceService = {
  // Get all device assignments for the user's organization
  getAssignments: async () => {
    const response = await axiosInstance.get('/device-assignments/');
    return response.data;
  },

  // Get active device assignments for the current user
  getMyActiveAssignments: async () => {
    const response = await axiosInstance.get('/device-assignments/my_active_assignments/');
    return response.data;
  },

  // Get all device assignments for the current user (active and historical)
  getMyAssignments: async () => {
    const response = await axiosInstance.get('/device-assignments/my_assignments/');
    return response.data;
  },

  // Get all device assignments for a specific location
  getLocationAssignments: async (locationId) => {
    const response = await axiosInstance.get(`/device-assignments/location/${locationId}/`);
    return response.data;
  },

  // Get available devices that can be assigned
  getAvailableDevices: async () => {
    const response = await axiosInstance.get('/device-assignments/available_devices/');
    return response.data;
  },

  // Get all locations
  getLocations: async () => {
    const response = await axiosInstance.get('/locations/');
    return response.data;
  },

  // Create a new location
  createLocation: async (locationData) => {
    // Ensure all required fields are present according to the API schema
    const requiredFields = ['organization', 'street_number', 'street_name', 'town_or_city', 'postcode'];
    const missingFields = requiredFields.filter(field => !locationData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    try {
      const response = await axiosInstance.post('/locations/', locationData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all devices
  getDevices: async () => {
    const response = await axiosInstance.get('/devices/');
    return response.data;
  },

  // Get a specific device
  getDevice: async (deviceId) => {
    const response = await axiosInstance.get(`/devices/${deviceId}/`);
    return response.data;
  },

  // Create a new device
  createDevice: async (deviceData) => {
    // Ensure all required fields are present according to the API schema
    const requiredFields = ['description', 'make', 'model', 'device_type'];
    const missingFields = requiredFields.filter(field => !deviceData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    try {
      const response = await axiosInstance.post('/devices/', deviceData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create a new device assignment
  createAssignment: async (assignmentData) => {
    // Ensure required fields are present
    const requiredFields = ['device_id', 'assigned_date'];
    const missingFields = requiredFields.filter(field => !assignmentData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    try {
      const response = await axiosInstance.post('/device-assignments/', assignmentData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Assign a device to the current user
  assignDeviceToMe: async (deviceId, assignmentData) => {
    try {
      const response = await axiosInstance.post(
        `/device-assignments/device/${deviceId}/assign-to-me/`,
        assignmentData
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Assign a device by device ID
  assignDeviceById: async (deviceId, assignmentData) => {
    try {
      const response = await axiosInstance.post(
        `/device-assignments/device/${deviceId}/assign/`,
        assignmentData
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Assign a device by identifier
  assignDeviceByIdentifier: async (identifier, assignmentData) => {
    try {
      const response = await axiosInstance.post(
        `/device-assignments/identifier/${identifier}/assign/`,
        assignmentData
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Return a device to a location
  returnDeviceToLocation: async (assignmentId, returnData) => {
    try {
      const response = await axiosInstance.post(
        `/device-assignments/${assignmentId}/return_to_location/`,
        returnData
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get device assignment history
  getDeviceHistory: async (deviceId) => {
    try {
      const response = await axiosInstance.get(`/device-assignments/device/${deviceId}/history/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update a device assignment
  updateAssignment: async (assignmentId, updateData) => {
    try {
      const response = await axiosInstance.patch(
        `/device-assignments/${assignmentId}/`,
        updateData
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get device photos
  getDevicePhotos: async () => {
    try {
      const response = await axiosInstance.get('/device-photos/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create device photo
  createDevicePhoto: async (photoData) => {
    try {
      const response = await axiosInstance.post('/device-photos/', photoData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get reports
  getReports: async () => {
    try {
      const response = await axiosInstance.get('/reports/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get my reports
  getMyReports: async () => {
    try {
      const response = await axiosInstance.get('/reports/my_reports/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get specific report
  getReport: async (reportId) => {
    try {
      const response = await axiosInstance.get(`/reports/${reportId}/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create report
  createReport: async (reportData) => {
    // Ensure required fields are present
    const requiredFields = ['device_id', 'report_date', 'description'];
    const missingFields = requiredFields.filter(field => !reportData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    try {
      const response = await axiosInstance.post('/reports/', reportData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update report
  updateReport: async (reportId, reportData) => {
    try {
      const response = await axiosInstance.patch(`/reports/${reportId}/`, reportData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

const decodeJWT = (token) => {
  try {
    if (!token) return null;
    
    const parts = token.split('.');
    
    if (parts.length !== 3) return null;
    
    const base64Url = parts[1];
    
    // Replace non-url compatible chars with standard base64 chars
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const paddedBase64 = base64 + padding;
    
    // Convert base64 to raw binary data held in a string
    try {
      // Decode base64
      const rawData = atob(paddedBase64);
      
      // Convert to percent-encoding
      const encodedData = rawData
        .split('')
        .map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('');
      
      // Decode URI component
      const jsonPayload = decodeURIComponent(encodedData);
      
      // Parse the JSON string
      const decodedData = JSON.parse(jsonPayload);
      return decodedData;
    } catch (decodeError) {
      return null;
    }
  } catch (error) {
    return null;
  }
};
  
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null); // For decoded token data
  const [error, setError] = useState(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Role-based helper functions
  const isAdmin = userData?.role === 'admin';
  const isOwner = userData?.role === 'owner';
  const isAdminOrOwner = isAdmin || isOwner;

  useEffect(() => {
    checkAuthState();
  }, []);

  // Methods to get and set the API key securely
  const getApiKey = async () => {
    try {
      return await SecureStore.getItemAsync(AUTH_KEYS.API_KEY);
    } catch (error) {
      console.error("Error retrieving API key:", error);
      return null;
    }
  };

  const setApiKey = async (key) => {
    try {
      await SecureStore.setItemAsync(AUTH_KEYS.API_KEY, key);
      return true;
    } catch (error) {
      console.error("Error saving API key:", error);
      return false;
    }
  };

  // Store decoded token data in AsyncStorage and state
  const saveTokenData = async (token) => {
    try {
      if (!token) return null;
      
      const decodedToken = decodeJWT(token);
      
      if (!decodedToken) return null;
      
      // Store decoded token in state
      const extractedUserData = {
        userId: decodedToken.user_id,
        orgId: decodedToken.org_id,
        role: decodedToken.role,
        name: decodedToken.first_name || 'User',
        has_completed_onboarding: decodedToken.has_completed_onboarding || false,
      };
      
      // Save token data to AsyncStorage
      await AsyncStorage.setItem(AUTH_KEYS.TOKEN_DATA, JSON.stringify(decodedToken));
      
      // Update state
      setUserData(extractedUserData);
      setOnboardingComplete(decodedToken.has_completed_onboarding || false);
      
      return decodedToken;
    } catch (error) {
      console.error("Error saving token data:", error);
      return null;
    }
  };

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      
      const savedUserData = await AsyncStorage.getItem(AUTH_KEYS.USER_DATA);
      const savedTokenData = await AsyncStorage.getItem(AUTH_KEYS.TOKEN_DATA);
      const accessToken = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      
      if (savedUserData) {
        const parsedUserData = JSON.parse(savedUserData);
        setUser(parsedUserData);
      }
      
      // First check if we have saved token data
      if (savedTokenData) {
        const parsedTokenData = JSON.parse(savedTokenData);
        
        const userData = {
          userId: parsedTokenData.user_id,
          orgId: parsedTokenData.org_id,
          role: parsedTokenData.role, 
          name: parsedTokenData.first_name || 'User',
          has_completed_onboarding: parsedTokenData.has_completed_onboarding || false,
        };
        
        setUserData(userData);
        setOnboardingComplete(parsedTokenData.has_completed_onboarding || false);
        setIsAuthenticated(true);
      } 
      // If no saved token data but we have a token, decode and save it
      else if (accessToken) {
        await saveTokenData(accessToken);
        setIsAuthenticated(true);
      }
    } catch (error) {
      setError('Error checking authentication state');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(AUTH_KEYS.REFRESH_TOKEN);
      
      if (!refreshToken) {
        throw new Error('No refresh token found');
      }

      // Updated to match API schema
      const response = await axiosInstance.post('/auth/token/refresh/', {
        refresh: refreshToken,
      });

      const accessToken = response.data.access;
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken);
      
      // Save the decoded token data
      await saveTokenData(accessToken);
      
      return accessToken;
    } catch (error) {
      await logout();
      throw error;
    }
  };

  const getAccessToken = async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      return token;
    } catch (error) {
      return null;
    }
  };

  const register = async (userData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Updated to match API schema
      const registerResponse = await axiosInstance.post('/auth/register/', {
        email: userData.email,
        password: userData.password,
        password2: userData.password, // Password confirmation
        first_name: userData.first_name,
        last_name: userData.last_name,
        organization_invite_code: userData.organization_invite_code || '',
        phone_number: userData.phone_number || ''
      });
      
      // Return the response data as confirmation email was sent
      // Note: According to the API schema, registration sends a confirmation email
      // and doesn't directly authenticate the user, so we return early
      return registerResponse.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Registration failed. Please try again.';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);

      // Updated to match API schema
      const response = await axiosInstance.post('/auth/token/', {
        email,
        password,
      });
      
      const accessToken = response.data.access;
      const refreshToken = response.data.refresh;
      
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken);
      await AsyncStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, refreshToken);
      
      // Save the decoded token data
      const tokenData = await saveTokenData(accessToken);
      
      // Extract user data from token if available
      if (tokenData) {
        const extractedUserData = {
          email: email,
          user_id: tokenData.user_id,
          first_name: tokenData.first_name || '',
          last_name: tokenData.last_name || '',
          has_completed_onboarding: tokenData.has_completed_onboarding || false,
        };
        
        await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(extractedUserData));
        setUser(extractedUserData);
        setOnboardingComplete(tokenData.has_completed_onboarding || false);
      }

      setIsAuthenticated(true);
      return { tokens: { access: accessToken, refresh: refreshToken }, user: tokenData || {} };
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Login failed. Please try again.';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const requestPasswordReset = async (email) => {
    try {
      setIsLoading(true);
      setError(null);

      // Send password reset request to API endpoint
      const response = await axiosInstance.post('/auth/password/reset/', {
        email
      });
      
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Password reset request failed. Please try again.';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
      await AsyncStorage.multiRemove([
        AUTH_KEYS.ACCESS_TOKEN,
        AUTH_KEYS.REFRESH_TOKEN,
        AUTH_KEYS.USER_DATA,
        AUTH_KEYS.TOKEN_DATA,
      ]);
      
      // We keep the API key for mobile endpoints even after logout
      // as it's related to the device, not the user

      setUser(null);
      setUserData(null);
      setIsAuthenticated(false);
      setOnboardingComplete(false);
      setError(null);
    } catch (error) {
      setError('Error during logout');
    } finally {
      setIsLoading(false);
    }
  };

  
const updateUser = async (userData) => {
    try {
      await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      setError('Error updating user data');
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Method to get user profile data
  const getUserProfile = async (userId) => {
    try {
      const response = await axiosInstance.get(`/profile/${userId}/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Method to update user profile
  const updateUserProfile = async (userId, profileData) => {
    try {
      const response = await axiosInstance.patch(`/profile/${userId}/`, profileData);
      
      // Update local user data
      const updatedData = response.data;
      
      // Update userData state with the new profile info
      setUserData(prevData => ({
        ...prevData,
        name: `${updatedData.first_name} ${updatedData.last_name}`,
        email: updatedData.email,
        first_name: updatedData.first_name,
        last_name: updatedData.last_name,
        phone_number: updatedData.phone_number
      }));
      
      // Update user state
      setUser(prevUser => ({
        ...prevUser,
        email: updatedData.email,
        first_name: updatedData.first_name,
        last_name: updatedData.last_name,
        phone_number: updatedData.phone_number
      }));
      
      // Persist to AsyncStorage
      const storedUserData = await AsyncStorage.getItem(AUTH_KEYS.USER_DATA);
      if (storedUserData) {
        const parsedData = JSON.parse(storedUserData);
        const updatedStoredData = {
          ...parsedData,
          email: updatedData.email,
          first_name: updatedData.first_name,
          last_name: updatedData.last_name,
          phone_number: updatedData.phone_number
        };
        await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(updatedStoredData));
      }
      
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Method to create organization
  const createOrganization = async (organizationData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axiosInstance.post('/organizations/', organizationData);
      
      // After successfully creating the organization, update onboarding status
      await updateOnboardingStatus(true);
      
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to create organization. Please try again.';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to update onboarding status
  const updateOnboardingStatus = async (status = true) => {
    try {
      // Update the backend
      const response = await axiosInstance.patch('/profile/', {
        has_completed_onboarding: status
      });
      
      // Update local state
      setOnboardingComplete(status);
      
      // Update userData
      if (userData) {
        const updatedUserData = { ...userData, has_completed_onboarding: status };
        setUserData(updatedUserData);
      }
      
      // Update user
      if (user) {
        const updatedUser = { ...user, has_completed_onboarding: status };
        await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
      
      // Get a fresh token to update token data
      await refreshToken();
      
      return true;
    } catch (error) {
      console.error("Error updating onboarding status:", error);
      return false;
    }
  };

  // Method to get organization members
  const getOrganizationMembers = async () => {
    try {
      const response = await axiosInstance.get('/organization-members/');
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Method to manually check and update role information
  const refreshRoleInfo = async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      
      if (token) {
        const decodedToken = decodeJWT(token);
        
        if (decodedToken && decodedToken.role) {
          setUserData(prev => {
            const updated = {
              ...prev,
              role: decodedToken.role,
              userId: decodedToken.user_id,
              orgId: decodedToken.org_id,
              has_completed_onboarding: decodedToken.has_completed_onboarding || false,
            };
            return updated;
          });
          
          setOnboardingComplete(decodedToken.has_completed_onboarding || false);
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    userData,
    error,
    onboardingComplete,
    login,
    logout,
    register,
    requestPasswordReset,
    updateUser,
    clearError,
    refreshToken,
    getAccessToken,
    deviceService,
    mobileService,
    axiosInstance,
    mobileApiInstance,
    isAdmin,
    isOwner,
    isAdminOrOwner,
    createOrganization,
    updateOnboardingStatus,
    refreshRoleInfo,
    getUserProfile,
    updateUserProfile,
    getOrganizationMembers,
    setApiKey,
    getApiKey
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default axiosInstance;
