import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { colorDifferences, colorsFromUrl, makeCandidate, publicShareUrl, validateColors } from './model';
import { parsePaletteBytes } from './palette-file';
import { ALL_STUDIES, ALTERNATE_STUDIES, applyStudy, FRAME_STUDIES, matchingStudy, PUNCTUATION_STUDIES } from './studies';
import type { PaletteStudy } from './studies';
import type { Candidate, LayoutKey } from './types';

const layout = (JSON.parse(readFileSync(new URL('../public/data/layout.json', import.meta.url), 'utf8')) as { keys: LayoutKey[] }).keys;
const base = JSON.parse(readFileSync(new URL('../public/data/palettes/amber-hinge-rose.json', import.meta.url), 'utf8')) as Candidate;

const expectedChanges: Record<string, Record<string, string>> = {
  'pale-quote': { QUOTE: '#C0FFFF' },
  'operator-ice': { MINUS: '#FFFFFF', PLUS: '#FFFFFF', SLASH: '#FFFFFF', BACK_SLASH: '#FFFFFF' },
  'three-role-split': {
    MINUS: '#FFFFFF', PLUS: '#FFFFFF', SLASH: '#FFFFFF', BACK_SLASH: '#FFFFFF',
    QUOTE: '#00FFFF', SEMICOLON: '#A0FF00', COMMA: '#A0FF00', PERIOD: '#A0FF00',
  },
};

test('documented punctuation studies change exactly 1, 4 and 8 keys without altering the base', () => {
  const untouched = structuredClone(base.key_colors);
  assert.deepEqual(PUNCTUATION_STUDIES.map(study => study.id), Object.keys(expectedChanges));
  for (const study of PUNCTUATION_STUDIES) {
    assert.equal(study.family, 'punctuation');
    assert.equal(study.baseId, base.id);
    assert.deepEqual(study.changes, expectedChanges[study.id]);
    const colors = applyStudy(study, base.key_colors, layout);
    assert.notEqual(colors, base.key_colors);
    assert.deepEqual(colorDifferences(untouched, colors).sort(), Object.keys(expectedChanges[study.id]!).sort());
    for (const key of Object.keys(colors)) assert.equal(colors[key], expectedChanges[study.id]![key] || untouched[key]);
    assert.equal(Object.keys(colors).length, 81);
    assert.equal(Object.values(colors).every(color => color !== '#000000'), true);
    validateColors(colors, layout);
    assert.equal(colors.CTRL_L, colors.CTRL_R);
    assert.equal(colors.ALT_L, colors.ALT_R);
    assert.equal(colors.SHIFT_L, colors.SHIFT_R);
  }
  assert.deepEqual(base.key_colors, untouched);
});

test('the archived three-key Glacier Gates retains its exact colors and old URL identity', () => {
  assert.deepEqual(FRAME_STUDIES.map(study => study.id), ['glacier-gates-v2', 'glacier-union', 'glacier-syntax', 'glacier-gates']);
  const study = FRAME_STUDIES.find(study => study.id === 'glacier-gates')!;
  assert.equal(study.id, 'glacier-gates');
  assert.equal(study.name, 'Glacier Gates Original');
  assert.equal(study.archived, true);
  assert.equal(study.family, 'frame');
  assert.equal(study.baseId, base.id);
  assert.deepEqual(study.changes, { TAB: '#FFFFFF', CAP: '#FFFFFF', ENTER: '#FFFFFF' });
  const original = structuredClone(base.key_colors);
  const colors = applyStudy(study, base.key_colors, layout);
  assert.deepEqual(colorDifferences(original, colors).sort(), ['CAP', 'ENTER', 'TAB']);
  for (const key of Object.keys(original)) assert.equal(colors[key], ['CAP', 'ENTER', 'TAB'].includes(key) ? '#FFFFFF' : original[key]);
  assert.deepEqual(base.key_colors, original);
  validateColors(colors, layout);
  assert.equal(Object.keys(colors).length, 81);
  assert.equal(Object.values(colors).every(color => color !== '#000000'), true);
  const sortedColors = Object.fromEntries(Object.keys(colors).sort().map(key => [key, colors[key]]));
  assert.equal(createHash('sha256').update(JSON.stringify(sortedColors)).digest('hex'), 'f01f5700e06ec56b049f64c4c08aecae20d0c480c53decb74e05cf7f2df8a686');
  const oldUrl = 'https://rana.github.io/inzone-profile-studio/?profile=amber-hinge-rose&colors=TAB.FFFFFF%2CCAP.FFFFFF%2CENTER.FFFFFF';
  const oldColors = colorsFromUrl(oldUrl, base.key_colors, layout);
  assert.deepEqual(oldColors, colors);
  assert.equal(matchingStudy(base.id!, oldColors, base.key_colors, layout)?.id, study.id);
  assert.equal(new Set(ALL_STUDIES.map(item => item.id)).size, ALL_STUDIES.length);
  assert.deepEqual(ALL_STUDIES, [...PUNCTUATION_STUDIES, ...FRAME_STUDIES, ...ALTERNATE_STUDIES]);
});

