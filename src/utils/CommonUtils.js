// CommonUtils.js - Common utility functions to reduce code duplication

import { Alert } from 'react-native';

// Color constants
export const COLORS = {
  PRIMARY_ORANGE: '#FF9500',
  SUCCESS_GREEN: '#10B981',
  ERROR_RED: '#EF4444',
  WARNING_YELLOW: '#F59E0B',
  INFO_BLUE: '#3B82F6',
  NEUTRAL_GRAY: '#6B7280',
  LIGHT_GRAY: '#F5F5F5',
  DARK_GRAY: '#333333',
  WHITE: '#FFFFFF',
  BLACK: '#000000',
};

// Status choices for reports
export const REPORT_STATUS_CHOICES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ESCALATED', label: 'Escalated' }
];

// Type choices for reports
export const REPORT_TYPE_CHOICES = [
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'STOLEN', label: 'Stolen' },
  { value: 'LOST', label: 'Lost' },
  { value: 'MALFUNCTIONING', label: 'Malfunctioning' },
  { value: 'MAINTENANCE', label: 'Needs Maintenance' },
  { value: 'OTHER', label: 'Other' }
];

// Device status choices
export const DEVICE_STATUS_CHOICES = [
  { value: 'available', label: 'Available' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'stolen', label: 'Stolen' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'lost', label: 'Lost' }
];

// Common validation functions
export const validation = {
  email: (email) => {
    const emailRegex = /\S+@\S+\.\S+/;
    return emailRegex.test(email);
  },
  
  phone: (phone) => {
    const phoneRegex = /^[\d\+\-\(\) ]{10,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  },
  
  url: (url) => {
    return /^https?:\/\/.+/.test(url);
  },
  
  ukPostcode: (postcode) => {
    const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
    return postcodeRegex.test(postcode);
  },
  
  required: (value) => {
    return value && value.toString().trim().length > 0;
  },
  
  minLength: (value, min) => {
    return value && value.toString().length >= min;
  },
  
  maxLength: (value, max) => {
    return value && value.toString().length <= max;
  }
};

// Common formatting functions
export const formatting = {
  currency: (amount, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  },
  
  date: (timestamp, format = 'standard') => {
    if (!timestamp) return 'N/A';
    
    const date = typeof timestamp === 'number' 
      ? new Date(timestamp * 1000) 
      : new Date(timestamp);
    
    switch (format) {
      case 'short':
        return date.toLocaleDateString('en-GB', {
          month: 'short',
          day: 'numeric',
        });
      case 'full':
        return date.toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        });
      default:
        return date.toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
    }
  },
  
  capitalize: (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
  
  truncate: (str, maxLength = 50) => {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }
};

// Status color helpers
export const getStatusColor = (status, type = 'device') => {
  switch (type) {
    case 'report':
      switch (status) {
        case 'PENDING':
          return COLORS.WARNING_YELLOW;
        case 'IN_PROGRESS':
          return COLORS.INFO_BLUE;
        case 'RESOLVED':
          return COLORS.SUCCESS_GREEN;
        case 'CANCELLED':
          return COLORS.NEUTRAL_GRAY;
        case 'ESCALATED':
          return COLORS.ERROR_RED;
        default:
          return COLORS.NEUTRAL_GRAY;
      }
    case 'device':
      switch (status) {
        case 'available':
          return COLORS.SUCCESS_GREEN;
        case 'assigned':
          return COLORS.INFO_BLUE;
        case 'damaged':
          return COLORS.ERROR_RED;
        case 'stolen':
          return COLORS.NEUTRAL_GRAY;
        case 'maintenance':
          return COLORS.WARNING_YELLOW;
        case 'lost':
          return COLORS.NEUTRAL_GRAY;
        default:
          return COLORS.SUCCESS_GREEN;
      }
    default:
      return COLORS.NEUTRAL_GRAY;
  }
};

// Common error handling
// NOTE: 401 errors are handled globally by the axios interceptor in AuthContext
// This function should only be used for other error types
export const handleApiError = (error, logout, defaultMessage = 'An error occurred') => {
  let errorMessage = defaultMessage;

  if (error.response) {
    errorMessage = error.response.data?.detail ||
                  error.response.data?.message ||
                  defaultMessage;

    // Skip 401 errors - they're handled globally by axios interceptor
    if (error.response.status === 401) {
      // Don't show alert - global interceptor handles this
      return errorMessage;
    }
  } else if (error.request) {
    errorMessage = 'No response from server. Please check your connection.';
  } else if (error.message) {
    errorMessage = error.message;
  }

  Alert.alert('Error', errorMessage);
  return errorMessage;
};

