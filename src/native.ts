/**
 * Offline Sony Web-export adapter, ported from the inspected Python converter.
 * No USB, network or storage access occurs here. Native profile identity and all
 * nonlighting settings remain from the supplied source-slot export.
 */
import type { Candidate } from './types';
export type { Candidate } from './types';

export const INSPECTED_VERSION = '1.2.1.0';
export const MAX_NATIVE_BYTES = 512_000;
export const CUSTOM_SLOT = 'PALETTE_CUSTOM_COLOR1';
export const PHYSICAL_KEYS = `
ESC F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12
TILDE NUM_1 NUM_2 NUM_3 NUM_4 NUM_5 NUM_6 NUM_7 NUM_8 NUM_9 NUM_0
MINUS PLUS BACKSPACE DELETE PAGE_UP
TAB Q W E R T Y U I O P BRACKET_LEFT BRACKET_RIGHT BACK_SLASH INSERT PAGE_DOWN
CAP A S D F G H J K L SEMICOLON QUOTE ENTER
SHIFT_L Z X C V B N M COMMA PERIOD SLASH SHIFT_R ARROW_UP
CTRL_L WIN_L ALT_L SPACE ALT_R FN CTRL_R ARROW_LEFT ARROW_DOWN ARROW_RIGHT
`.trim().split(/\s+/);
export const MODE_NAMES = `
NO_LIGHT_EFFECT COLOR_CYCLE STATIC_COLOR_SINGLE_COLOR COLOR_WAVE BREATH SNAKE
REACTIVE FOUNTAIN LASER TRAFFIC RIPPLE INZONE_ORIGINAL_1 INZONE_ORIGINAL_2
PALETTE_CUSTOM_COLOR1 PALETTE_CUSTOM_COLOR2
`.trim().split(/\s+/);
const colorTypes = `NO_COLOR SINGLE_COLOR_WHITE SINGLE_COLOR_RED SINGLE_COLOR_GREEN
SINGLE_COLOR_BLUE SINGLE_COLOR_YELLOW SINGLE_COLOR_PURPLE SINGLE_COLOR_CYAN
SINGLE_CUSTOM_COLOR SINGLE_COLOR_SPECTRUM_GRADIENT SINGLE_COLOR_INZONE_GRADIENT
SEVEN_COLOR_CYCLE SPECTRUM_COLOR_CYCLE INZONE_PURPLE_COLOR_CYCLE WARM_COLOR_CYCLE COLD_COLOR_CYCLE`.split(/\s+/);
const keyTypes = `STANDARD_KEY MOUSE_BUTTON CONSUMER_KEY COMBINE_KEY MACRO_KEY
SPECIAL_KEY NO_FUNCTION DEFAULT_FUNCTION`.split(/\s+/);
const speeds = ['NO_NEED', 'LOW_SPEED', 'MIDDLE_SPEED', 'MIDDLE_HIGH_SPEED', 'HIGH_SPEED'];
const brightnesses = Array.from({ length: 11 }, (_, i) => `PERCENT_${i * 10}`);
const rgbFields = ['ColorRed', 'ColorGreen', 'ColorBlue'];
const lightFields = ['LightEffectSpeed', 'LightEffectColorType', 'SingleCustomRedValue', 'SingleCustomGreenValue', 'SingleCustomBlueValue', 'BrightnessLevel'];
const nativeFields = ['CurrentPreset', 'PresetLightingEffectInfo', 'CustomColorSettings', 'KeyAssignSettings', 'ActuationPoints', 'RapidTriggerMakePoints', 'RapidTriggerBreakPoints', 'WithFnKeyAssignSettings', 'Macro', 'ProfileName', 'Model', 'Version', 'ExportedBy'];
const candidateCore = ['name', 'brightness_percent', 'key_colors'];
const candidateMetadata = `schema created device id slot brightness_level brightness_status color_status installation_status layout lighting_effect mouse_indicator palette philosophy preserve_settings source_layout use gradient`.split(/\s+/);
const macroCodes = new Set([0, 1, 2, ...Array.from({ length: 112 }, (_, i) => i + 4), ...Array.from({ length: 5 }, (_, i) => i + 135), ...Array.from({ length: 8 }, (_, i) => i + 224)]);
const pairedKeys = [['CTRL_L', 'CTRL_R'], ['ALT_L', 'ALT_R'], ['SHIFT_L', 'SHIFT_R']] as const;

