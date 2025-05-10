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
    console.log('REQUEST INTERCEPTOR - URL:', config.url);
    console.log('REQUEST INTERCEPTOR - Method:', config.method);
    console.log('REQUEST INTERCEPTOR - Token exists:', !!token);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('REQUEST INTERCEPTOR - Authorization header added');
    }
    
    if (config.data) {
      console.log('REQUEST INTERCEPTOR - Request body:', JSON.stringify(config.data, null, 2));
    }
    
    return config;
  },
  (error) => {
    console.error('REQUEST INTERCEPTOR - Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
  (response) => {
    console.log('RESPONSE INTERCEPTOR - URL:', response.config.url);
    console.log('RESPONSE INTERCEPTOR - Status:', response.status);
    console.log('RESPONSE INTERCEPTOR - Response data structure:', Object.keys(response.data));
    console.log('RESPONSE INTERCEPTOR - Response data:', JSON.stringify(response.data, null, 2));
    return response;
  },
  async (error) => {
    console.error('RESPONSE INTERCEPTOR - Error status:', error.response?.status);
    console.error('RESPONSE INTERCEPTOR - Error data:', JSON.stringify(error.response?.data, null, 2));
    
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('RESPONSE INTERCEPTOR - Attempting token refresh');
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem(AUTH_KEYS.REFRESH_TOKEN);
        console.log('RESPONSE INTERCEPTOR - Refresh token exists:', !!refreshToken);
        
        const response = await axios.post(
          'https://battwrapz.gmayersservices.com/api/auth/token/refresh/',
          { refresh: refreshToken }
        );

        console.log('RESPONSE INTERCEPTOR - Token refresh successful');
        const { access } = response.data;
        await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, access);
        console.log('RESPONSE INTERCEPTOR - New access token saved');

        originalRequest.headers.Authorization = `Bearer ${access}`;
        console.log('RESPONSE INTERCEPTOR - Retry original request with new token');
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error('RESPONSE INTERCEPTOR - Token refresh failed:', refreshError);
        throw refreshError;
      }
    }

    return Promise.reject(error);
  }
);

