// The server clamps page_size to 100, so a single listTools({page_size:200})
// silently covers only the first 100 tools — NFC-tag counts and "all tools"
// views must walk every page via listAllTools.
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  tools as toolsApi,
  organizations as orgsApi,
  assignments as assignmentsApi,
  incidents as incidentsApi,
  sites as sitesApi,
  members as membersApi,
} from '../../../api/endpoints';
import { useControlRoomData } from '../ControlRoom/hooks/useControlRoomData';
import { useFleetStatusData } from '../FleetStatus/hooks/useFleetStatusData';

jest.mock('../../../api/endpoints', () => ({
  tools: { listTools: jest.fn(), listAllTools: jest.fn() },
  organizations: { getMyOrganization: jest.fn() },
  assignments: { listAssignments: jest.fn(), listMyActiveAssignments: jest.fn() },
  incidents: { listIncidents: jest.fn() },
  sites: { listSites: jest.fn() },
  members: { listMembers: jest.fn() },
}));

const mockAuth = { user: { id: 1 }, userData: { role: 'owner' }, isAdminOrOwner: true };
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));

function probe(useHook: () => any, pick: (d: any) => unknown) {
  const out: { value?: unknown } = {};
  function Probe() {
    const hook = useHook();
    out.value = pick(hook);
    return <Text>probe</Text>;
  }
  return { Probe, out };
}

describe('dashboard tool coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (toolsApi.listAllTools as jest.Mock).mockResolvedValue([
      { id: 1, nfc_tag_id: 'A' },
      { id: 2, nfc_tag_id: null },
    ]);
    (orgsApi.getMyOrganization as jest.Mock).mockResolvedValue({ tool_count: 2 });
    (assignmentsApi.listAssignments as jest.Mock).mockResolvedValue({ items: [] });
    (assignmentsApi.listMyActiveAssignments as jest.Mock).mockResolvedValue([]);
    (incidentsApi.listIncidents as jest.Mock).mockResolvedValue({ items: [] });
    (sitesApi.listSites as jest.Mock).mockResolvedValue({ items: [] });
    (membersApi.listMembers as jest.Mock).mockResolvedValue({ items: [] });
  });

  it('useControlRoomData walks all tool pages and counts NFC tags from them', async () => {
    const { Probe, out } = probe(useControlRoomData, (h) => h.inventory);
    render(<Probe />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(toolsApi.listAllTools).toHaveBeenCalled();
    expect(toolsApi.listTools).not.toHaveBeenCalled();
    expect((out.value as any)?.tags).toBe(1);
    expect((out.value as any)?.devices).toBe(2);
  });

  it('useFleetStatusData walks all tool pages', async () => {
    const { Probe } = probe(useFleetStatusData, (h) => h);
    render(<Probe />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(toolsApi.listAllTools).toHaveBeenCalled();
    expect(toolsApi.listTools).not.toHaveBeenCalled();
  });
});