type RecordValue = Record<string, unknown>;
export type NativeProfile = RecordValue;
export interface Change { path: string; before: unknown; after: unknown }
export interface Preparation {
  profile: NativeProfile;
  changes: Change[];
  sourceProfileName: string;
  sourceVersion: string;
}
export interface Verification {
  matches: boolean;
  /** Alias for matches, for callers that present a validation result. */
  valid: boolean;
  differences: Change[];
  errors: string[];
}

export class NativeValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'NativeValidationError'; }
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new NativeValidationError(message);
}

function record(value: unknown, location: string): RecordValue {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), `${location}: expected an object`);
  const proto = Object.getPrototypeOf(value);
  requireValue(proto === Object.prototype || proto === null, `${location}: expected plain JSON data`);
  requireValue(Object.getOwnPropertySymbols(value).length === 0, `${location}: unexpected symbol fields`);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    requireValue(!descriptor.get && !descriptor.set, `${location}: expected plain JSON values`);
  }
  return value as RecordValue;
}

function exact(value: unknown, expected: readonly string[], location: string): RecordValue {
  const object = record(value, location);
  const actual = Object.keys(object);
  const wanted = new Set(expected);
  const missing = expected.filter(key => !Object.hasOwn(object, key));
  const extra = actual.filter(key => !wanted.has(key));
  requireValue(missing.length === 0 && extra.length === 0, `${location}: unknown or missing fields (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`);
  return object;
}

function integer(value: unknown, low: number, high: number, location: string): asserts value is number {
  requireValue(typeof value === 'number' && Number.isInteger(value) && value >= low && value <= high, `${location}: expected an integer from ${low} to ${high}`);
}

function choice(value: unknown, choices: readonly string[], location: string): asserts value is string {
  requireValue(typeof value === 'string' && choices.includes(value), `${location}: unsupported value`);
}

function boolean(value: unknown, location: string): void {
  requireValue(typeof value === 'boolean', `${location}: expected true or false`);
}

/** Strictly parse a file before validation; JSON.parse alone silently loses duplicate keys. */
export function parseNativeJson(text: string): unknown {
  requireValue(typeof text === 'string', 'Native export: expected JSON text');
  requireValue(new TextEncoder().encode(text).length <= MAX_NATIVE_BYTES, `Native export exceeds Sony's ${MAX_NATIVE_BYTES.toLocaleString('en-US')}-byte limit`);
  const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch { throw new NativeValidationError('Native export is not valid JSON. Keep the original export and choose a complete Sony Web JSON file.'); }
  let at = 0;
  const whitespace = () => { while (/[\t\r\n ]/.test(source[at] ?? '\0')) at++; };
  const string = (): string => {
    const start = at++;
    while (at < source.length) {
      const char = source[at++];
      if (char === '\\') at++;
      else if (char === '"') return JSON.parse(source.slice(start, at)) as string;
    }
    throw new NativeValidationError('Native export has an incomplete JSON string');
  };
  const walk = (depth: number): void => {
    requireValue(depth <= 128, 'Native export JSON is nested too deeply');
    whitespace();
    if (source[at] === '{') {
      at++; whitespace();
      const keys = new Set<string>();
      if (source[at] === '}') { at++; return; }
      while (at < source.length) {
        whitespace();
        const key = string();
        requireValue(!keys.has(key), `Duplicate JSON field: ${key}`);
        keys.add(key); whitespace(); at++; walk(depth + 1); whitespace();
        if (source[at++] === '}') return;
      }
    } else if (source[at] === '[') {
      at++; whitespace();
      if (source[at] === ']') { at++; return; }
      while (at < source.length) {
        walk(depth + 1); whitespace();
        if (source[at++] === ']') return;
      }
    } else if (source[at] === '"') { string(); }
    else { while (at < source.length && !/[\t\r\n ,}\]]/.test(source[at]!)) at++; }
  };
  walk(0);
  return parsed;
}

