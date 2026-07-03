import { canSubmitInvite } from '../InviteMemberSheet';

describe('canSubmitInvite', () => {
  it('requires a valid email', () => {
    expect(canSubmitInvite('', 'site_worker')).toBe(false);
    expect(canSubmitInvite('nope', 'site_worker')).toBe(false);
    expect(canSubmitInvite('a@b.com', 'site_worker')).toBe(true);
  });
  it('requires a role', () => {
    expect(canSubmitInvite('a@b.com', '')).toBe(false);
  });
  it('trims whitespace', () => {
    expect(canSubmitInvite('  a@b.com  ', 'admin')).toBe(true);
  });
});
