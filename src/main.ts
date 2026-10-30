import './style.css';
import { LatestTask } from './async-task';
import { readNativeFile, prepareNative, verifyNative } from './native';
import { colorDifferences, colorsFromUrl, makeCandidate, recolor, shareUrl, validateColors } from './model';
import type { Candidate, Catalog, CatalogProfile, LayoutKey } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;
const ns = 'http://www.w3.org/2000/svg';
const STORAGE = 'inzone-profile-studio:v1';
const statusNames: Record<CatalogProfile['status'], string> = { keeper: 'Keeper', accepted: 'Accepted', experiment: 'Experiment', reference: 'Reference' };
const groupKeys: Record<string, string[]> = { selected: [], shift: ['SHIFT_L', 'SHIFT_R'], hinge: ['WIN_L', 'FN'], ctrl: ['CTRL_L', 'CTRL_R'], alt: ['ALT_L', 'ALT_R'], gates: ['TAB', 'ENTER'] };
const keyNames: Record<string, string> = { SHIFT_L: 'Left Shift', SHIFT_R: 'Right Shift', CTRL_L: 'Left Ctrl', CTRL_R: 'Right Ctrl', ALT_L: 'Left Alt', ALT_R: 'Right Alt', WIN_L: 'Win', FN: 'Fn', CAP: 'Caps Lock', TILDE: 'Backtick / tilde', BRACKET_LEFT: 'Left bracket / brace', BRACKET_RIGHT: 'Right bracket / brace', BACKSPACE: 'Backspace', ARROW_UP: 'Up arrow', ARROW_DOWN: 'Down arrow', ARROW_LEFT: 'Left arrow', ARROW_RIGHT: 'Right arrow' };
const shortNames: Record<string, string> = { BACKSPACE: '⌫', DELETE: 'Del', PAGE_UP: 'PgUp', PAGE_DOWN: 'PgDn', INSERT: 'Ins', ARROW_UP: '↑', ARROW_DOWN: '↓', ARROW_LEFT: '←', ARROW_RIGHT: '→', SPACE: '—' };
let catalog: Catalog;
let layout: LayoutKey[];
const palettes = new Map<string, Candidate>();
const drafts = new Map<string, Record<string, string>>();
let selectedId = '';
let selectedKey = 'SHIFT_L';
let compareId = '';
let favorites = new Set<string>();
let favoritesOnly = false;
let view: 'preview' | 'compare' | 'edit' = 'preview';
let swatches = true;
let resizeObserver: ResizeObserver;
let sourceFile: File | null = null;
let prepared: ReturnType<typeof prepareNative> | null = null;
let exportCandidate: Candidate | null = null;
let preparedDownloaded = false;
const sourceTask = new LatestTask();
const readbackTask = new LatestTask();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}
function byId<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
function asset(path: string): string { return new URL(path.replace(/^\/+/, ''), new URL(import.meta.env.BASE_URL, document.baseURI)).href; }
function currentMeta(): CatalogProfile { return catalog.profiles.find(profile => profile.id === selectedId)!; }
function currentBase(): Candidate { return palettes.get(selectedId)!; }
function currentColors(): Record<string, string> { return drafts.get(selectedId) || currentBase().key_colors; }
function nameOf(key: LayoutKey): string { return keyNames[key.id] || key.label; }
function inform(message: string, error = false): void { const node = byId('notice'); node.textContent = message; node.classList.toggle('error', error); node.setAttribute('role', error ? 'alert' : 'status'); }
function persist(): void {
  try { localStorage.setItem(STORAGE, JSON.stringify({ favorites: [...favorites], drafts: Object.fromEntries(drafts), selectedId })); }
  catch { inform('This browser could not save your local choices. Download a palette to keep a copy.'); }
}
function download(data: BlobPart | Blob, filename: string, type = 'application/json'): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob); const a = el('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copyText(text: string, success: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); byId<HTMLTextAreaElement>('copy-fallback').hidden = true; inform(success); }
  catch { const field = byId<HTMLTextAreaElement>('copy-fallback'); field.hidden = false; field.value = text; field.focus(); field.select(); inform('Copy the selected text below.'); }
}
function updateUrl(): void {
  history.replaceState(null, '', shareUrl(location.href, selectedId, currentColors(), currentBase().key_colors));
}
function selectProfile(id: string): void {
  if (!palettes.has(id)) return;
  selectedId = id; selectedKey = 'SHIFT_L';
  const meta = currentMeta(); compareId = meta.parentId && palettes.has(meta.parentId) ? meta.parentId : catalog.profiles.find(profile => profile.id !== id)!.id;
  updateUrl(); persist(); render(); inform('');
}
function renderCatalog(): void {
  const list = byId('profile-list'); list.replaceChildren();
  const mobile = byId<HTMLSelectElement>('mobile-profile'); mobile.replaceChildren();
  for (const profile of catalog.profiles) {
    const option = el('option', '', profile.name); option.value = profile.id; mobile.append(option);
    if (favoritesOnly && !favorites.has(profile.id)) continue;
    const button = el('button', 'profile-choice'); button.type = 'button'; button.setAttribute('aria-pressed', String(profile.id === selectedId));
    button.dataset.profile = profile.id;
    const swatch = el('span', 'profile-swatch');
    const colors = palettes.get(profile.id)!.key_colors;
    ['Q', 'WIN_L', 'SHIFT_L', 'F6'].forEach(key => { const bit = el('i'); bit.style.backgroundColor = colors[key]!; swatch.append(bit); });
    const words = el('span', 'profile-words'); words.append(el('strong', '', profile.name), el('span', 'profile-caption', `${statusNames[profile.status]}${favorites.has(profile.id) ? ' · Your favorite' : ''}`));
    button.append(swatch, words); button.addEventListener('click', () => selectProfile(profile.id)); list.append(button);
  }
  if (!list.children.length) list.append(el('p', 'muted empty', 'No local favorites yet. Use the star beside a profile name to keep one here.'));
  mobile.value = selectedId;
  const toggle = byId<HTMLButtonElement>('favorites-filter'); toggle.setAttribute('aria-pressed', String(favoritesOnly));
}
function svgEl(tag: string, attrs: Record<string, string | number> = {}, text = ''): SVGElement {
  const node = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value))); if (text) node.textContent = text; return node;
}
function colorInk(hex: string): string {
  const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0]! + .7152 * rgb[1]! + .0722 * rgb[2]! > .2 ? '#121921' : '#FFFFFF';
}
function drawKeyboard(container: HTMLElement, colors: Record<string, string>, title: string, interactive: boolean, differences: string[] = []): void {
  const width = Math.max(260, Math.round(container.getBoundingClientRect().width));
  const unit = (width - 24) / 16.8; const height = unit * 6.85 + 24;
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'group', 'aria-label': `${title}, Sony US 81-key color preview` });
  svg.append(svgEl('title', {}, title), svgEl('desc', {}, 'Colors are assigned RGB values, not calibrated LED output. Click a key or use the Choose key control to inspect it.'));
  svg.append(svgEl('rect', { x: 2, y: 2, width: width - 4, height: height - 4, rx: 13, fill: '#101318' }));
  for (const key of layout) {
    const x = 12 + (key.x + .045) * unit, y = 12 + (key.y + .045) * unit, w = (key.w - .09) * unit, h = .91 * unit;
    const color = colors[key.id]!; const selected = interactive && key.id === selectedKey;
    const group = svgEl('g', { 'data-key': key.id, 'data-color': color, 'aria-label': `${nameOf(key)}: ${color}`, ...(interactive ? { role: 'button', tabindex: selected ? 0 : -1, 'aria-pressed': String(selected) } : {}) });
    group.append(svgEl('title', {}, `${nameOf(key)} · ${color}${differences.includes(key.id) ? ' · different' : ''}`));
    group.append(svgEl('rect', { x, y, width: w, height: h, rx: Math.max(2, unit * .06), fill: swatches ? color : '#1A1E25', stroke: selected ? '#FFFFFF' : color, 'stroke-width': selected ? 2.5 : 1, 'stroke-opacity': selected || swatches ? 1 : .8 }));
    const label = shortNames[key.id] || key.label;
    const fontSize = unit >= 45 ? 13 : 12;
    if (w > label.length * fontSize * .6 + 4 && h > 16) group.append(svgEl('text', { x: x + w / 2, y: y + h * .54, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: swatches ? colorInk(color) : color, 'font-size': fontSize, 'font-weight': 500, 'font-family': 'Ubuntu,system-ui,sans-serif' }, label));
    if (differences.includes(key.id)) group.append(svgEl('circle', { cx: x + w - 4, cy: y + 4, r: 2, fill: swatches ? colorInk(color) : '#FFFFFF' }));
    if (key.id === 'F' || key.id === 'J') group.append(svgEl('line', { x1: x + w * .43, x2: x + w * .57, y1: y + h * .82, y2: y + h * .82, stroke: swatches ? colorInk(color) : color, 'stroke-width': 1.3 }));
    if (interactive) {
      const choose = () => { selectedKey = key.id; renderInspector(); renderBoards(); };
      group.addEventListener('click', choose);
      group.addEventListener('keydown', event => {
        const e = event as KeyboardEvent;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault(); const direction = e.key.replace('Arrow', '');
          const options = layout.filter(other => direction === 'Left' ? other.x < key.x : direction === 'Right' ? other.x > key.x : direction === 'Up' ? other.y < key.y : other.y > key.y);
          options.sort((a, b) => Math.hypot(a.x - key.x, (a.y - key.y) * 2) - Math.hypot(b.x - key.x, (b.y - key.y) * 2));
          if (options[0]) { selectedKey = options[0].id; renderInspector(); renderBoards(); container.querySelector<SVGElement>(`[data-key="${selectedKey}"]`)?.focus(); }
        }
      });
    }
    svg.append(group);
  }
  svg.append(svgEl('circle', { cx: 12 + 15.65 * unit, cy: 12 + .5 * unit, r: .38 * unit, fill: '#252C35', stroke: '#5A626C', 'stroke-width': 1 }));
  container.replaceChildren(svg);
}
function renderBoards(): void {
  const colors = currentColors(); const other = palettes.get(compareId);
  const differences = other ? colorDifferences(colors, other.key_colors) : [];
  drawKeyboard(byId('keyboard'), colors, currentMeta().name, true, view === 'compare' ? differences : []);
  if (view === 'compare' && other) drawKeyboard(byId('compare-keyboard'), other.key_colors, other.name, false, differences);
  byId('compare-result').textContent = `${differences.length} ${differences.length === 1 ? 'key differs' : 'keys differ'}. Dots mark the differences on both previews.`;
}
function renderInspector(): void {
  const key = layout.find(item => item.id === selectedKey)!; const color = currentColors()[selectedKey]!;
  byId('selected-key-name').textContent = nameOf(key);
  byId('selected-key-color').textContent = color;
  byId('selected-key-swatch').style.backgroundColor = color;
  byId<HTMLSelectElement>('key-select').value = selectedKey;
  const target = byId<HTMLSelectElement>('edit-target').value;
  const editKey = target === 'selected' ? selectedKey : groupKeys[target]?.[0] || selectedKey;
  const editColor = currentColors()[editKey]!;
  byId<HTMLInputElement>('key-color').value = editColor;
  byId<HTMLInputElement>('hex-color').value = editColor;
  const changed = colorDifferences(currentBase().key_colors, currentColors());
  byId('draft-state').textContent = changed.length ? `Your variation · ${changed.length} ${changed.length === 1 ? 'key changed' : 'keys changed'}` : 'Original palette';
  byId<HTMLButtonElement>('reset-draft').disabled = !changed.length;
  byId<HTMLButtonElement>('reset-key').disabled = currentColors()[selectedKey] === currentBase().key_colors[selectedKey];
}
function renderProfileContext(): void {
  const meta = currentMeta();
  const edited = colorDifferences(currentBase().key_colors, currentColors()).length > 0;
  byId('profile-title').textContent = edited ? `${meta.name} — your variation` : meta.name;
  byId('profile-summary').textContent = meta.summary;
  byId('profile-acceptance').textContent = edited
    ? `This local variation has not been physically tested. Source palette: ${meta.name}. ${meta.acceptance || ''}`
    : meta.acceptance || statusNames[meta.status];
  byId('profile-status').textContent = edited ? 'Local variation' : statusNames[meta.status];
}
function render(): void {
  renderCatalog(); renderProfileContext();
  const star = byId<HTMLButtonElement>('favorite'); star.setAttribute('aria-pressed', String(favorites.has(selectedId))); star.textContent = favorites.has(selectedId) ? '★ Saved favorite' : '☆ Save favorite';
  byId('compare-section').hidden = view !== 'compare'; byId('edit-section').hidden = view !== 'edit';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  const compare = byId<HTMLSelectElement>('compare-profile'); compare.replaceChildren();
  for (const profile of catalog.profiles) if (profile.id !== selectedId) { const option = el('option', '', profile.name); option.value = profile.id; compare.append(option); }
  compare.value = compareId;
  renderInspector(); requestAnimationFrame(renderBoards);
}
function applyEdit(keys: string[], color: string): void {
  try { drafts.set(selectedId, recolor(currentColors(), keys, color)); validateColors(currentColors(), layout); updateUrl(); persist(); renderProfileContext(); renderInspector(); renderBoards(); inform('Variation saved in this browser. Download or share it to keep another copy.'); }
  catch (error) { inform((error as Error).message, true); renderInspector(); }
}
function selectedCandidate(): Candidate { return makeCandidate(currentBase(), currentColors(), layout); }
function exportMessage(message: string, error = false): void { const node = byId('export-message'); node.textContent = message; node.classList.toggle('error', error); }
function clearExport(): void {
  sourceTask.invalidate(); readbackTask.invalidate();
  sourceFile = null; prepared = null; preparedDownloaded = false; exportCandidate = selectedCandidate();
  byId<HTMLInputElement>('source-file').value = ''; byId<HTMLInputElement>('readback-file').value = ''; byId<HTMLSelectElement>('source-slot').value = '';
  byId('native-summary').textContent = 'No source export selected.'; byId('source-name').textContent = '';
  byId('verify-result').replaceChildren(); exportMessage('');
  byId<HTMLButtonElement>('download-native').disabled = true; byId<HTMLButtonElement>('download-rollback').disabled = true; byId<HTMLInputElement>('readback-file').disabled = true;
}
function updateExportControls(): void {
  const slot = byId<HTMLSelectElement>('source-slot').value;
  byId<HTMLButtonElement>('download-native').disabled = !prepared || !slot;
  byId<HTMLButtonElement>('download-rollback').disabled = !sourceFile || !slot;
  byId<HTMLInputElement>('readback-file').disabled = !preparedDownloaded;
  byId('target-slot').textContent = slot ? `Use physical slot ${slot}, the same slot you exported.` : 'Choose the physical source slot. The file does not identify it.';
}
async function loadNativeSource(): Promise<void> {
  sourceTask.invalidate(); readbackTask.invalidate();
  const file = byId<HTMLInputElement>('source-file').files?.[0];
  const candidate = exportCandidate;
  const slot = byId<HTMLSelectElement>('source-slot').value;
  sourceFile = null; prepared = null; preparedDownloaded = false;
  byId('verify-result').replaceChildren();
  byId<HTMLInputElement>('readback-file').value = '';
  byId('source-name').textContent = '';
  byId('native-summary').textContent = file ? 'Checking the source export…' : 'No source export selected.';
  exportMessage(''); updateExportControls();
  if (!file || !candidate) return;
  const ownsContext = (): boolean =>
    byId<HTMLDialogElement>('export-dialog').open &&
    exportCandidate === candidate &&
    byId<HTMLInputElement>('source-file').files?.[0] === file &&
    byId<HTMLSelectElement>('source-slot').value === slot;
  await sourceTask.run(() => readNativeFile(file), parsed => {
    if (!ownsContext()) return;
    const next = prepareNative(parsed, candidate);
    prepared = next; sourceFile = file;
    byId('source-name').textContent = `Sony profile name: ${next.sourceProfileName}. This name is preserved.`;
    const keys = new Set(next.changes.flatMap(change => { const match = change.path.match(/^\/CustomColorSettings\/PALETTE_CUSTOM_COLOR1\/([^/]+)\//); return match?.[1] ? [match[1]] : []; }));
    byId('native-summary').textContent = `${keys.size} physical ${keys.size === 1 ? 'key changes' : 'keys change'}; ${next.changes.length} saved fields change. Brightness is 100%. All unrelated fields stay in the prepared file.`;
    exportMessage('Source format checked. Keep your original file as the rollback.');
    updateExportControls();
  }, error => {
    if (!ownsContext()) return;
    sourceFile = null; prepared = null;
    byId('source-name').textContent = ''; byId('native-summary').textContent = 'No native file prepared.';
    exportMessage((error as Error).message, true); updateExportControls();
  });
}
async function verifyReadback(): Promise<void> {
  readbackTask.invalidate();
  const file = byId<HTMLInputElement>('readback-file').files?.[0];
  const expected = prepared;
  const source = sourceFile;
  const candidate = exportCandidate;
  const slot = byId<HTMLSelectElement>('source-slot').value;
  const resultNode = byId('verify-result'); resultNode.replaceChildren();
  if (!file || !expected || !source || !preparedDownloaded) return;
  resultNode.append(el('p', 'muted', 'Checking the new export…'));
  const ownsContext = (): boolean =>
    byId<HTMLDialogElement>('export-dialog').open &&
    prepared === expected && sourceFile === source && exportCandidate === candidate && preparedDownloaded &&
    byId<HTMLInputElement>('readback-file').files?.[0] === file &&
    byId<HTMLSelectElement>('source-slot').value === slot;
  await readbackTask.run(() => readNativeFile(file), actual => {
    if (!ownsContext()) return;
    const result = verifyNative(expected.profile, actual);
    resultNode.replaceChildren();
    const heading = el('strong', result.matches ? 'verified' : 'error', result.matches ? 'Exact match. Every exported field matches the prepared file.' : 'The new export does not match the prepared file.');
    resultNode.append(heading);
    if (result.errors.length) result.errors.forEach(error => resultNode.append(el('p', 'error', error)));
    if (result.differences.length) { const list = el('ul', 'difference-list'); result.differences.slice(0, 12).forEach(change => list.append(el('li', '', change.path))); resultNode.append(list, el('p', 'muted', `${result.differences.length} ${result.differences.length === 1 ? 'difference' : 'differences'} in total. No fields were ignored.`)); }
    if (result.matches) resultNode.append(el('p', 'muted', 'This verifies saved data. Check physical key behavior, legibility and persistence on your keyboard.'));
  }, error => {
    if (!ownsContext()) return;
    resultNode.replaceChildren(el('p', 'error', (error as Error).message));
  });
}

function createShell(): void {
  app.innerHTML = `
    <a class="skip-link" href="#workbench">Skip to keyboard preview</a>
    <header class="masthead"><a class="brand" href="${import.meta.env.BASE_URL}"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>INZONE <strong>Profile Studio</strong></span></a><div class="masthead-links"><span class="unofficial">Unofficial · KBD-H75 US81</span><a href="https://github.com/rana/inzone-profile-studio" target="_blank" rel="noopener">Source</a><a href="https://inzone-hub-for-web.sony.net/" target="_blank" rel="noopener">Sony Hub</a></div></header>
    <div class="app-layout">
      <aside class="catalog" aria-label="Profile collection"><div class="catalog-heading"><h1>Your next favorite.</h1><p>Readable light. A few useful landmarks.</p></div><button type="button" id="favorites-filter" class="filter-button" aria-pressed="false">My favorites</button><label class="mobile-profile">Choose a profile<select id="mobile-profile"></select></label><nav id="profile-list" class="profile-list" aria-label="Choose a profile"></nav><p class="catalog-note">Curated acceptance describes physical trials. Your saved favorites belong to this browser.</p></aside>
      <main id="workbench" class="workbench">
        <div class="profile-heading"><div><span class="status-tag" id="profile-status"></span><h2 id="profile-title"></h2><p id="profile-summary"></p></div><div class="profile-heading-actions"><button type="button" id="favorite" class="quiet-button" aria-pressed="false"></button><button type="button" id="use-profile" class="primary-button">Use on my keyboard</button></div></div>
        <div class="workbench-toolbar"><div class="view-switch" role="group" aria-label="Preview tools"><button type="button" data-view="preview" aria-pressed="true">Preview</button><button type="button" data-view="compare" aria-pressed="false">Compare</button><button type="button" data-view="edit" aria-pressed="false">Make a variation</button></div><label class="swatch-toggle"><input type="checkbox" id="swatches" checked> Full color swatches</label></div>
        <section class="keyboard-section" aria-label="Selected palette preview"><div id="keyboard" class="keyboard-stage"></div><div class="preview-caption"><span id="draft-state"></span><span>81 keys lit · 100% brightness · preview only</span></div></section>
        <section id="compare-section" class="compare-section" hidden><div class="section-heading"><label>Compare with<select id="compare-profile"></select></label><p id="compare-result"></p></div><div id="compare-keyboard" class="keyboard-stage"></div></section>
        <section class="inspector" aria-label="Selected key"><span id="selected-key-swatch" class="selected-swatch" aria-hidden="true"></span><div class="selected-description"><strong id="selected-key-name"></strong><code id="selected-key-color"></code></div><label class="choose-key">Choose key<select id="key-select"></select></label><span class="inspector-tip">Click a key to inspect its color.</span></section>
        <section id="edit-section" class="edit-section" hidden><div><h3>Make it yours</h3><p>Work on a local variation. The original stays intact.</p></div><div class="edit-controls"><label>Apply color to<select id="edit-target"><option value="selected">Selected key</option><option value="shift">Both Shift keys</option><option value="hinge">Win and Fn</option><option value="ctrl">Both Ctrl keys</option><option value="alt">Both Alt keys</option><option value="gates">Tab and Enter</option></select></label><label>Color<input id="key-color" type="color" value="#FF0080"></label><label>Hex<input id="hex-color" value="#FF0080" maxlength="7" spellcheck="false" autocomplete="off"></label><button type="button" id="apply-color">Apply color</button></div><div class="edit-footer"><p>Ctrl, Alt and Shift pairs stay matched. Every key stays illuminated.</p><button type="button" id="reset-key" class="text-button">Restore selected key</button><button type="button" id="reset-draft" class="text-button">Restore this palette</button></div></section>
        <div class="action-bar"><button type="button" id="share-profile" class="quiet-button">Copy share link</button><button type="button" id="download-palette" class="quiet-button">Save palette</button><button type="button" id="copy-request" class="text-button">Copy assistant request</button></div>
        <p id="profile-acceptance" class="acceptance-note"></p><p id="notice" class="notice" role="status" aria-live="polite"></p><textarea id="copy-fallback" class="copy-fallback" aria-label="Text to copy" readonly hidden></textarea>
        <details class="setup-example"><summary>One example four-slot setup</summary><p id="setup-caption"></p><div id="example-slots" class="example-slots"></div><p>On the keyboard, hold Fn and tap Tab to cycle profiles. This page previews designs; it is not connected to your device.</p></details>
        <footer class="workbench-footer"><p>Exact RGB assignments, not calibrated LED output. Physical color and legibility vary with keycaps and room light.</p><p>Built for shared exploration. Native exports never leave this tab.</p></footer>
      </main>
    </div>
    <dialog id="export-dialog" aria-labelledby="export-title"><div class="dialog-heading"><div><h2 id="export-title">Use this look on your keyboard</h2><p>Prepare a file here. Apply it through Sony Hub.</p></div><button type="button" id="close-export" class="quiet-button">Close</button></div><p class="privacy-note">Your native files are processed in this tab only. They are not uploaded or saved by this site.</p><ol class="export-steps"><li><h3>Back up the actual slot</h3><p>In Sony Hub, select the physical slot you want to change and export it. Keep that original file. A native file does not identify its hardware slot.</p><div class="source-controls"><label>Physical source slot<select id="source-slot"><option value="">Choose the slot you exported</option><option value="1">Slot 1</option><option value="2">Slot 2</option><option value="3">Slot 3</option><option value="4">Slot 4</option></select></label><label>Original Sony export<input type="file" id="source-file" accept=".json,application/json"></label></div><p id="source-name"></p><button type="button" id="download-rollback" class="quiet-button" disabled>Save another rollback copy</button></li><li><h3>Prepare, then apply in Sony Hub</h3><p id="native-summary">No source export selected.</p><p id="target-slot" class="slot-reminder">Choose the physical source slot. The file does not identify it.</p><button type="button" id="download-native" class="primary-button" disabled>Download prepared native file</button><p>Import into that same slot in <a href="https://inzone-hub-for-web.sony.net/" target="_blank" rel="noopener">Sony Hub</a>, then Save. If import is unavailable, your assistant can apply the exact colors through Sony’s editor. Your Sony profile name stays unchanged; verify before renaming.</p></li><li><h3>Verify a fresh export</h3><p>Export the saved slot again and compare it here.</p><label>New export after Save<input type="file" id="readback-file" accept=".json,application/json" disabled></label><div id="verify-result" class="verify-result" role="status" aria-live="polite"></div></li></ol><p id="export-message" class="notice" role="status" aria-live="polite"></p><p class="compatibility-note">Supports the inspected KBD-H75 US81 Sony Web export format 1.2.1.0. Unknown formats are refused. Preparing a file does not write the keyboard or establish compatibility with another device.</p><button type="button" id="clear-export" class="text-button">Clear loaded files</button></dialog>`;
}
function wireEvents(): void {
  byId<HTMLSelectElement>('mobile-profile').addEventListener('change', event => selectProfile((event.target as HTMLSelectElement).value));
  byId('favorites-filter').addEventListener('click', () => { favoritesOnly = !favoritesOnly; renderCatalog(); });
  byId('favorite').addEventListener('click', () => { favorites.has(selectedId) ? favorites.delete(selectedId) : favorites.add(selectedId); persist(); render(); });
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view as typeof view; render(); }));
  byId<HTMLSelectElement>('compare-profile').addEventListener('change', event => { compareId = (event.target as HTMLSelectElement).value; renderBoards(); });
  byId<HTMLInputElement>('swatches').addEventListener('change', event => { swatches = (event.target as HTMLInputElement).checked; renderBoards(); });
  byId<HTMLSelectElement>('key-select').addEventListener('change', event => { selectedKey = (event.target as HTMLSelectElement).value; renderInspector(); renderBoards(); });
  byId('edit-target').addEventListener('change', () => renderInspector());
  byId<HTMLInputElement>('key-color').addEventListener('input', event => { byId<HTMLInputElement>('hex-color').value = (event.target as HTMLInputElement).value.toUpperCase(); });
  byId('apply-color').addEventListener('click', () => { const group = byId<HTMLSelectElement>('edit-target').value; applyEdit(group === 'selected' ? [selectedKey] : groupKeys[group]!, byId<HTMLInputElement>('hex-color').value); });
  byId('reset-key').addEventListener('click', () => applyEdit([selectedKey], currentBase().key_colors[selectedKey]!));
  byId('reset-draft').addEventListener('click', () => { drafts.delete(selectedId); updateUrl(); persist(); renderProfileContext(); renderInspector(); renderBoards(); inform('Original palette restored.'); });
  byId('share-profile').addEventListener('click', () => { void copyText(shareUrl(location.href, selectedId, currentColors(), currentBase().key_colors), 'Share link copied. It includes this palette and your color changes, not native files.'); });
  byId('download-palette').addEventListener('click', () => { const candidate = selectedCandidate(); download(JSON.stringify(candidate, null, 2) + '\n', `${candidate.id}.json`); inform('Palette saved. Use “Use on my keyboard” to prepare a native Sony file.'); });
  byId('copy-request').addEventListener('click', () => { const link = shareUrl(location.href, selectedId, currentColors(), currentBase().key_colors); void copyText(`Apply the INZONE Profile Studio look “${selectedCandidate().name}”: ${link}. Back up the actual target slot first. Prepare from its fresh same-slot Sony Web native export, preserve Main/Fn, performance, macros and other unrelated fields, apply through Sony Hub and Save. Take a new same-slot export and verify every field. Keep a rollback and record physical feedback. Palette data is design intent, not a native Sony import.`, 'Assistant request copied. Paste it into your assistant chat.'); });
  const dialog = byId<HTMLDialogElement>('export-dialog');
  byId('use-profile').addEventListener('click', () => { clearExport(); dialog.showModal(); });
  byId('close-export').addEventListener('click', () => { clearExport(); dialog.close(); });
  dialog.addEventListener('cancel', () => clearExport());
  dialog.addEventListener('close', () => { if (!dialog.open) clearExport(); });
  byId('clear-export').addEventListener('click', () => clearExport());
  byId('source-file').addEventListener('change', () => { void loadNativeSource(); });
  // A changed slot starts a fresh read context, even when the same file remains selected.
  byId('source-slot').addEventListener('change', () => { void loadNativeSource(); });
  byId('download-rollback').addEventListener('click', () => { if (sourceFile) download(sourceFile, `slot-${byId<HTMLSelectElement>('source-slot').value}-original-rollback.json`); });
  byId('download-native').addEventListener('click', () => {
    const slot = byId<HTMLSelectElement>('source-slot').value; if (!prepared || !slot || !exportCandidate) return;
    download(JSON.stringify(prepared.profile, null, 2) + '\n', `slot-${slot}-${exportCandidate.id}-native.json`);
    preparedDownloaded = true; updateExportControls(); exportMessage(`Prepared file saved for physical slot ${slot}. Apply it to that same slot, Save, then verify a fresh export below.`);
  });
  byId('readback-file').addEventListener('change', () => { void verifyReadback(); });
}
async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(asset(path)); if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`); return response.json() as Promise<T>;
}
async function start(): Promise<void> {
  if (location.protocol === 'file:') throw new Error('Open the published studio, or start the local app with npm run dev. Opening the source HTML as a file cannot load the app.');
  const results = await Promise.all([loadJson<Catalog>('data/catalog.json'), loadJson<{ keys: LayoutKey[] }>('data/layout.json')]);
  catalog = results[0]; layout = results[1].keys;
  if (!catalog.profiles?.length || !Array.isArray(layout)) throw new Error('The profile collection is incomplete.');
  await Promise.all(catalog.profiles.map(async profile => { const candidate = await loadJson<Candidate>(profile.palette); validateColors(candidate.key_colors, layout); palettes.set(profile.id, candidate); }));
  selectedId = palettes.has(catalog.defaultProfileId) ? catalog.defaultProfileId : catalog.profiles[0]!.id;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE) || '{}') as { favorites?: string[]; drafts?: Record<string, Record<string, string>>; selectedId?: string };
    favorites = new Set((stored.favorites || []).filter(id => palettes.has(id)));
    if (stored.selectedId && palettes.has(stored.selectedId)) selectedId = stored.selectedId;
    for (const [id, colors] of Object.entries(stored.drafts || {})) if (palettes.has(id)) { try { validateColors(colors, layout); drafts.set(id, colors); } catch { /* Discard incompatible stored draft only. */ } }
  } catch { /* A disabled or malformed local store does not prevent browsing. */ }
  const fromUrl = new URL(location.href).searchParams.get('profile');
  if (fromUrl && palettes.has(fromUrl)) {
    selectedId = fromUrl;
    // An explicit share URL describes this exact palette, overriding an older local draft.
    drafts.delete(selectedId);
  }
  let urlWarning = fromUrl && !palettes.has(fromUrl) ? 'The shared profile is not in this collection. Showing your saved or default palette instead.' : '';
  if (!urlWarning && new URL(location.href).searchParams.has('colors')) { try { drafts.set(selectedId, colorsFromUrl(location.href, currentBase().key_colors, layout)); } catch (error) { urlWarning = (error as Error).message; } }
  createShell(); wireEvents();
  const keySelect = byId<HTMLSelectElement>('key-select'); layout.forEach(key => { const option = el('option', '', nameOf(key)); option.value = key.id; keySelect.append(option); });
  compareId = currentMeta().parentId || catalog.profiles.find(profile => profile.id !== selectedId)!.id;
  byId('setup-caption').textContent = `${catalog.setupLabel || 'Example setup; not a connected device'}. Recorded ${catalog.verifiedAt || 'with the collection'}.`;
  for (const slot of catalog.slots || []) { const profile = catalog.profiles.find(item => item.id === slot.profileId); if (!profile) continue; const button = el('button', 'slot-example'); button.type = 'button'; button.append(el('span', 'slot-number', String(slot.slot)), el('span', '', profile.name)); button.addEventListener('click', () => selectProfile(profile.id)); byId('example-slots').append(button); }
  let observedKeyboardWidth = -1;
  let resizeFrame = 0;
  resizeObserver = new ResizeObserver(entries => {
    const width = Math.round(entries[0]!.contentRect.width);
    if (width === observedKeyboardWidth) return;
    observedKeyboardWidth = width;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(renderBoards);
  });
  resizeObserver.observe(byId('keyboard'));
  render(); if (urlWarning) inform(urlWarning, true);
}
void start().catch(error => {
  app.replaceChildren(); const main = el('main', 'loading'); main.append(el('h1', '', 'INZONE Profile Studio'), el('p', 'error', (error as Error).message), el('p', '', 'Reload the page to try again. For a local checkout, run npm install and npm run dev, then open the printed local URL.'));
  const reload = el('button', 'primary-button', 'Reload studio'); reload.type = 'button'; reload.addEventListener('click', () => location.reload()); main.append(reload); app.append(main);
});
