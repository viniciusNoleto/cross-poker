// In-memory pub/sub (see game-concept.md, "Tempo real"). The channel registry lives on
// `globalThis` so publishers outside the route-handler module graph (the inactivity sweeper,
// started from `instrumentation.ts`) reach the same SSE subscribers. No `server-only` guard here
// for that same reason — route handlers import it through `libs/realtime.ts`.
type Listener = () => void;

const globalForRealtime = globalThis as typeof globalThis & { __crossPokerChannels?: Map<string, Set<Listener>> };

const channels: Map<string, Set<Listener>> = globalForRealtime.__crossPokerChannels
  ?? (globalForRealtime.__crossPokerChannels = new Map());

export function publish(channel: string) {
  channels.get(channel)?.forEach((listener) => listener());
}

export function subscribe(channel: string, listener: Listener): () => void {
  if (!channels.has(channel)) channels.set(channel, new Set());

  channels.get(channel)!.add(listener);

  return () => {
    channels.get(channel)?.delete(listener);

    if (channels.get(channel)?.size === 0) channels.delete(channel);
  };
}
