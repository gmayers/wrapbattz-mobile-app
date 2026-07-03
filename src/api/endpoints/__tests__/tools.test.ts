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

  describe('listToolCategories', () => {
    // The live API exposes no dedicated category lookup, so categories are
    // derived from the distinct category_id/category_name pairs on existing tools.
    const pageOf = (items: any[]) => ({
      data: { items, page: 1, page_size: 200, total: items.length, total_pages: 1 },
    });

    it('reads from GET /tools/ (no dedicated categories route exists)', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce(pageOf([]));
      await tools.listToolCategories();
      expect(apiClient.get).toHaveBeenCalledWith('/tools/', { params: { page_size: 200 } });
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
