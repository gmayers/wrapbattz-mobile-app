// src/screens/HomeScreen/__tests__/DevicesList.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import DevicesList from '../components/DevicesList';

const mockAssignments = [
  {
    id: '1',
    device: {
      id: 'device1',
      identifier: 'DEV001',
      device_type: 'Sensor',
      status: 'active',
      current_assignment: { id: 'assignment1' }
    },
    user: 'user1',
    location: { id: 'loc1', name: 'Location 1' },
    assigned_date: '2024-01-01',
    returned_date: undefined
  },
  {
    id: '2',
    device: {
      id: 'device2',
      identifier: 'DEV002',
      device_type: 'Monitor',
      status: 'active',
      current_assignment: { id: 'assignment2' }
    },
    user: 'user1',
    location: { id: 'loc2', name: 'Location 2' },
    assigned_date: '2024-01-02',
    returned_date: undefined
  }
];

const mockProps = {
  assignments: mockAssignments,
  loading: false,
  isAdminOrOwner: false,
  onDevicePress: jest.fn(),
  onDeviceReturn: jest.fn(),
  onViewAllPress: jest.fn(),
  onAddDevicePress: jest.fn(),
};

describe('DevicesList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with basic props', () => {
      render(<DevicesList {...mockProps} />);
      
      expect(screen.getByText('Your Assigned Devices')).toBeTruthy();
    });

    it('should render device cards when assignments exist', () => {
      render(<DevicesList {...mockProps} />);
      
      expect(screen.getByTestId('device-card-1')).toBeTruthy();
      expect(screen.getByTestId('device-card-2')).toBeTruthy();
    });

    it('should show View All button with correct count', () => {
      render(<DevicesList {...mockProps} />);
      
      const viewAllButton = screen.getByTestId('view-all-devices-button');
      expect(viewAllButton).toBeTruthy();
      expect(screen.getByText('View All (2 Devices)')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when loading is true', () => {
      render(<DevicesList {...mockProps} loading={true} />);
      
      expect(screen.getByTestId('devices-loading-indicator')).toBeTruthy();
    });

    it('should not show device cards when loading', () => {
      render(<DevicesList {...mockProps} loading={true} />);
      
      expect(screen.queryByTestId('device-card-1')).toBeFalsy();
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no assignments', () => {
      render(<DevicesList {...mockProps} assignments={[]} />);
      
      expect(screen.getByTestId('no-devices-text')).toBeTruthy();
      expect(screen.getByText('You have no devices assigned')).toBeTruthy();
    });

    it('should still show View All button with zero count when empty', () => {
      render(<DevicesList {...mockProps} assignments={[]} />);
      
      expect(screen.getByText('View All (0 Devices)')).toBeTruthy();
    });
  });

  describe('Admin/Owner Features', () => {
    it('should show Add Device button for admin/owner', () => {
      render(<DevicesList {...mockProps} isAdminOrOwner={true} />);
      
      expect(screen.getByTestId('add-device-button')).toBeTruthy();
      expect(screen.getByText('Add Device')).toBeTruthy();
    });

    it('should not show Add Device button for regular users', () => {
      render(<DevicesList {...mockProps} isAdminOrOwner={false} />);
      
      expect(screen.queryByTestId('add-device-button')).toBeFalsy();
    });
  });

  describe('Device Card Limiting', () => {
    const manyAssignments = Array.from({ length: 10 }, (_, i) => ({
      id: `${i + 1}`,
      device: {
        id: `device${i + 1}`,
        identifier: `DEV00${i + 1}`,
        device_type: 'Sensor',
        status: 'active',
        current_assignment: { id: `assignment${i + 1}` }
      },
      user: 'user1',
      location: { id: `loc${i + 1}`, name: `Location ${i + 1}` },
      assigned_date: '2024-01-01',
      returned_date: undefined
    }));

    it('should only show first 5 device cards', () => {
      render(<DevicesList {...mockProps} assignments={manyAssignments} />);
      
      // Should show first 5 cards
      expect(screen.getByTestId('device-card-1')).toBeTruthy();
      expect(screen.getByTestId('device-card-5')).toBeTruthy();
      
      // Should not show 6th card and beyond
      expect(screen.queryByTestId('device-card-6')).toBeFalsy();
    });

    it('should show correct count in View All button for many devices', () => {
      render(<DevicesList {...mockProps} assignments={manyAssignments} />);
      
      expect(screen.getByText('View All (10 Devices)')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('should call onDevicePress when device card is pressed', () => {
      render(<DevicesList {...mockProps} />);
      
      const deviceCard = screen.getByTestId('device-card-1');
      fireEvent.press(deviceCard);
      
      expect(mockProps.onDevicePress).toHaveBeenCalledWith('device1');
    });

    it('should call onViewAllPress when View All button is pressed', () => {
      render(<DevicesList {...mockProps} />);
      
      const viewAllButton = screen.getByTestId('view-all-devices-button');
      fireEvent.press(viewAllButton);
      
      expect(mockProps.onViewAllPress).toHaveBeenCalledTimes(1);
    });

    it('should call onAddDevicePress when Add Device button is pressed', () => {
      render(<DevicesList {...mockProps} isAdminOrOwner={true} />);
      
      const addButton = screen.getByTestId('add-device-button');
      fireEvent.press(addButton);
      
      expect(mockProps.onAddDevicePress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing device ID gracefully', () => {
      const invalidAssignments = [{
        id: '1',
        device: {
          id: '',
          identifier: 'DEV001',
          device_type: 'Sensor',
        },
        user: 'user1',
        location: { id: 'loc1', name: 'Location 1' },
        assigned_date: '2024-01-01',
      }];

      render(<DevicesList {...mockProps} assignments={invalidAssignments} />);
      
      const deviceCard = screen.getByTestId('device-card-1');
      fireEvent.press(deviceCard);
      
      expect(mockProps.onDevicePress).toHaveBeenCalledWith('');
    });

    it('should handle null device gracefully', () => {
      const invalidAssignments = [{
        id: '1',
        device: null,
        user: 'user1',
        location: { id: 'loc1', name: 'Location 1' },
        assigned_date: '2024-01-01',
      }];

      expect(() => {
        render(<DevicesList {...mockProps} assignments={invalidAssignments} />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility properties for interactive elements', () => {
      render(<DevicesList {...mockProps} />);
      
      const viewAllButton = screen.getByTestId('view-all-devices-button');
      expect(viewAllButton).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders with same props', () => {
      const { rerender } = render(<DevicesList {...mockProps} />);
      
      rerender(<DevicesList {...mockProps} />);
      
      expect(screen.getByText('Your Assigned Devices')).toBeTruthy();
    });

    it('should handle large numbers of assignments efficiently', () => {
      const largeAssignments = Array.from({ length: 100 }, (_, i) => ({
        id: `${i + 1}`,
        device: {
          id: `device${i + 1}`,
          identifier: `DEV${i + 1}`,
          device_type: 'Sensor',
          status: 'active',
        },
        user: 'user1',
        location: { id: `loc${i + 1}`, name: `Location ${i + 1}` },
        assigned_date: '2024-01-01',
      }));

      const startTime = Date.now();
      render(<DevicesList {...mockProps} assignments={largeAssignments} />);
      const renderTime = Date.now() - startTime;
      
      // Should render in reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);
      expect(screen.getByText('View All (100 Devices)')).toBeTruthy();
    });
  });

  describe('Integration with Sentry', () => {
    it('should capture device interaction events', () => {
      render(<DevicesList {...mockProps} />);
      
      const deviceCard = screen.getByTestId('device-card-1');
      fireEvent.press(deviceCard);
      
      global.testHelpers?.sentry?.captureTestMessage(
        'Device card interaction captured',
        'info'
      );
    });
  });
});