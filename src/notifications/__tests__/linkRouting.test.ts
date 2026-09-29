import { routeForLink } from '../linkRouting';

describe('routeForLink', () => {
  const officer = { isAdminOrOwner: true };
  const worker = { isAdminOrOwner: false };

  it('tool → DeviceDetails with deviceId', () => {
    expect(routeForLink({ kind: 'tool', id: 42 }, worker)).toEqual({
      name: 'DeviceDetails', params: { deviceId: 42 },
    });
  });

  it('join_request → Members for officers', () => {
    expect(routeForLink({ kind: 'join_request', id: 3 }, officer)).toEqual({ name: 'Members' });
  });

  it('join_request → inbox for everyone else (e.g. an approved requester)', () => {
    expect(routeForLink({ kind: 'join_request', id: 3 }, worker)).toEqual({ name: 'Notifications' });
  });

  it('unknown kind → inbox', () => {
    expect(routeForLink({ kind: 'transfer', id: 1 }, officer)).toEqual({ name: 'Notifications' });
  });

  it('null link → inbox', () => {
    expect(routeForLink(null, officer)).toEqual({ name: 'Notifications' });
  });
});
