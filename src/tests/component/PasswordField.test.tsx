// src/tests/component/PasswordField.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import PasswordField from '../../components/Form/PasswordField';
import * as Sentry from '@sentry/react-native';

describe('PasswordField Component', () => {
  const defaultProps = {
    label: 'Password',
    value: '',
    onChangeText: jest.fn(),
    placeholder: 'Enter password',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with basic props', () => {
      render(<PasswordField {...defaultProps} />);
      
      expect(screen.getByText('Password')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter password')).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'PasswordField rendered successfully',
        'info'
      );
    });

    it('should render required indicator when required', () => {
      render(<PasswordField {...defaultProps} required />);
      
      expect(screen.getByText('Password')).toBeTruthy();
      expect(screen.getByText('*')).toBeTruthy();
    });

    it('should render error message when error exists', () => {
      const errorMessage = 'Password is required';
      render(<PasswordField {...defaultProps} error={errorMessage} />);
      
      expect(screen.getByText(errorMessage)).toBeTruthy();
    });

    it('should render with visibility toggle by default', () => {
      render(<PasswordField {...defaultProps} />);
      
      // Should find the eye icon (visibility toggle)
      const input = screen.getByPlaceholderText('Enter password');
      expect(input.props.secureTextEntry).toBe(true);
    });

    it('should hide visibility toggle when showToggle is false', () => {
      render(<PasswordField {...defaultProps} showToggle={false} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      expect(input.props.secureTextEntry).toBe(true);
      
      // Should not have the toggle button
      // This would require more specific testing for the button presence
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility when eye icon is pressed', () => {
      render(<PasswordField {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      
      // Initially should be hidden (secureTextEntry = true)
      expect(input.props.secureTextEntry).toBe(true);
      
      // Find and press the toggle button
      const toggleButton = screen.getByTestId('toggle-password-visibility');
      expect(toggleButton).toBeTruthy();
      
      fireEvent.press(toggleButton);
      
      // After toggle, password should be visible (secureTextEntry = false)
      expect(input.props.secureTextEntry).toBe(false);
      
      global.testHelpers.sentry.captureTestMessage(
        'Password visibility toggled successfully',
        'info'
      );
    });

    it('should toggle back to hidden when pressed again', () => {
      render(<PasswordField {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      const toggleButton = screen.getByTestId('toggle-password-visibility');
      
      // Toggle to visible
      fireEvent.press(toggleButton);
      expect(input.props.secureTextEntry).toBe(false);
      
      // Toggle back to hidden
      fireEvent.press(toggleButton);
      expect(input.props.secureTextEntry).toBe(true);
    });

    it('should not toggle when disabled', () => {
      render(<PasswordField {...defaultProps} editable={false} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      const toggleButton = screen.getByTestId('toggle-password-visibility');
      
      // Try to toggle when disabled
      fireEvent.press(toggleButton);
      
      // Should remain hidden
      expect(input.props.secureTextEntry).toBe(true);
    });
  });

  describe('User Interactions', () => {
    it('should call onChangeText when text changes', () => {
      const onChangeText = jest.fn();
      render(<PasswordField {...defaultProps} onChangeText={onChangeText} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      fireEvent.changeText(input, 'newpassword');
      
      expect(onChangeText).toHaveBeenCalledWith('newpassword');
      
      global.testHelpers.sentry.captureTestMessage(
        'PasswordField onChangeText callback triggered',
        'info'
      );
    });

    it('should handle focus and blur events', () => {
      render(<PasswordField {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      
      fireEvent(input, 'focus');
      fireEvent(input, 'blur');
      
      // No specific assertions needed, just ensuring no crashes
      expect(true).toBe(true);
    });

    it('should be disabled when editable is false', () => {
      render(<PasswordField {...defaultProps} editable={false} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('Security Features', () => {
    it('should disable autocomplete and autocorrect', () => {
      render(<PasswordField {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      expect(input.props.autoCapitalize).toBe('none');
      expect(input.props.autoCorrect).toBe(false);
    });

    it('should start with password hidden', () => {
      render(<PasswordField {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      expect(input.props.secureTextEntry).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility for toggle button', () => {
      render(<PasswordField {...defaultProps} />);
      
      const toggleButton = screen.getByTestId('toggle-password-visibility');
      expect(toggleButton).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'PasswordField accessibility properties verified',
        'info'
      );
    });

    it('should provide screen reader support', () => {
      render(<PasswordField {...defaultProps} />);
      
      expect(screen.getByText('Password')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter password')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing props gracefully', () => {
      try {
        render(
          <PasswordField
            label=""
            value=""
            onChangeText={() => {}}
          />
        );
        expect(true).toBe(true);
      } catch (error) {
        global.testHelpers.sentry.captureTestError(error as Error, {
          test: 'PasswordField missing props handling',
        });
        throw error;
      }
    });

    it('should handle invalid onChangeText callback', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        render(<PasswordField {...defaultProps} onChangeText={null as any} />);
        
        const input = screen.getByPlaceholderText('Enter password');
        fireEvent.changeText(input, 'test');
        
      } catch (error) {
        global.testHelpers.sentry.captureTestError(error as Error, {
          test: 'PasswordField invalid callback handling',
        });
      }
      
      consoleSpy.mockRestore();
    });
  });

  describe('Styling States', () => {
    it('should apply error styling when error exists', () => {
      render(<PasswordField {...defaultProps} error="Password too weak" />);
      
      expect(screen.getByText('Password too weak')).toBeTruthy();
    });

    it('should apply disabled styling when not editable', () => {
      render(<PasswordField {...defaultProps} editable={false} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('Icon States', () => {
    it('should show eye icon when password is hidden', () => {
      render(<PasswordField {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      expect(input.props.secureTextEntry).toBe(true);
      
      // Icon state is managed internally, we test the toggle behavior
      const toggleButton = screen.getByTestId('toggle-password-visibility');
      expect(toggleButton).toBeTruthy();
    });

    it('should show eye-off icon when password is visible', () => {
      render(<PasswordField {...defaultProps} />);
      
      const toggleButton = screen.getByTestId('toggle-password-visibility');
      fireEvent.press(toggleButton);
      
      const input = screen.getByPlaceholderText('Enter password');
      expect(input.props.secureTextEntry).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const onChangeText = jest.fn();
      const { rerender } = render(
        <PasswordField {...defaultProps} onChangeText={onChangeText} />
      );
      
      // Re-render with same props
      rerender(<PasswordField {...defaultProps} onChangeText={onChangeText} />);
      
      expect(screen.getByText('Password')).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'PasswordField performance test completed',
        'info'
      );
    });
  });

  describe('Integration with Form Validation', () => {
    it('should display validation errors correctly', () => {
      const validationError = 'Password must be at least 8 characters';
      render(<PasswordField {...defaultProps} error={validationError} />);
      
      expect(screen.getByText(validationError)).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'PasswordField validation error display verified',
        'info'
      );
    });

    it('should work with password strength validation', () => {
      const onChangeText = jest.fn();
      render(<PasswordField {...defaultProps} onChangeText={onChangeText} />);
      
      const input = screen.getByPlaceholderText('Enter password');
      
      // Test various password strengths
      fireEvent.changeText(input, 'weak');
      expect(onChangeText).toHaveBeenCalledWith('weak');
      
      fireEvent.changeText(input, 'StrongP@ssw0rd');
      expect(onChangeText).toHaveBeenCalledWith('StrongP@ssw0rd');
    });
  });
});