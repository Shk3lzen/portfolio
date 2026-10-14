import { parseEntry, rank, ScoreEntry, TOP_N } from './leaderboard';

const DAY = '2026-10-14';
const valid = { day: DAY, name: 'Turbo Otter', color: 'hsl(120, 80%, 58%)', score: 321 };

test('accepts a well-formed entry for today', () => {
  expect(parseEntry('abc123', JSON.stringify(valid), DAY)).toEqual({
    deviceId: 'abc123',
    name: 'Turbo Otter',
    color: 'hsl(120, 80%, 58%)',
    score: 321,
  });
});

test('rejects entries from another day, bad fields, junk and cleared entries', () => {
  expect(parseEntry('abc123', JSON.stringify({ ...valid, day: '2026-10-13' }), DAY)).toBeNull();
  expect(parseEntry('abc123', JSON.stringify({ ...valid, name: '<script>' }), DAY)).toBeNull();
  expect(parseEntry('abc123', JSON.stringify({ ...valid, color: 'red; background:url(x)' }), DAY)).toBeNull();
  expect(parseEntry('abc123', JSON.stringify({ ...valid, score: 1e9 }), DAY)).toBeNull();
  expect(parseEntry('abc123', JSON.stringify({ ...valid, score: -5 }), DAY)).toBeNull();
  expect(parseEntry('ABC/../x', JSON.stringify(valid), DAY)).toBeNull();
  expect(parseEntry('abc123', 'not json', DAY)).toBeNull();
  expect(parseEntry('abc123', '', DAY)).toBeNull();
});

test('ranks best first and keeps only the top entries', () => {
  const entries: ScoreEntry[] = Array.from({ length: 15 }, (_, i) => ({
    deviceId: `d${i}`,
    name: `P${i}`,
    color: 'hsl(1, 80%, 58%)',
    score: i * 10,
  }));
  const top = rank(entries);
  expect(top).toHaveLength(TOP_N);
  expect(top[0].score).toBe(140);
  expect(top[TOP_N - 1].score).toBe(50);
});
