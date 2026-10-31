import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colorDifferences, colorsFromUrl, makeCandidate, publicShareUrl, validateColors } from './model';
import { parsePaletteBytes } from './palette-file';
import { applyStudy, matchingStudy, PUNCTUATION_STUDIES } from './studies';
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
  for (const study of PUNCTUATION_STUDIES) {
    const colors = applyStudy(study, base.key_colors, layout);
    assert.equal(matchingStudy(base.id!, colors, base.key_colors, layout)?.id, study.id);
    assert.equal(matchingStudy('another-reference', colors, base.key_colors, layout), undefined);
    assert.equal(matchingStudy(base.id!, { ...colors, Q: '#00FF80' }, base.key_colors, layout), undefined);
  }
});

test('studies survive public sharing and saved palette recovery without conferring physical acceptance', () => {
  for (const study of PUNCTUATION_STUDIES) {
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
