import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CUSTOM_SLOT, INSPECTED_VERSION, MAX_NATIVE_BYTES, MODE_NAMES, PHYSICAL_KEYS,
  parseNativeJson, parseNativeBytes, readNativeFile, prepareNative, validateNative, verifyNative,
} from './native';
import type { Candidate } from './types';

// Entirely synthetic schema fixture. Never a device export or an import sample.
function fixture(model = 'INZONE KBD-H75'): Record<string, any> {
  const reserved = Array.from({ length: model.endsWith('(US)') ? 7 : 5 }, (_, i) => `RESERVED_${i + 1}`);
  const keys = [...PHYSICAL_KEYS, ...reserved];
  const assignments = () => Object.fromEntries([...keys, 'MUTE', 'VOLUME_UP', 'VOLUME_DOWN'].map(key => [key, { KeyType: 'COMBINE_KEY', KeyCode1: 224, KeyCode2: 27, KeyCode3: 0 }]));
  return {
    CurrentPreset: 'RIPPLE',
    PresetLightingEffectInfo: Object.fromEntries(MODE_NAMES.map(mode => [mode, {
      LightEffectSpeed: 'LOW_SPEED', LightEffectColorType: 'SINGLE_CUSTOM_COLOR',
      SingleCustomRedValue: 22, SingleCustomGreenValue: 33, SingleCustomBlueValue: 44,
      BrightnessLevel: 'PERCENT_70',
    }])),
    CustomColorSettings: Object.fromEntries([CUSTOM_SLOT, 'PALETTE_CUSTOM_COLOR2'].map(slot => [slot,
      Object.fromEntries(keys.map((key, i) => [key, { ColorRed: i, ColorGreen: 20, ColorBlue: 40 }])),
    ])),
    KeyAssignSettings: assignments(), WithFnKeyAssignSettings: assignments(),
    ActuationPoints: Object.fromEntries(keys.map(key => [key, { TriggerPoint: 19 }])),
    RapidTriggerMakePoints: Object.fromEntries(keys.map(key => [key, { Enabled: false, Distance: 12, PointLinked: false }])),
    RapidTriggerBreakPoints: Object.fromEntries(keys.map(key => [key, { Enabled: true, Distance: 17, PointLinked: true }])),
    Macro: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`MACRO_KEY${i + 1}`, {
      MacroKeyActionsNumber: 2, MacroKeyPlayTime: 'PLAY_ONCE', LoopTime: 0,
      MacroKeyData: [
        { ActionNumber: 1, MacroKeyType: 'KEYBOARD', KeyStatus: 'KEY_MAKE', KeyCode: 4, TimeInterval: 31 },
        { ActionNumber: 2, MacroKeyType: 'KEYBOARD', KeyStatus: 'KEY_BREAK', KeyCode: 4, TimeInterval: 53 },
      ],
    }])),
    ProfileName: { ProfileName: 'SYNTHETIC TEST FIXTURE — NEVER IMPORT' },
    Model: model, Version: INSPECTED_VERSION, ExportedBy: 'Web',
  };
}

function candidate(): Candidate {
  return { schema: 'inzone-lighting-candidate/v1', id: 'synthetic-test', name: 'Synthetic palette', brightness_percent: 100, key_colors: Object.fromEntries(PHYSICAL_KEYS.map(key => [key, '#00FF60'])) };
}

test('conversion changes only Custom1 lighting and preserves all settings and source bytes', () => {
  assert.equal(PHYSICAL_KEYS.length, 81);
  assert.equal(new Set(PHYSICAL_KEYS).size, 81);
  for (const model of ['INZONE KBD-H75', 'INZONE KBD-H75(US)']) {
    const source = fixture(model);
    const original = structuredClone(source);
    const sourceBytes = JSON.stringify(source);
    const result = prepareNative(source, candidate());
    const output = result.profile as ReturnType<typeof fixture>;
    assert.equal(JSON.stringify(source), sourceBytes, 'input object must not be mutated');
    assert.equal(result.sourceProfileName, source.ProfileName.ProfileName);
    assert.equal(output.CurrentPreset, CUSTOM_SLOT);
    assert.equal(output.PresetLightingEffectInfo[CUSTOM_SLOT].BrightnessLevel, 'PERCENT_100');
    for (const key of PHYSICAL_KEYS) assert.deepEqual(output.CustomColorSettings[CUSTOM_SLOT][key], { ColorRed: 0, ColorGreen: 255, ColorBlue: 96 });
    const allowed = new Set(['/CurrentPreset', `/PresetLightingEffectInfo/${CUSTOM_SLOT}/BrightnessLevel`, ...PHYSICAL_KEYS.flatMap(key => ['ColorRed', 'ColorGreen', 'ColorBlue'].map(c => `/CustomColorSettings/${CUSTOM_SLOT}/${key}/${c}`))]);
    assert.ok(result.changes.length > 0);
    assert.ok(result.changes.every(change => allowed.has(change.path)));
    for (const key of Object.keys(source)) {
      if (!['CurrentPreset', 'PresetLightingEffectInfo', 'CustomColorSettings'].includes(key)) assert.deepEqual(output[key], original[key], key);
    }
    assert.deepEqual(output.CustomColorSettings.PALETTE_CUSTOM_COLOR2, original.CustomColorSettings.PALETTE_CUSTOM_COLOR2);
    for (const key of Object.keys(source.CustomColorSettings[CUSTOM_SLOT]).filter(k => !PHYSICAL_KEYS.includes(k))) assert.deepEqual(output.CustomColorSettings[CUSTOM_SLOT][key], original.CustomColorSettings[CUSTOM_SLOT][key]);
    for (const mode of MODE_NAMES.filter(mode => mode !== CUSTOM_SLOT)) assert.deepEqual(output.PresetLightingEffectInfo[mode], original.PresetLightingEffectInfo[mode]);
    assert.deepEqual(prepareNative(output, candidate()).changes, [], 'applying an identical palette has no changed fields');
  }
});

