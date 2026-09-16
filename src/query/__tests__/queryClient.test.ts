import Storage from 'expo-sqlite/kv-store';
import { queryClient, clearQueryCache } from '../queryClient';

describe('clearQueryCache', () => {
  it('empties the in-memory cache and removes the persisted copy', async () => {
    queryClient.setQueryData(['sites', 'legacy'], [{ id: 1 }]);
    expect(queryClient.getQueryData(['sites', 'legacy'])).toBeTruthy();

    await clearQueryCache();

    expect(queryClient.getQueryData(['sites', 'legacy'])).toBeUndefined();
    // The persisted copy on disk must go too — cached org data must not
    // survive into the next account's session.
    expect(Storage.removeItem).toHaveBeenCalledWith('tooltraq.query-cache.v1');
  });
});
