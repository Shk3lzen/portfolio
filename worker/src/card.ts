// The 1200×630 share image: the player's invader on the runner's ground line, beside
// "I SCORED 1240 — CAN YOU BEAT ME?" in a pixel font, in the site's navy-and-teal palette.
import { SPRITE_FRAMES } from '../../src/components/runner/sprite';
import { drawText, textWidth } from './font';
import { Bitmap, Rgb, encodePng } from './png';

export const CARD_W = 1200;
export const CARD_H = 630;

const BG = 0;
const PANEL = 1;
const ACCENT = 2;
const HEADING = 3;
const TEXT = 4;
const PLAYER = 5;
const EYE = 6;
const GROUND = 7;

// 'hsl(200, 80%, 58%)' → [r, g, b]
const hslToRgb = (color: string): Rgb => {
  const m = /^hsl\((\d{1,3}), (\d{1,3})%, (\d{1,3})%\)$/.exec(color);
  if (!m) return [100, 255, 218];
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((v) => Math.round(v * 255)) as Rgb;
};

export interface CardRun {
  name: string;
  color: string;
  score: number;
  day: string;
}

export const renderCard = async (run: CardRun) => {
  const bmp = new Bitmap(CARD_W, CARD_H, BG);
  const groundY = 500;

  // Accent bar and the site's handle.
  bmp.rect(0, 0, CARD_W, 10, ACCENT);
  drawText(bmp, 'SHKELZZEN.XYZ', 80, 70, 5, ACCENT);
  const dayLabel = `DAILY RUN ${run.day}`;
  drawText(bmp, dayLabel, CARD_W - 80 - textWidth(dayLabel, 4), 74, 4, TEXT);

  // Ground line with a couple of posts, like the game.
  bmp.rect(60, groundY, CARD_W - 120, 6, GROUND);
  bmp.rect(392, groundY - 84, 30, 84, PANEL);
  bmp.rect(400, groundY - 84, 14, 84, TEXT);

  // The invader, eyes open, looking at its score.
  const px = 22;
  const sprite = SPRITE_FRAMES[0];
  const sx = 110;
  const sy = groundY - sprite.length * px;
  sprite.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'X') bmp.rect(sx + x * px, sy + y * px, px, px, PLAYER);
  });
  for (const ex of [2, 7]) {
    bmp.rect(sx + ex * px, sy + 2 * px, px, px, EYE);
    bmp.rect(sx + ex * px + px / 2, sy + 2 * px + px / 4, px / 2, px / 2, BG);
  }

  // The message.
  const textX = 500;
  drawText(bmp, 'I SCORED', textX, 170, 7, HEADING);
  drawText(bmp, String(run.score), textX, 245, 20, ACCENT);
  drawText(bmp, 'CAN YOU BEAT ME?', textX, 410, 6, HEADING);
  drawText(bmp, `PLAYED BY ${run.name}`, 80, 545, 4, TEXT);

  const palette: Rgb[] = [
    [10, 25, 47], // BG #0a192f
    [17, 34, 64], // PANEL #112240
    [100, 255, 218], // ACCENT #64ffda
    [204, 214, 246], // HEADING #ccd6f6
    [136, 146, 176], // TEXT #8892b0
    hslToRgb(run.color), // PLAYER
    [248, 250, 252], // EYE
    [35, 53, 84], // GROUND #233554
  ];
  return encodePng(CARD_W, CARD_H, bmp.pixels, palette);
};