test('readback compares macros, Fn, actuation, reserved colors and names without ignoring fields', () => {
  const expected = prepareNative(fixture(), candidate()).profile as ReturnType<typeof fixture>;
  assert.deepEqual(verifyNative(expected, structuredClone(expected)), { matches: true, valid: true, differences: [], errors: [] });
  const readback = structuredClone(expected);
  readback.WithFnKeyAssignSettings.ARROW_LEFT.KeyCode1 = 225;
  readback.ActuationPoints.F1.TriggerPoint = 20;
  readback.RapidTriggerBreakPoints.CTRL_L.Distance = 18;
  readback.CustomColorSettings[CUSTOM_SLOT].RESERVED_1.ColorGreen = 21;
  readback.ProfileName.ProfileName = 'Different source-slot name';
  readback.Macro.MACRO_KEY1.MacroKeyData[1].TimeInterval = 54;
  const result = verifyNative(expected, readback);
  assert.equal(result.matches, false);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, []);
  const paths = new Set(result.differences.map(change => change.path));
  for (const path of ['/WithFnKeyAssignSettings/ARROW_LEFT/KeyCode1', '/ActuationPoints/F1/TriggerPoint', '/RapidTriggerBreakPoints/CTRL_L/Distance', `/CustomColorSettings/${CUSTOM_SLOT}/RESERVED_1/ColorGreen`, '/ProfileName/ProfileName', '/Macro/MACRO_KEY1/MacroKeyData/1/TimeInterval']) assert.ok(paths.has(path), path);
  const macroDifference = result.differences.find(change => change.path.startsWith('/Macro/'));
  assert.deepEqual(macroDifference?.before, '[macro value redacted]');
  assert.deepEqual(macroDifference?.after, '[macro value redacted]');
});

test('macro array length is significant even with an internally consistent action count', () => {
  const expected = fixture(); const observed = structuredClone(expected);
  observed.Macro.MACRO_KEY1.MacroKeyData.pop();
  observed.Macro.MACRO_KEY1.MacroKeyActionsNumber = 1;
  const result = verifyNative(expected, observed);
  assert.equal(result.matches, false);
  assert.ok(result.differences.some(change => change.path === '/Macro/MACRO_KEY1/MacroKeyData/1'));
});

test('unsupported native format and malformed protected settings are refused', () => {
  const mutations = [
    (p: ReturnType<typeof fixture>) => { p.Version = 'future-version'; },
    (p: ReturnType<typeof fixture>) => { p.Model = 'INZONE Mouse-A'; },
    (p: ReturnType<typeof fixture>) => { p.ExportedBy = 'Desktop'; },
    (p: ReturnType<typeof fixture>) => { p.UnreviewedSetting = true; },
    (p: ReturnType<typeof fixture>) => { delete p.CustomColorSettings[CUSTOM_SLOT].RESERVED_1; },
    (p: ReturnType<typeof fixture>) => { p.CustomColorSettings[CUSTOM_SLOT].A.ColorBlue = 256; },
    (p: ReturnType<typeof fixture>) => { p.ActuationPoints.A.TriggerPoint = true; },
    (p: ReturnType<typeof fixture>) => { p.RapidTriggerMakePoints.A.Enabled = 0; },
    (p: ReturnType<typeof fixture>) => { p.Macro.MACRO_KEY1.MacroKeyActionsNumber = 3; },
    (p: ReturnType<typeof fixture>) => { p.Macro.MACRO_KEY1.MacroKeyData[1].ActionNumber = 4; },
    (p: ReturnType<typeof fixture>) => { p.Macro.MACRO_KEY1.MacroKeyData[0].KeyCode = 200; },
    (p: ReturnType<typeof fixture>) => { p.ProfileName.ProfileName = '😀'.repeat(33); },
  ];
  for (const mutate of mutations) {
    const source = fixture(); mutate(source);
    assert.throws(() => prepareNative(source, candidate()));
    const verification = verifyNative(fixture(), source);
    assert.equal(verification.matches, false);
    assert.ok(verification.errors.length > 0);
  }
  const unusual = Object.setPrototypeOf(fixture(), { inherited: 'not JSON' });
  assert.throws(() => validateNative(unusual), /plain JSON/);
});

