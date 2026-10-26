// The pixel bots, shared by the runner game, the intro and the hero avatar. Every bot is
// 10×7 (so the runner's hitbox fits them all) with two frames so the legs shuffle, and two
// one-pixel eye holes the avatar fills with pupils.

export interface BotSprite {
  frames: [string[], string[]];
  eyes: { x: number; y: number }[];
}

export const BOTS: BotSprite[] = [
  {
    // The original invader.
    frames: [
      ['.XX....XX.', 'XXXXXXXXXX', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XX.X..X.XX', 'X........X'],
      ['.XX....XX.', 'XXXXXXXXXX', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XX.X..X.XX', '.X......X.'],
    ],
    eyes: [{ x: 2, y: 2 }, { x: 7, y: 2 }],
  },
  {
    // Antenna crab.
    frames: [
      ['..X....X..', '...XXXX...', '.XX.XX.XX.', 'XXXXXXXXXX', 'X.XXXXXX.X', 'X.X....X.X', '..XX..XX..'],
      ['..X....X..', '...XXXX...', '.XX.XX.XX.', 'XXXXXXXXXX', 'X.XXXXXX.X', 'X.X....X.X', '.XX....XX.'],
    ],
    eyes: [{ x: 3, y: 2 }, { x: 6, y: 2 }],
  },
  {
    // Tower.
    frames: [
      ['....XX....', '..XXXXXX..', '..X.XX.X..', '..XXXXXX..', 'XXXXXXXXXX', 'X.XX..XX.X', '..XX..XX..'],
      ['....XX....', '..XXXXXX..', '..X.XX.X..', '..XXXXXX..', 'XXXXXXXXXX', 'X.XX..XX.X', '.XX....XX.'],
    ],
    eyes: [{ x: 3, y: 2 }, { x: 6, y: 2 }],
  },
  {
    // Horned.
    frames: [
      ['X........X', 'XX......XX', '.XXXXXXXX.', 'XX.XXXX.XX', 'XXXXXXXXXX', '.XXXXXXXX.', '.X.X..X.X.'],
      ['X........X', 'XX......XX', '.XXXXXXXX.', 'XX.XXXX.XX', 'XXXXXXXXXX', '.XXXXXXXX.', 'X..X..X..X'],
    ],
    eyes: [{ x: 2, y: 3 }, { x: 7, y: 3 }],
  },
  {
    // Dome.
    frames: [
      ['...X..X...', '..XXXXXX..', '.XX.XX.XX.', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XX.X..X.XX', '.X......X.'],
      ['...X..X...', '..XXXXXX..', '.XX.XX.XX.', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XX.X..X.XX', 'X........X'],
    ],
    eyes: [{ x: 3, y: 2 }, { x: 6, y: 2 }],
  },
  {
    // Skull.
    frames: [
      ['..XXXXXX..', '.XXXXXXXX.', 'XXX.XX.XXX', 'XXXXXXXXXX', '.XXX..XXX.', '..XXXXXX..', '..X.XX.X..'],
      ['..XXXXXX..', '.XXXXXXXX.', 'XXX.XX.XXX', 'XXXXXXXXXX', '.XXX..XXX.', '..XXXXXX..', '...X..X...'],
    ],
    eyes: [{ x: 3, y: 2 }, { x: 6, y: 2 }],
  },
];

// The first bot's frames, for drawings that don't depend on who's looking (background bots).
export const SPRITE_FRAMES = BOTS[0].frames;

// Which bot a device gets: stable per device, and independent of its colour.
export const botFor = (deviceId: string): BotSprite => {
  let hash = 7;
  for (let i = 0; i < deviceId.length; i++) hash = (hash * 131 + deviceId.charCodeAt(i)) | 0;
  return BOTS[Math.abs(hash) % BOTS.length];
};

// Runner player ids are `${deviceId}-${tab}`; peers keep their own device's bot.
export const botForPlayer = (playerId: string) => botFor(playerId.replace(/-[a-z0-9]{4}$/, ''));
