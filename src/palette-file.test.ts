import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colorsFromUrl, makeCandidate, recolor, shareUrl } from './model';
import { MAX_PALETTE_BYTES, parsePaletteBytes, readPaletteFile } from './palette-file';
import type { Candidate, LayoutKey } from './types';

const layout = (JSON.parse(readFileSync(new URL('../public/data/layout.json', import.meta.url), 'utf8')) as { keys: LayoutKey[] }).keys;
const base = JSON.parse(readFileSync(new URL('../public/data/palettes/amber-hinge-rose.json', import.meta.url), 'utf8')) as Candidate;
const bytes = (data: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(data));
const palette = (): Candidate => makeCandidate(base, base.key_colors, layout);

test('saved variation reopens and shares exact colors without prior browser state', async () => {
  const colors = recolor(base.key_colors, ['SHIFT_L'], '#f000a0');
  const saved = makeCandidate(base, colors, layout);
  const opened = await readPaletteFile(new Blob([JSON.stringify(saved)]), layout);
  assert.equal(opened.id, 'amber-hinge-rose-draft');
  assert.equal(opened.name, saved.name);
  assert.deepEqual(opened.colors, colors);
  const link = shareUrl('https://example.github.io/inzone-profile-studio/', base.id!, opened.colors, base.key_colors);
  assert.deepEqual(colorsFromUrl(link, base.key_colors, layout), opened.colors);
  assert.deepEqual(parsePaletteBytes(bytes(makeCandidate(base, opened.colors, layout)), layout).colors, colors);
  assert.equal(base.key_colors.SHIFT_L, '#FF0080');
});

test('every published palette reopens while lowercase hex normalizes before pair checks', () => {
  const catalog = JSON.parse(readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8')) as { profiles: Array<{ palette: string }> };
  for (const entry of catalog.profiles) {
    const source = JSON.parse(readFileSync(new URL(`../public/${entry.palette}`, import.meta.url), 'utf8')) as Candidate;
    const mixed = structuredClone(source);
    mixed.key_colors.CTRL_L = mixed.key_colors.CTRL_L!.toLowerCase();
    assert.deepEqual(parsePaletteBytes(bytes(mixed), layout).colors, source.key_colors);
  }
  const source = palette(); delete source.brightness_level; delete source.id;
  assert.deepEqual(Object.keys(parsePaletteBytes(bytes(source), layout)).sort(), ['colors', 'name']);
});

test('missing, unknown, unlit, asymmetric and nonstring key colors are refused', () => {
  const mutations = [
    (p: Candidate) => { delete p.key_colors.Q; },
    (p: Candidate) => { delete p.key_colors.Q; p.key_colors.UNKNOWN = '#FFFFFF'; },
    (p: Candidate) => { p.key_colors.UNKNOWN = '#FFFFFF'; },
    (p: Candidate) => { p.key_colors.Q = '#000000'; },
    (p: Candidate) => { p.key_colors.CTRL_L = '#FFFFFF'; },
    (p: Candidate) => { p.key_colors.Q = 123 as unknown as string; },
    (p: Candidate) => { p.key_colors.Q = 'green'; },
    (p: Candidate) => { p.key_colors = null as unknown as Record<string, string>; },
    (p: Candidate) => { p.key_colors = [] as unknown as Record<string, string>; },
  ];
  for (const mutate of mutations) { const p = palette(); mutate(p); assert.throws(() => parsePaletteBytes(bytes(p), layout)); }
  const protoKey = JSON.stringify(palette()).replace('"key_colors":{', '"key_colors":{"__proto__":"#FFFFFF",');
  assert.throws(() => parsePaletteBytes(new TextEncoder().encode(protoKey), layout), /81 keys/);
});

test('duplicate and escaped duplicate fields are rejected before values can be overwritten', () => {
  const valid = JSON.stringify(palette());
  assert.throws(() => parsePaletteBytes(new TextEncoder().encode(valid.replace('"Q":', '"Q":"#FFFFFF","Q":')), layout), /Duplicate JSON field: Q/);
  assert.throws(() => parsePaletteBytes(new TextEncoder().encode(valid.replace('"Q":', '"\\u0051":"#FFFFFF","Q":')), layout), /Duplicate JSON field: Q/);
  assert.throws(() => parsePaletteBytes(new TextEncoder().encode(valid.replace('"name":', '"name":"hidden","name":')), layout), /Duplicate JSON field: name/);
});

test('wrong schemas, native exports and malformed palette metadata are refused', () => {
  const mutations = [
    (p: Candidate) => { delete p.schema; },
    (p: Candidate) => { p.schema = 'future/v2'; },
    (p: Candidate) => { p.name = ''; },
    (p: Candidate) => { p.name = '  '; },
    (p: Candidate) => { p.name = '\nHidden'; },
    (p: Candidate) => { p.name = 'x'.repeat(161); },
    (p: Candidate) => { p.name = 1 as unknown as string; },
    (p: Candidate) => { p.brightness_percent = 90; },
    (p: Candidate) => { p.brightness_percent = '100' as unknown as number; },
    (p: Candidate) => { p.brightness_level = null; },
    (p: Candidate) => { p.id = '../not-an-id'; },
  ];
  for (const mutate of mutations) { const p = palette(); mutate(p); assert.throws(() => parsePaletteBytes(bytes(p), layout)); }
  for (const value of [null, [], 'palette', { Model: 'INZONE KBD-H75', Version: '1.2.1.0', ProfileName: { ProfileName: 'Synthetic native-shaped rejection input' } }]) {
    assert.throws(() => parsePaletteBytes(bytes(value), layout));
  }
});

test('malicious metadata is ignored and display names remain literal text only', () => {
  const source = palette();
  source.name = '<img src=x onerror=alert(1)>';
  Object.assign(source, { acceptance: 'keeper', status: 'accepted', slot: 1, KeyAssignSettings: { Q: 'change me' }, __proto__: { polluted: true } });
  const text = JSON.stringify(source).replace('"schema":', '"__proto__":{"polluted":true},"schema":');
  const opened = parsePaletteBytes(new TextEncoder().encode(text), layout);
  assert.equal(opened.name, source.name);
  assert.deepEqual(Object.keys(opened).sort(), ['colors', 'id', 'name']);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.deepEqual(opened.colors, base.key_colors);
});

test('UTF-8, malformed JSON, size and nesting errors are reported as palette errors', async () => {
  assert.throws(() => parsePaletteBytes(Uint8Array.from([0x22, 0xc3, 0x28, 0x22]), layout), /Palette file is not valid UTF-8/);
  assert.throws(() => parsePaletteBytes(new TextEncoder().encode('{'), layout), /Palette file is not valid JSON/);
  assert.throws(() => parsePaletteBytes(new Uint8Array(MAX_PALETTE_BYTES + 1), layout), /Palette file exceeds the .*byte limit/);
  await assert.rejects(readPaletteFile(new Blob([new Uint8Array(MAX_PALETTE_BYTES + 1)]), layout), /Palette file exceeds/);
  const deep = '['.repeat(130) + '0' + ']'.repeat(130);
  assert.throws(() => parsePaletteBytes(new TextEncoder().encode(deep), layout), /Palette file JSON is nested too deeply/);
});
