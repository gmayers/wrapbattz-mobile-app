import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/api';

export const AuthContext = createContext(null);

const AUTH_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
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

      const response = await fetch('https://test.gmayersservices.com/api/auth/token/refresh/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, data.access);
      return data.access;
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout user
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

      const response = await authService.login(email, password);
      
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, response.access);
      await AsyncStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, response.refresh);
      
      if (response.user) {
        await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(response.user));
        setUser(response.user);
      }

      setIsAuthenticated(true);
      return response;
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