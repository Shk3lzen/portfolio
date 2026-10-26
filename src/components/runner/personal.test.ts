import { currentStreak, loadBestRun, loadStreak, recordPlay, saveBestRun } from './personal';
import { addCoins, buy, equip, grantAll, ITEMS, loadCosmetics } from './cosmetics';

beforeEach(() => localStorage.clear());

test('best run keeps only a better tape, and only for its day', () => {
  saveBestRun('2026-10-26', 100, [10, 10]);
  saveBestRun('2026-10-26', 50, [5]);
  expect(loadBestRun('2026-10-26')?.score).toBe(100);
  saveBestRun('2026-10-26', 120, [12]);
  expect(loadBestRun('2026-10-26')?.tape).toEqual([12]);
  expect(loadBestRun('2026-10-27')).toBeNull();
});

test('streaks grow day by day and reset after a gap', () => {
  recordPlay('2026-10-24');
  recordPlay('2026-10-25');
  recordPlay('2026-10-25');
  expect(loadStreak().count).toBe(2);
  expect(currentStreak(loadStreak(), '2026-10-26')).toBe(2);
  expect(currentStreak(loadStreak(), '2026-10-28')).toBe(0);
  recordPlay('2026-10-28');
  expect(loadStreak().count).toBe(1);
});

test('coins buy and equip cosmetics', () => {
  expect(buy('party').owned).toEqual([]); // can't afford it yet
  addCoins(20);
  const after = buy('party');
  expect(after.wallet).toBe(5);
  expect(after.hat).toBe('party');
  expect(equip('party').hat).toBeNull(); // wearing it again takes it off
  expect(buy('party').wallet).toBe(5); // already owned: no charge
});

test('the season 2 prize owns everything', () => {
  expect(grantAll().owned).toHaveLength(ITEMS.length);
  expect(loadCosmetics().wallet).toBe(0);
});