/** Browser-chosen file bytes stay local; invalid UTF-8 is not silently replaced. */
export function parseNativeBytes(data: Uint8Array): unknown {
  requireValue(data.byteLength <= MAX_NATIVE_BYTES, `Native export exceeds Sony's ${MAX_NATIVE_BYTES.toLocaleString('en-US')}-byte limit`);
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); }
  catch { throw new NativeValidationError('Native export is not valid UTF-8 JSON. Choose the untouched Sony Web export.'); }
  return parseNativeJson(text);
}

export async function readNativeFile(file: Blob): Promise<unknown> {
  requireValue(file.size <= MAX_NATIVE_BYTES, `Native export exceeds Sony's ${MAX_NATIVE_BYTES.toLocaleString('en-US')}-byte limit`);
  return parseNativeBytes(new Uint8Array(await file.arrayBuffer()));
}

/** The complete inspected Sony Hub for Web format, not a hardware-provenance check. */
export function validateNative(source: unknown): asserts source is NativeProfile {
  const profile = exact(source, nativeFields, 'Native profile');
  choice(profile.Model, ['INZONE KBD-H75', 'INZONE KBD-H75(US)'], 'Model');
  requireValue(profile.Version === INSPECTED_VERSION, `Version: only inspected Sony Web exporter ${INSPECTED_VERSION} is supported. A changed format must be reviewed before conversion.`);
  requireValue(profile.ExportedBy === 'Web', 'ExportedBy: use a fresh Sony Hub for Web export');
  const name = exact(profile.ProfileName, ['ProfileName'], 'ProfileName').ProfileName;
  requireValue(typeof name === 'string' && name.length <= 64, 'ProfileName: expected a string of at most 64 UTF-16 units');
  const reserved = Array.from({ length: profile.Model === 'INZONE KBD-H75(US)' ? 7 : 5 }, (_, i) => `RESERVED_${i + 1}`);
  const keys = [...PHYSICAL_KEYS, ...reserved];
  choice(profile.CurrentPreset, MODE_NAMES, 'CurrentPreset');
  const effects = exact(profile.PresetLightingEffectInfo, MODE_NAMES, 'PresetLightingEffectInfo');
  for (const mode of MODE_NAMES) {
    const location = `PresetLightingEffectInfo.${mode}`;
    const info = exact(effects[mode], lightFields, location);
    choice(info.LightEffectSpeed, speeds, `${location}.LightEffectSpeed`);
    choice(info.LightEffectColorType, colorTypes, `${location}.LightEffectColorType`);
    choice(info.BrightnessLevel, brightnesses, `${location}.BrightnessLevel`);
    for (const field of ['SingleCustomRedValue', 'SingleCustomGreenValue', 'SingleCustomBlueValue']) integer(info[field], 0, 255, `${location}.${field}`);
  }
  const colors = exact(profile.CustomColorSettings, [CUSTOM_SLOT, 'PALETTE_CUSTOM_COLOR2'], 'CustomColorSettings');
  for (const slot of [CUSTOM_SLOT, 'PALETTE_CUSTOM_COLOR2']) {
    const map = exact(colors[slot], keys, `CustomColorSettings.${slot}`);
    for (const key of keys) {
      const rgb = exact(map[key], rgbFields, `${slot}.${key}`);
      for (const field of rgbFields) integer(rgb[field], 0, 255, `${slot}.${key}.${field}`);
    }
  }
  for (const section of ['KeyAssignSettings', 'WithFnKeyAssignSettings']) {
    const assignments = exact(profile[section], [...keys, 'MUTE', 'VOLUME_UP', 'VOLUME_DOWN'], section);
    for (const key of Object.keys(assignments)) {
      const location = `${section}.${key}`;
      const assignment = exact(assignments[key], ['KeyType', 'KeyCode1', 'KeyCode2', 'KeyCode3'], location);
      choice(assignment.KeyType, keyTypes, `${location}.KeyType`);
      for (const field of ['KeyCode1', 'KeyCode2', 'KeyCode3']) integer(assignment[field], 0, 255, `${location}.${field}`);
    }
  }
  const actuation = exact(profile.ActuationPoints, keys, 'ActuationPoints');
  for (const key of keys) integer(exact(actuation[key], ['TriggerPoint'], `ActuationPoints.${key}`).TriggerPoint, 1, 34, `ActuationPoints.${key}.TriggerPoint`);
  for (const section of ['RapidTriggerMakePoints', 'RapidTriggerBreakPoints']) {
    const points = exact(profile[section], keys, section);
    for (const key of keys) {
      const point = exact(points[key], ['Enabled', 'Distance', 'PointLinked'], `${section}.${key}`);
      boolean(point.Enabled, `${section}.${key}.Enabled`);
      boolean(point.PointLinked, `${section}.${key}.PointLinked`);
      integer(point.Distance, 1, 34, `${section}.${key}.Distance`);
    }
  }
  const macros = exact(profile.Macro, Array.from({ length: 10 }, (_, i) => `MACRO_KEY${i + 1}`), 'Macro');
  for (const key of Object.keys(macros)) {
    const macro = exact(macros[key], ['MacroKeyActionsNumber', 'MacroKeyPlayTime', 'LoopTime', 'MacroKeyData'], `Macro.${key}`);
    integer(macro.MacroKeyActionsNumber, 0, 100, `${key}.MacroKeyActionsNumber`);
    integer(macro.LoopTime, 0, 100, `${key}.LoopTime`);
    choice(macro.MacroKeyPlayTime, ['PLAY_ONCE', 'PLAY_FOR_LOOP_TIME_SETTING'], `${key}.MacroKeyPlayTime`);
    const actions = macro.MacroKeyData;
    requireValue(Array.isArray(actions) && actions.length <= 100, `${key}.MacroKeyData: expected up to 100 actions`);
    requireValue(actions.length === macro.MacroKeyActionsNumber, `${key}: action count does not match data`);
    let previous: number | undefined;
    for (const item of actions) {
      const action = exact(item, ['ActionNumber', 'MacroKeyType', 'KeyStatus', 'KeyCode', 'TimeInterval'], `${key}.action`);
      integer(action.ActionNumber, 0, 100, `${key}.ActionNumber`);
      if (previous !== undefined) requireValue(action.ActionNumber === previous + 1, `${key}: nonconsecutive action numbers`);
      previous = action.ActionNumber;
      choice(action.MacroKeyType, ['KEYBOARD', 'MOUSE'], `${key}.MacroKeyType`);
      choice(action.KeyStatus, ['KEY_MAKE', 'KEY_BREAK'], `${key}.KeyStatus`);
      integer(action.KeyCode, 0, 255, `${key}.KeyCode`);
      requireValue(macroCodes.has(action.KeyCode), `${key}: unsupported macro key code`);
      integer(action.TimeInterval, 0, 60_000, `${key}.TimeInterval`);
    }
  }
  requireValue(new TextEncoder().encode(JSON.stringify(source)).length <= MAX_NATIVE_BYTES, 'Native export exceeds Sony’s import size limit');
}