test('incomplete, dark, asymmetric or wrong-schema palette cannot become an import', () => {
  const changes = [
    (c: Candidate) => { delete c.key_colors.ESC; },
    (c: Candidate) => { c.key_colors.RESERVED_1 = '#00FF00'; },
    (c: Candidate) => { c.key_colors.A = '#000000'; },
    (c: Candidate) => { c.key_colors.A = 'green'; },
    (c: Candidate) => { c.key_colors.CTRL_L = '#4400FF'; },
    (c: Candidate) => { c.schema = 'unknown/v2'; },
    (c: Candidate) => { c.brightness_percent = 35; },
    (c: Candidate) => { c.brightness_percent = 0; },
    (c: Candidate) => { c.brightness_level = 5; },
    (c: Candidate) => { c.device = 'another keyboard'; },
    (c: Candidate) => { c.unreviewedSetting = true; },
  ];
  for (const mutate of changes) { const c = candidate(); mutate(c); assert.throws(() => prepareNative(fixture(), c)); }
});

test('file parser refuses duplicate keys, malformed data and oversized input', () => {
  for (const source of ['{"x":1,"x":2}', '{"a":0,"\\u0061":1}', '[{"x":1,"x":2}]', '{"x":NaN}', ' '.repeat(MAX_NATIVE_BYTES + 1)]) assert.throws(() => parseNativeJson(source));
  const ordinary = { text: 'escaped \\"quote and { braces }', value: [true, false, null, -1.23e4], object: { a: 'a', b: 'b' } };
  assert.deepEqual(parseNativeJson('\uFEFF' + JSON.stringify(ordinary)), ordinary);
  assert.deepEqual(parseNativeJson(JSON.stringify(fixture())), fixture());
  const polluted = parseNativeJson('{"__proto__":{"polluted":true}}');
  assert.throws(() => validateNative(polluted));
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('raw file parser rejects invalid UTF-8 rather than changing source strings', async () => {
  assert.throws(() => parseNativeBytes(Uint8Array.from([0x22, 0xc3, 0x28, 0x22])), /UTF-8/);
  assert.throws(() => parseNativeBytes(new Uint8Array(MAX_NATIVE_BYTES + 1)), /byte limit/);
  const file = new Blob([JSON.stringify(fixture())], { type: 'application/json' });
  assert.deepEqual(await readNativeFile(file), fixture());
});

test('every published catalog palette converts against a synthetic export without losing source identity', () => {
  const publicRoot = new URL('../public/', import.meta.url);
  const catalog = JSON.parse(readFileSync(new URL('data/catalog.json', publicRoot), 'utf8')) as { profiles: Array<{ id: string; palette: string }> };
  assert.equal(catalog.profiles.length, 9, 'the published nine-profile collection is exercised');
  assert.equal(new Set(catalog.profiles.map(p => p.id)).size, catalog.profiles.length);
  for (const entry of catalog.profiles) {
    assert.ok(entry.palette.startsWith('data/palettes/') && !entry.palette.includes('..'), entry.id);
    const palette = JSON.parse(readFileSync(new URL(entry.palette, publicRoot), 'utf8')) as Candidate;
    assert.equal(palette.id, entry.id);
    const source = fixture();
    const result = prepareNative(source, palette);
    const output = result.profile as ReturnType<typeof fixture>;
    assert.equal(output.CurrentPreset, CUSTOM_SLOT, entry.id);
    assert.equal(output.PresetLightingEffectInfo[CUSTOM_SLOT].BrightnessLevel, 'PERCENT_100', entry.id);
    assert.deepEqual(output.ProfileName, source.ProfileName, `${entry.id}: keep actual source-slot name`);
    for (const key of PHYSICAL_KEYS) {
      const color = palette.key_colors[key]!;
      assert.deepEqual(output.CustomColorSettings[CUSTOM_SLOT][key], {
        ColorRed: parseInt(color.slice(1, 3), 16), ColorGreen: parseInt(color.slice(3, 5), 16), ColorBlue: parseInt(color.slice(5, 7), 16),
      }, `${entry.id}/${key}`);
    }
    for (const section of ['KeyAssignSettings', 'WithFnKeyAssignSettings', 'ActuationPoints', 'RapidTriggerMakePoints', 'RapidTriggerBreakPoints', 'Macro', 'Model', 'Version', 'ExportedBy']) assert.deepEqual(output[section], source[section], `${entry.id}/${section}`);
    assert.deepEqual(output.CustomColorSettings.PALETTE_CUSTOM_COLOR2, source.CustomColorSettings.PALETTE_CUSTOM_COLOR2, entry.id);
    for (const key of Object.keys(source.CustomColorSettings[CUSTOM_SLOT]).filter(key => !PHYSICAL_KEYS.includes(key))) assert.deepEqual(output.CustomColorSettings[CUSTOM_SLOT][key], source.CustomColorSettings[CUSTOM_SLOT][key], `${entry.id}/${key}`);
  }
});
