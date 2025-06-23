// src/tests/unit/simpleFormValidation.test.ts
// Simple test to verify Jest setup without React Native dependencies

describe('FormValidation Simple Test', () => {
  it('should validate email addresses without dependencies', () => {
    const emailRegex = /\S+@\S+\.\S+/;
    
    const validEmail = 'test@example.com';
    const invalidEmail = 'invalid-email';
    
    expect(emailRegex.test(validEmail)).toBe(true);
    expect(emailRegex.test(invalidEmail)).toBe(false);
    
    console.log('Simple validation test passed');
  });

  it('should validate password strength', () => {
    const validatePassword = (password: string): boolean => {
      if (password.length < 8) return false;
      
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      const hasSpecial = /[!@#$%^&*]/.test(password);
      
      const criteriaCount = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
      return criteriaCount >= 3;
    };

    expect(validatePassword('StrongP@ss123')).toBe(true);
    expect(validatePassword('weak')).toBe(false);
    expect(validatePassword('onlylowercase')).toBe(false);
    
    console.log('Password validation test passed');
  });

  it('should validate phone numbers', () => {
    const phoneRegex = /^[\d\+\-\(\) ]{10,15}$/;
    
    const validPhones = ['+1234567890', '(555) 123-4567', '555-123-4567'];
    const invalidPhones = ['abc', '123', '1234567890123456789']; // too long
    
    validPhones.forEach(phone => {
      expect(phoneRegex.test(phone.replace(/\s/g, ''))).toBe(true);
    });
    
    invalidPhones.forEach(phone => {
      expect(phoneRegex.test(phone.replace(/\s/g, ''))).toBe(false);
    });
    
    console.log('Phone validation test passed');
  });

  it('should validate UK postcodes', () => {
    const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
    
    const validPostcodes = ['SW1A 1AA', 'M1 1AA', 'B33 8TH'];
    const invalidPostcodes = ['12345', 'INVALID', 'SW1A'];
    
    validPostcodes.forEach(postcode => {
      expect(postcodeRegex.test(postcode)).toBe(true);
    });
    
    invalidPostcodes.forEach(postcode => {
      expect(postcodeRegex.test(postcode)).toBe(false);
    });
    
    console.log('UK postcode validation test passed');
  });

  it('should demonstrate test error tracking simulation', () => {
    const mockSentryCapture = jest.fn();
    
    try {
      // Simulate a validation that might fail
      const testData = null;
      if (!testData) {
        throw new Error('Data validation failed: null input');
      }
    } catch (error) {
      // Simulate Sentry capture
      mockSentryCapture(error, {
        test: 'validation_error_handling',
        component: 'FormValidation',
      });
      
      expect(mockSentryCapture).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          test: 'validation_error_handling',
          component: 'FormValidation',
        })
      );
    }
    
    console.log('Error tracking simulation test passed');
  });
});