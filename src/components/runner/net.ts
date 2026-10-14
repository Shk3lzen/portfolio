// Multiplayer plumbing for the runner. Players find each other through a shared lobby
// (presence emulated with heartbeats) and exchange small messages over a "pipe":
//   1. in development, the local relay (`npm run relay`) if it's running;
//   2. a free public MQTT broker over secure WebSockets (EMQX, else HiveMQ) — no account needed;
//   3. a BroadcastChannel, which only connects tabs of the same browser.
// The public broker is open to anyone, so every incoming message is validated and anything
// malformed is dropped. Only ids, colours and positions are sent; never IP addresses.

export type PlayerStatus = 'idle' | 'solo' | 'race';

export interface PeerMeta {
  id: string;
  color: string;
  status: PlayerStatus;
}

export type NetMessage =
  | { t: 'race'; raceId: string; seed: number; from: string }
  // Sent by anyone playing. raceId is null outside races; go is false during a race countdown.
  | { t: 'state'; id: string; seed: number; raceId: string | null; y: number; d: number; alive: boolean; go: boolean };

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
// Everyone tries the same broker first so they meet; the second is for networks that block it.
const MQTT_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
// Separate channels so local development never mixes with visitors on the live site.
const MQTT_TOPIC = `shkelzzen.xyz/runner/v1/${process.env.NODE_ENV === 'production' ? 'live' : 'dev'}`;
const MAX_PEERS = 24;

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

// ---- validation (messages from a public channel are untrusted) -------------------------

const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9-]{1,32}$/.test(v);
const isNum = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const isColor = (v: unknown): v is string => typeof v === 'string' && /^hsl\(\d{1,3}, 80%, 58%\)$/.test(v);
const STATUSES: PlayerStatus[] = ['idle', 'solo', 'race'];

const parseMeta = (v: any): PeerMeta | null =>
  v && isId(v.id) && isColor(v.color) && STATUSES.includes(v.status) ? { id: v.id, color: v.color, status: v.status } : null;

const parseMessage = (v: any): NetMessage | null => {
  if (!v) return null;
  if (v.t === 'race' && isId(v.raceId) && isNum(v.seed, 2 ** 32) && isId(v.from)) {
    return { t: 'race', raceId: v.raceId, seed: v.seed, from: v.from };
  }
  if (
    v.t === 'state' &&
    isId(v.id) &&
    isNum(v.seed, 2 ** 32) &&
    (v.raceId === null || isId(v.raceId)) &&
    isNum(v.y, 500) &&
    isNum(v.d, 1e7) &&
    typeof v.alive === 'boolean' &&
    typeof v.go === 'boolean'
  ) {
    const { id, seed, raceId, y, d, alive, go } = v;
    return { t: 'state', id, seed, raceId, y, d, alive, go };
  }
  return null;
};

// ---- pipes: everything posted reaches every *other* participant -------------------------

interface Pipe {
  post(data: unknown): void;
  listen(handler: (data: any) => void): void;
  close(): void;
}

const broadcastChannelPipe = (): Pipe | null => {
  if (typeof BroadcastChannel === 'undefined') return null;
  const bc = new BroadcastChannel(LOBBY);
  return {
    post: (data) => bc.postMessage(data),
    listen: (handler) => {
      bc.onmessage = ({ data }) => handler(data);
    },
    close: () => bc.close(),
  };
};

// Resolves once connected, or null if the relay isn't running.
const relayPipe = (url: string): Promise<Pipe | null> =>
  new Promise((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      resolve(null);
      return;
    }
    const timer = window.setTimeout(() => ws.close(), 1500);
    ws.onerror = () => resolve(null);
    ws.onclose = () => resolve(null);
    ws.onopen = () => {
      window.clearTimeout(timer);
      resolve({
        post: (data) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(data)),
        listen: (handler) => {
          ws.onmessage = ({ data }) => {
            try {
              handler(JSON.parse(String(data)));
            } catch {
              /* ignore junk */
            }
          };
        },
        close: () => ws.close(),
      });
    };
  });

