import { pickLastUserHolder } from '@/screens/Tools/hooks/lastHeld';

it('returns most recent assignment that had a user', () => {
  const history = [
    { assigned_at: '2026-01-01', assignee_user_id: null, assignee_user_email: '', assignee_site_id: 2, assignee_site_name: 'Depot' },
    { assigned_at: '2026-02-01', assignee_user_id: 7, assignee_user_email: 'sylvia@x.com', assignee_site_id: null, assignee_site_name: '' },
    { assigned_at: '2026-03-01', assignee_user_id: null, assignee_user_email: '', assignee_site_id: 2, assignee_site_name: 'Depot' },
  ] as any[];
  expect(pickLastUserHolder(history)).toBe('sylvia@x.com');
});
it('returns null when no user ever held it', () => {
  expect(pickLastUserHolder([{ assigned_at: '2026-01-01', assignee_user_id: null }] as any)).toBeNull();
});
