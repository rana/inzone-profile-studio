import { colorDifferences, normalizeColor, validateColors } from './model';
import type { LayoutKey } from './types';

export interface PaletteStudy {
  id: string;
  name: string;
  family: 'punctuation' | 'frame' | 'palette';
  baseId: string;
  summary: string;
  question: string;
  changes: Readonly<Record<string, string>>;
}

/** Proposed comparisons, not accepted palettes or hardware state. */
export const PUNCTUATION_STUDIES: readonly PaletteStudy[] = [
  {
    id: 'pale-quote',
    name: 'Pale Quote',
    family: 'punctuation',
    baseId: 'amber-hinge-rose',
    summary: 'One pale aqua quote key within the green writing field.',
    question: 'Does one distinct quote key help you find it without adding visual noise?',
    changes: { QUOTE: '#C0FFFF' },
  },
  {
    id: 'operator-ice',
    name: 'Operator Ice',
    family: 'punctuation',
    baseId: 'amber-hinge-rose',
    summary: 'Four white keys mark operators, paths and escapes.',
    question: 'Does a separate punctuation group help at a glance while the green writing field stays calm?',
    changes: { MINUS: '#FFFFFF', PLUS: '#FFFFFF', SLASH: '#FFFFFF', BACK_SLASH: '#FFFFFF' },
  },
  {
    id: 'three-role-split',
    name: 'Three-Role Split',
    family: 'punctuation',
    baseId: 'amber-hinge-rose',
    summary: 'White operator/path keys, a cyan quote and chartreuse separators.',
    question: 'Do three punctuation roles add useful distinctions, or make the writing field too busy?',
    changes: {
      MINUS: '#FFFFFF', PLUS: '#FFFFFF', SLASH: '#FFFFFF', BACK_SLASH: '#FFFFFF',
      QUOTE: '#00FFFF', SEMICOLON: '#A0FF00', COMMA: '#A0FF00', PERIOD: '#A0FF00',
    },
  },
];

/** A separate command-frame question, not combined with punctuation changes. */
export const FRAME_STUDIES: readonly PaletteStudy[] = [
  {
    id: 'glacier-gates',
    name: 'Glacier Gates',
    family: 'frame',
    baseId: 'amber-hinge-rose',
    summary: 'White Tab, Caps and Enter within the familiar green field and colored landmarks.',
    question: 'Does a neutral command group add a useful distinction, or draw too much attention from the green writing field?',
    changes: { TAB: '#FFFFFF', CAP: '#FFFFFF', ENTER: '#FFFFFF' },
  },
];

/** One complete alternate mood, with role boundaries retained. */
export const ALTERNATE_STUDIES: readonly PaletteStudy[] = [
  {
    id: 'solar-draft',
    name: 'Solar Draft',
    family: 'palette',
    baseId: 'amber-hinge-rose',
    summary: 'Amber writing, a white number rail, green Win/Fn and a violet–azure–cyan crown.',
    question: 'Does a warm writing field offer an enjoyable alternate mood while the functional groups remain easy to recognize?',
    changes: {
      ...Object.fromEntries([
        ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'SPACE', 'MINUS', 'PLUS', 'BACK_SLASH',
        'SEMICOLON', 'QUOTE', 'COMMA', 'PERIOD', 'SLASH',
      ].map(key => [key, '#FFB000'])),
      ...Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`NUM_${index}`, '#FFFFFF'])),
      BRACKET_LEFT: '#FFFFFF', BRACKET_RIGHT: '#FFFFFF',
      WIN_L: '#00FF00', FN: '#00FF00',
      F1: '#4400FF', F2: '#4400FF', F3: '#4400FF', F4: '#4400FF',
      F5: '#00A0FF', F6: '#00A0FF', F7: '#00A0FF', F8: '#00A0FF',
      F9: '#00FFFF', F10: '#00FFFF', F11: '#00FFFF', F12: '#00FFFF',
    },
  },
];

export const ALL_STUDIES: readonly PaletteStudy[] = [...PUNCTUATION_STUDIES, ...FRAME_STUDIES, ...ALTERNATE_STUDIES];

/** Start from the exact published base; never mutate it or expand a patch. */
export function applyStudy(study: PaletteStudy, baseColors: Record<string, string>, layout: LayoutKey[]): Record<string, string> {
  validateColors(baseColors, layout);
  const colors = { ...baseColors };
  for (const [key, color] of Object.entries(study.changes)) {
    if (!Object.hasOwn(baseColors, key)) throw new Error(`Unknown study key: ${key}.`);
    colors[key] = normalizeColor(color);
  }
  validateColors(colors, layout);
  return colors;
}

/** Identify only an exact known proposal; this does not confer acceptance. */
export function matchingStudy(baseId: string, colors: Record<string, string>, baseColors: Record<string, string>, layout: LayoutKey[]): PaletteStudy | undefined {
  validateColors(colors, layout);
  validateColors(baseColors, layout);
  return ALL_STUDIES.find(study => study.baseId === baseId && colorDifferences(applyStudy(study, baseColors, layout), colors).length === 0);
}
