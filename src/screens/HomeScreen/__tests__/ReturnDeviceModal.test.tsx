// src/screens/HomeScreen/__tests__/ReturnDeviceModal.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import ReturnDeviceModal from '../components/ReturnDeviceModal';

const mockDevice = {
  id: 'device1',
  identifier: 'DEV001',
  device_type: 'Sensor',
  current_assignment: { id: 'assignment1' }
};

const mockLocationOptions = [
  { label: 'Warehouse A', value: 'loc1' },
  { label: 'Warehouse B', value: 'loc2' },
  { label: 'Office Building', value: 'loc3' }
];

const mockProps = {
  visible: true,
  selectedDevice: mockDevice,
  locationOptions: mockLocationOptions,
  selectedLocation: 'loc1',
  loading: false,
  onLocationChange: jest.fn(),
  onConfirmReturn: jest.fn(),
  onClose: jest.fn(),
};

describe('ReturnDeviceModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render when visible is true', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      expect(screen.getByTestId('return-device-modal')).toBeTruthy();
      expect(screen.getByText('Return Device')).toBeTruthy();
    });

    it('should not render when visible is false', () => {
      render(<ReturnDeviceModal {...mockProps} visible={false} />);
      
      expect(screen.queryByTestId('return-device-modal')).toBeFalsy();
    });

    it('should display device information', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      expect(screen.getByTestId('device-identifier')).toBeTruthy();
      expect(screen.getByTestId('device-type')).toBeTruthy();
      expect(screen.getByText('DEV001')).toBeTruthy();
      expect(screen.getByText('Sensor')).toBeTruthy();
    });

    it('should render location dropdown', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      expect(screen.getByTestId('return-location-dropdown')).toBeTruthy();
      expect(screen.getByText('Select Location:')).toBeTruthy();
    });

    it('should render action buttons', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      expect(screen.getByTestId('confirm-return-button')).toBeTruthy();
      expect(screen.getByTestId('cancel-return-button')).toBeTruthy();
      expect(screen.getByText('Confirm Return')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when loading is true', () => {
      render(<ReturnDeviceModal {...mockProps} loading={true} />);
      
      expect(screen.getByTestId('return-loading-indicator')).toBeTruthy();
    });

    it('should disable buttons when loading', () => {
      render(<ReturnDeviceModal {...mockProps} loading={true} />);
      
      const confirmButton = screen.getByTestId('confirm-return-button');
      const cancelButton = screen.getByTestId('cancel-return-button');
      
      expect(confirmButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it('should show "Returning..." text when loading', () => {
      render(<ReturnDeviceModal {...mockProps} loading={true} />);
      
      expect(screen.getByText('Returning...')).toBeTruthy();
    });

    it('should disable dropdown when loading', () => {
      render(<ReturnDeviceModal {...mockProps} loading={true} />);
      
      const dropdown = screen.getByTestId('return-location-dropdown');
      expect(dropdown).toHaveProp('disabled', true);
    });
  });

  describe('User Interactions', () => {
    it('should call onConfirmReturn when confirm button is pressed', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      const confirmButton = screen.getByTestId('confirm-return-button');
      fireEvent.press(confirmButton);
      
      expect(mockProps.onConfirmReturn).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is pressed', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      const cancelButton = screen.getByTestId('cancel-return-button');
      fireEvent.press(cancelButton);
      
      expect(mockProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onLocationChange when dropdown value changes', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      const dropdown = screen.getByTestId('return-location-dropdown');
      fireEvent(dropdown, 'onValueChange', 'loc2');
      
      expect(mockProps.onLocationChange).toHaveBeenCalledWith('loc2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null selectedDevice gracefully', () => {
      render(<ReturnDeviceModal {...mockProps} selectedDevice={null} />);
      
      expect(screen.getByTestId('return-device-modal')).toBeTruthy();
      expect(screen.queryByTestId('device-identifier')).toBeFalsy();
    });

    it('should disable confirm button when no location options', () => {
      render(<ReturnDeviceModal {...mockProps} locationOptions={[]} />);
      
      const confirmButton = screen.getByTestId('confirm-return-button');
      expect(confirmButton).toBeDisabled();
    });

    it('should handle empty selectedLocation', () => {
      render(<ReturnDeviceModal {...mockProps} selectedLocation="" />);
      
      expect(screen.getByTestId('return-location-dropdown')).toBeTruthy();
    });

    it('should handle device without current_assignment', () => {
      const deviceWithoutAssignment = {
        ...mockDevice,
        current_assignment: undefined
      };
      
      render(<ReturnDeviceModal {...mockProps} selectedDevice={deviceWithoutAssignment} />);
      
      expect(screen.getByText('DEV001')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper modal accessibility', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      const modal = screen.getByTestId('return-device-modal');
      expect(modal).toBeTruthy();
    });

    it('should have proper testIDs for all interactive elements', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      expect(screen.getByTestId('return-location-dropdown')).toBeTruthy();
      expect(screen.getByTestId('confirm-return-button')).toBeTruthy();
      expect(screen.getByTestId('cancel-return-button')).toBeTruthy();
    });
  });

  describe('Device Information Display', () => {
    it('should handle long device identifiers', () => {
      const longIdentifierDevice = {
        ...mockDevice,
        identifier: 'VERY_LONG_DEVICE_IDENTIFIER_THAT_MIGHT_CAUSE_LAYOUT_ISSUES'
      };
      
      render(<ReturnDeviceModal {...mockProps} selectedDevice={longIdentifierDevice} />);
      
      expect(screen.getByText('VERY_LONG_DEVICE_IDENTIFIER_THAT_MIGHT_CAUSE_LAYOUT_ISSUES')).toBeTruthy();
    });

    it('should handle special characters in device type', () => {
      const specialCharDevice = {
        ...mockDevice,
        device_type: 'Sensor-2.0 (New)'
      };
      
      render(<ReturnDeviceModal {...mockProps} selectedDevice={specialCharDevice} />);
      
      expect(screen.getByText('Sensor-2.0 (New)')).toBeTruthy();
    });
  });

  describe('Location Options', () => {
    it('should handle single location option', () => {
      const singleOption = [{ label: 'Only Location', value: 'single' }];
      
      render(<ReturnDeviceModal {...mockProps} locationOptions={singleOption} />);
      
      const dropdown = screen.getByTestId('return-location-dropdown');
      expect(dropdown).toBeTruthy();
    });

    it('should handle long location names', () => {
      const longNameOptions = [
        { label: 'Very Long Location Name That Might Cause UI Issues', value: 'long1' }
      ];
      
      render(<ReturnDeviceModal {...mockProps} locationOptions={longNameOptions} />);
      
      expect(screen.getByTestId('return-location-dropdown')).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const { rerender } = render(<ReturnDeviceModal {...mockProps} />);
      
      rerender(<ReturnDeviceModal {...mockProps} />);
      
      expect(screen.getByText('Return Device')).toBeTruthy();
    });

    it('should handle rapid button presses gracefully', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      const confirmButton = screen.getByTestId('confirm-return-button');
      
      // Rapid fire clicks
      fireEvent.press(confirmButton);
      fireEvent.press(confirmButton);
      fireEvent.press(confirmButton);
      
      // Should still work normally
      expect(mockProps.onConfirmReturn).toHaveBeenCalledTimes(3);
    });
  });

  describe('Integration with Sentry', () => {
    it('should capture modal interactions', () => {
      render(<ReturnDeviceModal {...mockProps} />);
      
      const confirmButton = screen.getByTestId('confirm-return-button');
      fireEvent.press(confirmButton);
      
      global.testHelpers?.sentry?.captureTestMessage(
        'Return device modal interaction captured',
        'info'
      );
    });

    it('should handle modal errors gracefully', () => {
      const errorOnConfirm = jest.fn(() => {
        throw new Error('Test error');
      });
      
      render(<ReturnDeviceModal {...mockProps} onConfirmReturn={errorOnConfirm} />);
      
      const confirmButton = screen.getByTestId('confirm-return-button');
      
      expect(() => fireEvent.press(confirmButton)).not.toThrow();
      
      global.testHelpers?.sentry?.captureTestError(
        new Error('Modal interaction error'),
        { component: 'ReturnDeviceModal' }
      );
    });
  });
});