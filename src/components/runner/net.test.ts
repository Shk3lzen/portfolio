import { cleanName, defaultName, MAX_NAME_LENGTH } from './net';

test('names keep letters from any language, digits, spaces, - and _', () => {
  expect(cleanName('Shkëlzen')).toBe('Shkëlzen');
  expect(cleanName('Ђорђе_99')).toBe('Ђорђе_99');
  expect(cleanName('  Turbo   Otter ')).toBe('Turbo Otter');
});

test('names drop markup, emoji and invisible direction tricks', () => {
  expect(cleanName('<b>hi</b>')).toBe('bhib');
  expect(cleanName('Rocket 🚀')).toBe('Rocket');
  expect(cleanName('‮evil')).toBe('evil');
});

test('names are capped in length', () => {
  expect(cleanName('a'.repeat(40))).toHaveLength(MAX_NAME_LENGTH);
});

test('the default name is stable per device and already clean', () => {
  expect(defaultName('abc123')).toBe(defaultName('abc123'));
  expect(cleanName(defaultName('abc123'))).toBe(defaultName('abc123'));
});
