import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { assignments as assignmentsApi } from '../../../api/endpoints';
import { ApiError } from '../../../api/errors';
import {
  toLegacyAssignment,
  toLegacyDevice,
  type LegacyAssignment,
  type LegacyDevice,
} from '../../../api/adapters';

export interface UseDevicesReturn {
  assignments: LegacyAssignment[];
  loading: boolean;
  fetchDevices: () => Promise<void>;
  handleDeviceReturn: (assignmentId: number | string, siteId: number | string) => Promise<void>;
  fetchDevicesByLocation: (siteId: string | number) => Promise<LegacyDevice[]>;
}

function reportError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    Alert.alert('Error', error.message || fallback);
  } else if (error instanceof Error) {
    Alert.alert('Error', error.message || fallback);
  } else {
    Alert.alert('Error', fallback);
  }
}

export const useDevices = (): UseDevicesReturn => {
  const [legacyAssignments, setLegacyAssignments] = useState<LegacyAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const list = await assignmentsApi.listMyActiveAssignments();
      const mapped = list.map(toLegacyAssignment);
      // Active (no returned_date) first, then by assigned_date desc.
      mapped.sort((a, b) => {
        if (!a.returned_date && b.returned_date) return -1;
        if (a.returned_date && !b.returned_date) return 1;
        const at = a.assigned_date ? new Date(a.assigned_date).getTime() : 0;
        const bt = b.assigned_date ? new Date(b.assigned_date).getTime() : 0;
        return bt - at;
      });
      setLegacyAssignments(mapped);
    } catch (error) {
      reportError(error, 'Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeviceReturn = useCallback(
    async (assignmentId: number | string, siteId: number | string) => {
      try {
        await assignmentsApi.returnAssignment(Number(assignmentId), {
          target_site_id: Number(siteId),
          condition: '',
          notes: '',
        });
        Alert.alert('Success', 'Device has been returned successfully', [
          { text: 'OK', onPress: () => fetchDevices() },
        ]);
      } catch (error) {
        reportError(error, 'Failed to return device.');
        throw error;
      }
    },
    [fetchDevices]
  );

  const fetchDevicesByLocation = useCallback(
    async (_siteId: string | number): Promise<LegacyDevice[]> => {
      try {
        // The new API doesn't scope "available" by site — an available tool is
        // available everywhere. Callers that need site-scoped assignments can
        // use `assignmentsApi.listAssignmentsBySite`.
        const page = await assignmentsApi.listAvailableTools();
        return page.items.map(toLegacyDevice);
      } catch (error) {
        reportError(error, 'Failed to fetch available devices');
        return [];
      }
    },
    []
  );

  return {
    assignments: legacyAssignments,
    loading,
    fetchDevices,
    handleDeviceReturn,
    fetchDevicesByLocation,
  };
};