test('current Glacier refinements change exactly 2, 6 and 6 keys while Caps and all other keys retain the keeper colors', () => {
  const expected: Record<string, Record<string, string>> = {
    'glacier-gates-v2': { TAB: '#FFFFFF', ENTER: '#FFFFFF' },
    'glacier-union': { TAB: '#FFFFFF', ENTER: '#FFFFFF', MINUS: '#FFFFFF', PLUS: '#FFFFFF', SLASH: '#FFFFFF', BACK_SLASH: '#FFFFFF' },
    'glacier-syntax': { TAB: '#FFFFFF', ENTER: '#FFFFFF', MINUS: '#00A0FF', PLUS: '#00A0FF', SLASH: '#00A0FF', BACK_SLASH: '#00A0FF' },
  };
  const original = structuredClone(base.key_colors);
  const active = FRAME_STUDIES.filter(study => !study.archived);
  assert.deepEqual(active.map(study => study.id), Object.keys(expected));
  for (const study of active) {
    assert.deepEqual(study.changes, expected[study.id]);
    const colors = applyStudy(study, base.key_colors, layout);
    const changedKeys = Object.keys(expected[study.id]!);
    assert.deepEqual(colorDifferences(original, colors).sort(), changedKeys.sort());
    assert.equal(Object.keys(original).length - changedKeys.length, study.id === 'glacier-gates-v2' ? 79 : 75);
    for (const key of Object.keys(original)) assert.equal(colors[key], expected[study.id]![key] || original[key]);
    assert.equal(colors.CAP, '#B000FF');
    validateColors(colors, layout);
    assert.equal(Object.keys(colors).length, 81);
    assert.equal(Object.values(colors).every(color => color !== '#000000'), true);
    assert.equal(colors.CTRL_L, colors.CTRL_R);
    assert.equal(colors.ALT_L, colors.ALT_R);
    assert.equal(colors.SHIFT_L, colors.SHIFT_R);
  }
  assert.deepEqual(base.key_colors, original);
  const union = applyStudy(active.find(study => study.id === 'glacier-union')!, original, layout);
  const syntax = applyStudy(active.find(study => study.id === 'glacier-syntax')!, original, layout);
  assert.deepEqual(colorDifferences(union, syntax).sort(), ['BACK_SLASH', 'MINUS', 'PLUS', 'SLASH']);
});

test('all three current Glacier candidate files and documented previews match their complete study colors', () => {
  const document = readFileSync(new URL('../docs/FRAME-STUDIES.md', import.meta.url), 'utf8');
  for (const study of FRAME_STUDIES.filter(study => !study.archived)) {
    const candidate = JSON.parse(readFileSync(new URL(`../public/data/studies/${study.id}.json`, import.meta.url), 'utf8')) as Candidate;
    const colors = applyStudy(study, base.key_colors, layout);
    assert.deepEqual(candidate.key_colors, colors);
    assert.equal(candidate.id, 'amber-hinge-rose-draft');
    assert.equal(candidate.name, study.name);
    assert.equal(candidate.brightness_percent, 100);
    assert.equal(candidate.brightness_level, 10);
    assert.equal(Object.hasOwn(candidate, 'acceptance'), false);
    assert.equal(Object.hasOwn(candidate, 'status'), false);
    const reopened = parsePaletteBytes(new TextEncoder().encode(JSON.stringify(candidate)), layout);
    assert.equal(reopened.id, 'amber-hinge-rose-draft');
    assert.deepEqual(reopened.colors, colors);
    assert.equal(matchingStudy(base.id!, reopened.colors, base.key_colors, layout)?.id, study.id);
    const preview = document.match(new RegExp(`\\[Preview ${study.name}\\]\\(([^)]+)\\)`))?.[1];
    assert.ok(preview, `${study.name} has a documented preview link.`);
    assert.deepEqual(colorsFromUrl(preview, base.key_colors, layout), colors);
  }
});

