// Dashboards get their counts from GET /organizations/me/stats/ instead of
// downloading full tool/incident/member lists and counting client-side.
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
  organizations: { getMyOrganization: jest.fn(), getOrgStats: jest.fn() },
  assignments: { listAssignments: jest.fn(), listMyActiveAssignments: jest.fn() },
  incidents: { listIncidents: jest.fn() },
  sites: { listSites: jest.fn() },
  members: { listMembers: jest.fn() },
}));

const mockAuth = { user: { id: 1 }, userData: { role: 'owner' }, isAdminOrOwner: true };
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));

// The hooks refresh on tab focus; there is no navigator in these tests.
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));

const STATS = {
  tools: { total: 5, with_nfc_tag: 3, available: 4 },
  assignments: { active: 1 },
  incidents: { open: 2, missing: 0, maintenance_due: 1, critical: 1 },
  members: { total: 4, admins: 1, workers: 3 },
  sites: { total: 2, active: 2 },
};

function probe(useHook: () => any, pick: (d: any) => unknown) {
  const out: { value?: unknown } = {};
  function Probe() {
    out.value = pick(useHook());
    return <Text>probe</Text>;
  }
  return { Probe, out };
}

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe('dashboard stats adoption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (orgsApi.getMyOrganization as jest.Mock).mockResolvedValue({
      name: 'Org',
      tool_count: 5,
      member_count: 4,
      site_count: 2,
    });
    (orgsApi.getOrgStats as jest.Mock).mockResolvedValue(STATS);
    (assignmentsApi.listAssignments as jest.Mock).mockResolvedValue({ items: [] });
    (incidentsApi.listIncidents as jest.Mock).mockResolvedValue({ items: [] });
    (sitesApi.listSites as jest.Mock).mockResolvedValue({ items: [] });
  });

  it('useControlRoomData reads counts from org stats, not full lists', async () => {
    const { Probe, out } = probe(useControlRoomData, (h) => ({
      inventory: h.inventory,
      members: h.members,
    }));
    render(<Probe />);
    await flush();

    expect(orgsApi.getOrgStats).toHaveBeenCalled();
    // No count-only list downloads.
    expect(toolsApi.listAllTools).not.toHaveBeenCalled();
    expect(toolsApi.listTools).not.toHaveBeenCalled();
    expect(membersApi.listMembers).not.toHaveBeenCalled();
    expect(incidentsApi.listIncidents).not.toHaveBeenCalled();

    const value = out.value as any;
    expect(value.inventory.tags).toBe(3);
    expect(value.inventory.devices).toBe(5);
    expect(value.inventory.maintenance).toBe(1);
    expect(value.members.admins).toBe(1);
    expect(value.members.workers).toBe(3);
  });

  it('useFleetStatusData reads tag counts from org stats but keeps the incident list for exceptions', async () => {
    const { Probe, out } = probe(useFleetStatusData, (h) => h.inventory);
    render(<Probe />);
    await flush();

    expect(orgsApi.getOrgStats).toHaveBeenCalled();
    expect(toolsApi.listAllTools).not.toHaveBeenCalled();
    expect(toolsApi.listTools).not.toHaveBeenCalled();
    // Exceptions rows still need real incident rows.
    expect(incidentsApi.listIncidents).toHaveBeenCalled();

    expect((out.value as any).tagsUsed).toBe(3);
    expect((out.value as any).total).toBe(5);
  });
});