// Resolves once subscribed to the public broker, or null if it can't be reached.
const mqttPipe = async (url: string): Promise<Pipe | null> => {
  // Loaded on demand so the MQTT client stays out of the main bundle.
  // The browser build only has a default export, though the (Node) typings show named ones.
  const mqtt = await import('mqtt');
  const connect = mqtt.connect ?? (mqtt as unknown as { default: typeof mqtt }).default.connect;
  const pipeId = Math.random().toString(36).slice(2, 10);
  const client = connect(url, { protocolVersion: 5, connectTimeout: 4000, reconnectPeriod: 3000 });
  let handler: (data: any) => void = () => {};

  client.on('message', (_topic, payload) => {
    if (payload.length > 1024) return;
    try {
      const { from, data } = JSON.parse(payload.toString());
      if (from !== pipeId) handler(data);
    } catch {
      /* ignore junk */
    }
  });

  return new Promise((resolve) => {
    const fail = () => {
      client.end(true);
      resolve(null);
    };
    const timer = window.setTimeout(fail, 5000);
    client.once('connect', () => {
      // noLocal: the broker doesn't echo our own messages back (we also filter by pipeId).
      client.subscribe(MQTT_TOPIC, { qos: 0, nl: true }, (err) => {
        window.clearTimeout(timer);
        if (err) {
          fail();
          return;
        }
        resolve({
          post: (data) => client.publish(MQTT_TOPIC, JSON.stringify({ from: pipeId, data }), { qos: 0 }),
          listen: (h) => {
            handler = h;
          },
          close: () => client.end(true),
        });
      });
    });
  });
};

// Presence emulated over a pipe with heartbeats that expire.
const pipeTransport = (pipe: Pipe, me: PeerMeta, handlers: TransportHandlers): Transport => {
  const peers = new Map<string, { meta: PeerMeta; seen: number }>();
  let current = me;

  const emitPeers = () => handlers.onPeers(Array.from(peers.values(), (p) => p.meta));
  const hello = () => pipe.post({ kind: 'hello', meta: current });

  pipe.listen((data) => {
    if (!data || typeof data !== 'object') return;
    if (data.kind === 'hello') {
      const meta = parseMeta(data.meta);
      if (!meta || meta.id === current.id) return;
      const known = peers.has(meta.id);
      if (!known && peers.size >= MAX_PEERS) return;
      peers.set(meta.id, { meta, seen: Date.now() });
      if (!known) hello(); // let newcomers see us right away
      emitPeers();
    } else if (data.kind === 'bye' && isId(data.id)) {
      if (peers.delete(data.id)) emitPeers();
    } else if (data.kind === 'msg') {
      const msg = parseMessage(data.msg);
      // Only accept messages from players we know about (they said hello first).
      const sender = msg && (msg.t === 'race' ? msg.from : msg.id);
      if (msg && sender && peers.has(sender)) handlers.onMessage(msg);
    }
  });

  const heartbeat = window.setInterval(() => {
    hello();
    const cutoff = Date.now() - 5000;
    let changed = false;
    peers.forEach((p, id) => {
      if (p.seen < cutoff) changed = peers.delete(id);
    });
    if (changed) emitPeers();
  }, 2000);
  const bye = () => pipe.post({ kind: 'bye', id: current.id });
  window.addEventListener('pagehide', bye);
  hello();

  return {
    update(meta) {
      current = meta;
      hello();
    },
    send(msg) {
      pipe.post({ kind: 'msg', msg });
    },
    close() {
      bye();
      window.clearInterval(heartbeat);
      window.removeEventListener('pagehide', bye);
      pipe.close();
    },
  };
};

export const connect = async (me: PeerMeta, handlers: TransportHandlers): Promise<Transport | null> => {
  let pipe: Pipe | null = null;
  if (process.env.NODE_ENV === 'development') {
    pipe = await relayPipe(`ws://${window.location.hostname}:8787`);
  }
  for (const url of MQTT_BROKERS) {
    if (!pipe) pipe = await mqttPipe(url).catch(() => null);
  }
  if (!pipe) pipe = broadcastChannelPipe();
  return pipe && pipeTransport(pipe, me, handlers);
};
