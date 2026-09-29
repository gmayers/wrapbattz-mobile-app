import { apiClient } from '../../client';
import * as transfers from '../transfers';

jest.mock('../../client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const transfer = { id: 7, tool_id: 3, tool_name: 'Drill', status: 'pending' };

describe('transfer endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST /assignments/transfers/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: transfer });
    const payload = { tool_id: 3, to_user_id: 12, note: '' };
    await expect(transfers.createTransfer(payload)).resolves.toEqual(transfer);
    expect(apiClient.post).toHaveBeenCalledWith('/assignments/transfers/', payload);
  });

  it('GET /assignments/transfers/pending/', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [transfer] });
    await expect(transfers.listPendingForMe()).resolves.toEqual([transfer]);
    expect(apiClient.get).toHaveBeenCalledWith('/assignments/transfers/pending/');
  });

  it('GET /assignments/transfers/ with a status filter', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { items: [] } });
    await transfers.listTransfers('pending');
    expect(apiClient.get).toHaveBeenCalledWith('/assignments/transfers/', {
      params: { status: 'pending' },
    });
  });

  it.each([
    ['acceptTransfer', 'accept'],
    ['declineTransfer', 'decline'],
    ['cancelTransfer', 'cancel'],
  ] as const)('%s posts to /%s/', async (fn, action) => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: transfer });
    await expect(transfers[fn](7)).resolves.toEqual(transfer);
    expect(apiClient.post).toHaveBeenCalledWith(`/assignments/transfers/7/${action}/`);
  });

  it('surfaces client errors', async () => {
    const err = new Error('transfer_pending');
    (apiClient.post as jest.Mock).mockRejectedValueOnce(err);
    await expect(transfers.createTransfer({ tool_id: 3, to_user_id: 12, note: '' })).rejects.toBe(err);
  });
});
