import { renderHook, waitFor } from '@testing-library/react-native';
import { useTeamMemberDetail } from '../useTeamMemberDetail';

const mockGetMember = jest.fn();
const mockListAssignments = jest.fn();

jest.mock('../../../../api/endpoints', () => ({
  members: { getMember: (...args: any[]) => mockGetMember(...args) },
  assignments: { listAssignments: (...args: any[]) => mockListAssignments(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMember.mockResolvedValue({
    id: 1, user_id: 200, first_name: 'Wendy', last_name: 'Jones', email: 'wj@x.com', role: 'site_worker', is_active: true, is_primary: false, joined_at: '',
  });
  mockListAssignments.mockResolvedValue({
    items: [
      { id: 1, tool_id: 11, tool_name: 'Drill', status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
      { id: 2, tool_id: 12, tool_name: 'Saw',   status: 'active', assignee_user_id: 200, assignee_user_email: 'wj@x.com', assignee_site_id: 1, assignee_site_name: 'CHW' },
    ],
    total: 2, page: 1, page_size: 50, total_pages: 1,
  });
});

describe('useTeamMemberDetail', () => {
  it('loads member name + role', async () => {
    const { result } = renderHook(() => useTeamMemberDetail(200));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.name).toBe('Wendy Jones');
    expect(result.current.role).toBe('Site worker');
  });

  it('loads assigned tools filtered by user', async () => {
    const { result } = renderHook(() => useTeamMemberDetail(200));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tools).toHaveLength(2);
    expect(mockListAssignments).toHaveBeenCalledWith({ status: 'active', user: 200 });
  });
});
