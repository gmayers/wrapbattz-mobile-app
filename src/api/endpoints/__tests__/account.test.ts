import { apiClient } from '../../client';
import * as account from '../account';

jest.mock('../../client', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

describe('account endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('requestEmailChange', () => {
    it('POSTs /account/email/change/ with the new address', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { requested: true } });

      const result = await account.requestEmailChange({ new_email: 'new@example.com' });

      expect(apiClient.post).toHaveBeenCalledWith('/account/email/change/', {
        new_email: 'new@example.com',
      });
      expect(result).toEqual({ requested: true });
    });
  });

  describe('confirmEmailChange', () => {
    it('POSTs /account/email/confirm/ with the code', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { email: 'new@example.com' },
      });

      const result = await account.confirmEmailChange({ code: '123456' });

      expect(apiClient.post).toHaveBeenCalledWith('/account/email/confirm/', {
        code: '123456',
      });
      expect(result).toEqual({ email: 'new@example.com' });
    });
  });

  describe('updateMe', () => {
    it('PATCHes /account/ with exactly the payload given (no implicit email key)', async () => {
      (apiClient.patch as jest.Mock).mockResolvedValueOnce({ data: {} });

      await account.updateMe({ first_name: 'A', last_name: 'B', phone_number: '1' });

      expect(apiClient.patch).toHaveBeenCalledWith('/account/', {
        first_name: 'A',
        last_name: 'B',
        phone_number: '1',
      });
    });
  });
});
