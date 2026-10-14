// Multiplayer plumbing for the runner. Players find each other through a shared lobby
// (presence) and exchange small broadcast messages. Uses Supabase Realtime when
// REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY are set; otherwise falls back to a
// BroadcastChannel, which only connects tabs of the same browser (handy for local testing).
// Nothing is stored server-side and no IP addresses are shared between players.

export type PlayerStatus = 'idle' | 'solo' | 'race';

export interface PeerMeta {
  id: string;
  color: string;
  status: PlayerStatus;
}

export type NetMessage =
  | { t: 'race'; raceId: string; seed: number; from: string }
  | { t: 'state'; raceId: string; id: string; y: number; d: number; alive: boolean };

export interface Transport {
  update(meta: PeerMeta): void;
  send(msg: NetMessage): void;
  close(): void;
}

export interface TransportHandlers {
  onPeers(peers: PeerMeta[]): void;
  onMessage(msg: NetMessage): void;
}

const LOBBY = 'runner-lobby';
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// A random per-device id kept in localStorage, so each computer/phone keeps its own colour.
export const getDeviceId = () => {
  const key = 'runner-device-id';
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const id = Math.random().toString(36).slice(2, 10);
    localStorage.setItem(key, id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
};

export const colorFor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 80%, 58%)`;
};

const connectSupabase = async (
  me: PeerMeta,
  handlers: TransportHandlers,
  url: string,
  key: string
): Promise<Transport> => {
  // Loaded on demand so the realtime client stays out of the main bundle.
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } });
  const channel = client.channel(LOBBY, {
    config: { presence: { key: me.id }, broadcast: { self: false } },
  });
  let current = me;

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PeerMeta>();
      const peers = Object.values(state)
        .map((entries) => entries[entries.length - 1])
        .filter((p): p is PeerMeta & { presence_ref: string } => !!p && p.id !== current.id);
      handlers.onPeers(peers.map(({ id, color, status }) => ({ id, color, status })));
    })
    .on('broadcast', { event: 'msg' }, ({ payload }) => handlers.onMessage(payload as NetMessage))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track(current);
    });

  return {
    update(meta) {
      current = meta;
      channel.track(meta);
    },
    send(msg) {
      channel.send({ type: 'broadcast', event: 'msg', payload: msg });
    },
    close() {
      client.removeChannel(channel);
    },
  };
};

// Same-browser fallback. Presence is emulated with heartbeats that expire.
const connectLocal = (me: PeerMeta, handlers: TransportHandlers): Transport | null => {
  if (typeof BroadcastChannel === 'undefined') return null;
  const bc = new BroadcastChannel(LOBBY);
  const peers = new Map<string, { meta: PeerMeta; seen: number }>();
  let current = me;

  const emitPeers = () => handlers.onPeers(Array.from(peers.values(), (p) => p.meta));
  const hello = () => bc.postMessage({ kind: 'hello', meta: current });

  bc.onmessage = ({ data }) => {
    if (data.kind === 'hello') {
      const known = peers.has(data.meta.id);
      peers.set(data.meta.id, { meta: data.meta, seen: Date.now() });
      if (!known) hello(); // let newcomers see us right away
      emitPeers();
    } else if (data.kind === 'bye') {
      peers.delete(data.id);
      emitPeers();
    } else if (data.kind === 'msg') {
      handlers.onMessage(data.msg);
    }
  };

  const heartbeat = window.setInterval(() => {
    hello();
    const cutoff = Date.now() - 5000;
    let changed = false;
    peers.forEach((p, id) => {
      if (p.seen < cutoff) changed = peers.delete(id);
    });
    if (changed) emitPeers();
  }, 2000);
  const bye = () => bc.postMessage({ kind: 'bye', id: current.id });
  window.addEventListener('pagehide', bye);
  hello();

  return {
    update(meta) {
      current = meta;
      hello();
    },
    send(msg) {
      bc.postMessage({ kind: 'msg', msg });
    },
    close() {
      bye();
      window.clearInterval(heartbeat);
      window.removeEventListener('pagehide', bye);
      bc.close();
    },
  };
};

export const connect = async (me: PeerMeta, handlers: TransportHandlers): Promise<Transport | null> => {
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      return await connectSupabase(me, handlers, SUPABASE_URL, SUPABASE_KEY);
    } catch {
      /* fall through to local-only play */
    }
  }
  return connectLocal(me, handlers);
};