test('Solar Draft defines a complete alternate mood with exactly 61 changed and 20 preserved keys', () => {
  assert.equal(ALTERNATE_STUDIES.length, 1);
  const study = ALTERNATE_STUDIES[0]!;
  assert.equal(study.id, 'solar-draft');
  assert.equal(study.family, 'palette');
  assert.equal(study.baseId, base.id);
  const original = structuredClone(base.key_colors);
  const colors = applyStudy(study, base.key_colors, layout);
  const expectedRoles: Array<[string[], string]> = [
    [[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'SPACE', 'MINUS', 'PLUS', 'BACK_SLASH', 'SEMICOLON', 'QUOTE', 'COMMA', 'PERIOD', 'SLASH'], '#FFB000'],
    [['NUM_0', 'NUM_1', 'NUM_2', 'NUM_3', 'NUM_4', 'NUM_5', 'NUM_6', 'NUM_7', 'NUM_8', 'NUM_9', 'BRACKET_LEFT', 'BRACKET_RIGHT'], '#FFFFFF'],
    [['WIN_L', 'FN'], '#00FF00'],
    [['F1', 'F2', 'F3', 'F4'], '#4400FF'],
    [['F5', 'F6', 'F7', 'F8'], '#00A0FF'],
    [['F9', 'F10', 'F11', 'F12'], '#00FFFF'],
  ];
  const expectedPatch = Object.fromEntries(expectedRoles.flatMap(([keys, color]) => keys.map(key => [key, color])));
  assert.deepEqual(study.changes, expectedPatch);
  assert.equal(Object.keys(expectedPatch).length, 61);
  assert.deepEqual(colorDifferences(original, colors).sort(), Object.keys(expectedPatch).sort());
  const retained = Object.keys(original).filter(key => !Object.hasOwn(expectedPatch, key));
  assert.equal(retained.length, 20);
  for (const key of retained) assert.equal(colors[key], original[key]);
  assert.deepEqual(base.key_colors, original);
  validateColors(colors, layout);
  assert.equal(Object.keys(colors).length, 81);
  assert.equal(Object.values(colors).every(color => color !== '#000000'), true);
  assert.equal(colors.CTRL_L, colors.CTRL_R);
  assert.equal(colors.ALT_L, colors.ALT_R);
  assert.equal(colors.SHIFT_L, colors.SHIFT_R);
});

test('the downloadable Solar Draft candidate exactly matches the study and restores its reference identity', () => {
  const candidate = JSON.parse(readFileSync(new URL('../public/data/studies/solar-draft.json', import.meta.url), 'utf8')) as Candidate;
  const study = ALTERNATE_STUDIES[0]!;
  const colors = applyStudy(study, base.key_colors, layout);
  assert.deepEqual(candidate.key_colors, colors);
  assert.equal(candidate.name, study.name);
  assert.equal(candidate.id, makeCandidate(base, colors, layout).id);
  assert.equal(candidate.brightness_percent, 100);
  assert.equal(candidate.brightness_level, 10);
  assert.equal(Object.hasOwn(candidate, 'acceptance'), false);
  assert.equal(Object.hasOwn(candidate, 'status'), false);
  const reopened = parsePaletteBytes(new TextEncoder().encode(JSON.stringify(candidate)), layout);
  assert.equal(reopened.id, 'amber-hinge-rose-draft');
  assert.deepEqual(reopened.colors, colors);
  assert.equal(matchingStudy(base.id!, reopened.colors, base.key_colors, layout)?.id, study.id);
  const document = readFileSync(new URL('../docs/ALTERNATE-PALETTES.md', import.meta.url), 'utf8');
  const preview = document.match(/\[Preview Solar Draft\]\(([^)]+)\)/)?.[1];
  assert.ok(preview, 'The documented preview link exists.');
  assert.deepEqual(colorsFromUrl(preview, base.key_colors, layout), colors);
});

test('study patches refuse unknown, black, malformed or asymmetric changes instead of silently expanding them', () => {
  const study = PUNCTUATION_STUDIES[0]!;
  const withChanges = (changes: Readonly<Record<string, string>>): PaletteStudy => ({ ...study, changes });
  assert.throws(() => applyStudy(withChanges({ UNKNOWN: '#FFFFFF' }), base.key_colors, layout), /Unknown study key/);
  assert.throws(() => applyStudy(withChanges({ toString: '#FFFFFF' }), base.key_colors, layout), /Unknown study key/);
  assert.throws(() => applyStudy(withChanges({ QUOTE: '#000000' }), base.key_colors, layout), /illuminated/);
  assert.throws(() => applyStudy(withChanges({ QUOTE: 'white' }), base.key_colors, layout), /six-digit/);
  assert.throws(() => applyStudy(withChanges({ CTRL_L: '#FFFFFF' }), base.key_colors, layout), /pairs/);
  const incomplete = { ...base.key_colors }; delete incomplete.Q;
  assert.throws(() => applyStudy(study, incomplete, layout), /81 keys/);
  assert.equal(base.key_colors.CTRL_L, '#4400FF');
});

