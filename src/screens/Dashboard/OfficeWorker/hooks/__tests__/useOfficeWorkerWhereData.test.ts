import { renderHook, waitFor } from '@testing-library/react-native';
import { useOfficeWorkerWhereData } from '../useOfficeWorkerWhereData';

const mockListSites = jest.fn();
const mockListVans = jest.fn();
const mockListAssignments = jest.fn();
const mockListJoinRequests = jest.fn();
const mockGetMyOrg = jest.fn();

jest.mock('../../../../../api/endpoints', () => ({
  sites: { listSites: (...args: any[]) => mockListSites(...args) },
  vans: { listVans: (...args: any[]) => mockListVans(...args) },
  assignments: { listAssignments: (...args: any[]) => mockListAssignments(...args) },
  joinRequests: { listJoinRequests: (...args: any[]) => mockListJoinRequests(...args) },
  organizations: { getMyOrganization: (...args: any[]) => mockGetMyOrg(...args) },
}));

jest.mock('../../../../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { first_name: 'Mary', last_name: 'Beth', email: 'mb@example.com' } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyOrg.mockResolvedValue({ name: 'Davidson-Morris' });
  mockListSites.mockResolvedValue({
    items: [
      { id: 1, name: 'Chelsea Wharf', site_type: 'site', prefix_code: 'CHW-04' },
      { id: 2, name: 'Canary Block C', site_type: 'site', prefix_code: 'CBC-11' },
      { id: 3, name: 'Toolbox A (HQ)', site_type: 'toolbox', prefix_code: 'TB-A' },
    ],
    total: 3, page: 1, page_size: 50, total_pages: 1,
  });
  mockListVans.mockResolvedValue({
    items: [
      { id: 10, name: 'Transit Van 02', prefix_code: 'VAN-02' },
    ],
    total: 1, page: 1, page_size: 50, total_pages: 1,
  });
  mockListAssignments.mockResolvedValue({
    items: [
      { id: 100, tool_id: 1, tool_name: 'Drill', status: 'active', assignee_site_id: 1, assignee_site_name: 'CHW', assignee_user_id: 200, assignee_user_email: 'mj@x.com' },
      { id: 101, tool_id: 2, tool_name: 'Saw',   status: 'active', assignee_site_id: 1, assignee_site_name: 'CHW', assignee_user_id: 201, assignee_user_email: 'sw@x.com' },
      { id: 102, tool_id: 3, tool_name: 'Hammer',status: 'active', assignee_site_id: 3, assignee_site_name: 'TB',  assignee_user_id: null, assignee_user_email: '' },
    ],
    total: 3, page: 1, page_size: 50, total_pages: 1,
  });
  mockListJoinRequests.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 });
});

describe('useOfficeWorkerWhereData', () => {
  it('returns counts split by site_type and van entity', async () => {
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.counts).toEqual({ sites: 2, vehicles: 1, toolboxes: 1, total: 4 });
  });

  it('aggregates tool counts per location', async () => {
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const chelsea = result.current.locations.find(l => l.name === 'Chelsea Wharf');
    expect(chelsea?.toolCount).toBe(2);
    const tb = result.current.locations.find(l => l.name === 'Toolbox A (HQ)');
    expect(tb?.toolCount).toBe(1);
  });

  it('reports total tools placed across all assignments to a site', async () => {
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalToolsPlaced).toBe(3);
  });

  it('falls back to pendingApprovals=null when join-requests endpoint forbids', async () => {
    mockListJoinRequests.mockRejectedValueOnce(new Error('403'));
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pendingApprovals).toBeNull();
  });

  it('returnsDue is always null (BACKEND_GAP)', async () => {
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.returnsDue).toBeNull();
  });

  it('captures error when sites endpoint throws', async () => {
    mockListSites.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useOfficeWorkerWhereData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('boom');
  });
});
