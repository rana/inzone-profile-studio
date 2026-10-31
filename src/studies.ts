import { colorDifferences, normalizeColor, validateColors } from './model';
import type { LayoutKey } from './types';

export interface PaletteStudy {
  id: string;
  name: string;
  family: 'punctuation' | 'frame' | 'palette';
  archived?: boolean;
  trial?: { status: 'liked' | 'revision-requested'; note: string };
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
    trial: { status: 'liked', note: 'Liked in one physical trial and chosen for the moment; legend readability was not separately confirmed.' },
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

/** Current command-frame refinements, plus a preserved historical comparison. */
export const FRAME_STUDIES: readonly PaletteStudy[] = [
  {
    id: 'glacier-gates-v2',
    name: 'Glacier Gates',
    family: 'frame',
    baseId: 'amber-hinge-rose',
    summary: 'White Tab and Enter; Caps returns to its original violet.',
    question: 'Do the two white command gates keep their useful distinction while Caps blends back into the violet frame?',
    changes: { TAB: '#FFFFFF', ENTER: '#FFFFFF' },
  },
  {
    id: 'glacier-union',
    name: 'Glacier Union',
    family: 'frame',
    baseId: 'amber-hinge-rose',
    summary: 'White Tab and Enter join the four white operator/path keys; Caps stays violet.',
    question: 'Do six white landmarks combine the useful gate and punctuation cues without crowding the green writing field?',
    trial: { status: 'revision-requested', note: 'In the combined trial, white Tab felt out of place; standalone Operator Ice was chosen for the moment.' },
    changes: { TAB: '#FFFFFF', ENTER: '#FFFFFF', MINUS: '#FFFFFF', PLUS: '#FFFFFF', SLASH: '#FFFFFF', BACK_SLASH: '#FFFFFF' },
  },
  {
    id: 'glacier-syntax',
    name: 'Glacier Syntax',
    family: 'frame',
    baseId: 'amber-hinge-rose',
    summary: 'White Tab and Enter contrast with azure operator/path keys; Caps stays violet.',
    question: 'Does keeping the gates white and coloring the four operator keys azure make the two roles easier to distinguish?',
    changes: { TAB: '#FFFFFF', ENTER: '#FFFFFF', MINUS: '#00A0FF', PLUS: '#00A0FF', SLASH: '#00A0FF', BACK_SLASH: '#00A0FF' },
  },
  {
    id: 'glacier-gates',
    name: 'Glacier Gates Original',
    family: 'frame',
    archived: true,
    baseId: 'amber-hinge-rose',
    summary: 'White Tab, Caps and Enter within the familiar green field and colored landmarks.',
    question: 'Does a neutral command group add a useful distinction, or draw too much attention from the green writing field?',
    trial: { status: 'revision-requested', note: 'White Tab and Enter were liked in one physical trial; Caps was requested to return to violet. Legend readability was not separately confirmed.' },
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
