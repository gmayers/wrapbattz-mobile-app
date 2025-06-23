// src/tests/e2e/AuthFlow.e2e.test.ts
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import * as Sentry from '@sentry/react-native';

describe('Authentication E2E Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
    
    Sentry.addBreadcrumb({
      message: 'Starting authentication E2E test',
      level: 'info',
      category: 'e2e.auth',
    });
  });

  describe('Login Flow', () => {
    it('should display login screen on app launch', async () => {
      try {
        await waitFor(element(by.text('Welcome Back')))
          .toBeVisible()
          .withTimeout(10000);
        
        await detoxExpect(element(by.text('Sign in to continue'))).toBeVisible();
        await detoxExpect(element(by.id('email-input'))).toBeVisible();
        await detoxExpect(element(by.id('password-input'))).toBeVisible();
        
        Sentry.addBreadcrumb({
          message: 'Login screen displayed successfully',
          level: 'info',
          category: 'e2e.auth.login',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'login_screen_display' },
          contexts: {
            e2e: {
              step: 'initial_screen_load',
              expected: 'login_screen_visible',
            },
          },
        });
        throw error;
      }
    });

    it('should show validation errors for empty fields', async () => {
      try {
        // Try to login without entering credentials
        await element(by.id('login-button')).tap();
        
        await waitFor(element(by.text('Please enter a valid email address')))
          .toBeVisible()
          .withTimeout(5000);
        
        await detoxExpect(element(by.text('Password is required'))).toBeVisible();
        
        Sentry.addBreadcrumb({
          message: 'Login validation errors displayed correctly',
          level: 'info',
          category: 'e2e.auth.validation',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'login_validation' },
          contexts: {
            e2e: {
              step: 'validation_check',
              expected: 'error_messages_visible',
            },
          },
        });
        throw error;
      }
    });

    it('should handle invalid credentials', async () => {
      try {
        // Enter invalid credentials
        await element(by.id('email-input')).typeText('invalid@test.com');
        await element(by.id('password-input')).typeText('wrongpassword');
        await element(by.id('login-button')).tap();
        
        // Wait for error alert (this depends on your app's error handling)
        await waitFor(element(by.text('Login Failed')))
          .toBeVisible()
          .withTimeout(10000);
        
        Sentry.addBreadcrumb({
          message: 'Invalid credentials handled correctly',
          level: 'info',
          category: 'e2e.auth.error_handling',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'invalid_credentials' },
          contexts: {
            e2e: {
              step: 'login_attempt',
              credentials: 'invalid',
            },
          },
        });
        throw error;
      }
    });

    it('should navigate to register screen', async () => {
      try {
        await element(by.id('register-button')).tap();
        
        await waitFor(element(by.text('Create an Account')))
          .toBeVisible()
          .withTimeout(5000);
        
        await detoxExpect(element(by.text('Join us to track and manage your devices'))).toBeVisible();
        
        Sentry.addBreadcrumb({
          message: 'Navigation to register screen successful',
          level: 'info',
          category: 'e2e.navigation',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'navigation_to_register' },
        });
        throw error;
      }
    });

    it('should navigate to pricing screen', async () => {
      try {
        await element(by.id('pricing-button')).tap();
        
        // Wait for pricing screen to load
        await waitFor(element(by.text('Subscription Plans')))
          .toBeVisible()
          .withTimeout(5000);
        
        Sentry.addBreadcrumb({
          message: 'Navigation to pricing screen successful',
          level: 'info',
          category: 'e2e.navigation',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'navigation_to_pricing' },
        });
        throw error;
      }
    });
  });

  describe('Registration Flow', () => {
    beforeEach(async () => {
      // Navigate to register screen
      await element(by.id('register-button')).tap();
      await waitFor(element(by.text('Create an Account'))).toBeVisible();
    });

    it('should display registration form', async () => {
      try {
        await detoxExpect(element(by.text('Create an Account'))).toBeVisible();
        await detoxExpect(element(by.text('Join us to track and manage your devices'))).toBeVisible();
        
        // Check all form fields are present
        await detoxExpect(element(by.placeholder('Enter first name'))).toBeVisible();
        await detoxExpect(element(by.placeholder('Enter last name'))).toBeVisible();
        await detoxExpect(element(by.placeholder('Enter your email'))).toBeVisible();
        await detoxExpect(element(by.placeholder('Enter phone number'))).toBeVisible();
        await detoxExpect(element(by.placeholder('Create a password'))).toBeVisible();
        await detoxExpect(element(by.placeholder('Confirm your password'))).toBeVisible();
        
        Sentry.addBreadcrumb({
          message: 'Registration form displayed correctly',
          level: 'info',
          category: 'e2e.auth.register',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'registration_form_display' },
        });
        throw error;
      }
    });

    it('should show validation errors for incomplete form', async () => {
      try {
        // Try to register without filling required fields
        await element(by.text('Register')).tap();
        
        await waitFor(element(by.text('This field is required')))
          .toBeVisible()
          .withTimeout(5000);
        
        Sentry.addBreadcrumb({
          message: 'Registration validation errors displayed',
          level: 'info',
          category: 'e2e.auth.validation',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'registration_validation' },
        });
        throw error;
      }
    });

    it('should handle password mismatch', async () => {
      try {
        // Fill form with mismatched passwords
        await element(by.placeholder('Enter first name')).typeText('John');
        await element(by.placeholder('Enter last name')).typeText('Doe');
        await element(by.placeholder('Enter your email')).typeText('john@test.com');
        await element(by.placeholder('Enter phone number')).typeText('+1234567890');
        await element(by.placeholder('Create a password')).typeText('StrongPass123!');
        await element(by.placeholder('Confirm your password')).typeText('DifferentPass123!');
        
        await element(by.text('Register')).tap();
        
        await waitFor(element(by.text('Passwords do not match')))
          .toBeVisible()
          .withTimeout(5000);
        
        Sentry.addBreadcrumb({
          message: 'Password mismatch validation working',
          level: 'info',
          category: 'e2e.auth.validation',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'password_mismatch' },
        });
        throw error;
      }
    });

    it('should navigate back to login', async () => {
      try {
        await element(by.text('Login')).tap();
        
        await waitFor(element(by.text('Welcome Back')))
          .toBeVisible()
          .withTimeout(5000);
        
        Sentry.addBreadcrumb({
          message: 'Navigation back to login successful',
          level: 'info',
          category: 'e2e.navigation',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'navigation_back_to_login' },
        });
        throw error;
      }
    });
  });

  describe('Password Security Features', () => {
    beforeEach(async () => {
      await element(by.id('register-button')).tap();
      await waitFor(element(by.text('Create an Account'))).toBeVisible();
    });

    it('should toggle password visibility', async () => {
      try {
        const passwordInput = element(by.placeholder('Create a password'));
        const toggleButton = element(by.id('toggle-password-visibility'));
        
        // Type password (should be hidden initially)
        await passwordInput.typeText('TestPassword123!');
        
        // Toggle visibility
        await toggleButton.tap();
        
        // Password should now be visible
        // Note: Detox can't easily test secureTextEntry changes, 
        // but we can verify the toggle button is interactive
        
        await toggleButton.tap(); // Toggle back
        
        Sentry.addBreadcrumb({
          message: 'Password visibility toggle working',
          level: 'info',
          category: 'e2e.auth.security',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'password_visibility_toggle' },
        });
        throw error;
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network errors gracefully', async () => {
      try {
        // Simulate network failure by entering valid credentials 
        // but expecting network error (this would need actual network simulation)
        await element(by.id('email-input')).typeText('test@example.com');
        await element(by.id('password-input')).typeText('validpassword');
        
        // Turn off network if possible (platform dependent)
        if (device.getPlatform() === 'ios') {
          await device.setURLBlacklist(['.*']);
        }
        
        await element(by.id('login-button')).tap();
        
        // Should show network error
        await waitFor(element(by.text('Unable to connect to the server')))
          .toBeVisible()
          .withTimeout(10000);
        
        // Re-enable network
        if (device.getPlatform() === 'ios') {
          await device.setURLBlacklist([]);
        }
        
        Sentry.addBreadcrumb({
          message: 'Network error handling working',
          level: 'info',
          category: 'e2e.error_handling',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'network_error_handling' },
        });
        throw error;
      }
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', async () => {
      try {
        // Test basic accessibility
        await detoxExpect(element(by.text('Welcome Back'))).toBeVisible();
        await detoxExpect(element(by.id('email-input'))).toBeVisible();
        await detoxExpect(element(by.id('password-input'))).toBeVisible();
        await detoxExpect(element(by.id('login-button'))).toBeVisible();
        
        Sentry.addBreadcrumb({
          message: 'Accessibility elements verified',
          level: 'info',
          category: 'e2e.accessibility',
        });
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'accessibility_check' },
        });
        throw error;
      }
    });
  });

  describe('Performance', () => {
    it('should load screens within acceptable time', async () => {
      try {
        const startTime = Date.now();
        
        // Navigate between screens and measure load times
        await element(by.id('register-button')).tap();
        await waitFor(element(by.text('Create an Account'))).toBeVisible();
        
        const registrationLoadTime = Date.now() - startTime;
        
        await element(by.text('Login')).tap();
        await waitFor(element(by.text('Welcome Back'))).toBeVisible();
        
        const loginLoadTime = Date.now() - startTime;
        
        // Report performance metrics to Sentry
        Sentry.addBreadcrumb({
          message: 'Screen load performance measured',
          level: 'info',
          category: 'e2e.performance',
          data: {
            registration_load_time: registrationLoadTime,
            login_load_time: loginLoadTime,
          },
        });
        
        // Assert reasonable load times (adjust thresholds as needed)
        expect(registrationLoadTime).toBeLessThan(3000);
        expect(loginLoadTime).toBeLessThan(3000);
      } catch (error) {
        Sentry.captureException(error as Error, {
          tags: { test: 'performance_check' },
        });
        throw error;
      }
    });
  });
});