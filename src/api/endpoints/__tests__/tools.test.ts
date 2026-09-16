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
    // The live API exposes no dedicated category lookup, so categories are
    // derived from the distinct category_id/category_name pairs on existing tools.
    const pageOf = (items: any[]) => ({
      data: { items, page: 1, page_size: 100, total: items.length, total_pages: 1 },
    });

    it('reads every page of GET /tools/ (no dedicated categories route exists)', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce(pageOf([]));
      await tools.listToolCategories();
      expect(apiClient.get).toHaveBeenCalledWith('/tools/', {
        params: { page: 1, page_size: 100 },
      });
    });

    it('returns distinct categories, deduped and sorted by name', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce(
        pageOf([
          { id: 1, category_id: 34, category_name: 'Angle Grinder' },
          { id: 2, category_id: 31, category_name: 'Drill' },
          { id: 3, category_id: 34, category_name: 'Angle Grinder' }, // dup
        ])
      );
      const res = await tools.listToolCategories();
      expect(res).toEqual([
        { id: 34, name: 'Angle Grinder' },
        { id: 31, name: 'Drill' },
      ]);
    });

    it('skips tools with no category', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce(
        pageOf([
          { id: 1, category_id: null, category_name: '' },
          { id: 2, category_id: 36, category_name: 'Laser Level' },
        ])
      );
      const res = await tools.listToolCategories();
      expect(res).toEqual([{ id: 36, name: 'Laser Level' }]);
    });

    it('falls back to the id when category_name is missing', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce(
        pageOf([{ id: 1, category_id: 7 }])
      );
      const res = await tools.listToolCategories();
      expect(res).toEqual([{ id: 7, name: '7' }]);
    });

    it('returns [] when there are no tools', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { items: [] } });
      const res = await tools.listToolCategories();
      expect(res).toEqual([]);
    });
  });
});
