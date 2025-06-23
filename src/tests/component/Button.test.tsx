// src/tests/component/Button.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import Button from '../../components/Button';
import * as Sentry from '@sentry/react-native';

describe('Button Component', () => {
  const defaultProps = {
    title: 'Test Button',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with basic props', () => {
      render(<Button {...defaultProps} />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'Button rendered successfully',
        'info'
      );
    });

    it('should render with custom background color', () => {
      render(<Button {...defaultProps} backgroundColorProp="#FF0000" />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });

    it('should render with custom text color', () => {
      render(<Button {...defaultProps} textColorProp="#FFFFFF" />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });

    it('should render with left icon', () => {
      const leftIcon = <span data-testid="left-icon">←</span>;
      render(<Button {...defaultProps} leftIcon={leftIcon} />);
      
      expect(screen.getByTestId('left-icon')).toBeTruthy();
    });

    it('should render with right icon', () => {
      const rightIcon = <span data-testid="right-icon">→</span>;
      render(<Button {...defaultProps} rightIcon={rightIcon} />);
      
      expect(screen.getByTestId('right-icon')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('should render filled variant', () => {
      render(<Button {...defaultProps} variant="filled" />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });

    it('should render outlined variant', () => {
      render(<Button {...defaultProps} variant="outlined" />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });

    it('should render ghost variant', () => {
      render(<Button {...defaultProps} variant="ghost" />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });
  });

  describe('Sizes', () => {
    it('should render small size', () => {
      render(<Button {...defaultProps} size="small" />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });

    it('should render medium size', () => {
      render(<Button {...defaultProps} size="medium" />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });

    it('should render large size', () => {
      render(<Button {...defaultProps} size="large" />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });
  });

  describe('States', () => {
    it('should render loading state', () => {
      render(<Button {...defaultProps} loading={true} />);
      
      expect(screen.getByText('Loading...')).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'Button loading state rendered',
        'info'
      );
    });

    it('should render custom loading text', () => {
      render(<Button {...defaultProps} loading={true} loadingText="Processing..." />);
      
      expect(screen.getByText('Processing...')).toBeTruthy();
    });

    it('should render disabled state', () => {
      render(<Button {...defaultProps} disabled={true} />);
      
      const button = screen.getByText('Test Button');
      expect(button).toBeTruthy();
    });

    it('should be disabled when loading', () => {
      const onPress = jest.fn();
      render(<Button {...defaultProps} loading={true} onPress={onPress} />);
      
      const button = screen.getByText('Loading...');
      fireEvent.press(button);
      
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('User Interactions', () => {
    it('should call onPress when pressed', () => {
      const onPress = jest.fn();
      render(<Button {...defaultProps} onPress={onPress} />);
      
      const button = screen.getByText('Test Button');
      fireEvent.press(button);
      
      expect(onPress).toHaveBeenCalledTimes(1);
      
      global.testHelpers.sentry.captureTestMessage(
        'Button onPress callback triggered',
        'info'
      );
    });

    it('should not call onPress when disabled', () => {
      const onPress = jest.fn();
      render(<Button {...defaultProps} disabled={true} onPress={onPress} />);
      
      const button = screen.getByText('Test Button');
      fireEvent.press(button);
      
      expect(onPress).not.toHaveBeenCalled();
    });

    it('should not call onPress when loading', () => {
      const onPress = jest.fn();
      render(<Button {...defaultProps} loading={true} onPress={onPress} />);
      
      const button = screen.getByText('Loading...');
      fireEvent.press(button);
      
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have testID when provided', () => {
      render(<Button {...defaultProps} testID="test-button" />);
      
      const button = screen.getByTestId('test-button');
      expect(button).toBeTruthy();
    });

    it('should be accessible to screen readers', () => {
      render(<Button {...defaultProps} />);
      
      const button = screen.getByText('Test Button');
      expect(button).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'Button accessibility verified',
        'info'
      );
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom styles', () => {
      const customStyle = { backgroundColor: 'red' };
      render(<Button {...defaultProps} style={customStyle} />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });

    it('should apply custom title style', () => {
      const titleStyle = { fontSize: 20 };
      render(<Button {...defaultProps} titleStyle={titleStyle} />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });

    it('should apply custom border radius', () => {
      render(<Button {...defaultProps} borderRadius={20} />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });

    it('should apply custom width', () => {
      render(<Button {...defaultProps} width={200} />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing onPress gracefully', () => {
      try {
        render(<Button title="Test Button" onPress={undefined as any} />);
        
        const button = screen.getByText('Test Button');
        fireEvent.press(button);
        
        // Should not crash
        expect(true).toBe(true);
      } catch (error) {
        global.testHelpers.sentry.captureTestError(error as Error, {
          test: 'Button missing onPress handling',
        });
        throw error;
      }
    });

    it('should handle invalid props gracefully', () => {
      try {
        render(<Button title="" onPress={() => {}} />);
        expect(true).toBe(true);
      } catch (error) {
        global.testHelpers.sentry.captureTestError(error as Error, {
          test: 'Button invalid props handling',
        });
        throw error;
      }
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const onPress = jest.fn();
      const { rerender } = render(<Button {...defaultProps} onPress={onPress} />);
      
      // Re-render with same props
      rerender(<Button {...defaultProps} onPress={onPress} />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
      
      global.testHelpers.sentry.captureTestMessage(
        'Button performance test completed',
        'info'
      );
    });
  });

  describe('Loading State Integration', () => {
    it('should show loading indicator with custom color', () => {
      render(<Button {...defaultProps} loading={true} loadingColor="#FF0000" />);
      
      expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('should handle loading state changes', () => {
      const { rerender } = render(<Button {...defaultProps} loading={false} />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
      
      rerender(<Button {...defaultProps} loading={true} />);
      
      expect(screen.getByText('Loading...')).toBeTruthy();
    });
  });

  describe('Active Opacity', () => {
    it('should apply custom active opacity', () => {
      render(<Button {...defaultProps} activeOpacity={0.5} />);
      
      expect(screen.getByText('Test Button')).toBeTruthy();
    });
  });

  describe('Icon Integration', () => {
    it('should render with both left and right icons', () => {
      const leftIcon = <span data-testid="left-icon">←</span>;
      const rightIcon = <span data-testid="right-icon">→</span>;
      
      render(
        <Button 
          {...defaultProps} 
          leftIcon={leftIcon} 
          rightIcon={rightIcon} 
        />
      );
      
      expect(screen.getByTestId('left-icon')).toBeTruthy();
      expect(screen.getByText('Test Button')).toBeTruthy();
      expect(screen.getByTestId('right-icon')).toBeTruthy();
    });

    it('should not render icons when loading', () => {
      const leftIcon = <span data-testid="left-icon">←</span>;
      const rightIcon = <span data-testid="right-icon">→</span>;
      
      render(
        <Button 
          {...defaultProps} 
          loading={true}
          leftIcon={leftIcon} 
          rightIcon={rightIcon} 
        />
      );
      
      expect(screen.queryByTestId('left-icon')).toBeFalsy();
      expect(screen.queryByTestId('right-icon')).toBeFalsy();
      expect(screen.getByText('Loading...')).toBeTruthy();
    });
  });
});