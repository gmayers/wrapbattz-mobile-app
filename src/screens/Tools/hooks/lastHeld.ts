import type { AssignmentRead } from '../../../api/types';

export function pickLastUserHolder(history: AssignmentRead[]): string | null {
  const withUser = history
    .filter((h) => h.assignee_user_id != null)
    .sort((a, b) => String(b.assigned_at ?? '').localeCompare(String(a.assigned_at ?? '')));
  return withUser.length ? (withUser[0].assignee_user_email || null) : null;
}

// Concurrency-capped, session-cached enrichment. Resolves last user-holder per tool.
const cache = new Map<number, string | null>();
export async function enrichLastHeld(
  toolIds: number[],
  getHistory: (id: number) => Promise<{ items: AssignmentRead[] }>,
  onResolved: (toolId: number, lastHeld: string | null) => void,
  limit = 4,
): Promise<void> {
  // Re-emit cached hits immediately.
  for (const id of toolIds) if (cache.has(id)) onResolved(id, cache.get(id) ?? null);
  const queue = toolIds.filter((id) => !cache.has(id));
  let i = 0;
  async function worker() {
    while (i < queue.length) {
      const id = queue[i++];
      try {
        const page = await getHistory(id);
        const name = pickLastUserHolder(page.items ?? []);
        cache.set(id, name);
        onResolved(id, name);
      } catch {
        cache.set(id, null);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}
