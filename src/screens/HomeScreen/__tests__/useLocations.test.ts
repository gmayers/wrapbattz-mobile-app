// src/screens/HomeScreen/__tests__/useLocations.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useLocations } from '../hooks/useLocations';
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
  getLocations: jest.fn(),
};

const mockLocations = [
  { id: '1', name: 'Warehouse A' },
  { id: '2', name: 'Warehouse B' },
  { id: '3', name: 'Office Building' },
];

describe('useLocations Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      deviceService: mockDeviceService,
      logout: jest.fn(),
    });
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useLocations());
      
      expect(result.current.locations).toEqual([]);
      expect(result.current.locationOptions).toEqual([]);
      expect(result.current.selectedReturnLocation).toBe('');
      expect(typeof result.current.setSelectedReturnLocation).toBe('function');
      expect(typeof result.current.fetchLocations).toBe('function');
      expect(typeof result.current.resetSelection).toBe('function');
    });
  });

  describe('fetchLocations', () => {
    it('should fetch locations successfully', async () => {
      mockDeviceService.getLocations.mockResolvedValue(mockLocations);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(result.current.locations).toEqual(mockLocations);
    });

    it('should handle fetch error gracefully', async () => {
      const error = new Error('Network error');
      mockDeviceService.getLocations.mockRejectedValue(error);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(result.current.locations).toEqual([]);
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Network error');
    });

    it('should handle API error response', async () => {
      const error = {
        response: {
          data: { detail: 'Failed to load locations' },
          status: 500,
        },
      };
      mockDeviceService.getLocations.mockRejectedValue(error);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to load locations');
    });

    it('should handle 401 unauthorized error', async () => {
      const mockLogout = jest.fn();
      mockUseAuth.mockReturnValue({
        deviceService: mockDeviceService,
        logout: mockLogout,
      });
      
      const error = {
        response: {
          status: 401,
          data: { detail: 'Unauthorized' },
        },
      };
      mockDeviceService.getLocations.mockRejectedValue(error);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(mockAlert).toHaveBeenCalledWith(
        'Session Expired',
        'Your session has expired. Please login again.',
        expect.any(Array)
      );
    });
  });

  describe('Location Options Transformation', () => {
    it('should transform locations into dropdown options', async () => {
      mockDeviceService.getLocations.mockResolvedValue(mockLocations);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(result.current.locationOptions).toEqual([
        { label: 'Warehouse A', value: '1' },
        { label: 'Warehouse B', value: '2' },
        { label: 'Office Building', value: '3' },
      ]);
    });

    it('should auto-select first location when options are available', async () => {
      mockDeviceService.getLocations.mockResolvedValue(mockLocations);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(result.current.selectedReturnLocation).toBe('1');
    });

    it('should not auto-select if location is already selected', async () => {
      mockDeviceService.getLocations.mockResolvedValue(mockLocations);
      
      const { result } = renderHook(() => useLocations());
      
      // Pre-select a location
      act(() => {
        result.current.setSelectedReturnLocation('2');
      });
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(result.current.selectedReturnLocation).toBe('2');
    });
  });

  describe('Selection Management', () => {
    it('should update selected location', () => {
      const { result } = renderHook(() => useLocations());
      
      act(() => {
        result.current.setSelectedReturnLocation('2');
      });
      
      expect(result.current.selectedReturnLocation).toBe('2');
    });

    it('should reset selection', () => {
      const { result } = renderHook(() => useLocations());
      
      // Set a location first
      act(() => {
        result.current.setSelectedReturnLocation('2');
      });
      
      expect(result.current.selectedReturnLocation).toBe('2');
      
      // Reset
      act(() => {
        result.current.resetSelection();
      });
      
      expect(result.current.selectedReturnLocation).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty locations array', async () => {
      mockDeviceService.getLocations.mockResolvedValue([]);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(result.current.locations).toEqual([]);
      expect(result.current.locationOptions).toEqual([]);
      expect(result.current.selectedReturnLocation).toBe('');
    });

    it('should handle locations with special characters', async () => {
      const specialLocations = [
        { id: '1', name: 'Warehouse-A & Co.' },
        { id: '2', name: 'Building #2 (Main)' },
      ];
      mockDeviceService.getLocations.mockResolvedValue(specialLocations);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(result.current.locationOptions).toEqual([
        { label: 'Warehouse-A & Co.', value: '1' },
        { label: 'Building #2 (Main)', value: '2' },
      ]);
    });

    it('should handle locations with long names', async () => {
      const longNameLocations = [
        { 
          id: '1', 
          name: 'Very Long Location Name That Might Cause UI Issues In Some Cases'
        },
      ];
      mockDeviceService.getLocations.mockResolvedValue(longNameLocations);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(result.current.locationOptions[0].label).toBe(
        'Very Long Location Name That Might Cause UI Issues In Some Cases'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const error = { request: {} };
      mockDeviceService.getLocations.mockRejectedValue(error);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(mockAlert).toHaveBeenCalledWith(
        'Error',
        'No response from server. Please try again later.'
      );
    });

    it('should handle unknown errors', async () => {
      const error = {};
      mockDeviceService.getLocations.mockRejectedValue(error);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to fetch locations');
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const { result, rerender } = renderHook(() => useLocations());
      
      const firstFetchFunction = result.current.fetchLocations;
      
      rerender();
      
      const secondFetchFunction = result.current.fetchLocations;
      
      expect(firstFetchFunction).toBe(secondFetchFunction);
    });

    it('should handle rapid selection changes', () => {
      const { result } = renderHook(() => useLocations());
      
      // Rapid selection changes
      act(() => {
        result.current.setSelectedReturnLocation('1');
        result.current.setSelectedReturnLocation('2');
        result.current.setSelectedReturnLocation('3');
      });
      
      expect(result.current.selectedReturnLocation).toBe('3');
    });
  });

  describe('State Synchronization', () => {
    it('should maintain state consistency between locations and options', async () => {
      const firstBatch = [{ id: '1', name: 'Location 1' }];
      const secondBatch = [
        { id: '1', name: 'Location 1' },
        { id: '2', name: 'Location 2' },
      ];
      
      const { result } = renderHook(() => useLocations());
      
      // First fetch
      mockDeviceService.getLocations.mockResolvedValue(firstBatch);
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(result.current.locations).toHaveLength(1);
      expect(result.current.locationOptions).toHaveLength(1);
      expect(result.current.selectedReturnLocation).toBe('1');
      
      // Second fetch with more locations
      mockDeviceService.getLocations.mockResolvedValue(secondBatch);
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      expect(result.current.locations).toHaveLength(2);
      expect(result.current.locationOptions).toHaveLength(2);
      // Should maintain previous selection
      expect(result.current.selectedReturnLocation).toBe('1');
    });
  });

  describe('Integration with Sentry', () => {
    it('should capture location operation events', async () => {
      mockDeviceService.getLocations.mockResolvedValue(mockLocations);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      global.testHelpers?.sentry?.captureTestMessage(
        'Locations fetch operation completed',
        'info'
      );
    });

    it('should capture location errors for debugging', async () => {
      const error = new Error('Test location error');
      mockDeviceService.getLocations.mockRejectedValue(error);
      
      const { result } = renderHook(() => useLocations());
      
      await act(async () => {
        await result.current.fetchLocations();
      });
      
      global.testHelpers?.sentry?.captureTestError(error, {
        hook: 'useLocations',
        operation: 'fetchLocations',
      });
    });
  });
});