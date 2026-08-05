import 'server-only';

type Listener = () => void;

const channels = new Map<string, Set<Listener>>();

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
