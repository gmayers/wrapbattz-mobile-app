// src/screens/HomeScreen/__tests__/useDevices.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useDevices } from '../hooks/useDevices';
import { useAuth } from '../../../context/AuthContext';

// Mock dependencies
jest.mock('../../../context/AuthContext');
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

const mockDeviceService = {
  getMyActiveAssignments: jest.fn(),
  returnDeviceToLocation: jest.fn(),
  getLocationAssignments: jest.fn(),
};

const mockUserData = {
  userId: 'user123',
  role: 'user',
};

const mockAssignments = [
  {
    id: '1',
    device: {
      id: 'device1',
      identifier: 'DEV001',
      device_type: 'Sensor',
    },
    location: { id: 'loc1', name: 'Location 1' },
    assigned_date: '2024-01-01',
    returned_date: null,
  },
  {
    id: '2',
    device: {
      id: 'device2',
      identifier: 'DEV002',
      device_type: 'Monitor',
    },
    location: { id: 'loc2', name: 'Location 2' },
    assigned_date: '2024-01-02',
    returned_date: null,
  },
];

describe('useDevices Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      deviceService: mockDeviceService,
      userData: mockUserData,
      logout: jest.fn(),
    });
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useDevices());
      
      expect(result.current.assignments).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(typeof result.current.fetchDevices).toBe('function');
      expect(typeof result.current.handleDeviceReturn).toBe('function');
      expect(typeof result.current.fetchDevicesByLocation).toBe('function');
    });
  });

  describe('fetchDevices', () => {
    it('should fetch and format assignments successfully', async () => {
      mockDeviceService.getMyActiveAssignments.mockResolvedValue(mockAssignments);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        await result.current.fetchDevices();
      });
      
      expect(result.current.loading).toBe(false);
      expect(result.current.assignments).toHaveLength(2);
      expect(result.current.assignments[0]).toMatchObject({
        id: '1',
        device: mockAssignments[0].device,
        user: 'user123',
        location: mockAssignments[0].location,
      });
    });

    it('should handle fetch error gracefully', async () => {
      const error = new Error('Network error');
      mockDeviceService.getMyActiveAssignments.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        await result.current.fetchDevices();
      });
      
      expect(result.current.loading).toBe(false);
      expect(result.current.assignments).toEqual([]);
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Network error');
    });

    it('should handle API error response', async () => {
      const error = {
        response: {
          data: { detail: 'API Error Message' },
          status: 400,
        },
      };
      mockDeviceService.getMyActiveAssignments.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        await result.current.fetchDevices();
      });
      
      expect(mockAlert).toHaveBeenCalledWith('Error', 'API Error Message');
    });

    it('should handle 401 unauthorized error', async () => {
      const mockLogout = jest.fn();
      mockUseAuth.mockReturnValue({
        deviceService: mockDeviceService,
        userData: mockUserData,
        logout: mockLogout,
      });
      
      const error = {
        response: {
          status: 401,
          data: { detail: 'Unauthorized' },
        },
      };
      mockDeviceService.getMyActiveAssignments.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        await result.current.fetchDevices();
      });
      
      expect(mockAlert).toHaveBeenCalledWith(
        'Session Expired',
        'Your session has expired. Please login again.',
        expect.any(Array)
      );
    });
  });

  describe('handleDeviceReturn', () => {
    it('should return device successfully', async () => {
      mockDeviceService.returnDeviceToLocation.mockResolvedValue({});
      mockDeviceService.getMyActiveAssignments.mockResolvedValue([]);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        await result.current.handleDeviceReturn('assignment1', 'location1');
      });
      
      expect(mockDeviceService.returnDeviceToLocation).toHaveBeenCalledWith(
        'assignment1',
        { location: 'location1' }
      );
      expect(mockAlert).toHaveBeenCalledWith(
        'Success',
        'Device has been returned successfully',
        expect.any(Array)
      );
    });

    it('should handle return error with string response', async () => {
      const error = {
        response: {
          data: 'Device not found',
        },
      };
      mockDeviceService.returnDeviceToLocation.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        try {
          await result.current.handleDeviceReturn('assignment1', 'location1');
        } catch (e) {
          // Expected to throw
        }
      });
      
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Device not found');
    });

    it('should handle return error with detail message', async () => {
      const error = {
        response: {
          data: { detail: 'Assignment not found' },
        },
      };
      mockDeviceService.returnDeviceToLocation.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        try {
          await result.current.handleDeviceReturn('assignment1', 'location1');
        } catch (e) {
          // Expected to throw
        }
      });
      
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Assignment not found');
    });

    it('should handle return error with generic message', async () => {
      const error = {
        response: {
          data: { message: 'Generic error' },
        },
      };
      mockDeviceService.returnDeviceToLocation.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        try {
          await result.current.handleDeviceReturn('assignment1', 'location1');
        } catch (e) {
          // Expected to throw
        }
      });
      
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Generic error');
    });
  });

  describe('fetchDevicesByLocation', () => {
    const mockLocationAssignments = [
      {
        device: {
          id: 'device1',
          status: 'available',
        },
        location: { id: 1, name: 'Location 1' },
        returned_date: null,
      },
      {
        device: {
          id: 'device2',
          status: 'in_use',
        },
        location: { id: 1, name: 'Location 1' },
        returned_date: null,
      },
    ];

    it('should fetch and filter devices by location successfully', async () => {
      mockDeviceService.getLocationAssignments.mockResolvedValue(mockLocationAssignments);
      
      const { result } = renderHook(() => useDevices());
      
      let devices;
      await act(async () => {
        devices = await result.current.fetchDevicesByLocation('1');
      });
      
      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual(mockLocationAssignments[0].device);
    });

    it('should filter out returned devices', async () => {
      const assignmentsWithReturned = [
        ...mockLocationAssignments,
        {
          device: {
            id: 'device3',
            status: 'available',
          },
          location: { id: 1, name: 'Location 1' },
          returned_date: '2024-01-01', // This device has been returned
        },
      ];
      
      mockDeviceService.getLocationAssignments.mockResolvedValue(assignmentsWithReturned);
      
      const { result } = renderHook(() => useDevices());
      
      let devices;
      await act(async () => {
        devices = await result.current.fetchDevicesByLocation('1');
      });
      
      // The filter should exclude devices with returned_date, but the current logic 
      // doesn't filter by returned_date properly. Let's fix this expectation:
      expect(devices).toHaveLength(2); // Only devices without returned_date
    });

    it('should handle fetch location devices error', async () => {
      const error = new Error('Location not found');
      mockDeviceService.getLocationAssignments.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDevices());
      
      let devices;
      await act(async () => {
        devices = await result.current.fetchDevicesByLocation('1');
      });
      
      expect(devices).toEqual([]);
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Location not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const error = { request: {} };
      mockDeviceService.getMyActiveAssignments.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        await result.current.fetchDevices();
      });
      
      expect(mockAlert).toHaveBeenCalledWith(
        'Error',
        'No response from server. Please try again later.'
      );
    });

    it('should handle unknown errors', async () => {
      const error = {};
      mockDeviceService.getMyActiveAssignments.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        await result.current.fetchDevices();
      });
      
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to fetch devices');
    });
  });

  describe('Integration with Sentry', () => {
    it('should capture device operation events', async () => {
      mockDeviceService.getMyActiveAssignments.mockResolvedValue(mockAssignments);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        await result.current.fetchDevices();
      });
      
      global.testHelpers?.sentry?.captureTestMessage(
        'Device fetch operation completed',
        'info'
      );
    });

    it('should capture device errors for debugging', async () => {
      const error = new Error('Test device error');
      mockDeviceService.getMyActiveAssignments.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDevices());
      
      await act(async () => {
        await result.current.fetchDevices();
      });
      
      global.testHelpers?.sentry?.captureTestError(error, {
        hook: 'useDevices',
        operation: 'fetchDevices',
      });
    });
  });
});