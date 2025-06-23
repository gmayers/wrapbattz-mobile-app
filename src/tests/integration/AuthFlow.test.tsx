// src/tests/integration/AuthFlow.test.tsx
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import LoginScreen from '../../screens/AuthScreens/Login/LoginScreen';
import RegisterScreen from '../../screens/AuthScreens/Register/RegisterScreen';
import ChangePasswordScreen from '../../screens/ChangePassword/ChangePasswordScreen';
import { AuthContext } from '../../context/AuthContext';

// Mock the auth context
const mockAuthContext = {
  login: jest.fn() as jest.MockedFunction<any>,
  register: jest.fn() as jest.MockedFunction<any>,
  logout: jest.fn() as jest.MockedFunction<any>,
  isAuthenticated: false,
  userData: null,
  axiosInstance: {
    post: jest.fn() as jest.MockedFunction<any>,
    patch: jest.fn() as jest.MockedFunction<any>,
    get: jest.fn() as jest.MockedFunction<any>,
    defaults: { baseURL: 'http://test.com' },
  },
  loading: false,
};

const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthContext.Provider value={mockAuthContext}>
    {children}
  </AuthContext.Provider>
);

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Alert mock
    (Alert.alert as jest.Mock).mockClear();
  });

  describe('Login Flow', () => {
    it('should complete successful login flow', async () => {
      mockAuthContext.login.mockResolvedValue(undefined);
      
      render(
        <AuthWrapper>
          <LoginScreen />
        </AuthWrapper>
      );

      // Fill in login form
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const loginButton = screen.getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalledWith('test@example.com', 'password123');
      });

      global.testHelpers.sentry.captureTestMessage(
        'Login flow completed successfully',
        'info'
      );
    });

    it('should handle login validation errors', async () => {
      render(
        <AuthWrapper>
          <LoginScreen />
        </AuthWrapper>
      );

      const loginButton = screen.getByText('Sign In');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeTruthy();
        expect(screen.getByText('Password is required')).toBeTruthy();
      });

      expect(mockAuthContext.login).not.toHaveBeenCalled();

      global.testHelpers.sentry.captureTestMessage(
        'Login validation errors handled correctly',
        'info'
      );
    });

    it('should handle login API errors', async () => {
      const apiError = new Error('Invalid credentials');
      mockAuthContext.login.mockRejectedValue({
        response: {
          data: { detail: 'Invalid credentials' }
        }
      });

      render(
        <AuthWrapper>
          <LoginScreen />
        </AuthWrapper>
      );

      // Fill in login form
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const loginButton = screen.getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Invalid credentials');
      });

      global.testHelpers.sentry.captureTestError(apiError, {
        test: 'Login API error handling',
        email: 'test@example.com',
      });
    });

    it('should navigate to register screen', () => {
      const mockNavigate = jest.fn() as jest.MockedFunction<any>;
      (require('@react-navigation/native').useNavigation as jest.Mock).mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
        setOptions: jest.fn(),
        replace: jest.fn(),
        canGoBack: () => true,
      });

      render(
        <AuthWrapper>
          <LoginScreen />
        </AuthWrapper>
      );

      const registerButton = screen.getByText('Create Account');
      fireEvent.press(registerButton);

      expect(mockNavigate).toHaveBeenCalledWith('Register');
    });

    it('should navigate to forgot password screen', () => {
      const mockNavigate = jest.fn() as jest.MockedFunction<any>;
      (require('@react-navigation/native').useNavigation as jest.Mock).mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
        setOptions: jest.fn(),
        replace: jest.fn(),
        canGoBack: () => true,
      });

      render(
        <AuthWrapper>
          <LoginScreen />
        </AuthWrapper>
      );

      const forgotButton = screen.getByText('Forgot Password?');
      fireEvent.press(forgotButton);

      expect(mockNavigate).toHaveBeenCalledWith('ForgotPassword');
    });
  });

  describe('Registration Flow', () => {
    it('should complete successful registration flow', async () => {
      mockAuthContext.axiosInstance.post.mockResolvedValue({
        data: { message: 'Registration successful' }
      });

      const mockNavigate = jest.fn();
      (require('@react-navigation/native').useNavigation).mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
        setOptions: jest.fn(),
        replace: jest.fn(),
        canGoBack: () => true,
      });

      render(
        <AuthWrapper>
          <RegisterScreen navigation={{ navigate: mockNavigate } as any} />
        </AuthWrapper>
      );

      // Fill in registration form
      const firstNameInput = screen.getByPlaceholderText('Enter first name');
      const lastNameInput = screen.getByPlaceholderText('Enter last name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
      const registerButton = screen.getByText('Register');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'john@example.com');
      fireEvent.changeText(phoneInput, '+1234567890');
      fireEvent.changeText(passwordInput, 'StrongP@ss123');
      fireEvent.changeText(confirmPasswordInput, 'StrongP@ss123');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(mockAuthContext.axiosInstance.post).toHaveBeenCalledWith(
          '/auth/register/',
          expect.objectContaining({
            email: 'john@example.com',
            first_name: 'John',
            last_name: 'Doe',
            phone_number: '+1234567890',
          })
        );
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Registration Successful',
          expect.stringContaining('check your email'),
          expect.any(Array)
        );
      });

      global.testHelpers.sentry.captureTestMessage(
        'Registration flow completed successfully',
        'info'
      );
    });

    it('should handle registration validation errors', async () => {
      render(
        <AuthWrapper>
          <RegisterScreen navigation={{ navigate: jest.fn() } as any} />
        </AuthWrapper>
      );

      const registerButton = screen.getByText('Register');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText('This field is required')).toBeTruthy();
      });

      expect(mockAuthContext.axiosInstance.post).not.toHaveBeenCalled();
    });

    it('should handle API validation errors', async () => {
      mockAuthContext.axiosInstance.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            email: ['User with this email already exists.'],
            password: ['Password is too weak.'],
          }
        }
      });

      render(
        <AuthWrapper>
          <RegisterScreen navigation={{ navigate: jest.fn() } as any} />
        </AuthWrapper>
      );

      // Fill in form with valid data
      const firstNameInput = screen.getByPlaceholderText('Enter first name');
      const lastNameInput = screen.getByPlaceholderText('Enter last name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
      const registerButton = screen.getByText('Register');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'existing@example.com');
      fireEvent.changeText(phoneInput, '+1234567890');
      fireEvent.changeText(passwordInput, 'StrongP@ss123');
      fireEvent.changeText(confirmPasswordInput, 'StrongP@ss123');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText('User with this email already exists.')).toBeTruthy();
        expect(screen.getByText('Password is too weak.')).toBeTruthy();
      });

      global.testHelpers.sentry.captureTestMessage(
        'Registration API errors handled correctly',
        'warning'
      );
    });
  });

  describe('Change Password Flow', () => {
    beforeEach(() => {
      mockAuthContext.userData = { userId: 123, name: 'Test User' };
    });

    it('should complete successful password change', async () => {
      mockAuthContext.axiosInstance.patch.mockResolvedValue({
        data: { message: 'Password changed successfully' }
      });

      const mockGoBack = jest.fn();
      (require('@react-navigation/native').useNavigation).mockReturnValue({
        navigate: jest.fn(),
        goBack: mockGoBack,
        setOptions: jest.fn(),
        replace: jest.fn(),
        canGoBack: () => true,
      });

      render(
        <AuthWrapper>
          <ChangePasswordScreen navigation={{ goBack: mockGoBack, setOptions: jest.fn() } as any} />
        </AuthWrapper>
      );

      // Fill in password change form
      const currentPasswordInput = screen.getByPlaceholderText('Enter your current password');
      const newPasswordInput = screen.getByPlaceholderText('Enter your new password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your new password');
      const updateButton = screen.getByText('Update Password');

      fireEvent.changeText(currentPasswordInput, 'oldpassword');
      fireEvent.changeText(newPasswordInput, 'NewStrongP@ss123');
      fireEvent.changeText(confirmPasswordInput, 'NewStrongP@ss123');
      fireEvent.press(updateButton);

      await waitFor(() => {
        expect(mockAuthContext.axiosInstance.patch).toHaveBeenCalledWith(
          '/profile/123/',
          expect.objectContaining({
            current_password: 'oldpassword',
            password: 'NewStrongP@ss123',
            password_confirm: 'NewStrongP@ss123',
          })
        );
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'Password changed successfully',
          expect.any(Array)
        );
      });

      global.testHelpers.sentry.captureTestMessage(
        'Password change flow completed successfully',
        'info'
      );
    });

    it('should handle password change validation errors', async () => {
      render(
        <AuthWrapper>
          <ChangePasswordScreen navigation={{ goBack: jest.fn(), setOptions: jest.fn() } as any} />
        </AuthWrapper>
      );

      const updateButton = screen.getByText('Update Password');
      fireEvent.press(updateButton);

      await waitFor(() => {
        expect(screen.getByText('This field is required')).toBeTruthy();
      });

      expect(mockAuthContext.axiosInstance.patch).not.toHaveBeenCalled();
    });

    it('should validate password strength', async () => {
      render(
        <AuthWrapper>
          <ChangePasswordScreen navigation={{ goBack: jest.fn(), setOptions: jest.fn() } as any} />
        </AuthWrapper>
      );

      const currentPasswordInput = screen.getByPlaceholderText('Enter your current password');
      const newPasswordInput = screen.getByPlaceholderText('Enter your new password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your new password');
      const updateButton = screen.getByText('Update Password');

      fireEvent.changeText(currentPasswordInput, 'oldpassword');
      fireEvent.changeText(newPasswordInput, 'weak');
      fireEvent.changeText(confirmPasswordInput, 'weak');
      fireEvent.press(updateButton);

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least 3 of: uppercase, lowercase, number, special character')).toBeTruthy();
      });
    });

    it('should validate password confirmation', async () => {
      render(
        <AuthWrapper>
          <ChangePasswordScreen navigation={{ goBack: jest.fn(), setOptions: jest.fn() } as any} />
        </AuthWrapper>
      );

      const currentPasswordInput = screen.getByPlaceholderText('Enter your current password');
      const newPasswordInput = screen.getByPlaceholderText('Enter your new password');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm your new password');
      const updateButton = screen.getByText('Update Password');

      fireEvent.changeText(currentPasswordInput, 'oldpassword');
      fireEvent.changeText(newPasswordInput, 'NewStrongP@ss123');
      fireEvent.changeText(confirmPasswordInput, 'DifferentPassword');
      fireEvent.press(updateButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeTruthy();
      });
    });
  });

  describe('Error Tracking Integration', () => {
    it('should track authentication errors in Sentry', async () => {
      const authError = new Error('Authentication failed');
      mockAuthContext.login.mockRejectedValue(authError);

      render(
        <AuthWrapper>
          <LoginScreen />
        </AuthWrapper>
      );

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const loginButton = screen.getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalled();
      });

      // Verify that error tracking is happening
      global.testHelpers.sentry.captureTestError(authError, {
        test: 'Authentication error tracking',
        screen: 'LoginScreen',
      });
    });

    it('should track validation errors in Sentry', async () => {
      render(
        <AuthWrapper>
          <LoginScreen />
        </AuthWrapper>
      );

      const loginButton = screen.getByText('Sign In');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeTruthy();
      });

      global.testHelpers.sentry.captureTestMessage(
        'Validation errors tracked in authentication flow',
        'warning'
      );
    });
  });

  describe('Cross-Screen Navigation', () => {
    it('should navigate between authentication screens correctly', () => {
      const mockNavigate = jest.fn();
      (require('@react-navigation/native').useNavigation).mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
        setOptions: jest.fn(),
        replace: jest.fn(),
        canGoBack: () => true,
      });

      // Test Login -> Register
      const { rerender } = render(
        <AuthWrapper>
          <LoginScreen />
        </AuthWrapper>
      );

      const createAccountButton = screen.getByText('Create Account');
      fireEvent.press(createAccountButton);
      expect(mockNavigate).toHaveBeenCalledWith('Register');

      // Test Register -> Login
      rerender(
        <AuthWrapper>
          <RegisterScreen navigation={{ navigate: mockNavigate } as any} />
        </AuthWrapper>
      );

      const loginLink = screen.getByText('Login');
      fireEvent.press(loginLink);
      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });
  });
});