import { apiClient } from '../../client';
import * as tools from '../tools';

jest.mock('../../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('tools endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listAllTools', () => {
    // The server clamps page_size to 100; full coverage means walking pages.
    it('walks every page within the clamp', async () => {
      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: { items: [{ id: 1 }], total_pages: 2 } })
        .mockResolvedValueOnce({ data: { items: [{ id: 2 }], total_pages: 2 } });

      const items = await tools.listAllTools();

      expect(items.map((t: any) => t.id)).toEqual([1, 2]);
      expect(apiClient.get).toHaveBeenNthCalledWith(1, '/tools/', {
        params: { page: 1, page_size: 100 },
      });
      expect(apiClient.get).toHaveBeenNthCalledWith(2, '/tools/', {
        params: { page: 2, page_size: 100 },
      });
    });

    it('stops at the runaway cap', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { items: [{ id: 9 }], total_pages: 99 },
      });
      await tools.listAllTools(3);
      expect(apiClient.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('listToolCategories', () => {
    // The backend now serves the org's category catalog directly; no more
    // deriving categories from pages of full tool objects.
    it('reads GET /tools/categories/', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [
          { id: 34, name: 'Angle Grinder' },
          { id: 31, name: 'Drill' },
        ],
      });
      const res = await tools.listToolCategories();
      expect(apiClient.get).toHaveBeenCalledWith('/tools/categories/');
      expect(res).toEqual([
        { id: 34, name: 'Angle Grinder' },
        { id: 31, name: 'Drill' },
      ]);
    });
  });
});
