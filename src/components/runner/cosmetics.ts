// Coins saved across runs buy cosmetics for your own bot: a hat on top and a trail behind.
// Purely local and purely for looks — other players still see your plain bot, and nothing
// here touches the simulation, so replays and scores are unaffected.

export type HatId = 'party' | 'cap' | 'halo' | 'crown';
export type TrailId = 'sparkle' | 'rainbow';
export type ItemId = HatId | TrailId;

export interface Item {
  id: ItemId;
  slot: 'hat' | 'trail';
  name: string;
  cost: number;
}

export const ITEMS: Item[] = [
  { id: 'party', slot: 'hat', name: 'Party hat', cost: 15 },
  { id: 'cap', slot: 'hat', name: 'Cap', cost: 25 },
  { id: 'halo', slot: 'hat', name: 'Halo', cost: 40 },
  { id: 'crown', slot: 'hat', name: 'Crown', cost: 60 },
  { id: 'sparkle', slot: 'trail', name: 'Sparkle trail', cost: 30 },
  { id: 'rainbow', slot: 'trail', name: 'Rainbow trail', cost: 80 },
];

// Pixel art on the bot's 10-wide grid, bottom row sitting just above its head.
// Each character is a colour key into the hat's palette; '.' is empty.
export const HATS: Record<HatId, { rows: string[]; palette: Record<string, string> }> = {
  party: {
    rows: ['....a.....', '....b.....', '...bcb....', '..bcbcb...'],
    palette: { a: '#facc15', b: '#ec4899', c: '#38bdf8' },
  },
  cap: {
    rows: ['..aaaaa...', '.aaaaaaabb'],
    palette: { a: '#2563eb', b: '#1e3a8a' },
  },
  halo: {
    rows: ['..aaaaaa..', '.a......a.', '..aaaaaa..', '..........'],
    palette: { a: '#fde68a' },
  },
  crown: {
    rows: ['.a..a..a..', '.aa.aa.aa.', '.abaaaaba.', '.aaaaaaaa.'],
    palette: { a: '#f2b705', b: '#ef4444' },
  },
};

const RAINBOW = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
export const rainbowColor = (i: number) => RAINBOW[i % RAINBOW.length];

interface Saved {
  wallet: number;
  owned: ItemId[];
  hat: HatId | null;
  trail: TrailId | null;
}

const KEY = 'runner-cosmetics';
const EMPTY: Saved = { wallet: 0, owned: [], hat: null, trail: null };
const VALID = new Set<string>(ITEMS.map((i) => i.id));

export const loadCosmetics = (): Saved => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!v || typeof v !== 'object') return { ...EMPTY };
    const owned = Array.isArray(v.owned) ? (v.owned.filter((id: unknown) => typeof id === 'string' && VALID.has(id)) as ItemId[]) : [];
    const has = (id: unknown) => typeof id === 'string' && owned.includes(id as ItemId);
    return {
      wallet: Number.isFinite(v.wallet) && v.wallet > 0 ? Math.floor(v.wallet) : 0,
      owned,
      hat: has(v.hat) && v.hat in HATS ? v.hat : null,
      trail: has(v.trail) && (v.trail === 'sparkle' || v.trail === 'rainbow') ? v.trail : null,
    };
  } catch {
    return { ...EMPTY };
  }
};

const save = (s: Saved) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  return s;
};

export const addCoins = (n: number) => {
  const s = loadCosmetics();
  return save({ ...s, wallet: s.wallet + Math.max(0, Math.floor(n)) });
};

// Buys an item (if affordable and not owned) and equips it.
export const buy = (id: ItemId) => {
  const s = loadCosmetics();
  const item = ITEMS.find((i) => i.id === id);
  if (!item || s.owned.includes(id) || s.wallet < item.cost) return s;
  return equip(id, save({ ...s, wallet: s.wallet - item.cost, owned: [...s.owned, id] }));
};

// Equips an owned item, or takes it off if it's already on.
export const equip = (id: ItemId, s = loadCosmetics()) => {
  const item = ITEMS.find((i) => i.id === id);
  if (!item || !s.owned.includes(id)) return s;
  if (item.slot === 'hat') return save({ ...s, hat: s.hat === id ? null : (id as HatId) });
  return save({ ...s, trail: s.trail === id ? null : (id as TrailId) });
};

// The season 2 treasure-hunt prize: owns everything (keeps what's equipped).
export const grantAll = () => {
  const s = loadCosmetics();
  if (ITEMS.every((i) => s.owned.includes(i.id))) return s;
  return save({ ...s, owned: ITEMS.map((i) => i.id) });
};
