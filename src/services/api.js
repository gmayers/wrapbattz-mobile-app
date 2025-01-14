// services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://test.gmayersservices.com/api';

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const response = await api.post('/auth/token/refresh/', {
          refresh: refreshToken,
        });

        const { access } = response.data;
        await AsyncStorage.setItem('accessToken', access);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh token fails, logout user
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
        throw refreshError;
      }
    }

    return Promise.reject(error);
  }
);

// Auth services
export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/token/', { email, password });
    await AsyncStorage.setItem('accessToken', response.data.access);
    await AsyncStorage.setItem('refreshToken', response.data.refresh);
    return response.data;
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
  },

  isAuthenticated: async () => {
    const token = await AsyncStorage.getItem('accessToken');
    return !!token;
  },
};

// Device services
export const deviceService = {
  getAllDevices: async () => {
    const response = await api.get('/devices/');
    return response.data;
  },

  getDevice: async (id) => {
    const response = await api.get(`/devices/${id}/`);
    return response.data;
  },

  createDevice: async (deviceData) => {
    const response = await api.post('/devices/', deviceData);
    return response.data;
  },
};

// Device Assignment services
export const assignmentService = {
  getAllAssignments: async () => {
    const response = await api.get('/device-assignments/');
    return response.data;
  },

  getAssignment: async (id) => {
    const response = await api.get(`/device-assignments/${id}/`);
    return response.data;
  },

  createAssignment: async (assignmentData) => {
    const response = await api.post('/device-assignments/', assignmentData);
    return response.data;
  },

  updateAssignment: async (id, assignmentData) => {
    const response = await api.put(`/device-assignments/${id}/`, assignmentData);
    return response.data;
  },

  partialUpdateAssignment: async (id, assignmentData) => {
    const response = await api.patch(`/device-assignments/${id}/`, assignmentData);
    return response.data;
  },
};

// Device Photos services
export const photoService = {
  getAllPhotos: async () => {
    const response = await api.get('/device-photos/');
    return response.data;
  },

  getPhoto: async (id) => {
    const response = await api.get(`/device-photos/${id}/`);
    return response.data;
  },

  createPhoto: async (photoData) => {
    const response = await api.post('/device-photos/', photoData);
    return response.data;
  },
};

// Location services
export const locationService = {
  getAllLocations: async () => {
    const response = await api.get('/locations/');
    return response.data;
  },

  getLocation: async (id) => {
    const response = await api.get(`/locations/${id}/`);
    return response.data;
  },
};

// Organization Member services
export const memberService = {
  getAllMembers: async () => {
    const response = await api.get('/organization-members/');
    return response.data;
  },

  getMember: async (id) => {
    const response = await api.get(`/organization-members/${id}/`);
    return response.data;
  },
};

// Report services
export const reportService = {
  getAllReports: async () => {
    const response = await api.get('/reports/');
    return response.data;
  },

  getReport: async (id) => {
    const response = await api.get(`/reports/${id}/`);
    return response.data;
  },

  createReport: async (reportData) => {
    const response = await api.post('/reports/', reportData);
    return response.data;
  },
};

// Error handling utility
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        return {
          type: 'VALIDATION_ERROR',
          message: 'Please check your input.',
          details: data
        };
      case 401:
        return {
          type: 'AUTHENTICATION_ERROR',
          message: 'Please login again.',
          details: data
        };
      case 403:
        return {
          type: 'PERMISSION_ERROR',
          message: 'You do not have permission to perform this action.',
          details: data
        };
      case 404:
        return {
          type: 'NOT_FOUND',
          message: 'The requested resource was not found.',
          details: data
        };
      case 500:
        return {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred.',
          details: data
        };
      default:
        return {
          type: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred.',
          details: data
        };
    }
  } else if (error.request) {
    // Request made but no response received
    return {
      type: 'NETWORK_ERROR',
      message: 'Unable to connect to the server.',
      details: error.request
    };
  } else {
    // Error setting up request
    return {
      type: 'REQUEST_ERROR',
      message: 'Error setting up the request.',
      details: error.message
    };
  }
};

// Helper function to format API requests
export const formatApiRequest = {
  device: (data) => ({
    identifier: data.identifier,
    description: data.description,
    make: data.make,
    model: data.model,
    device_type: data.deviceType,
    serial_number: data.serialNumber,
    maintenance_interval: data.maintenanceInterval,
    next_maintenance: data.nextMaintenance,
    organization: data.organizationId,
  }),
  
  assignment: (data) => ({
    device_id: data.deviceId,
    user: data.userId,
    location: data.locationId,
    assigned_date: data.assignedDate,
    returned_date: data.returnedDate,
  }),

  report: (data) => ({
    device_id: data.deviceId,
    report_date: data.reportDate,
    type: data.type.toUpperCase(),
    status: data.status,
    description: data.description,
    resolved: data.resolved,
    resolved_date: data.resolvedDate,
  }),
};

export default api;