// JSON validation and normalization for NFC
export const nfcUtils = {
  normalizeJsonString: (jsonString) => {
    // Replace fancy quotes with standard quotes
    let normalized = jsonString
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // Replace various fancy double quotes
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Replace various fancy single quotes
    
    // Remove any control characters
    normalized = normalized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Fix any malformed JSON that might have occurred from improper encoding
    try {
      // Test if it's valid after normalization
      JSON.parse(normalized);
      return normalized;
    } catch (e) {
      // Further repairs for common issues
      
      // Replace unquoted property names - find words followed by colon
      normalized = normalized.replace(/(\s*)(\w+)(\s*):(\s*)/g, (match, before, word, middle, after) => {
        // Don't replace if it's already part of a properly quoted structure
        if ((/"\w+"(\s*):/.test(match) || /'?\w+'?(\s*):/.test(match))) {
          return match;
        }
        return `${before}"${word}"${middle}:${after}`;
      });
      
      // Try to fix dangling quote issues
      let quoteCount = 0;
      for (let i = 0; i < normalized.length; i++) {
        if (normalized[i] === '"' && (i === 0 || normalized[i-1] !== '\\')) {
          quoteCount++;
        }
      }
      
      if (quoteCount % 2 !== 0) {
        // Unbalanced quotes - try to identify and fix the issue
        console.log("Detected unbalanced quotes, attempting fix");
        
        // Add a closing quote before any commas or closing braces
        normalized = normalized.replace(/([^"\s,{}[\]]+)(\s*)(,|\}|\])/g, '$1"$2$3');
        
        // Fix any values that should start with a quote but don't
        normalized = normalized.replace(/:(\s*)([^"\s,{}[\]][^,{}[\]]*)/g, ':$1"$2"');
      }
      
      return normalized;
    }
  },
  
  validateJSON: (jsonString) => {
    try {
      JSON.parse(jsonString);
      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  },
  
  isLikelyJSON: (value) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  }
};

// Common form validation
export const validateForm = (formData, validationRules) => {
  const errors = {};
  
  for (const [field, rules] of Object.entries(validationRules)) {
    const value = formData[field];
    
    for (const rule of rules) {
      if (rule.type === 'required' && !validation.required(value)) {
        errors[field] = rule.message || `${field} is required`;
        break;
      }
      
      if (rule.type === 'email' && value && !validation.email(value)) {
        errors[field] = rule.message || 'Please enter a valid email';
        break;
      }
      
      if (rule.type === 'phone' && value && !validation.phone(value)) {
        errors[field] = rule.message || 'Please enter a valid phone number';
        break;
      }
      
      if (rule.type === 'minLength' && value && !validation.minLength(value, rule.value)) {
        errors[field] = rule.message || `Must be at least ${rule.value} characters`;
        break;
      }
      
      if (rule.type === 'maxLength' && value && !validation.maxLength(value, rule.value)) {
        errors[field] = rule.message || `Must be no more than ${rule.value} characters`;
        break;
      }
      
      if (rule.type === 'custom' && rule.validator && !rule.validator(value)) {
        errors[field] = rule.message || 'Invalid value';
        break;
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Common async storage helpers
export const storageHelpers = {
  setItem: async (key, value) => {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
      return true;
    } catch (error) {
      console.error('Error saving to storage:', error);
      return false;
    }
  },
  
  getItem: async (key) => {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error reading from storage:', error);
      return null;
    }
  },
  
  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from storage:', error);
      return false;
    }
  }
};

// Common device helpers
export const deviceHelpers = {
  getDeviceStatusLabel: (status) => {
    const choice = DEVICE_STATUS_CHOICES.find(c => c.value === status);
    return choice ? choice.label : formatting.capitalize(status);
  },
  
  getReportStatusLabel: (status) => {
    const choice = REPORT_STATUS_CHOICES.find(c => c.value === status);
    return choice ? choice.label : formatting.capitalize(status);
  },
  
  getReportTypeLabel: (type) => {
    const choice = REPORT_TYPE_CHOICES.find(c => c.value === type);
    return choice ? choice.label : formatting.capitalize(type);
  }
};

// Export all utilities
export default {
  COLORS,
  REPORT_STATUS_CHOICES,
  REPORT_TYPE_CHOICES,
  DEVICE_STATUS_CHOICES,
  validation,
  formatting,
  getStatusColor,
  handleApiError,
  nfcUtils,
  validateForm,
  storageHelpers,
  deviceHelpers,
};