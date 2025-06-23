// src/tests/unit/FormValidation.test.ts
import { FormValidation } from '../../utils/FormValidation';
import * as Sentry from '@sentry/react-native';

describe('FormValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('email validation', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'test+tag@gmail.com',
        'user123@test-domain.com',
      ];

      validEmails.forEach(email => {
        expect(FormValidation.email(email)).toBe(true);
        // Log successful validation to Sentry
        global.testHelpers.sentry.captureTestMessage(
          `Email validation passed for: ${email}`,
          'info'
        );
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user.domain.com',
        '',
        'user@domain',
      ];

      invalidEmails.forEach(email => {
        expect(FormValidation.email(email)).toBe(false);
        // Log validation failure to Sentry
        global.testHelpers.sentry.captureTestMessage(
          `Email validation correctly rejected: ${email}`,
          'info'
        );
      });
    });

    it('should handle edge cases', () => {
      try {
        expect(FormValidation.email(null as any)).toBe(false);
        expect(FormValidation.email(undefined as any)).toBe(false);
        expect(FormValidation.email(123 as any)).toBe(false);
      } catch (error) {
        global.testHelpers.sentry.captureTestError(error as Error, {
          test: 'email validation edge cases',
        });
        throw error;
      }
    });
  });

  describe('phone validation', () => {
    it('should validate correct phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '(555) 123-4567',
        '555-123-4567',
        '+44 20 1234 5678',
        '01234567890',
      ];

      validPhones.forEach(phone => {
        expect(FormValidation.phone(phone)).toBe(true);
        global.testHelpers.sentry.captureTestMessage(
          `Phone validation passed for: ${phone}`,
          'info'
        );
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        'abc',
        '123',
        '++1234567890',
        '',
        '1234567890123456', // too long
      ];

      invalidPhones.forEach(phone => {
        expect(FormValidation.phone(phone)).toBe(false);
        global.testHelpers.sentry.captureTestMessage(
          `Phone validation correctly rejected: ${phone}`,
          'info'
        );
      });
    });
  });

  describe('password strength validation', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'StrongPass123!',
        'MyP@ssw0rd',
        'Complex1ty!',
        'Secure@123',
      ];

      strongPasswords.forEach(password => {
        const result = FormValidation.passwordStrength(password);
        expect(result.valid).toBe(true);
        expect(result.message).toBeUndefined();
        
        global.testHelpers.sentry.captureTestMessage(
          `Password strength validation passed`,
          'info'
        );
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'weak',              // too short
        '12345678',          // only numbers
        'onlylowercase',     // only lowercase
        'ONLYUPPERCASE',     // only uppercase
        'justlower',         // only lowercase, too short
        '123',               // too short, only numbers
      ];

      weakPasswords.forEach(password => {
        const result = FormValidation.passwordStrength(password);
        expect(result.valid).toBe(false);
        expect(result.message).toBeDefined();
        
        global.testHelpers.sentry.captureTestMessage(
          `Password strength validation correctly rejected weak password`,
          'info'
        );
      });
    });

    it('should require minimum length', () => {
      const shortPassword = '1234567';
      const result = FormValidation.passwordStrength(shortPassword);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 8 characters');
    });
  });

  describe('UK postcode validation', () => {
    it('should validate correct UK postcodes', () => {
      const validPostcodes = [
        'SW1A 1AA',
        'M1 1AA',
        'B33 8TH',
        'W1A 0AX',
        'EC1A 1BB',
      ];

      validPostcodes.forEach(postcode => {
        expect(FormValidation.ukPostcode(postcode)).toBe(true);
        global.testHelpers.sentry.captureTestMessage(
          `UK postcode validation passed for: ${postcode}`,
          'info'
        );
      });
    });

    it('should reject invalid UK postcodes', () => {
      const invalidPostcodes = [
        '12345',
        'INVALID',
        'SW1A',
        'SW1A 1AAA',
        '',
      ];

      invalidPostcodes.forEach(postcode => {
        expect(FormValidation.ukPostcode(postcode)).toBe(false);
        global.testHelpers.sentry.captureTestMessage(
          `UK postcode validation correctly rejected: ${postcode}`,
          'info'
        );
      });
    });
  });

  describe('form validation', () => {
    it('should validate a complete form with no errors', () => {
      const formData = {
        email: 'test@example.com',
        password: 'StrongPass123!',
        name: 'John Doe',
      };

      const rules = {
        email: FormValidation.commonRules.email(true),
        password: FormValidation.commonRules.password(8),
        name: FormValidation.commonRules.required(),
      };

      const result = FormValidation.validateForm(formData, rules);
      
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
      
      global.testHelpers.sentry.captureTestMessage(
        'Complete form validation passed',
        'info'
      );
    });

    it('should return errors for invalid form data', () => {
      const formData = {
        email: 'invalid-email',
        password: 'weak',
        name: '',
      };

      const rules = {
        email: FormValidation.commonRules.email(true),
        password: FormValidation.commonRules.password(8),
        name: FormValidation.commonRules.required(),
      };

      const result = FormValidation.validateForm(formData, rules);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeDefined();
      expect(result.errors.password).toBeDefined();
      expect(result.errors.name).toBeDefined();
      
      global.testHelpers.sentry.captureTestMessage(
        'Form validation correctly identified errors',
        'info'
      );
    });
  });

  describe('password matching', () => {
    it('should validate matching passwords', () => {
      const password = 'SecurePassword123!';
      const confirmPassword = 'SecurePassword123!';
      
      expect(FormValidation.passwordsMatch(password, confirmPassword)).toBe(true);
    });

    it('should reject non-matching passwords', () => {
      const password = 'SecurePassword123!';
      const confirmPassword = 'DifferentPassword123!';
      
      expect(FormValidation.passwordsMatch(password, confirmPassword)).toBe(false);
    });
  });

  describe('required field validation', () => {
    it('should validate non-empty values', () => {
      expect(FormValidation.required('valid string')).toBe(true);
      expect(FormValidation.required(123)).toBe(true);
      expect(FormValidation.required(['item'])).toBe(true);
      expect(FormValidation.required(true)).toBe(true);
    });

    it('should reject empty values', () => {
      expect(FormValidation.required('')).toBe(false);
      expect(FormValidation.required('   ')).toBe(false);
      expect(FormValidation.required(null)).toBe(false);
      expect(FormValidation.required(undefined)).toBe(false);
      expect(FormValidation.required([])).toBe(false);
      expect(FormValidation.required(NaN)).toBe(false);
    });
  });

  describe('length validation', () => {
    it('should validate minimum length', () => {
      expect(FormValidation.minLength('hello', 3)).toBe(true);
      expect(FormValidation.minLength('hello', 5)).toBe(true);
      expect(FormValidation.minLength('hello', 6)).toBe(false);
    });

    it('should validate maximum length', () => {
      expect(FormValidation.maxLength('hello', 10)).toBe(true);
      expect(FormValidation.maxLength('hello', 5)).toBe(true);
      expect(FormValidation.maxLength('hello', 3)).toBe(false);
    });
  });

  describe('URL validation', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://test.org',
        'https://sub.domain.com/path',
        'http://localhost:3000',
      ];

      validUrls.forEach(url => {
        expect(FormValidation.url(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'example.com',
        'ftp://example.com',
        'not-a-url',
        '',
      ];

      invalidUrls.forEach(url => {
        expect(FormValidation.url(url)).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('should handle validation errors gracefully', () => {
      try {
        // Test with invalid input that might cause errors
        FormValidation.validateField(null, [
          { type: 'custom', validator: () => { throw new Error('Test error'); } }
        ]);
      } catch (error) {
        global.testHelpers.sentry.captureTestError(error as Error, {
          test: 'validation error handling',
          input: null,
        });
        
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});