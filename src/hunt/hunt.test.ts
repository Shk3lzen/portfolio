import { activeSeason, find, fragmentsIn, isComplete, normalizeAnswer, onFound, readFound } from './hunt';

beforeEach(() => localStorage.clear());

test('a fragment is found once and announced once', () => {
  const heard: string[] = [];
  const off = onFound((id) => heard.push(id));
  expect(find('konami')).toBe(true);
  expect(find('konami')).toBe(false);
  off();
  expect(readFound()).toEqual(['konami']);
  expect(heard).toEqual(['konami']);
});

test('a season is complete only with every fragment in it', () => {
  const season1 = fragmentsIn(1);
  season1.slice(1).forEach((f) => find(f.id));
  expect(isComplete()).toBe(false);
  find(season1[0].id);
  expect(isComplete()).toBe(true);
  expect(activeSeason()).toBe(2);
});

test("season 2 fragments don't count until season 1 is done", () => {
  expect(find('matrix')).toBe(false);
  expect(readFound()).toEqual([]);
  fragmentsIn(1).forEach((f) => find(f.id));
  expect(find('matrix')).toBe(true);
});

test('junk in storage is ignored', () => {
  localStorage.setItem('hunt-found', JSON.stringify(['404', 'nope', 7]));
  expect(readFound()).toEqual(['404']);
  localStorage.setItem('hunt-found', '{not json');
  expect(readFound()).toEqual([]);
});

test('answers ignore case, spaces and punctuation', () => {
  expect(normalizeAnswer(' Invaders, never-sleep! ')).toBe('invadersneversleep');
});
