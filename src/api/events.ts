declare const __DEV__: boolean;

type Handler<T> = (payload: T) => void;

export type ApiEvents = {
  'session-expired': void;
  'tokens-updated': void;
  'tokens-cleared': void;
};

type EventName = keyof ApiEvents;

const listeners: { [K in EventName]: Set<Handler<ApiEvents[K]>> } = {
  'session-expired': new Set(),
  'tokens-updated': new Set(),
  'tokens-cleared': new Set(),
};

export function on<K extends EventName>(event: K, handler: Handler<ApiEvents[K]>): () => void {
  listeners[event].add(handler as Handler<ApiEvents[K]>);
  return () => {
    listeners[event].delete(handler as Handler<ApiEvents[K]>);
  };
}

export function emit<K extends EventName>(event: K, payload: ApiEvents[K]): void {
  for (const handler of listeners[event]) {
    try {
      handler(payload);
    } catch (error) {
      if (__DEV__) {
        console.error(`[api.events] handler for ${event} threw`, error);
      }
    }
  }
}
