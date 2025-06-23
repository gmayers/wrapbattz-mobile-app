// src/utils/FormValidation.ts
import { ValidationRule, ValidationResult } from '../types';

export class FormValidation {
  /**
   * Validate email format
   */
  static email(email: string): boolean {
    const emailRegex = /\S+@\S+\.\S+/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   */
  static phone(phone: string): boolean {
    if (!phone || phone.trim().length < 10) return false;
    
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Count digits only
    const digitCount = (cleaned.match(/\d/g) || []).length;
    
    // Must have at least 10 digits, max 15
    if (digitCount < 10 || digitCount > 15) return false;
    
    // Basic format validation - allows +, digits, spaces, dashes, parentheses
    const phoneRegex = /^[\+]?[\d\s\-\(\)]+$/;
    
    return phoneRegex.test(phone);
  }

  /**
   * Validate URL format
   */
  static url(url: string): boolean {
    return /^https?:\/\/.+/.test(url);
  }

  /**
   * Validate UK postcode format
   */
  static ukPostcode(postcode: string): boolean {
    const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
    return postcodeRegex.test(postcode);
  }

  /**
   * Check if value is required (not empty)
   */
  static required(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return !isNaN(value);
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  }

  /**
   * Check minimum length
   */
  static minLength(value: string, min: number): boolean {
    return value && value.length >= min;
  }

  /**
   * Check maximum length
   */
  static maxLength(value: string, max: number): boolean {
    return !value || value.length <= max;
  }

  /**
   * Validate password strength
   */
  static passwordStrength(password: string): { valid: boolean; message?: string } {
    if (!password || password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    const criteriaCount = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (criteriaCount < 3) {
      return { 
        valid: false, 
        message: 'Password must contain at least 3 of: uppercase, lowercase, number, special character' 
      };
    }
    
    return { valid: true };
  }

  /**
   * Validate passwords match
   */
  static passwordsMatch(password: string, confirmPassword: string): boolean {
    return password === confirmPassword;
  }

  /**
   * Validate a single field with multiple rules
   */
  static validateField(value: any, rules: ValidationRule[]): string | null {
    for (const rule of rules) {
      switch (rule.type) {
        case 'required':
          if (!this.required(value)) {
            return rule.message || 'This field is required';
          }
          break;
          
        case 'email':
          if (value && !this.email(value)) {
            return rule.message || 'Please enter a valid email address';
          }
          break;
          
        case 'phone':
          if (value && !this.phone(value)) {
            return rule.message || 'Please enter a valid phone number';
          }
          break;
          
        case 'url':
          if (value && !this.url(value)) {
            return rule.message || 'Please enter a valid URL (must start with http:// or https://)';
          }
          break;
          
        case 'ukPostcode':
          if (value && !this.ukPostcode(value)) {
            return rule.message || 'Please enter a valid UK postcode';
          }
          break;
          
        case 'minLength':
          if (value && rule.value && !this.minLength(value, rule.value)) {
            return rule.message || `Must be at least ${rule.value} characters`;
          }
          break;
          
        case 'maxLength':
          if (value && rule.value && !this.maxLength(value, rule.value)) {
            return rule.message || `Must be no more than ${rule.value} characters`;
          }
          break;
          
        case 'custom':
          if (rule.validator && !rule.validator(value)) {
            return rule.message || 'Invalid value';
          }
          break;
      }
    }
    
    return null;
  }

  /**
   * Validate an entire form with validation rules
   */
  static validateForm(formData: Record<string, any>, validationRules: Record<string, ValidationRule[]>): ValidationResult {
    const errors: Record<string, string> = {};
    
    for (const [field, rules] of Object.entries(validationRules)) {
      const value = formData[field];
      const error = this.validateField(value, rules);
      
      if (error) {
        errors[field] = error;
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Common validation rule sets
   */
  static commonRules = {
    email: (required = true): ValidationRule[] => [
      ...(required ? [{ type: 'required' as const }] : []),
      { type: 'email' as const }
    ],
    
    password: (minLength = 8): ValidationRule[] => [
      { type: 'required' as const },
      { type: 'minLength' as const, value: minLength },
      { 
        type: 'custom' as const, 
        validator: (value: string) => FormValidation.passwordStrength(value).valid,
        message: 'Password must contain at least 3 of: uppercase, lowercase, number, special character'
      }
    ],
    
    confirmPassword: (originalPassword: string): ValidationRule[] => [
      { type: 'required' as const },
      {
        type: 'custom' as const,
        validator: (value: string) => FormValidation.passwordsMatch(originalPassword, value),
        message: 'Passwords do not match'
      }
    ],
    
    phone: (required = false): ValidationRule[] => [
      ...(required ? [{ type: 'required' as const }] : []),
      { type: 'phone' as const }
    ],
    
    ukPostcode: (required = true): ValidationRule[] => [
      ...(required ? [{ type: 'required' as const }] : []),
      { type: 'ukPostcode' as const }
    ],
    
    url: (required = false): ValidationRule[] => [
      ...(required ? [{ type: 'required' as const }] : []),
      { type: 'url' as const }
    ],
    
    required: (): ValidationRule[] => [
      { type: 'required' as const }
    ],
    
    maxLength: (max: number, required = false): ValidationRule[] => [
      ...(required ? [{ type: 'required' as const }] : []),
      { type: 'maxLength' as const, value: max }
    ]
  };
}

export default FormValidation;