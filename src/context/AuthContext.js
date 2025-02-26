import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export const AuthContext = createContext(null);

const AUTH_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
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

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      const userData = await AsyncStorage.getItem(AUTH_KEYS.USER_DATA);
      const accessToken = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      
      if (userData && accessToken) {
        setUser(JSON.parse(userData));
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

      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, response.data.access);
      return response.data.access;
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
      
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, response.data.access);
      await AsyncStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, response.data.refresh);
      
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
      ]);

      setUser(null);
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

  const value = {
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    logout,
    updateUser,
    clearError,
    refreshToken,
    getAccessToken,
    deviceService, // Add the device service to the context
    axiosInstance, // Expose the axios instance for custom API calls
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