// API service for device-related operations
const deviceService = {
  getAssignments: async () => {
    console.log('DEVICE SERVICE - Fetching device assignments');
    const response = await axiosInstance.get('/device-assignments/');
    console.log('DEVICE SERVICE - Assignments data:', JSON.stringify(response.data, null, 2));
    return response.data;
  },

  getLocations: async () => {
    console.log('DEVICE SERVICE - Fetching locations');
    const response = await axiosInstance.get('/locations/');
    console.log('DEVICE SERVICE - Locations data:', JSON.stringify(response.data, null, 2));
    return response.data;
  },

  createLocation: async (locationData) => {
    console.log('DEVICE SERVICE - Creating new location');
    console.log('DEVICE SERVICE - Location data:', JSON.stringify(locationData, null, 2));
    
    // Ensure all required fields are present according to the API schema
    const requiredFields = ['street_number', 'street_name', 'town_or_city', 'postcode'];
    const missingFields = requiredFields.filter(field => !locationData[field]);
    
    if (missingFields.length > 0) {
      console.error('DEVICE SERVICE - Missing required fields:', missingFields);
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    try {
      const response = await axiosInstance.post('/locations/', locationData);
      console.log('DEVICE SERVICE - Location created successfully:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error('DEVICE SERVICE - Error creating location:', error.response?.data || error.message);
      throw error;
    }
  },

  getDevicesByLocation: async (locationId) => {
    console.log(`DEVICE SERVICE - Fetching devices for location: ${locationId}`);
    const response = await axiosInstance.get(`/devices/?location=${locationId}`);
    console.log('DEVICE SERVICE - Devices data:', JSON.stringify(response.data, null, 2));
    return response.data;
  },

  getMyAssignedDevices: async () => {
    console.log('DEVICE SERVICE - Fetching my assigned devices');
    const response = await axiosInstance.get('/devices/my_assigned_devices/');
    console.log('DEVICE SERVICE - My assigned devices data:', JSON.stringify(response.data, null, 2));
    return response.data;
  },

  returnDevice: async (deviceId, returnData) => {
    console.log(`DEVICE SERVICE - Returning device ID: ${deviceId}`);
    console.log('DEVICE SERVICE - Return data:', JSON.stringify(returnData, null, 2));
    const response = await axiosInstance.patch(
      `/device-assignments/${deviceId}/`,
      returnData
    );
    console.log('DEVICE SERVICE - Return response:', JSON.stringify(response.data, null, 2));
    return response.data;
  },

  createDeviceReturn: async (returnData) => {
    console.log('DEVICE SERVICE - Creating device return');
    console.log('DEVICE SERVICE - Return data:', JSON.stringify(returnData, null, 2));
    const response = await axiosInstance.post('/device-returns/', returnData);
    console.log('DEVICE SERVICE - Create return response:', JSON.stringify(response.data, null, 2));
    return response.data;
  }
};

// Pure JS function to decode a JWT token without external libraries
const decodeJWT = (token) => {
  console.log('DECODE JWT - Attempting to decode token');
  console.log('DECODE JWT - Token exists:', !!token);
  
  try {
    if (!token) return null;
    
    const parts = token.split('.');
    console.log('DECODE JWT - Token parts count:', parts.length);
    
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
      console.log('DECODE JWT - Successfully decoded token data:', JSON.stringify(decodedData, null, 2));
      return decodedData;
    } catch (decodeError) {
      console.error('DECODE JWT - Error during base64 decoding:', decodeError);
      return null;
    }
  } catch (error) {
    console.error('DECODE JWT - Error decoding JWT:', error);
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
    console.log('AUTH PROVIDER - Initial mount, checking auth state');
    checkAuthState();
  }, []);

  // Store decoded token data in AsyncStorage and state
  const saveTokenData = async (token) => {
    console.log('SAVE TOKEN DATA - Attempting to save token data');
    console.log('SAVE TOKEN DATA - Token exists:', !!token);
    
    try {
      if (!token) return null;
      
      const decodedToken = decodeJWT(token);
      console.log('SAVE TOKEN DATA - Decoded token exists:', !!decodedToken);
      
      if (!decodedToken) return null;
      
      // Store decoded token in state
      const extractedUserData = {
        userId: decodedToken.user_id,
        orgId: decodedToken.org_id,
        role: decodedToken.role,
        name: decodedToken.first_name || 'User',
      };
      
      console.log('SAVE TOKEN DATA - Extracted user data:', JSON.stringify(extractedUserData, null, 2));
      
      // Save token data to AsyncStorage
      await AsyncStorage.setItem(AUTH_KEYS.TOKEN_DATA, JSON.stringify(decodedToken));
      console.log('SAVE TOKEN DATA - Token data saved to AsyncStorage');
      
      // Update state
      setUserData(extractedUserData);
      console.log('SAVE TOKEN DATA - User data state updated');
      
      return decodedToken;
    } catch (error) {
      console.error('SAVE TOKEN DATA - Error saving token data:', error);
      return null;
    }
  };

  const checkAuthState = async () => {
    console.log('CHECK AUTH STATE - Starting auth state check');
    
    try {
      setIsLoading(true);
      console.log('CHECK AUTH STATE - isLoading set to true');
      
      const savedUserData = await AsyncStorage.getItem(AUTH_KEYS.USER_DATA);
      const savedTokenData = await AsyncStorage.getItem(AUTH_KEYS.TOKEN_DATA);
      const accessToken = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      
      console.log('CHECK AUTH STATE - Saved user data exists:', !!savedUserData);
      console.log('CHECK AUTH STATE - Token exists:', !!accessToken);
      console.log('CHECK AUTH STATE - Saved token data exists:', !!savedTokenData);
      
      if (savedUserData) {
        const parsedUserData = JSON.parse(savedUserData);
        console.log('CHECK AUTH STATE - Parsed user data:', JSON.stringify(parsedUserData, null, 2));
        setUser(parsedUserData);
        console.log('CHECK AUTH STATE - User state set');
      }
      
      // First check if we have saved token data
      if (savedTokenData) {
        const parsedTokenData = JSON.parse(savedTokenData);
        console.log('CHECK AUTH STATE - Parsed token data:', JSON.stringify(parsedTokenData, null, 2));
        
        const userData = {
          userId: parsedTokenData.user_id,
          orgId: parsedTokenData.org_id,
          role: parsedTokenData.role, 
          name: parsedTokenData.first_name || 'User',
        };
        
        console.log('CHECK AUTH STATE - Setting userData from token data:', JSON.stringify(userData, null, 2));
        setUserData(userData);
        setIsAuthenticated(true);
        console.log('CHECK AUTH STATE - isAuthenticated set to true from saved token data');
      } 
      // If no saved token data but we have a token, decode and save it
      else if (accessToken) {
        console.log('CHECK AUTH STATE - No saved token data but access token exists, decoding token');
        await saveTokenData(accessToken);
        setIsAuthenticated(true);
        console.log('CHECK AUTH STATE - isAuthenticated set to true from access token');
      } else {
        console.log('CHECK AUTH STATE - No token or token data found, user not authenticated');
      }
    } catch (error) {
      console.error('CHECK AUTH STATE - Error checking auth state:', error);
      setError('Error checking authentication state');
    } finally {
      setIsLoading(false);
      console.log('CHECK AUTH STATE - isLoading set to false');
    }
  };

  const refreshToken = async () => {
    console.log('REFRESH TOKEN - Starting token refresh');
    
    try {
      const refreshToken = await AsyncStorage.getItem(AUTH_KEYS.REFRESH_TOKEN);
      console.log('REFRESH TOKEN - Refresh token exists:', !!refreshToken);
      
      if (!refreshToken) {
        console.error('REFRESH TOKEN - No refresh token found');
        throw new Error('No refresh token found');
      }

      console.log('REFRESH TOKEN - Sending refresh token request');
      const response = await axiosInstance.post('/auth/token/refresh/', {
        refresh: refreshToken,
      });

      console.log('REFRESH TOKEN - Token refresh successful');
      const accessToken = response.data.access;
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken);
      console.log('REFRESH TOKEN - New access token saved to AsyncStorage');
      
      // Save the decoded token data
      await saveTokenData(accessToken);
      console.log('REFRESH TOKEN - Token data saved');
      
      return accessToken;
    } catch (error) {
      console.error('REFRESH TOKEN - Token refresh error:', error);
      console.log('REFRESH TOKEN - Logging out user due to refresh failure');
      await logout();
      throw error;
    }
  };

  const getAccessToken = async () => {
    console.log('GET ACCESS TOKEN - Retrieving access token');
    
    try {
      const token = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      console.log('GET ACCESS TOKEN - Token exists:', !!token);
      return token;
    } catch (error) {
      console.error('GET ACCESS TOKEN - Error getting access token:', error);
      return null;
    }
  };

  const register = async (userData) => {
    console.log('REGISTER - Starting user registration');
    console.log('REGISTER - User data:', JSON.stringify(userData, null, 2));
    
    try {
      setIsLoading(true);
      console.log('REGISTER - isLoading set to true');
      setError(null);
      console.log('REGISTER - error cleared');

      // Register the user with the new API endpoint
      console.log('REGISTER - Sending registration request');
      const registerResponse = await axiosInstance.post('/auth/register/', {
        email: userData.email,
        username: userData.username || userData.email,
        password: userData.password,
        password2: userData.password, // Add password confirmation
        first_name: userData.first_name,
        last_name: userData.last_name,
        organization_invite_code: userData.organization_invite_code || '', // Updated field name
        phone_number: userData.phone_number
      });
      
      console.log('REGISTER - Registration successful, response:', JSON.stringify(registerResponse.data, null, 2));
      
      // Check if tokens are directly returned from registration
      if (registerResponse.data.tokens) {
        console.log('REGISTER - Tokens received from registration response');
        const { access, refresh } = registerResponse.data.tokens;
        
        await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, access);
        await AsyncStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, refresh);
        console.log('REGISTER - Tokens saved to AsyncStorage');
        
        // Save the decoded token data
        await saveTokenData(access);
        console.log('REGISTER - Token data saved');
        
        // Set user data if available
        const userInfo = {
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          ...registerResponse.data
        };
        
        delete userInfo.tokens; // Remove tokens from user data
        
        await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(userInfo));
        console.log('REGISTER - User data saved to AsyncStorage');
        setUser(userInfo);
        console.log('REGISTER - User state set');
        
        setIsAuthenticated(true);
        console.log('REGISTER - isAuthenticated set to true');
        
        return registerResponse.data;
      } else {
        // Fallback to old login flow if tokens not returned
        console.log('REGISTER - No tokens in response, attempting login');
        const loginResponse = await axiosInstance.post('/auth/token/', {
          email: userData.email,
          password: userData.password,
        });
        
        console.log('REGISTER - Login successful, response:', JSON.stringify(loginResponse.data, null, 2));
        const accessToken = loginResponse.data.access;
        const refreshToken = loginResponse.data.refresh;
        
        await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken);
        await AsyncStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, refreshToken);
        console.log('REGISTER - Tokens saved to AsyncStorage');
        
        // Save the decoded token data
        await saveTokenData(accessToken);
        console.log('REGISTER - Token data saved');
        
        if (loginResponse.data.user) {
          await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(loginResponse.data.user));
          console.log('REGISTER - User data saved to AsyncStorage');
          setUser(loginResponse.data.user);
          console.log('REGISTER - User state set');
        }

        setIsAuthenticated(true);
        console.log('REGISTER - isAuthenticated set to true');
        return loginResponse.data;
      }
    } catch (error) {
      console.error('REGISTER - Registration error:', error);
      console.error('REGISTER - Response data:', JSON.stringify(error.response?.data, null, 2));
      const errorMessage = error.response?.data?.detail || 'Registration failed. Please try again.';
      setError(errorMessage);
      console.log('REGISTER - Error state set to:', errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
      console.log('REGISTER - isLoading set to false');
    }
  };

  const login = async (email, password, tokens = null) => {
    console.log('LOGIN - Starting user login');
    console.log('LOGIN - Email:', email);
    
    try {
      setIsLoading(true);
      console.log('LOGIN - isLoading set to true');
      setError(null);
      console.log('LOGIN - error cleared');

      let accessToken, refreshToken, userData;
      
      // If tokens are provided directly (from registration response)
      if (tokens) {
        console.log('LOGIN - Using provided tokens from registration');
        accessToken = tokens.access;
        refreshToken = tokens.refresh;
        userData = null; // Will be set from token data
      } else {
        // Otherwise make a login request
        console.log('LOGIN - Sending login request');
        const response = await axiosInstance.post('/auth/token/', {
          email,
          password,
        });
        
        console.log('LOGIN - Login successful, response structure:', Object.keys(response.data));
        console.log('LOGIN - Full response data:', JSON.stringify(response.data, null, 2));
        
        accessToken = response.data.access;
        refreshToken = response.data.refresh;
        userData = response.data.user;
      }
      
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken);
      await AsyncStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, refreshToken);
      console.log('LOGIN - Tokens saved to AsyncStorage');
      
      // Save the decoded token data
      const tokenData = await saveTokenData(accessToken);
      console.log('LOGIN - Token data saved');
      
      if (userData) {
        await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(userData));
        console.log('LOGIN - User data saved to AsyncStorage');
        setUser(userData);
        console.log('LOGIN - User state set:', JSON.stringify(userData, null, 2));
      } else if (tokenData) {
        // Extract basic user info from token if no user data provided
        const basicUserData = {
          email: email,
          first_name: tokenData.first_name || '',
          last_name: '',
        };
        await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(basicUserData));
        console.log('LOGIN - Basic user data saved to AsyncStorage');
        setUser(basicUserData);
        console.log('LOGIN - User state set with basic info');
      }

      setIsAuthenticated(true);
      console.log('LOGIN - isAuthenticated set to true');
      return { tokens: { access: accessToken, refresh: refreshToken }, user: userData || {} };
    } catch (error) {
      console.error('LOGIN - Login error:', error);
      console.error('LOGIN - Response status:', error.response?.status);
      console.error('LOGIN - Response data:', JSON.stringify(error.response?.data, null, 2));
      const errorMessage = error.response?.data?.detail || 'Login failed. Please try again.';
      setError(errorMessage);
      console.log('LOGIN - Error state set to:', errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
      console.log('LOGIN - isLoading set to false');
    }
  };

  const logout = async () => {
    console.log('LOGOUT - Starting user logout');
    
    try {
      setIsLoading(true);
      console.log('LOGOUT - isLoading set to true');
      
      console.log('LOGOUT - Clearing AsyncStorage items');
      await AsyncStorage.multiRemove([
        AUTH_KEYS.ACCESS_TOKEN,
        AUTH_KEYS.REFRESH_TOKEN,
        AUTH_KEYS.USER_DATA,
        AUTH_KEYS.TOKEN_DATA,
      ]);
      console.log('LOGOUT - AsyncStorage items cleared');

      setUser(null);
      console.log('LOGOUT - User state cleared');
      setUserData(null);
      console.log('LOGOUT - UserData state cleared');
      setIsAuthenticated(false);
      console.log('LOGOUT - isAuthenticated set to false');
      setError(null);
      console.log('LOGOUT - Error state cleared');
    } catch (error) {
      console.error('LOGOUT - Logout error:', error);
      setError('Error during logout');
      console.log('LOGOUT - Error state set to: Error during logout');
    } finally {
      setIsLoading(false);
      console.log('LOGOUT - isLoading set to false');
    }
  };

  const updateUser = async (userData) => {
    console.log('UPDATE USER - Starting user update');
    console.log('UPDATE USER - User data:', JSON.stringify(userData, null, 2));
    
    try {
      await AsyncStorage.setItem(AUTH_KEYS.USER_DATA, JSON.stringify(userData));
      console.log('UPDATE USER - User data saved to AsyncStorage');
      setUser(userData);
      console.log('UPDATE USER - User state updated');
    } catch (error) {
      console.error('UPDATE USER - Error updating user data:', error);
      setError('Error updating user data');
      console.log('UPDATE USER - Error state set');
    }
  };

  const clearError = () => {
    console.log('CLEAR ERROR - Clearing error state');
    setError(null);
  };

  // Method to manually check and update role information
  const refreshRoleInfo = async () => {
    console.log('REFRESH ROLE INFO - Starting role refresh');
    
    try {
      const token = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      console.log('REFRESH ROLE INFO - Token exists:', !!token);
      
      if (token) {
        const decodedToken = decodeJWT(token);
        console.log('REFRESH ROLE INFO - Decoded token exists:', !!decodedToken);
        
        if (decodedToken && decodedToken.role) {
          console.log('REFRESH ROLE INFO - Role found in token:', decodedToken.role);
          
          setUserData(prev => {
            const updated = {
              ...prev,
              role: decodedToken.role,
              userId: decodedToken.user_id,
              orgId: decodedToken.org_id,
            };
            console.log('REFRESH ROLE INFO - Updated userData:', JSON.stringify(updated, null, 2));
            return updated;
          });
          
          console.log('REFRESH ROLE INFO - Role info updated successfully');
          return true;
        } else {
          console.log('REFRESH ROLE INFO - No role found in token');
        }
      } else {
        console.log('REFRESH ROLE INFO - No token found');
      }
      
      return false;
    } catch (error) {
      console.error('REFRESH ROLE INFO - Error refreshing role info:', error);
      return false;
    }
  };

  // Log state changes
  useEffect(() => {
    console.log('AUTH STATE CHANGE - isAuthenticated:', isAuthenticated);
  }, [isAuthenticated]);
  
  useEffect(() => {
    console.log('AUTH STATE CHANGE - isLoading:', isLoading);
  }, [isLoading]);
  
  useEffect(() => {
    console.log('AUTH STATE CHANGE - user:', user ? 'exists' : 'null');
    if (user) console.log('AUTH STATE CHANGE - user data:', JSON.stringify(user, null, 2));
  }, [user]);
  
  useEffect(() => {
    console.log('AUTH STATE CHANGE - userData:', userData ? 'exists' : 'null');
    if (userData) console.log('AUTH STATE CHANGE - userData:', JSON.stringify(userData, null, 2));
  }, [userData]);
  
  useEffect(() => {
    console.log('AUTH STATE CHANGE - error:', error ? error : 'null');
  }, [error]);

  const value = {
    isAuthenticated,
    isLoading,
    user,
    userData,
    error,
    login,
    logout,
    register,
    updateUser,
    clearError,
    refreshToken,
    getAccessToken,
    deviceService,
    axiosInstance,
    isAdmin,
    isOwner,
    isAdminOrOwner,
    refreshRoleInfo,
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