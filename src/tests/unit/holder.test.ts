import { toLegacyAssignment } from '@/api/adapters';

const base = {
  id: 1, uuid: 'u', tool_id: 9, tool_name: 'Drill',
  assigned_at: null, returned_at: null, status: 'active', condition: '', notes: '',
  assignee_user_id: null, assignee_user_email: '',
  assignee_site_id: null, assignee_site_name: '',
} as any;

describe('toLegacyAssignment holder', () => {
  it('user-held → holder.kind user', () => {
    const a = toLegacyAssignment({ ...base, assignee_user_id: 5, assignee_user_email: 'wendy@x.com' });
    expect(a.holder).toEqual({ kind: 'user', name: 'wendy@x.com' });
  });
  it('site-held → holder.kind site', () => {
    const a = toLegacyAssignment({ ...base, assignee_site_id: 3, assignee_site_name: 'Depot A' });
    expect(a.holder).toEqual({ kind: 'site', name: 'Depot A' });
  });
  it('user takes precedence over site when both present', () => {
    const a = toLegacyAssignment({ ...base, assignee_user_id: 5, assignee_user_email: 'w@x.com', assignee_site_id: 3, assignee_site_name: 'Depot A' });
    expect(a.holder).toEqual({ kind: 'user', name: 'w@x.com' });
  });
  it('unassigned → holder null', () => {
    expect(toLegacyAssignment(base).holder).toBeNull();
  });
  it('user id present but email omitted → holder kind user with empty name', () => {
    const a = toLegacyAssignment({ ...base, assignee_user_id: 5, assignee_user_email: '' });
    expect(a.holder).toEqual({ kind: 'user', name: '' });
  });
});
