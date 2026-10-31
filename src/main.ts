import './style.css';
import { LatestTask } from './async-task';
import { readPaletteFile } from './palette-file';
import { readNativeFile, prepareNative, verifyNative } from './native';
import { colorDifferences, colorsFromUrl, makeCandidate, publicShareUrl, recolor, shareUrl, validateColors } from './model';
import { ALL_STUDIES, applyStudy, matchingStudy } from './studies';
import type { PaletteStudy } from './studies';
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
// Trials have their own temporary colors: browsing them never replaces a saved draft.
let studyPreview: { colors: Record<string, string>; returnId: string } | null = null;
let selectedId = '';
let selectedKey = 'SHIFT_L';
let compareId = '';
// Which board is displayed never changes the selected palette or export context.
let compareSide: 'selected' | 'reference' = 'selected';
let favorites = new Set<string>();
let favoritesOnly = false;
let view: 'preview' | 'compare' | 'edit' = 'preview';
let swatches = true;
let resizeObserver: ResizeObserver;
let sourceFile: File | null = null;
let prepared: ReturnType<typeof prepareNative> | null = null;
let exportCandidate: Candidate | null = null;
let preparedDownloaded = false;
const paletteTask = new LatestTask();
const sourceTask = new LatestTask();
const readbackTask = new LatestTask();
const copyTask = new LatestTask();

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
function currentColors(): Record<string, string> { return studyPreview?.colors || drafts.get(selectedId) || currentBase().key_colors; }
function currentStudy(): PaletteStudy | undefined { return matchingStudy(selectedId, currentColors(), currentBase().key_colors, layout); }
function defaultComparisonId(): string {
  if (colorDifferences(currentBase().key_colors, currentColors()).length) return selectedId;
  const meta = currentMeta();
  return meta.parentId && palettes.has(meta.parentId) ? meta.parentId : catalog.profiles.find(profile => profile.id !== selectedId)!.id;
}
function nameOf(key: LayoutKey): string { return keyNames[key.id] || key.label; }
function inform(message: string, error = false): void { const node = byId('notice'); node.textContent = message; node.classList.toggle('error', error); node.setAttribute('role', error ? 'alert' : 'status'); }
function persist(): void {
  try { localStorage.setItem(STORAGE, JSON.stringify({ favorites: [...favorites], drafts: Object.fromEntries(drafts), selectedId: studyPreview?.returnId || selectedId })); }
  catch { inform('This browser could not save your local choices. Download a palette to keep a copy.'); }
}
function download(data: BlobPart | Blob, filename: string, type = 'application/json'): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob); const a = el('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function invalidateSharing(): void {
  copyTask.invalidate();
  byId('share-panel').hidden = true;
  byId<HTMLInputElement>('public-share-link').value = '';
  byId<HTMLAnchorElement>('open-shared-preview').removeAttribute('href');
  const fallback = byId<HTMLTextAreaElement>('copy-fallback');
  fallback.hidden = true; fallback.value = '';
}
async function copyText(text: string, success: string, fallback: 'public-link' | 'text'): Promise<void> {
  const profileId = selectedId;
  const base = currentBase();
  const colors = currentColors();
  const ownsContext = (): boolean => selectedId === profileId && currentBase() === base && currentColors() === colors;
  await copyTask.run(() => navigator.clipboard.writeText(text), () => {
    if (!ownsContext()) return;
    byId<HTMLTextAreaElement>('copy-fallback').hidden = true; inform(success);
  }, () => {
    if (!ownsContext()) return;
    if (fallback === 'public-link') {
      const field = byId<HTMLInputElement>('public-share-link');
      field.focus(); field.select(); inform('Copy the selected public share link below.');
    } else {
      const field = byId<HTMLTextAreaElement>('copy-fallback');
      field.hidden = false; field.value = text; field.focus(); field.select(); inform('Copy the selected assistant request below.');
    }
  });
}
function shareCurrentPalette(forAssistant: boolean): void {
  invalidateSharing();
  try {
    const link = publicShareUrl(selectedId, currentColors(), currentBase().key_colors, layout);
    byId<HTMLInputElement>('public-share-link').value = link;
    byId<HTMLAnchorElement>('open-shared-preview').href = link;
    byId('share-panel').hidden = false;
    if (forAssistant) {
      const request = `Apply the INZONE Profile Studio look “${selectedCandidate().name}”: ${link}. Back up the actual target slot first. Prepare from its fresh same-slot Sony Web native export, preserve Main/Fn, performance, macros and other unrelated fields, apply through Sony Hub and Save. Take a new same-slot export and verify every field. Keep a rollback and record physical feedback. Palette data is design intent, not a native Sony import.`;
      void copyText(request, 'Assistant request copied. Paste it into your assistant chat.', 'text');
    } else {
      void copyText(link, 'Public share link copied. It carries all 81 colors, not native exports.', 'public-link');
    }
  } catch (error) { inform((error as Error).message, true); }
}
function updateUrl(): void {
  history.replaceState(null, '', shareUrl(location.href, selectedId, currentColors(), currentBase().key_colors));
}
function invalidatePaletteRead(): void {
  paletteTask.invalidate();
  byId<HTMLInputElement>('palette-file').value = '';
  byId('open-palette').removeAttribute('aria-busy');
}
function closeNativeWorkflow(): void {
  clearExport();
  const dialog = byId<HTMLDialogElement>('export-dialog');
  if (dialog.open) dialog.close();
}
function selectProfile(id: string): void {
  if (!palettes.has(id)) return;
  invalidatePaletteRead(); invalidateSharing(); closeNativeWorkflow();
  studyPreview = null;
  selectedId = id; selectedKey = 'SHIFT_L'; compareSide = 'selected'; byId<HTMLDetailsElement>('both-boards').open = false;
  compareId = defaultComparisonId();
  updateUrl(); persist(); render(); inform('');
}
function previewStudy(study: PaletteStudy): void {
  const base = palettes.get(study.baseId);
  if (!base) { inform('This study needs its original palette in the collection.', true); return; }
  const colors = applyStudy(study, base.key_colors, layout);
  const returnId = studyPreview?.returnId || selectedId;
  invalidatePaletteRead(); invalidateSharing(); closeNativeWorkflow();
  selectedId = study.baseId; studyPreview = { colors, returnId };
  selectedKey = Object.keys(study.changes)[0]!; compareId = study.baseId; view = 'compare'; compareSide = 'selected'; byId<HTMLDetailsElement>('both-boards').open = false;
  updateUrl(); render();
  byId('study-list').querySelector<HTMLButtonElement>(`[data-study="${study.id}"]`)?.focus({ preventScroll: true });
  inform(`${study.name} is a temporary preview. Your saved variation is unchanged. Save or share this study to keep it; “Leave preview” returns to your palette.`);
}
function renderStudies(): void {
  const study = currentStudy();
  const list = byId('study-list'); list.replaceChildren();
  const studyButton = (item: PaletteStudy): HTMLButtonElement => {
    const button = el('button', 'study-choice'); button.type = 'button';
    button.dataset.study = item.id; button.setAttribute('aria-pressed', String(study?.id === item.id));
    const samples = el('span', 'study-samples'); samples.setAttribute('aria-hidden', 'true');
    [...new Set(Object.values(item.changes))].forEach(color => { const sample = el('i'); sample.style.backgroundColor = color; samples.append(sample); });
    const count = Object.keys(item.changes).length;
    button.append(samples, el('strong', '', item.name), el('span', 'study-count', `${count} ${count === 1 ? 'key' : 'keys'}`), el('span', 'study-summary', item.summary));
    button.addEventListener('click', () => previewStudy(item)); return button;
  };
  for (const [family, title] of [['palette', 'Alternate palettes'], ['frame', 'Command frame'], ['punctuation', 'Punctuation landmarks']]) {
    const group = el('section', 'study-family'); group.append(el('h3', '', title!));
    const choices = el('div', 'study-list'); group.append(choices); list.append(group);
    for (const item of ALL_STUDIES.filter(item => item.family === family && !item.archived)) choices.append(studyButton(item));
    const archived = ALL_STUDIES.filter(item => item.family === family && item.archived);
    if (archived.length) {
      const history = el('details', 'study-archive'); history.open = !!study?.archived;
      const olderChoices = el('div', 'study-list'); archived.forEach(item => olderChoices.append(studyButton(item)));
      history.append(el('summary', '', 'Earlier versions'), olderChoices); group.append(history);
    }
  }
  byId('leave-study').hidden = !studyPreview;
  byId('study-question').textContent = study ? study.question : 'Try a different overall mood, or refine one relationship in the keeper. Each study states the question it explores.';
  if (study || studyPreview) byId<HTMLDetailsElement>('studies').open = true;
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
  svg.append(svgEl('title', {}, title), svgEl('desc', {}, `Colors are assigned RGB values, not calibrated LED output. ${interactive ? 'Click a key or use the Choose key control to inspect it.' : 'Read-only reference preview. Return to Selected look to inspect or edit the selected palette.'}`));
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
  const referenceVisible = view === 'compare' && compareSide === 'reference' && !!other;
  const selectedName = selectedCandidate().name;
  const shownName = referenceVisible ? other!.name : selectedName;
  drawKeyboard(byId('keyboard'), referenceVisible ? other!.key_colors : colors, shownName, !referenceVisible, view === 'compare' ? differences : []);
  const bothBoards = byId<HTMLDetailsElement>('both-boards');
  if (view === 'compare' && bothBoards.open && other) drawKeyboard(byId('compare-keyboard'), other.key_colors, other.name, false, differences);
  byId('compare-result').textContent = `${differences.length} ${differences.length === 1 ? 'key differs' : 'keys differ'}. Dots mark the changed keys.`;
  byId('compare-selected').setAttribute('aria-pressed', String(!referenceVisible));
  byId('compare-reference').setAttribute('aria-pressed', String(referenceVisible));
  byId<HTMLButtonElement>('compare-reference').disabled = !other;
  const caption = `Viewing ${referenceVisible ? 'reference' : 'selected look'}: ${shownName}. Save, share and use on keyboard target ${selectedName}.`;
  const captionNode = byId('compare-view-caption');
  if (captionNode.textContent !== caption) captionNode.textContent = caption;
  byId('key-inspector').hidden = referenceVisible;
  const changed = colorDifferences(currentBase().key_colors, colors);
  byId('draft-state').textContent = referenceVisible ? `Reference · ${other!.name}` : changed.length ? `${currentStudy()?.name || (studyPreview ? 'Temporary variation' : 'Your variation')} · ${changed.length} ${changed.length === 1 ? 'key changed' : 'keys changed'}` : 'Original palette';
  const list = byId('comparison-changes'); list.replaceChildren();
  if (view === 'compare' && other) for (const id of differences) {
    const item = el('li'); item.append(el('strong', '', nameOf(layout.find(key => key.id === id)!)));
    for (const [label, color] of [['Reference', other.key_colors[id]!], ['Selected', colors[id]!]]) {
      const value = el('span', 'change-color'); const sample = el('i'); sample.style.backgroundColor = color!; sample.setAttribute('aria-hidden', 'true');
      value.append(sample, el('span', '', `${label}: ${color}`)); item.append(value);
    }
    list.append(item);
  }
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
  byId<HTMLButtonElement>('reset-draft').disabled = !changed.length;
  byId<HTMLButtonElement>('reset-key').disabled = currentColors()[selectedKey] === currentBase().key_colors[selectedKey];
}
function renderProfileContext(): void {
  const meta = currentMeta();
  const study = currentStudy();
  const edited = colorDifferences(currentBase().key_colors, currentColors()).length > 0;
  byId('profile-title').textContent = study?.name || (edited ? `${meta.name} — your variation` : meta.name);
  byId('profile-summary').textContent = study?.summary || meta.summary;
  byId('profile-acceptance').textContent = study
    ? study.trial
      ? `${study.trial.note} Source palette: ${meta.name}. Feedback applies to this exact study; previewing does not change your keyboard.`
      : `Proposed ${study.family === 'palette' ? 'alternate-palette' : study.family === 'frame' ? 'command-frame' : 'punctuation'} study of ${meta.name}. No physical verdict is recorded for this exact look. Previewing does not change your keyboard.`
    : edited
    ? `This local variation has not been physically tested. Source palette: ${meta.name}. ${meta.acceptance || ''}`
    : meta.acceptance || statusNames[meta.status];
  byId('profile-status').textContent = study
    ? study.trial?.status === 'liked' ? 'Study · liked in one physical trial' : study.trial?.status === 'revision-requested' ? 'Study · revision requested' : 'Study · no physical verdict'
    : edited ? 'Local variation' : statusNames[meta.status];
}
function render(): void {
  if (view !== 'compare') { compareSide = 'selected'; byId<HTMLDetailsElement>('both-boards').open = false; }
  renderCatalog(); renderProfileContext(); renderStudies();
  const star = byId<HTMLButtonElement>('favorite'); star.setAttribute('aria-pressed', String(favorites.has(selectedId))); star.textContent = favorites.has(selectedId) ? '★ Saved favorite' : '☆ Save favorite';
  star.disabled = !!studyPreview && colorDifferences(currentBase().key_colors, currentColors()).length > 0; star.title = star.disabled ? 'Save this study as a palette file or share its link. Favorites mark published originals.' : '';
  byId('compare-controls').hidden = view !== 'compare'; byId('compare-section').hidden = view !== 'compare'; byId('edit-section').hidden = view !== 'edit';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  const compare = byId<HTMLSelectElement>('compare-profile'); compare.replaceChildren();
  for (const profile of catalog.profiles) {
    const option = el('option', '', profile.name + (profile.id === selectedId ? ' (original)' : ''));
    option.value = profile.id; compare.append(option);
  }
  compare.value = compareId;
  renderInspector(); requestAnimationFrame(renderBoards);
}
function applyEdit(keys: string[], color: string): void {
  compareSide = 'selected';
  invalidatePaletteRead(); invalidateSharing(); closeNativeWorkflow();
  try {
    const colors = recolor(currentColors(), keys, color); validateColors(colors, layout);
    if (studyPreview) studyPreview.colors = colors; else drafts.set(selectedId, colors);
    updateUrl(); persist(); render();
    inform(studyPreview ? 'Temporary preview edited. Save the palette or share it to keep a copy. Your saved variation is unchanged.' : 'Variation saved in this browser. Download or share it to keep another copy.');
  }
  catch (error) { inform((error as Error).message, true); renderInspector(); }
}
async function openPaletteFile(): Promise<void> {
  paletteTask.invalidate();
  invalidateSharing();
  const input = byId<HTMLInputElement>('palette-file');
  const file = input.files?.[0];
  byId('open-palette').removeAttribute('aria-busy');
  if (!file) return;
  const sourceId = selectedId;
  const source = currentBase();
  closeNativeWorkflow();
  byId('open-palette').setAttribute('aria-busy', 'true');
  inform('Opening the palette design…');
  const ownsContext = (): boolean =>
    selectedId === sourceId && currentBase() === source && input.files?.[0] === file;
  await paletteTask.run(() => readPaletteFile(file, layout), imported => {
    if (!ownsContext()) return;
    validateColors(imported.colors, layout);
    const exactId = imported.id && palettes.has(imported.id) ? imported.id : undefined;
    const draftBase = imported.id?.endsWith('-draft') ? imported.id.slice(0, -6) : undefined;
    const knownId = exactId || (draftBase && palettes.has(draftBase) ? draftBase : undefined);
    const baseId = knownId || sourceId;
    invalidateSharing(); closeNativeWorkflow();
    studyPreview = null; selectedId = baseId; selectedKey = 'SHIFT_L'; compareSide = 'selected'; byId<HTMLDetailsElement>('both-boards').open = false;
    const matchesOriginal = colorDifferences(currentBase().key_colors, imported.colors).length === 0;
    if (matchesOriginal) drafts.delete(baseId);
    else drafts.set(baseId, { ...imported.colors });
    compareId = baseId; view = 'compare';
    updateUrl(); persist(); render();
    byId('open-palette').removeAttribute('aria-busy'); input.value = '';
    const reference = currentMeta().name;
    const association = knownId ? '' : ` No matching library palette was identified; ${reference} is used for comparison.`;
    inform(matchesOriginal
      ? `“${imported.name}” matches the published ${reference} palette. Showing that original; the file adds no physical acceptance evidence.${association}`
      : `Opened “${imported.name}” as a local variation of ${reference}, not a physically tested look.${association} Save the palette or share its link to keep a portable copy.`);
  }, error => {
    if (!ownsContext()) return;
    byId('open-palette').removeAttribute('aria-busy'); input.value = '';
    inform((error as Error).message, true);
  });
}

