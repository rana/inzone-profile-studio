import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colorDifferences, colorsFromUrl, makeCandidate, normalizeColor, recolor, shareUrl, validateColors } from './model';
import type { Candidate, LayoutKey } from './types';
const layout = (JSON.parse(readFileSync(new URL('../public/data/layout.json', import.meta.url), 'utf8')) as { keys: LayoutKey[] }).keys;
const base = JSON.parse(readFileSync(new URL('../public/data/palettes/amber-hinge-rose.json', import.meta.url), 'utf8')) as Candidate;

test('paired modifier edits remain mirrored without changing unrelated keys', () => {
  const changed = recolor(base.key_colors, ['SHIFT_L'], '#ff00a0');
  assert.equal(changed.SHIFT_L, '#FF00A0'); assert.equal(changed.SHIFT_R, '#FF00A0');
  assert.deepEqual(colorDifferences(base.key_colors, changed).sort(), ['SHIFT_L', 'SHIFT_R']);
  assert.equal(base.key_colors.SHIFT_L, '#FF0080');
});
test('black and incomplete palettes are refused', () => {
  assert.throws(() => normalizeColor('#000000'), /illuminated/);
  const partial = { ...base.key_colors }; delete partial.Q;
  assert.throws(() => validateColors(partial, layout), /81 keys/);
});
test('asymmetric modifier colors cannot enter a share or exported draft', () => {
  assert.throws(() => makeCandidate(base, { ...base.key_colors, CTRL_L: '#00FFFF' }, layout), /pairs/);
});
test('a shared variation round trips only changed colors under GitHub Pages subpaths', () => {
  const colors = recolor(base.key_colors, ['WIN_L', 'FN'], '#FFCC00');
  const url = shareUrl('https://example.github.io/inzone-profile-studio/?old=1#x', 'amber-hinge-rose', colors, base.key_colors);
  assert.equal(new URL(url).pathname, '/inzone-profile-studio/');
  assert.equal(new URL(url).searchParams.get('profile'), 'amber-hinge-rose');
  assert.equal(new URL(url).searchParams.has('old'), false);
  assert.deepEqual(colorsFromUrl(url, base.key_colors, layout), colors);
});
test('malformed shared variations fail safely instead of silently editing a different key', () => {
  assert.throws(() => colorsFromUrl('https://example.test/?colors=UNKNOWN.FFFFFF', base.key_colors, layout), /unknown/);
  assert.throws(() => colorsFromUrl('https://example.test/?colors=Q.000000', base.key_colors, layout), /illuminated/);
  assert.throws(() => colorsFromUrl('https://example.test/?colors=Q.FFFFFF,Q.FF0000', base.key_colors, layout), /repeated/);
});
test('exported palette has the full lit layout and fixed brightness', () => {
  const colors = recolor(base.key_colors, ['Q'], '#00FFC0');
  const candidate = makeCandidate(base, colors, layout);
  assert.equal(Object.keys(candidate.key_colors).length, 81); assert.equal(candidate.brightness_percent, 100);
  assert.match(candidate.id!, /draft$/); assert.equal(candidate.schema, 'inzone-lighting-candidate/v1');
});


test('restoring a shared variation removes obsolete URL colors before a reload', () => {
  const changed = recolor(base.key_colors, ['WIN_L', 'FN'], '#FFCC00');
  const originalShare = shareUrl('https://example.github.io/inzone-profile-studio/', 'amber-hinge-rose', changed, base.key_colors);
  const restoredUrl = shareUrl(originalShare, 'amber-hinge-rose', base.key_colors, base.key_colors);
  assert.equal(new URL(restoredUrl).searchParams.has('colors'), false);
  assert.deepEqual(colorsFromUrl(restoredUrl, base.key_colors, layout), base.key_colors);
  const revised = recolor(base.key_colors, ['WIN_L', 'FN'], '#FF8800');
  const revisedUrl = shareUrl(originalShare, 'amber-hinge-rose', revised, base.key_colors);
  assert.equal(new URL(revisedUrl).searchParams.get('colors')!.includes('FFCC00'), false);
  assert.deepEqual(colorsFromUrl(revisedUrl, base.key_colors, layout), revised);
});