export function validateCandidate(value: unknown): asserts value is Candidate {
  const candidate = record(value, 'Palette');
  const allowed = new Set([...candidateCore, ...candidateMetadata]);
  requireValue(candidateCore.every(key => Object.hasOwn(candidate, key)), 'Palette: name, brightness_percent and key_colors are required');
  requireValue(Object.keys(candidate).every(key => allowed.has(key)), 'Palette: unsupported metadata fields');
  if (Object.keys(candidate).some(key => !candidateCore.includes(key))) requireValue(candidate.schema === 'inzone-lighting-candidate/v1', 'Palette: unsupported schema');
  requireValue(typeof candidate.name === 'string' && candidate.name.length > 0 && candidate.name.length <= 64, 'Palette name must contain 1–64 characters');
  integer(candidate.brightness_percent, 10, 100, 'Palette brightness');
  requireValue(candidate.brightness_percent % 10 === 0, 'Palette brightness must use a 10% increment');
  if (Object.hasOwn(candidate, 'brightness_level')) {
    integer(candidate.brightness_level, 1, 10, 'Palette brightness_level');
    requireValue(candidate.brightness_level * 10 === candidate.brightness_percent, 'Palette brightness values disagree');
  }
  if (Object.hasOwn(candidate, 'slot')) integer(candidate.slot, 1, 4, 'Palette slot');
  if (Object.hasOwn(candidate, 'lighting_effect')) requireValue(candidate.lighting_effect === 'static custom per-key map (Custom design 1)', 'Only static Custom design 1 is supported');
  if (Object.hasOwn(candidate, 'device')) requireValue(candidate.device === 'Sony INZONE KBD-H75 / KBDG900B', 'Palette is for a different keyboard model');
  const map = exact(candidate.key_colors, PHYSICAL_KEYS, 'Palette key_colors');
  for (const key of PHYSICAL_KEYS) {
    const color = map[key];
    requireValue(typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color), `${key}: expected #RRGGBB`);
    requireValue(color.toUpperCase() !== '#000000', `${key}: black would remove this key’s illumination`);
  }
  for (const [left, right] of pairedKeys) requireValue(String(map[left]).toUpperCase() === String(map[right]).toUpperCase(), `${left}/${right}: keep paired modifier colors together`);
}

