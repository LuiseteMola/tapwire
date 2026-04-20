type SseHandler = (event: MessageEvent<string>) => void;

let eventSource: EventSource | null = null;
const listeners = new Map<string, Set<SseHandler>>();

function connect() {
  const es = new EventSource('/events');
  eventSource = es;

  // Route named events to registered listeners
  for (const [name, handlers] of listeners) {
    es.addEventListener(name, (e) => {
      for (const handler of handlers) {
        handler(e as MessageEvent<string>);
      }
    });
  }

  es.onerror = () => {
    es.close();
    eventSource = null;
    setTimeout(connect, 2_000);
  };
}

export function subscribeSse(eventName: string, handler: SseHandler): void {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }
  listeners.get(eventName)!.add(handler);

  // If already connected, add listener to active EventSource
  if (eventSource) {
    eventSource.addEventListener(eventName, handler as EventListener);
  }
}

export function unsubscribeSse(eventName: string, handler: SseHandler): void {
  listeners.get(eventName)?.delete(handler);
  if (eventSource) {
    eventSource.removeEventListener(eventName, handler as EventListener);
  }
}

export function initSseConnection(): void {
  if (eventSource) {
    return;
  }
  connect();
}

export function disposeSseConnection(): void {
  eventSource?.close();
  eventSource = null;
}
