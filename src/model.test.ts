import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colorDifferences, colorsFromUrl, makeCandidate, normalizeColor, PUBLIC_STUDIO_URL, publicShareUrl, recolor, shareUrl, validateColors } from './model';
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

test('local address state stays local while explicit sharing targets only the public studio', () => {
  const colors = recolor(base.key_colors, ['WIN_L', 'FN'], '#FFCC00');
  const local = new URL(shareUrl('http://127.0.0.1:4173/private-session/?token=do-not-share#local-note', base.id!, colors, base.key_colors));
  assert.equal(local.origin, 'http://127.0.0.1:4173');
  assert.equal(local.pathname, '/private-session/');
  assert.equal(local.searchParams.get('colors')!.split(',').length, 2);
  const publicUrl = new URL(publicShareUrl(base.id!, colors, base.key_colors, layout));
  assert.equal(publicUrl.origin + publicUrl.pathname, PUBLIC_STUDIO_URL);
  assert.equal(publicUrl.protocol, 'https:');
  assert.deepEqual([...publicUrl.searchParams.keys()].sort(), ['colors', 'profile']);
  assert.equal(publicUrl.hash, '');
  assert.equal(publicUrl.username, '');
  assert.equal(publicUrl.searchParams.get('colors')!.split(',').length, 81);
  assert.doesNotMatch(publicUrl.href, /127\.0\.0\.1|private-session|token|local-note/);
});

test('a full public snapshot restores all colors even when the published reference changes', () => {
  const colors = recolor(base.key_colors, ['QUOTE'], '#C0FFFF');
  const link = publicShareUrl(base.id!, colors, base.key_colors, layout);
  const changedReference = Object.fromEntries(layout.map(key => [key.id, '#123456']));
  assert.deepEqual(colorsFromUrl(link, changedReference, layout), colors);
  assert.deepEqual(colorsFromUrl(publicShareUrl(base.id!, base.key_colors, base.key_colors, layout), changedReference, layout), base.key_colors);
  assert.equal(new URL(link).searchParams.get('colors')!.length <= 2000, true);
});

test('all nine published palettes make deterministic uppercase public snapshots', () => {
  const catalog = JSON.parse(readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8')) as { profiles: Array<{ id: string; palette: string }> };
  assert.equal(catalog.profiles.length, 9);
  for (const entry of catalog.profiles) {
    const candidate = JSON.parse(readFileSync(new URL(`../public/${entry.palette}`, import.meta.url), 'utf8')) as Candidate;
    const lowercaseReversed = Object.fromEntries(Object.entries(candidate.key_colors).reverse().map(([key, value]) => [key, value.toLowerCase()]));
    const link = publicShareUrl(entry.id, lowercaseReversed, candidate.key_colors, layout);
    assert.equal(link, publicShareUrl(entry.id, candidate.key_colors, candidate.key_colors, layout));
    assert.deepEqual(colorsFromUrl(link, base.key_colors, layout), candidate.key_colors);
    const tokens = new URL(link).searchParams.get('colors')!.split(',');
    assert.equal(tokens.length, 81);
    assert.deepEqual(tokens, [...tokens].sort());
    assert.equal(tokens.every(token => /^[A-Z0-9_]+\.[0-9A-F]{6}$/.test(token)), true);
  }
});

test('public sharing refuses invalid colors or references and unsafe profile identifiers', () => {
  const missing = { ...base.key_colors }; delete missing.Q;
  const invalidMaps = [missing, { ...base.key_colors, Q: '#000000' }, { ...base.key_colors, CTRL_L: '#FFFFFF' }, { ...base.key_colors, UNKNOWN: '#FFFFFF' }];
  for (const map of invalidMaps) {
    assert.throws(() => publicShareUrl(base.id!, map, base.key_colors, layout));
    assert.throws(() => publicShareUrl(base.id!, base.key_colors, map, layout));
  }
  for (const id of ['', '../palette', 'https://example.test/', 'palette?private=1', 'palette#secret', 'UPPERCASE', '-palette', 'palette-', 'two--hyphens', 'a'.repeat(129)]) {
    assert.throws(() => publicShareUrl(id, base.key_colors, base.key_colors, layout), /identifier/);
  }
});
