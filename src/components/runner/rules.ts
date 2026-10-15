// Validation shared by the browser and the score server: anything from a public channel or a
// request body is untrusted. No browser APIs here, so the server can import it too.

export const MAX_NAME_LENGTH = 14;

// Letters (any language), digits, spaces, - and _ only; trimmed and capped.
const NAME_DISALLOWED = new RegExp('[^\\p{L}\\p{N} _-]', 'gu');
export const cleanName = (raw: string) =>
  raw
    .replace(NAME_DISALLOWED, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();

export const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9-]{1,32}$/.test(v);
export const isNum = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
export const isColor = (v: unknown): v is string => typeof v === 'string' && /^hsl\(\d{1,3}, 80%, 58%\)$/.test(v);
export const isName = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && cleanName(v) === v;
