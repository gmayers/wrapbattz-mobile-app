import { renderHook, waitFor } from '@testing-library/react-native';
import { useLocationDetail } from '../useLocationDetail';

const mockGetSite = jest.fn();
const mockGetVan = jest.fn();
const mockListAssignmentsBySite = jest.fn();
const mockListSiteAssignments = jest.fn();
const mockListMembers = jest.fn();

jest.mock('../../../../api/endpoints', () => ({
  sites: { getSite: (...args: any[]) => mockGetSite(...args) },
  vans: { getVan: (...args: any[]) => mockGetVan(...args) },
  assignments: { listAssignmentsBySite: (...args: any[]) => mockListAssignmentsBySite(...args) },
  siteAssignments: { listSiteAssignments: (...args: any[]) => mockListSiteAssignments(...args) },
  members: { listMembers: (...args: any[]) => mockListMembers(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSite.mockResolvedValue({ id: 1, name: 'Chelsea Wharf', site_type: 'site', prefix_code: 'CHW-04', status: 'active' });
  mockListAssignmentsBySite.mockResolvedValue({
    items: [
      { id: 1, tool_id: 11, tool_name: 'Drill',  status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1 },
      { id: 2, tool_id: 12, tool_name: 'Saw',    status: 'active', assignee_user_id: 201, assignee_user_email: 'sw@x.com', assignee_site_id: 1 },
      { id: 3, tool_id: 13, tool_name: 'Hammer', status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1 },
    ],
    total: 3, page: 1, page_size: 50, total_pages: 1,
  });
  mockListSiteAssignments.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 });
  mockListMembers.mockResolvedValue({
    items: [
      { id: 1, user_id: 200, first_name: 'Wendy',  last_name: 'Jones',    email: 'wj@x.com', role: 'site_worker', is_active: true, is_primary: false, joined_at: '' },
      { id: 2, user_id: 201, first_name: 'Sylvia', last_name: 'Williams', email: 'sw@x.com', role: 'site_worker', is_active: true, is_primary: false, joined_at: '' },
    ],
    total: 2, page: 1, page_size: 50, total_pages: 1,
  });
});

describe('useLocationDetail (site)', () => {
  it('loads the site and renders its name + code', async () => {
    const { result } = renderHook(() => useLocationDetail(1, 'site'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.name).toBe('Chelsea Wharf');
    expect(result.current.code).toBe('CHW-04');
  });

  it('deduplicates users into the Users tab and counts tools per user', async () => {
    const { result } = renderHook(() => useLocationDetail(1, 'site'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.users).toHaveLength(2);
    const wendy = result.current.users.find(u => u.name === 'Wendy Jones');
    expect(wendy?.toolCount).toBe(2);
  });

  it('builds tools list with assignee names', async () => {
    const { result } = renderHook(() => useLocationDetail(1, 'site'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tools).toHaveLength(3);
    expect(result.current.tools[0].assigneeName).toBeDefined();
  });
});

describe('useLocationDetail (vehicle)', () => {
  beforeEach(() => {
    mockGetVan.mockResolvedValue({ id: 10, name: 'Transit Van 02', prefix_code: 'VAN-02', status: 'active' });
    mockListAssignmentsBySite.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 });
  });
  it('loads van metadata when kind is vehicle', async () => {
    const { result } = renderHook(() => useLocationDetail(10, 'vehicle'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.name).toBe('Transit Van 02');
    expect(mockGetVan).toHaveBeenCalledWith(10);
    expect(mockGetSite).not.toHaveBeenCalled();
  });
});
