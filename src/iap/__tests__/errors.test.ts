import { IapError } from '../errors';

describe('IapError', () => {
  it('exposes code and message', () => {
    const err = new IapError({ code: 'user_cancelled', message: 'cancelled' });
    expect(err.code).toBe('user_cancelled');
    expect(err.message).toBe('cancelled');
    expect(err).toBeInstanceOf(Error);
  });

  it('round-trips the platform original error', () => {
    const orig = new Error('boom');
    const err = new IapError({ code: 'unknown', message: 'wrap', cause: orig });
    expect(err.cause).toBe(orig);
  });
});
