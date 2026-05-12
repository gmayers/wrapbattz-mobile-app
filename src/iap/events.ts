export type IapEventMap = {
  'purchase.started': { tierId: string };
  'purchase.success': { tierId: string };
  'purchase.failed': { tierId: string; code: string; message: string };
  'purchase.cancelled': { tierId: string };
  'subscription.changed': { source: string | null };
};

type Listener<K extends keyof IapEventMap> = (payload: IapEventMap[K]) => void;

class IapEventBus {
  private listeners: { [K in keyof IapEventMap]?: Set<Listener<K>> } = {};

  on<K extends keyof IapEventMap>(event: K, fn: Listener<K>): () => void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    (this.listeners[event] as Set<Listener<K>>).add(fn);
    return () => {
      (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(fn);
    };
  }

  emit<K extends keyof IapEventMap>(event: K, payload: IapEventMap[K]): void {
    this.listeners[event]?.forEach((fn) => {
      try {
        (fn as Listener<K>)(payload);
      } catch (e) {
        console.warn('[iapEvents] listener threw:', e);
      }
    });
  }
}

export const iapEvents = new IapEventBus();
