// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/api';

// Create context
export const AuthContext = createContext(null);

// Storage keys
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

  // Initialize auth state
  useEffect(() => {
    checkAuthState();
  }, []);

  // Check if user is authenticated
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

  // Login handler
  const login = async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);

      // Call login API
      const response = await authService.login(email, password);
      
      // Store tokens
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, response.access);
      await AsyncStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, response.refresh);
      
      // Store user data if available
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

  // Logout handler
  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Clear all auth related storage
      await AsyncStorage.multiRemove([
        AUTH_KEYS.ACCESS_TOKEN,
        AUTH_KEYS.REFRESH_TOKEN,
        AUTH_KEYS.USER_DATA,
      ]);

      // Reset state
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

  // Update user data
  const updateUser = async (userData) => {
    try {
      await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error updating user data:', error);
      setError('Error updating user data');
    }
  };

  // Clear any error
  const clearError = () => setError(null);

  // Context value
  const value = {
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    logout,
    updateUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for using auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Example usage:
/*
import { useAuth } from '../context/AuthContext';

const MyComponent = () => {
  const { 
    isAuthenticated, 
    isLoading, 
    user, 
    error, 
    login, 
    logout,
    updateUser,
    clearError 
  } = useAuth();

  const handleLogin = async () => {
    try {
      await login('email@example.com', 'password');
      // Navigate to home screen
    } catch (error) {
      // Handle error
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <View>
      {error && <ErrorMessage message={error} onDismiss={clearError} />}
      {isAuthenticated ? (
        <Button title="Logout" onPress={logout} />
      ) : (
        <Button title="Login" onPress={handleLogin} />
      )}
    </View>
  );
};
*/