function pointer(key: string): string { return key.replace(/~/g, '~0').replace(/\//g, '~1'); }
function differences(before: unknown, after: unknown, path = ''): Change[] {
  if (Object.is(before, after)) return [];
  const beforeArray = Array.isArray(before), afterArray = Array.isArray(after);
  if (beforeArray && afterArray) {
    const changes: Change[] = [];
    for (let i = 0; i < Math.max(before.length, after.length); i++) changes.push(...differences(before[i], after[i], `${path}/${i}`));
    return changes;
  }
  if (!beforeArray && !afterArray && before !== null && after !== null && typeof before === 'object' && typeof after === 'object') {
    const left = before as RecordValue, right = after as RecordValue;
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().flatMap(key => differences(left[key], right[key], `${path}/${pointer(key)}`));
  }
  return [{ path, before, after }];
}

export function prepareNative(source: unknown, candidate: Candidate): Preparation {
  validateNative(source); validateCandidate(candidate);
  const output = JSON.parse(JSON.stringify(source)) as NativeProfile;
  output.CurrentPreset = CUSTOM_SLOT;
  const effects = record(output.PresetLightingEffectInfo, 'PresetLightingEffectInfo');
  record(effects[CUSTOM_SLOT], CUSTOM_SLOT).BrightnessLevel = `PERCENT_${candidate.brightness_percent}`;
  const maps = record(output.CustomColorSettings, 'CustomColorSettings');
  const map = record(maps[CUSTOM_SLOT], CUSTOM_SLOT);
  for (const key of PHYSICAL_KEYS) {
    const color = candidate.key_colors[key]!;
    map[key] = { ColorRed: parseInt(color.slice(1, 3), 16), ColorGreen: parseInt(color.slice(3, 5), 16), ColorBlue: parseInt(color.slice(5, 7), 16) };
  }
  validateNative(output);
  const changes = differences(source, output);
  const allowed = new Set(['/CurrentPreset', `/PresetLightingEffectInfo/${CUSTOM_SLOT}/BrightnessLevel`, ...PHYSICAL_KEYS.flatMap(key => rgbFields.map(field => `/CustomColorSettings/${CUSTOM_SLOT}/${key}/${field}`))]);
  requireValue(changes.every(change => allowed.has(change.path)), 'Conversion refused: a protected setting would change');
  requireValue(new TextEncoder().encode(JSON.stringify(output, null, 2) + '\n').length <= MAX_NATIVE_BYTES, 'Prepared profile exceeds Sony’s import size limit');
  return { profile: output, changes, sourceProfileName: record(source.ProfileName, 'ProfileName').ProfileName as string, sourceVersion: INSPECTED_VERSION };
}

/** Exact supplied-file comparison, not device provenance, slot, persistence or key-event proof. */
export function verifyNative(expected: unknown, readback: unknown): Verification {
  try {
    validateNative(expected); validateNative(readback);
    const changes = differences(expected, readback).map(change => change.path.startsWith('/Macro/') ? { ...change, before: '[macro value redacted]', after: '[macro value redacted]' } : change);
    const matches = changes.length === 0;
    return { matches, valid: matches, differences: changes, errors: [] };
  } catch (error) {
    return { matches: false, valid: false, differences: [], errors: [error instanceof Error ? error.message : 'Invalid native profile'] };
  }
}
