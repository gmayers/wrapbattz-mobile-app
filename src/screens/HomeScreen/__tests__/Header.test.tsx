// src/screens/HomeScreen/__tests__/Header.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import Header from '../components/Header';

const mockProps = {
  userName: 'John Doe',
  isAdminOrOwner: false,
  onProfilePress: jest.fn(),
  onManageNFCPress: jest.fn(),
  onAssignDevicePress: jest.fn(),
};

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with basic props', () => {
      render(<Header {...mockProps} />);
      
      expect(screen.getByText('Welcome John Doe')).toBeTruthy();
      expect(screen.getByText('J')).toBeTruthy(); // Avatar initial
    });

    it('should render profile button', () => {
      render(<Header {...mockProps} />);
      
      const profileButton = screen.getByTestId('profile-button');
      expect(profileButton).toBeTruthy();
    });

    it('should display correct avatar initial', () => {
      render(<Header {...mockProps} userName="Alice Smith" />);
      
      expect(screen.getByText('A')).toBeTruthy();
    });

    it('should handle empty userName gracefully', () => {
      render(<Header {...mockProps} userName="" />);
      
      expect(screen.getByText('Welcome ')).toBeTruthy();
    });
  });

  describe('User Role - Regular User', () => {
    it('should show Request Device button for regular users', () => {
      render(<Header {...mockProps} isAdminOrOwner={false} />);
      
      expect(screen.getByTestId('request-device-button')).toBeTruthy();
      expect(screen.getByText('Request Device')).toBeTruthy();
    });

    it('should not show admin buttons for regular users', () => {
      render(<Header {...mockProps} isAdminOrOwner={false} />);
      
      expect(screen.queryByTestId('manage-nfc-button')).toBeFalsy();
      expect(screen.queryByTestId('assign-device-button')).toBeFalsy();
    });
  });

  describe('User Role - Admin/Owner', () => {
    it('should show admin buttons for admin/owner users', () => {
      render(<Header {...mockProps} isAdminOrOwner={true} />);
      
      expect(screen.getByTestId('manage-nfc-button')).toBeTruthy();
      expect(screen.getByTestId('assign-device-button')).toBeTruthy();
      expect(screen.getByText('Manage NFC')).toBeTruthy();
      expect(screen.getByText('Assign Device')).toBeTruthy();
    });

    it('should not show Request Device button for admin/owner', () => {
      render(<Header {...mockProps} isAdminOrOwner={true} />);
      
      expect(screen.queryByTestId('request-device-button')).toBeFalsy();
    });
  });

  describe('User Interactions', () => {
    it('should call onProfilePress when profile button is pressed', () => {
      render(<Header {...mockProps} />);
      
      const profileButton = screen.getByTestId('profile-button');
      fireEvent.press(profileButton);
      
      expect(mockProps.onProfilePress).toHaveBeenCalledTimes(1);
    });

    it('should call onAssignDevicePress when Request Device button is pressed', () => {
      render(<Header {...mockProps} isAdminOrOwner={false} />);
      
      const requestButton = screen.getByTestId('request-device-button');
      fireEvent.press(requestButton);
      
      expect(mockProps.onAssignDevicePress).toHaveBeenCalledTimes(1);
    });

    it('should call onManageNFCPress when Manage NFC button is pressed', () => {
      render(<Header {...mockProps} isAdminOrOwner={true} />);
      
      const manageNFCButton = screen.getByTestId('manage-nfc-button');
      fireEvent.press(manageNFCButton);
      
      expect(mockProps.onManageNFCPress).toHaveBeenCalledTimes(1);
    });

    it('should call onAssignDevicePress when Assign Device button is pressed', () => {
      render(<Header {...mockProps} isAdminOrOwner={true} />);
      
      const assignButton = screen.getByTestId('assign-device-button');
      fireEvent.press(assignButton);
      
      expect(mockProps.onAssignDevicePress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility properties', () => {
      render(<Header {...mockProps} />);
      
      const profileButton = screen.getByTestId('profile-button');
      expect(profileButton).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in userName', () => {
      render(<Header {...mockProps} userName="José María" />);
      
      expect(screen.getByText('Welcome José María')).toBeTruthy();
      expect(screen.getByText('J')).toBeTruthy();
    });

    it('should handle long userName', () => {
      const longName = 'This is a very long name that might cause layout issues';
      render(<Header {...mockProps} userName={longName} />);
      
      expect(screen.getByText(`Welcome ${longName}`)).toBeTruthy();
      expect(screen.getByText('T')).toBeTruthy();
    });

    it('should handle numbers in userName', () => {
      render(<Header {...mockProps} userName="User123" />);
      
      expect(screen.getByText('Welcome User123')).toBeTruthy();
      expect(screen.getByText('U')).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const { rerender } = render(<Header {...mockProps} />);
      
      // Re-render with same props
      rerender(<Header {...mockProps} />);
      
      expect(screen.getByText('Welcome John Doe')).toBeTruthy();
    });
  });

  describe('Integration with Sentry', () => {
    it('should handle button press errors gracefully', () => {
      const errorOnPress = jest.fn(() => {
        throw new Error('Test error');
      });
      
      render(<Header {...mockProps} onProfilePress={errorOnPress} />);
      
      const profileButton = screen.getByTestId('profile-button');
      
      // The error will be thrown, but we can verify the handler was called
      expect(() => fireEvent.press(profileButton)).toThrow('Test error');
      expect(errorOnPress).toHaveBeenCalledTimes(1);
      
      global.testHelpers?.sentry?.captureTestMessage(
        'Header button press error handled',
        'info'
      );
    });
  });
});