test('study identity requires the correct reference and every exact color, not a partial patch match', () => {
  assert.equal(matchingStudy(base.id!, base.key_colors, base.key_colors, layout), undefined);
  for (const study of ALL_STUDIES) {
    const colors = applyStudy(study, base.key_colors, layout);
    assert.equal(matchingStudy(base.id!, colors, base.key_colors, layout)?.id, study.id);
    assert.equal(matchingStudy('another-reference', colors, base.key_colors, layout), undefined);
    assert.equal(matchingStudy(base.id!, { ...colors, Q: '#00FF80' }, base.key_colors, layout), undefined);
  }
});

test('physical feedback is attached only to the exact observed study and does not transfer to revisions', () => {
  const observations = [
    ['operator-ice', 'liked'],
    ['glacier-gates', 'revision-requested'],
    ['glacier-union', 'revision-requested'],
  ] as const;
  for (const [id, status] of observations) {
    const study = ALL_STUDIES.find(item => item.id === id)!;
    const colors = applyStudy(study, base.key_colors, layout);
    const matched = matchingStudy(base.id!, colors, base.key_colors, layout);
    assert.equal(matched?.trial?.status, status);
    if (id === 'glacier-union') assert.equal(matched?.trial?.note, 'In the combined trial, white Tab felt out of place; standalone Operator Ice was chosen for the moment.');
    else assert.ok(matched?.trial?.note.toLowerCase().includes('legend readability was not separately confirmed.'));
    if (id === 'operator-ice') assert.ok(matched?.trial?.note.includes('chosen for the moment'));
    assert.equal(matchingStudy(base.id!, { ...colors, Q: '#00FF80' }, base.key_colors, layout), undefined);
    assert.equal(matchingStudy('another-reference', colors, base.key_colors, layout), undefined);
  }
  for (const id of ['glacier-gates-v2', 'glacier-syntax']) assert.equal(FRAME_STUDIES.find(study => study.id === id)!.trial, undefined);
  assert.equal(ALTERNATE_STUDIES[0]!.trial, undefined);
});

test('exported and opened palette data cannot inherit or confer trial status or acceptance', () => {
  const observed = PUNCTUATION_STUDIES.find(study => study.id === 'operator-ice')!;
  const colors = applyStudy(observed, base.key_colors, layout);
  const taintedBase = { ...base, trial: observed.trial, status: 'accepted', acceptance: 'Do not inherit this claim.' };
  const candidate = makeCandidate(taintedBase, colors, layout);
  for (const key of ['trial', 'status', 'acceptance']) assert.equal(Object.hasOwn(candidate, key), false);
  const imported = parsePaletteBytes(new TextEncoder().encode(JSON.stringify({
    ...candidate, trial: observed.trial, status: 'accepted', acceptance: 'Imported claims are not evidence.',
  })), layout);
  for (const key of ['trial', 'status', 'acceptance']) assert.equal(Object.hasOwn(imported, key), false);
  assert.deepEqual(imported.colors, colors);
});

test('studies survive public sharing and saved palette recovery without conferring physical acceptance', () => {
  for (const study of ALL_STUDIES) {
    const colors = applyStudy(study, base.key_colors, layout);
    const link = publicShareUrl(base.id!, colors, base.key_colors, layout);
    const fromUrl = colorsFromUrl(link, base.key_colors, layout);
    assert.deepEqual(fromUrl, colors);
    assert.equal(matchingStudy(base.id!, fromUrl, base.key_colors, layout)?.id, study.id);
    const candidate = makeCandidate(base, colors, layout);
    const reopened = parsePaletteBytes(new TextEncoder().encode(JSON.stringify(candidate)), layout);
    assert.deepEqual(reopened.colors, colors);
    assert.equal(matchingStudy(base.id!, reopened.colors, base.key_colors, layout)?.id, study.id);
    assert.equal(Object.hasOwn(candidate, 'acceptance'), false);
    assert.equal(Object.hasOwn(candidate, 'status'), false);
  }
});
