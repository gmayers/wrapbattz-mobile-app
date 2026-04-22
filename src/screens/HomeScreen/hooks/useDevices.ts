import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { assignments as assignmentsApi, tools as toolsApi } from '../../../api/endpoints';
import { ApiError } from '../../../api/errors';
import type { AssignmentRead, ToolRead } from '../../../api/types';

// Legacy shape consumed by DevicesList / ReturnDeviceModal. Keep this mapping
// until those components are rewritten against AssignmentRead directly.
export interface LegacyAssignment {
  id: number;
  uuid: string;
  user_name: string;
  location_name: string;
  device: {
    id: number;
    identifier: string;
    device_type: string;
    status: string;
    current_assignment?: { id: number };
  };
  user: string;
  location: { id: number; name: string } | null;
  assigned_date: string | null;
  returned_date: string | null;
  status: string;
  condition: string;
  notes: string;
}

function toLegacyAssignment(a: AssignmentRead): LegacyAssignment {
  return {
    id: a.id,
    uuid: a.uuid,
    user_name: a.assignee_user_email ?? '',
    location_name: a.assignee_site_name ?? '',
    device: {
      id: a.tool_id,
      identifier: a.tool_name,
      device_type: '',
      status: a.status ?? 'active',
      current_assignment: { id: a.id },
    },
    user: a.assignee_user_email ?? '',
    location:
      a.assignee_site_id != null
        ? { id: a.assignee_site_id, name: a.assignee_site_name ?? '' }
        : null,
    assigned_date: a.assigned_at ?? null,
    returned_date: a.returned_at ?? null,
    status: a.status ?? 'active',
    condition: a.condition ?? '',
    notes: a.notes ?? '',
  };
}

export interface LegacyDevice {
  id: number;
  identifier: string;
  device_type: string;
  status: string;
}

function toLegacyDevice(tool: ToolRead): LegacyDevice {
  return {
    id: tool.id,
    identifier: tool.name,
    device_type: tool.category_name ?? '',
    status: tool.status ?? '',
  };
}

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

// Silence unused import warning if the tools module is later removed from here.
export type { ToolRead } from '../../../api/types';
void toolsApi;
