import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export const AuthContext = createContext(null);

const AUTH_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
  TOKEN_DATA: 'tokenData', // New key to store decoded token data
};

// Create axios instance with base configuration
const axiosInstance = axios.create({
  baseURL: 'https://battwrapz.gmayersservices.com/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to add token to requests
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem(AUTH_KEYS.REFRESH_TOKEN);
        const response = await axios.post(
          'https://battwrapz.gmayersservices.com/api/auth/token/refresh/',
          { refresh: refreshToken }
        );

        const { access } = response.data;
        await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Handle refresh token failure
        throw refreshError;
      }
    }

    return Promise.reject(error);
  }
);

// API service for device-related operations
const deviceService = {
  getAssignments: async () => {
    const response = await axiosInstance.get('/device-assignments/');
    return response.data;
  },

  getLocations: async () => {
    const response = await axiosInstance.get('/locations/');
    return response.data;
  },

  getDevicesByLocation: async (locationId) => {
    const response = await axiosInstance.get(`/devices/?location=${locationId}`);
    return response.data;
  },

  returnDevice: async (deviceId, returnData) => {
    const response = await axiosInstance.patch(
      `/device-assignments/${deviceId}/`,
      returnData
    );
    return response.data;
  },

  createDeviceReturn: async (returnData) => {
    const response = await axiosInstance.post('/device-returns/', returnData);
    return response.data;
  }
};

// Pure JS function to decode a JWT token without external libraries
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
      return JSON.parse(jsonPayload);
    } catch (decodeError) {
      console.error('Error during base64 decoding:', decodeError);
      return null;
    }
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null); // For decoded token data
  const [error, setError] = useState(null);

  // Role-based helper functions
  const isAdmin = userData?.role === 'admin';
  const isOwner = userData?.role === 'owner';
  const isAdminOrOwner = isAdmin || isOwner;

  useEffect(() => {
    checkAuthState();
  }, []);

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
      };
      
      console.log('Setting userData to:', extractedUserData);
      
      // Save token data to AsyncStorage
      await AsyncStorage.setItem(AUTH_KEYS.TOKEN_DATA, JSON.stringify(decodedToken));
      
      // Update state
      setUserData(extractedUserData);
      
      return decodedToken;
    } catch (error) {
      console.error('Error saving token data:', error);
      return null;
    }
  };

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      const savedUserData = await AsyncStorage.getItem(AUTH_KEYS.USER_DATA);
      const savedTokenData = await AsyncStorage.getItem(AUTH_KEYS.TOKEN_DATA);
      const accessToken = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      
      console.log('checkAuthState - Token exists:', !!accessToken);
      console.log('checkAuthState - Saved token data exists:', !!savedTokenData);
      
      if (savedUserData) {
        const parsedUserData = JSON.parse(savedUserData);
        setUser(parsedUserData);
      }
      
      // First check if we have saved token data
      if (savedTokenData) {
        const parsedTokenData = JSON.parse(savedTokenData);
        setUserData({
          userId: parsedTokenData.user_id,
          orgId: parsedTokenData.org_id,
          role: parsedTokenData.role, 
          name: parsedTokenData.first_name || user?.username || 'User',
        });
        setIsAuthenticated(true);
      } 
      // If no saved token data but we have a token, decode and save it
      else if (accessToken) {
        await saveTokenData(accessToken);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      setError('Error checking authentication state');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(AUTH_KEYS.REFRESH_TOKEN);
      if (!refreshToken) throw new Error('No refresh token found');

      const response = await axiosInstance.post('/auth/token/refresh/', {
        refresh: refreshToken,
      });

      const accessToken = response.data.access;
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken);
      
      // Save the decoded token data
      await saveTokenData(accessToken);
      
      return accessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
      throw error;
    }
  };

  const getAccessToken = async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      return token;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axiosInstance.post('/auth/token/', {
        email,
        password,
      });
      
      const accessToken = response.data.access;
      const refreshToken = response.data.refresh;
      
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken);
      await AsyncStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, refreshToken);
      
      // Save the decoded token data
      await saveTokenData(accessToken);
      
      if (response.data.user) {
        await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(response.data.user));
        setUser(response.data.user);
      }

      setIsAuthenticated(true);
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.detail || 'Login failed. Please try again.';
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
        AUTH_KEYS.TOKEN_DATA, // Also clear stored token data
      ]);

      setUser(null);
      setUserData(null);
      setIsAuthenticated(false);
      setError(null);
    } catch (error) {
      console.error('Logout error:', error);
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
      console.error('Error updating user data:', error);
      setError('Error updating user data');
    }
  };

  const clearError = () => setError(null);

  // Method to manually check and update role information
  const refreshRoleInfo = async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      if (token) {
        const decodedToken = decodeJWT(token);
        if (decodedToken && decodedToken.role) {
          setUserData(prev => ({
            ...prev,
            role: decodedToken.role,
            userId: decodedToken.user_id,
            orgId: decodedToken.org_id,
          }));
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error refreshing role info:', error);
      return false;
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    userData,
    error,
    login,
    logout,
    updateUser,
    clearError,
    refreshToken,
    getAccessToken,
    deviceService,
    axiosInstance,
    isAdmin,
    isOwner,
    isAdminOrOwner,
    refreshRoleInfo, // New method to manually refresh role info
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