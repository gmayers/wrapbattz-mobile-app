import type { AxiosError } from 'axios';
import { fromAxiosError } from '../errors';

function axiosError(code: string): AxiosError {
  return Object.assign(new Error('boom'), { isAxiosError: true, code }) as AxiosError;
}

describe('fromAxiosError', () => {
  it('maps ECONNABORTED to timeout', () => {
    expect(fromAxiosError(axiosError('ECONNABORTED')).code).toBe('timeout');
  });

  it('maps ETIMEDOUT to timeout', () => {
    expect(fromAxiosError(axiosError('ETIMEDOUT')).code).toBe('timeout');
  });

  it('maps other no-response errors to network', () => {
    expect(fromAxiosError(axiosError('ERR_NETWORK')).code).toBe('network');
  });
});
