import { renderHook, waitFor } from '@testing-library/react-native';
import { useSiteWorkerData } from '../useSiteWorkerData';

const mockListMyActive = jest.fn();
const mockListMine = jest.fn();
const mockListMyIncidents = jest.fn();
const mockListSites = jest.fn();
const mockListSiteAssignments = jest.fn();
const mockGetMyOrg = jest.fn();

jest.mock('../../../../../api/endpoints', () => ({
  assignments: {
    listMyActiveAssignments: (...args: any[]) => mockListMyActive(...args),
    listMyAssignments: (...args: any[]) => mockListMine(...args),
  },
  incidents: { listMyIncidents: (...args: any[]) => mockListMyIncidents(...args) },
  sites: { listSites: (...args: any[]) => mockListSites(...args) },
  siteAssignments: { listSiteAssignments: (...args: any[]) => mockListSiteAssignments(...args) },
  organizations: { getMyOrganization: (...args: any[]) => mockGetMyOrg(...args) },
}));

jest.mock('../../../../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { id: 200, first_name: 'Wendy', last_name: 'Jones', email: 'wj@x.com' } }),
}));

const TODAY_ISO = new Date().toISOString().slice(0, 10);

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockGetMyOrg.mockResolvedValue({ name: 'Davidson-Morris' });
  mockListSites.mockResolvedValue({
    items: [{ id: 5, name: 'Transit Van 02', site_type: 'vehicle', prefix_code: 'VAN-02', status: 'active' }],
    total: 1, page: 1, page_size: 50, total_pages: 1,
  });
  mockListSiteAssignments.mockResolvedValue({
    items: [{ id: 1, user_id: 200, user_email: 'wj@x.com', site_id: 9, site_name: 'Chelsea Wharf', role: 'Site lead', is_active: true, created_at: '' }],
    total: 1, page: 1, page_size: 50, total_pages: 1,
  });
  mockListMyIncidents.mockResolvedValue({
    items: [
      { id: 11, tool_id: 100, tool_name: 'Milwaukee SE-8330', type: 'check', severity: 'medium', status: 'open', description: 'Blade check flagged', created_at: '' },
    ],
    total: 1, page: 1, page_size: 50, total_pages: 1,
  });
  mockListMine.mockResolvedValue({
    items: [
      { id: 50, tool_id: 70, tool_name: 'Returned Drill', status: 'returned', returned_at: TODAY_ISO },
      { id: 51, tool_id: 71, tool_name: 'Older Returned',  status: 'returned', returned_at: isoDaysAgo(2) },
    ],
    total: 2, page: 1, page_size: 50, total_pages: 1,
  });
  mockListMyActive.mockResolvedValue([
    {
      id: 1, tool_id: 200, tool_name: 'Bosch GH-3544', status: 'active',
      assigned_at: isoDaysAgo(11), expected_return_at: isoDaysAgo(4), returned_at: null, assignee_user_id: 200,
    },
    {
      id: 2, tool_id: 201, tool_name: 'Honda EU22i', status: 'active',
      assigned_at: isoDaysAgo(2), expected_return_at: TODAY_ISO, returned_at: null, assignee_user_id: 200,
    },
    {
      id: 3, tool_id: 202, tool_name: 'Generic Drill', status: 'active',
      assigned_at: TODAY_ISO, expected_return_at: null, returned_at: null, assignee_user_id: 200,
    },
    {
      id: 4, tool_id: 203, tool_name: 'Milwaukee SE-8330', status: 'active',
      assigned_at: isoDaysAgo(1), expected_return_at: null, returned_at: null, assignee_user_id: 200,
    },
    {
      id: 5, tool_id: 204, tool_name: 'Van Tool A', status: 'active',
      assigned_at: TODAY_ISO, expected_return_at: null, returned_at: null,
      assignee_site_id: 5, assignee_site_name: 'Transit Van 02',
    },
    {
      id: 6, tool_id: 205, tool_name: 'Van Tool B', status: 'active',
      assigned_at: TODAY_ISO, expected_return_at: null, returned_at: null,
      assignee_site_id: 5, assignee_site_name: 'Transit Van 02',
    },
  ]);
});

describe('useSiteWorkerData', () => {
  it('returns CHECKED OUT count from active assignments length', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.checkedOut).toBe(6);
  });

  it('counts only assignments returned today as RETURNED', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.returnedToday).toBe(1);
  });

  it('counts overdue assignments (expected_return_at < today)', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overdueCount).toBe(1);
  });

  it('produces an overdue row before a due-today row', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const overdueIdx = result.current.rows.findIndex(r => r.kind === 'overdue');
    const dueIdx = result.current.rows.findIndex(r => r.kind === 'due_today');
    expect(overdueIdx).toBeGreaterThanOrEqual(0);
    expect(dueIdx).toBeGreaterThan(overdueIdx);
  });

  it('produces a flagged row from listMyIncidents', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const flagged = result.current.rows.find(r => r.kind === 'flagged');
    expect(flagged?.primary).toBe('Milwaukee SE-8330');
    expect(flagged?.cta.kind).toBe('log');
  });

  it('builds tagline from active site assignment', async () => {
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.siteTagline).toContain('CHELSEA WHARF');
  });

  it('falls back to ORG / SITE tagline when no active site assignment', async () => {
    mockListSiteAssignments.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 });
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.siteTagline).toContain('SITE');
  });

  it('emits an EOD row at 16:00 with van-assigned tools', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(`${TODAY_ISO}T16:30:00Z`));
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const eod = result.current.rows.find(r => r.kind === 'eod');
    expect(eod).toBeDefined();
    expect(eod?.secondary).toMatch(/2 items.*VAN-02/);
  });

  it('does NOT emit an EOD row before 16:00', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(`${TODAY_ISO}T09:00:00Z`));
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows.find(r => r.kind === 'eod')).toBeUndefined();
  });

  it('captures error from listMyActiveAssignments', async () => {
    mockListMyActive.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useSiteWorkerData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('boom');
  });
});
