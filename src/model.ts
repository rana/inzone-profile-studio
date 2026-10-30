import type { Candidate, LayoutKey } from './types';

export const PAIRED_KEYS: ReadonlyArray<readonly [string, string]> = [
  ['CTRL_L', 'CTRL_R'], ['ALT_L', 'ALT_R'], ['SHIFT_L', 'SHIFT_R'],
];

export function normalizeColor(value: string): string {
  const color = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) throw new Error('Use a six-digit color, such as #FFB000.');
  if (color === '#000000') throw new Error('Keep this key illuminated. Choose a color brighter than black.');
  return color;
}

export function recolor(colors: Record<string, string>, keys: string[], value: string): Record<string, string> {
  const color = normalizeColor(value);
  const changed = { ...colors };
  const all = new Set(keys);
  for (const pair of PAIRED_KEYS) if (pair.some(key => all.has(key))) pair.forEach(key => all.add(key));
  for (const key of all) {
    if (!(key in changed)) throw new Error(`Unknown physical key: ${key}.`);
    changed[key] = color;
  }
  return changed;
}

export function validateColors(colors: Record<string, string>, layout: LayoutKey[]): void {
  const ids = new Set(layout.map(key => key.id));
  if (ids.size !== 81 || Object.keys(colors).length !== 81 || Object.keys(colors).some(key => !ids.has(key))) {
    throw new Error('The palette must cover all 81 keys in this keyboard layout.');
  }
  Object.values(colors).forEach(normalizeColor);
  for (const [a, b] of PAIRED_KEYS) if (colors[a] !== colors[b]) throw new Error('Keep both Ctrl, Alt and Shift pairs the same color.');
}

export function colorDifferences(a: Record<string, string>, b: Record<string, string>): string[] {
  return Object.keys(a).filter(key => a[key] !== b[key]);
}

export function makeCandidate(base: Candidate, colors: Record<string, string>, layout: LayoutKey[]): Candidate {
  validateColors(colors, layout);
  const changed = colorDifferences(base.key_colors, colors).length > 0;
  return {
    schema: 'inzone-lighting-candidate/v1',
    id: changed ? `${base.id || 'profile'}-draft` : (base.id || 'profile'),
    name: changed ? `${base.name} — my variation` : base.name,
    brightness_percent: 100,
    brightness_level: 10,
    key_colors: { ...colors },
  };
}

export function shareUrl(url: string, profileId: string, colors: Record<string, string>, original: Record<string, string>): string {
  const target = new URL(url);
  target.search = '';
  target.hash = '';
  target.searchParams.set('profile', profileId);
  const changes = colorDifferences(original, colors).map(key => `${key}.${colors[key]!.slice(1)}`);
  if (changes.length) target.searchParams.set('colors', changes.join(','));
  return target.href;
}

export function colorsFromUrl(url: string, original: Record<string, string>, layout: LayoutKey[]): Record<string, string> {
  const value = new URL(url).searchParams.get('colors');
  if (!value) return { ...original };
  if (value.length > 2000) throw new Error('This shared variation is too large.');
  let colors = { ...original };
  const seen = new Set<string>();
  for (const entry of value.split(',')) {
    const [key, color, extra] = entry.split('.');
    if (!key || !color || extra || seen.has(key) || !(key in colors)) throw new Error('This shared variation contains an unknown or repeated key.');
    seen.add(key);
    colors[key] = normalizeColor(`#${color}`);
  }
  validateColors(colors, layout);
  return colors;
}