function selectedCandidate(): Candidate {
  const candidate = makeCandidate(currentBase(), currentColors(), layout);
  const study = currentStudy();
  return study ? { ...candidate, name: study.name } : candidate;
}
function candidateFilename(): string { return currentStudy() ? `${selectedId}-${currentStudy()!.id}` : selectedCandidate().id!; }
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
        <details id="studies" class="study-shelf"><summary>Explore studies <span>Alternate palettes and refinements</span></summary><p>Each study explores a stated design question. Physical feedback is noted where available. Previewing keeps your saved variation intact.</p><div id="study-list" class="study-groups"></div><div class="study-followup"><p id="study-question"></p><button type="button" id="leave-study" class="quiet-button" hidden>Leave preview · return to my palette</button></div></details>
        <div class="workbench-toolbar"><div class="view-switch" role="group" aria-label="Preview tools"><button type="button" data-view="preview" aria-pressed="true">Preview</button><button type="button" data-view="compare" aria-pressed="false">Compare</button><button type="button" data-view="edit" aria-pressed="false">Make a variation</button></div><label class="swatch-toggle"><input type="checkbox" id="swatches" checked> Full color swatches</label></div>
        <section id="compare-controls" class="compare-controls" aria-label="Compare in place" hidden><div class="compare-toolbar"><label>Compare with<select id="compare-profile"></select></label><div class="compare-side" role="group" aria-label="Board to view"><button type="button" id="compare-selected" aria-pressed="true">Selected look</button><button type="button" id="compare-reference" aria-pressed="false">Reference</button></div></div><p id="compare-view-caption" class="compare-view-caption" role="status" aria-live="polite"></p></section>
        <section class="keyboard-section" aria-label="Keyboard color preview"><div id="keyboard" class="keyboard-stage"></div><div class="preview-caption"><span id="draft-state"></span><span>81 keys lit · 100% brightness · preview only</span></div></section>
        <section id="compare-section" class="compare-section" hidden><p id="compare-result"></p><ul id="comparison-changes" class="comparison-changes" aria-label="Exact color differences"></ul><details id="both-boards" class="reference-board"><summary>Show reference board below</summary><div id="compare-keyboard" class="keyboard-stage"></div></details></section>
        <section id="key-inspector" class="inspector" aria-label="Selected key"><span id="selected-key-swatch" class="selected-swatch" aria-hidden="true"></span><div class="selected-description"><strong id="selected-key-name"></strong><code id="selected-key-color"></code></div><label class="choose-key">Choose key<select id="key-select"></select></label><span class="inspector-tip">Click a key to inspect its color.</span></section>
        <section id="edit-section" class="edit-section" hidden><div><h3>Make it yours</h3><p>Work on a local variation. The original stays intact.</p></div><div class="edit-controls"><label>Apply color to<select id="edit-target"><option value="selected">Selected key</option><option value="shift">Both Shift keys</option><option value="hinge">Win and Fn</option><option value="ctrl">Both Ctrl keys</option><option value="alt">Both Alt keys</option><option value="gates">Tab and Enter</option></select></label><label>Color<input id="key-color" type="color" value="#FF0080"></label><label>Hex<input id="hex-color" value="#FF0080" maxlength="7" spellcheck="false" autocomplete="off"></label><button type="button" id="apply-color">Apply color</button></div><div class="edit-footer"><p>Ctrl, Alt and Shift pairs stay matched. Every key stays illuminated.</p><button type="button" id="reset-key" class="text-button">Restore selected key</button><button type="button" id="reset-draft" class="text-button">Restore this palette</button></div></section>
        <div class="action-bar"><button type="button" id="share-profile" class="quiet-button">Copy share link</button><button type="button" id="download-palette" class="quiet-button">Save palette</button><button type="button" id="open-palette" class="quiet-button" aria-describedby="palette-file-help">Open palette JSON</button><input type="file" id="palette-file" accept=".json,application/json" aria-label="Open palette design JSON" hidden><button type="button" id="copy-request" class="text-button">Copy assistant request</button></div>
        <section id="share-panel" class="share-panel" aria-label="Share this palette" hidden><label for="public-share-link">Public share link</label><div class="share-link-row"><input id="public-share-link" type="url" readonly spellcheck="false" aria-describedby="public-share-help"><a id="open-shared-preview" target="_blank" rel="noopener">Open shared preview ↗</a></div><p id="public-share-help">The recipient opens the public studio online. This link carries all 81 colors, not native exports.</p></section>
        <p id="palette-file-help" class="palette-file-help">Palette design files open here. Sony native exports belong in “Use on my keyboard”.</p><p id="profile-acceptance" class="acceptance-note"></p><p id="notice" class="notice" role="status" aria-live="polite"></p><textarea id="copy-fallback" class="copy-fallback" aria-label="Text to copy" readonly hidden></textarea>
        <details class="setup-example"><summary>One example four-slot setup</summary><p id="setup-caption"></p><div id="example-slots" class="example-slots"></div><p>On the keyboard, hold Fn and tap Tab to cycle profiles. This page previews designs; it is not connected to your device.</p></details>
        <footer class="workbench-footer"><p>Exact RGB assignments, not calibrated LED output. Physical color and legibility vary with keycaps and room light.</p><p>Built for shared exploration. Native exports never leave this tab.</p><p><a href="https://github.com/rana/inzone-profile-studio/releases/latest/download/inzone-profile-studio-offline.zip">Keep an offline copy</a> · <a href="https://github.com/rana/inzone-profile-studio/blob/main/docs/RECOVERY.md" target="_blank" rel="noopener">Recovery guide</a><br>Requires Node 22.12+ on the Node 22 line. Save important variations as palette files; browser favorites and drafts are not included.</p></footer>
      </main>
    </div>
    <dialog id="export-dialog" aria-labelledby="export-title"><div class="dialog-heading"><div><h2 id="export-title">Use this look on your keyboard</h2><p>Prepare a file here. Apply it through Sony Hub.</p></div><button type="button" id="close-export" class="quiet-button">Close</button></div><p class="privacy-note">Your native files are processed in this tab only. They are not uploaded or saved by this site.</p><ol class="export-steps"><li><h3>Back up the actual slot</h3><p>In Sony Hub, select the physical slot you want to change and export it. Keep that original file. A native file does not identify its hardware slot.</p><div class="source-controls"><label>Physical source slot<select id="source-slot"><option value="">Choose the slot you exported</option><option value="1">Slot 1</option><option value="2">Slot 2</option><option value="3">Slot 3</option><option value="4">Slot 4</option></select></label><label>Original Sony export<input type="file" id="source-file" accept=".json,application/json"></label></div><p id="source-name"></p><button type="button" id="download-rollback" class="quiet-button" disabled>Save another rollback copy</button></li><li><h3>Prepare, then apply in Sony Hub</h3><p id="native-summary">No source export selected.</p><p id="target-slot" class="slot-reminder">Choose the physical source slot. The file does not identify it.</p><button type="button" id="download-native" class="primary-button" disabled>Download prepared native file</button><p>Import into that same slot in <a href="https://inzone-hub-for-web.sony.net/" target="_blank" rel="noopener">Sony Hub</a>, then Save. If import is unavailable, your assistant can apply the exact colors through Sony’s editor. Your Sony profile name stays unchanged; verify before renaming.</p></li><li><h3>Verify a fresh export</h3><p>Export the saved slot again and compare it here.</p><label>New export after Save<input type="file" id="readback-file" accept=".json,application/json" disabled></label><div id="verify-result" class="verify-result" role="status" aria-live="polite"></div></li></ol><p id="export-message" class="notice" role="status" aria-live="polite"></p><p class="compatibility-note">Supports the inspected KBD-H75 US81 Sony Web export format 1.2.1.0. Unknown formats are refused. Preparing a file does not write the keyboard or establish compatibility with another device.</p><button type="button" id="clear-export" class="text-button">Clear loaded files</button></dialog>`;
}
function wireEvents(): void {
  byId('leave-study').addEventListener('click', () => {
    const returnId = studyPreview?.returnId; if (!returnId) return;
    selectProfile(returnId); view = 'preview'; render(); inform('Returned to your palette. Your saved variation is unchanged.');
  });
  byId<HTMLSelectElement>('mobile-profile').addEventListener('change', event => selectProfile((event.target as HTMLSelectElement).value));
  byId('favorites-filter').addEventListener('click', () => { favoritesOnly = !favoritesOnly; renderCatalog(); });
  byId('favorite').addEventListener('click', () => { favorites.has(selectedId) ? favorites.delete(selectedId) : favorites.add(selectedId); persist(); render(); });
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view as typeof view; render(); }));
  byId<HTMLSelectElement>('compare-profile').addEventListener('change', event => { compareId = (event.target as HTMLSelectElement).value; compareSide = 'selected'; renderBoards(); });
  byId('compare-selected').addEventListener('click', () => { compareSide = 'selected'; renderBoards(); });
  byId('compare-reference').addEventListener('click', () => { compareSide = 'reference'; renderBoards(); });
  byId('both-boards').addEventListener('toggle', () => renderBoards());
  byId<HTMLInputElement>('swatches').addEventListener('change', event => { swatches = (event.target as HTMLInputElement).checked; renderBoards(); });
  byId<HTMLSelectElement>('key-select').addEventListener('change', event => { selectedKey = (event.target as HTMLSelectElement).value; renderInspector(); renderBoards(); });
  byId('edit-target').addEventListener('change', () => { invalidatePaletteRead(); invalidateSharing(); renderInspector(); });
  byId<HTMLInputElement>('key-color').addEventListener('input', event => { invalidatePaletteRead(); invalidateSharing(); byId<HTMLInputElement>('hex-color').value = (event.target as HTMLInputElement).value.toUpperCase(); });
  byId('hex-color').addEventListener('input', () => { invalidatePaletteRead(); invalidateSharing(); });
  byId('apply-color').addEventListener('click', () => { const group = byId<HTMLSelectElement>('edit-target').value; applyEdit(group === 'selected' ? [selectedKey] : groupKeys[group]!, byId<HTMLInputElement>('hex-color').value); });
  byId('reset-key').addEventListener('click', () => applyEdit([selectedKey], currentBase().key_colors[selectedKey]!));
  byId('reset-draft').addEventListener('click', () => { compareSide = 'selected'; invalidatePaletteRead(); invalidateSharing(); closeNativeWorkflow(); if (studyPreview) studyPreview.colors = { ...currentBase().key_colors }; else drafts.delete(selectedId); updateUrl(); persist(); render(); inform(studyPreview ? 'Previewing the original. Your saved variation is unchanged; “Leave preview” returns to it.' : 'Original palette restored.'); });
  byId('share-profile').addEventListener('click', () => shareCurrentPalette(false));
  byId<HTMLInputElement>('public-share-link').addEventListener('focus', event => (event.target as HTMLInputElement).select());
  byId('open-palette').addEventListener('click', () => { compareSide = 'selected'; renderBoards(); invalidatePaletteRead(); invalidateSharing(); inform('Choose a palette design JSON file. Sony native exports use the separate native workflow.'); byId<HTMLInputElement>('palette-file').click(); });
  byId('palette-file').addEventListener('change', () => { void openPaletteFile(); });
  byId('palette-file').addEventListener('cancel', () => { invalidatePaletteRead(); inform('No palette opened. The current preview is unchanged.'); });
  byId('download-palette').addEventListener('click', () => { const candidate = selectedCandidate(); download(JSON.stringify(candidate, null, 2) + '\n', `${candidateFilename()}.json`); inform('Palette saved. Reopen it with “Open palette JSON”. To prepare a Sony import, choose “Use on my keyboard”.'); });
  byId('copy-request').addEventListener('click', () => shareCurrentPalette(true));
  const dialog = byId<HTMLDialogElement>('export-dialog');
  byId('use-profile').addEventListener('click', () => { compareSide = 'selected'; renderBoards(); invalidatePaletteRead(); invalidateSharing(); clearExport(); dialog.showModal(); });
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
    download(JSON.stringify(prepared.profile, null, 2) + '\n', `slot-${slot}-${candidateFilename()}-native.json`);
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
  const returnId = selectedId;
  if (fromUrl && palettes.has(fromUrl)) {
    selectedId = fromUrl;
    // Explicit links show their exact look without replacing an older local draft.
    studyPreview = { colors: { ...currentBase().key_colors }, returnId };
  }
  let urlWarning = fromUrl && !palettes.has(fromUrl) ? 'The shared profile is not in this collection. Showing your saved or default palette instead.' : '';
  if (!urlWarning && new URL(location.href).searchParams.has('colors')) { try { studyPreview = { colors: colorsFromUrl(location.href, currentBase().key_colors, layout), returnId }; } catch (error) { urlWarning = (error as Error).message; } }
  createShell(); wireEvents();
  const keySelect = byId<HTMLSelectElement>('key-select'); layout.forEach(key => { const option = el('option', '', nameOf(key)); option.value = key.id; keySelect.append(option); });
  compareId = defaultComparisonId();
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
