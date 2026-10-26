import { morseTimeline } from './morse';

test('the timeline spells the word in dots and dashes', () => {
  const signals = morseTimeline('ROBOT')
    .filter((s) => s.on)
    .map((s) => (s.units === 1 ? '.' : '-'))
    .join('');
  expect(signals).toBe('.-.----...----'); // R O B O T
});
