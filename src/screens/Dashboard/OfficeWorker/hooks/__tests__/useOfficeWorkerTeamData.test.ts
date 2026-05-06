import { renderHook, waitFor } from '@testing-library/react-native';
import { useOfficeWorkerTeamData } from '../useOfficeWorkerTeamData';

const mockListMembers = jest.fn();
const mockListAssignments = jest.fn();
const mockListSiteAssignments = jest.fn();
const mockGetMyOrg = jest.fn();

jest.mock('../../../../../api/endpoints', () => ({
  members: { listMembers: (...args: any[]) => mockListMembers(...args) },
  assignments: { listAssignments: (...args: any[]) => mockListAssignments(...args) },
  siteAssignments: { listSiteAssignments: (...args: any[]) => mockListSiteAssignments(...args) },
  organizations: { getMyOrganization: (...args: any[]) => mockGetMyOrg(...args) },
}));

jest.mock('../../../../../context/AuthContext', () => ({
  useAuth: () => ({ userData: { first_name: 'Mary', last_name: 'Beth', email: 'mb@example.com' } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyOrg.mockResolvedValue({ name: 'Davidson-Morris' });
  mockListMembers.mockResolvedValue({
    items: [
      { id: 1, user_id: 200, first_name: 'Wendy',  last_name: 'Jones',    email: 'wj@x.com', role: 'office_worker', is_active: true, is_primary: false, joined_at: '' },
      { id: 2, user_id: 201, first_name: 'Sylvia', last_name: 'Williams', email: 'sw@x.com', role: 'site_worker',   is_active: true, is_primary: false, joined_at: '' },
      { id: 3, user_id: 202, first_name: 'Lydia',  last_name: 'Graham',   email: 'lg@x.com', role: 'site_worker',   is_active: true, is_primary: false, joined_at: '' },
      { id: 4, user_id: 203, first_name: 'Denise', last_name: 'Thomas',   email: 'dt@x.com', role: 'office_worker', is_active: true, is_primary: false, joined_at: '' },
    ],
    total: 4, page: 1, page_size: 50, total_pages: 1,
  });
  mockListAssignments.mockResolvedValue({
    items: [
      { id: 1, tool_id: 1, tool_name: 'Drill', status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 2, tool_id: 2, tool_name: 'Saw',   status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 3, tool_id: 3, tool_name: 'Hammer',status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 4, tool_id: 4, tool_name: 'Wrench',status: 'active', assignee_user_id: 201, assignee_user_email: 'sw@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 5, tool_id: 5, tool_name: 'Pliers',status: 'active', assignee_user_id: 201, assignee_user_email: 'sw@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 6, tool_id: 6, tool_name: 'Tape',  status: 'active', assignee_user_id: 202, assignee_user_email: 'lg@x.com', assignee_site_id: 2, assignee_site_name: 'CBC' },
      { id: 7, tool_id: 7, tool_name: 'Knife', status: 'active', assignee_user_id: 203, assignee_user_email: 'dt@x.com', assignee_site_id: null, assignee_site_name: '' },
      { id: 8, tool_id: 8, tool_name: 'Scrap', status: 'active', assignee_user_id: 203, assignee_user_email: 'dt@x.com', assignee_site_id: null, assignee_site_name: '' },
    ],
    total: 8, page: 1, page_size: 50, total_pages: 1,
  });
  mockListSiteAssignments.mockResolvedValue({
    items: [
      { id: 10, user_id: 200, user_email: 'wj@x.com', site_id: 1, site_name: 'Chelsea Wharf', role: 'Site lead',   is_active: true, created_at: '' },
      { id: 11, user_id: 201, user_email: 'sw@x.com', site_id: 1, site_name: 'Chelsea Wharf', role: 'Foreman',     is_active: true, created_at: '' },
      { id: 12, user_id: 202, user_email: 'lg@x.com', site_id: 2, site_name: 'Canary Block',  role: 'Site worker', is_active: true, created_at: '' },
    ],
    total: 3, page: 1, page_size: 50, total_pages: 1,
  });
});

describe('useOfficeWorkerTeamData', () => {
  it('returns one member row per member', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.members).toHaveLength(4);
    expect(result.current.totalMembers).toBe(4);
  });

  it('groups active assignments per member into toolCount', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const wendy = result.current.members.find(m => m.name === 'Wendy Jones');
    expect(wendy?.toolCount).toBe(3);
    const denise = result.current.members.find(m => m.name === 'Denise Thomas');
    expect(denise?.toolCount).toBe(2);
  });

  it('totalToolsOut equals total active assignments', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalToolsOut).toBe(8);
  });

  it('joins site role + site code into metaPrimary', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const wendy = result.current.members.find(m => m.name === 'Wendy Jones');
    expect(wendy?.metaPrimary).toBe('Chelsea Wharf · Site lead');
    const denise = result.current.members.find(m => m.name === 'Denise Thomas');
    expect(denise?.metaPrimary).toBe('Office worker');
  });

  it('omits metaSecondary (BACKEND_GAP for last-scan)', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.members[0].metaSecondary).toBeUndefined();
  });

  it('onSite/hq are null (BACKEND_GAP)', async () => {
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.onSite).toBeNull();
    expect(result.current.hq).toBeNull();
  });

  it('captures error when listMembers rejects', async () => {
    mockListMembers.mockRejectedValueOnce(new Error('members boom'));
    const { result } = renderHook(() => useOfficeWorkerTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('members boom');
  });
});
