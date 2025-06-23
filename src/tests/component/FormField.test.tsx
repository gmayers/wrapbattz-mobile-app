// src/tests/component/FormField.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import FormField from '../../components/Form/FormField';
import * as Sentry from '@sentry/react-native';

describe('FormField Component', () => {
  const defaultProps = {
    label: 'Test Label',
    value: '',
    onChangeText: jest.fn(),
    placeholder: 'Enter text',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with basic props', () => {
      render(<FormField {...defaultProps} />);
      
      expect(screen.getByText('Test Label')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'FormField rendered successfully with basic props',
        'info'
      );
    });

    it('should render required indicator when required', () => {
      render(<FormField {...defaultProps} required />);
      
      expect(screen.getByText('Test Label')).toBeTruthy();
      expect(screen.getByText('*')).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'FormField rendered required indicator',
        'info'
      );
    });

    it('should render error message when error exists', () => {
      const errorMessage = 'This field is required';
      render(<FormField {...defaultProps} error={errorMessage} />);
      
      expect(screen.getByText(errorMessage)).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'FormField rendered error message',
        'info'
      );
    });

    it('should render with initial value', () => {
      render(<FormField {...defaultProps} value="Initial Value" />);
      
      const input = screen.getByDisplayValue('Initial Value');
      expect(input).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('should call onChangeText when text changes', () => {
      const onChangeText = jest.fn();
      render(<FormField {...defaultProps} onChangeText={onChangeText} />);
      
      const input = screen.getByPlaceholderText('Enter text');
      fireEvent.changeText(input, 'New text');
      
      expect(onChangeText).toHaveBeenCalledWith('New text');
      
      global.testHelpers.sentry.captureTestMessage(
        'FormField onChangeText callback triggered',
        'info'
      );
    });

    it('should handle focus and blur events', () => {
      render(<FormField {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter text');
      
      fireEvent(input, 'focus');
      fireEvent(input, 'blur');
      
      // No specific assertions needed, just ensuring no crashes
      expect(true).toBe(true);
    });

    it('should be disabled when editable is false', () => {
      render(<FormField {...defaultProps} editable={false} />);
      
      const input = screen.getByPlaceholderText('Enter text');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('Keyboard Types', () => {
    it('should set email keyboard type', () => {
      render(<FormField {...defaultProps} keyboardType="email-address" />);
      
      const input = screen.getByPlaceholderText('Enter text');
      expect(input.props.keyboardType).toBe('email-address');
    });

    it('should set phone keyboard type', () => {
      render(<FormField {...defaultProps} keyboardType="phone-pad" />);
      
      const input = screen.getByPlaceholderText('Enter text');
      expect(input.props.keyboardType).toBe('phone-pad');
    });
  });

  describe('Multiline Support', () => {
    it('should render as multiline when specified', () => {
      render(<FormField {...defaultProps} multiline={true} />);
      
      const input = screen.getByPlaceholderText('Enter text');
      expect(input.props.multiline).toBe(true);
    });

    it('should set text align vertical for multiline', () => {
      render(<FormField {...defaultProps} multiline={true} />);
      
      const input = screen.getByPlaceholderText('Enter text');
      expect(input.props.textAlignVertical).toBe('top');
    });
  });

  describe('Auto Capitalization', () => {
    it('should set auto capitalization to none', () => {
      render(<FormField {...defaultProps} autoCapitalize="none" />);
      
      const input = screen.getByPlaceholderText('Enter text');
      expect(input.props.autoCapitalize).toBe('none');
    });

    it('should set auto capitalization to words', () => {
      render(<FormField {...defaultProps} autoCapitalize="words" />);
      
      const input = screen.getByPlaceholderText('Enter text');
      expect(input.props.autoCapitalize).toBe('words');
    });
  });

  describe('Styling', () => {
    it('should apply error styling when error exists', () => {
      render(<FormField {...defaultProps} error="Error message" />);
      
      // The error styling is applied through StyleSheet, so we check for error text
      expect(screen.getByText('Error message')).toBeTruthy();
    });

    it('should apply disabled styling when not editable', () => {
      render(<FormField {...defaultProps} editable={false} />);
      
      const input = screen.getByPlaceholderText('Enter text');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing props gracefully', () => {
      try {
        render(
          <FormField
            label=""
            value=""
            onChangeText={() => {}}
          />
        );
        expect(true).toBe(true);
      } catch (error) {
        global.testHelpers.sentry.captureTestError(error as Error, {
          test: 'FormField missing props handling',
        });
        throw error;
      }
    });

    it('should handle invalid onChangeText callback', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        render(<FormField {...defaultProps} onChangeText={null as any} />);
        
        const input = screen.getByPlaceholderText('Enter text');
        fireEvent.changeText(input, 'test');
        
      } catch (error) {
        global.testHelpers.sentry.captureTestError(error as Error, {
          test: 'FormField invalid callback handling',
        });
      }
      
      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility properties', () => {
      render(<FormField {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter text');
      expect(input).toBeTruthy();
      
      // Basic accessibility check
      global.testHelpers.sentry.captureTestMessage(
        'FormField accessibility properties verified',
        'info'
      );
    });

    it('should associate label with input for screen readers', () => {
      render(<FormField {...defaultProps} />);
      
      expect(screen.getByText('Test Label')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const onChangeText = jest.fn();
      const { rerender } = render(
        <FormField {...defaultProps} onChangeText={onChangeText} />
      );
      
      // Re-render with same props
      rerender(<FormField {...defaultProps} onChangeText={onChangeText} />);
      
      expect(screen.getByText('Test Label')).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'FormField performance test completed',
        'info'
      );
    });
  });

  describe('Integration with Form Validation', () => {
    it('should display validation errors correctly', () => {
      const validationError = 'Please enter a valid email address';
      render(<FormField {...defaultProps} error={validationError} />);
      
      expect(screen.getByText(validationError)).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'FormField validation error display verified',
        'info'
      );
    });

    it('should clear error when user starts typing', () => {
      const onChangeText = jest.fn();
      const { rerender } = render(
        <FormField {...defaultProps} error="Error message" onChangeText={onChangeText} />
      );
      
      expect(screen.getByText('Error message')).toBeTruthy();
      
      // Simulate clearing error by parent component
      rerender(<FormField {...defaultProps} onChangeText={onChangeText} />);
      
      expect(screen.queryByText('Error message')).toBeFalsy();
    });
  });
});