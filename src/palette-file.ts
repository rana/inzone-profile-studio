/** Saved palette designs only; user-selected bytes never leave this tab. */
import { normalizeColor, validateColors } from './model';
import { MAX_NATIVE_BYTES, parseNativeBytes } from './native';
import type { LayoutKey } from './types';

export const MAX_PALETTE_BYTES = MAX_NATIVE_BYTES;

export interface OpenedPalette {
  name: string;
  id?: string;
  colors: Record<string, string>;
}

export class PaletteValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'PaletteValidationError'; }
}

function requirePalette(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PaletteValidationError(message);
}

function object(value: unknown, label: string): Record<string, unknown> {
  requirePalette(value !== null && typeof value === 'object' && !Array.isArray(value), `${label}: expected a JSON object.`);
  return value as Record<string, unknown>;
}

function parseBytes(bytes: Uint8Array): unknown {
  try { return parseNativeBytes(bytes); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Palette file could not be read.';
    throw new PaletteValidationError(message
      .replace(/Native export exceeds Sony's /g, 'Palette file exceeds the ')
      .replace(/Native export/g, 'Palette file')
      .replace(/Keep the original export and choose a complete Sony Web JSON file\./g, 'Choose a complete saved INZONE palette design.')
      .replace(/Choose the untouched Sony Web export\./g, 'Choose the original saved palette design.'));
  }
}

/** Reopen colors and a display name, never imported acceptance or device state. */
export function parsePaletteBytes(bytes: Uint8Array, layout: LayoutKey[]): OpenedPalette {
  const data = object(parseBytes(bytes), 'Palette file');
  requirePalette(data.schema === 'inzone-lighting-candidate/v1', 'Choose an INZONE palette design (inzone-lighting-candidate/v1), not a Sony native export.');
  requirePalette(typeof data.name === 'string' && data.name.trim().length > 0 && data.name.length <= 160 && !/[\u0000-\u001F\u007F]/.test(data.name), 'Palette name must be nonempty plain text of at most 160 characters.');
  requirePalette(data.brightness_percent === 100, 'Palette brightness_percent must be 100 to keep the saved lighting level.');
  requirePalette(!Object.hasOwn(data, 'brightness_level') || data.brightness_level === 10, 'Palette brightness_level, when present, must be 10.');
  requirePalette(!Object.hasOwn(data, 'id') || (typeof data.id === 'string' && /^[a-z0-9][a-z0-9_-]{0,127}$/i.test(data.id)), 'Palette id, when present, must be a short identifier using letters, numbers, hyphens or underscores.');

  const rawColors = object(data.key_colors, 'Palette key_colors');
  const colors: Record<string, string> = Object.fromEntries(Object.entries(rawColors).map(([key, value]) => {
    requirePalette(typeof value === 'string', `${key}: palette colors must be six-digit #RRGGBB strings.`);
    return [key, normalizeColor(value)];
  }));
  validateColors(colors, layout);

  // Explicitly project approved fields: file metadata cannot confer acceptance,
  // change mappings or enter local storage through this result.
  return { name: data.name.trim(), ...(typeof data.id === 'string' ? { id: data.id } : {}), colors };
}

export async function readPaletteFile(file: Blob, layout: LayoutKey[]): Promise<OpenedPalette> {
  requirePalette(file.size <= MAX_PALETTE_BYTES, `Palette file exceeds the ${MAX_PALETTE_BYTES.toLocaleString('en-US')}-byte limit.`);
  return parsePaletteBytes(new Uint8Array(await file.arrayBuffer()), layout);
}
