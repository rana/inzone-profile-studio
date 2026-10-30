/** Dependency-free integrity check for an extracted offline bundle, not a signature. */
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2] || dirname(fileURLToPath(import.meta.url)));
const fail = message => { throw new Error(message); };
const safePath = name => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(name) || name.endsWith('/') || name.split('/').some(part => !part || part.startsWith('.'))) fail(`Unsafe payload path: ${JSON.stringify(name)}`);
};
const files = new Set();
const folded = new Set();
const osMetadata = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const metadataFiles = new Set();
async function inventory(folder, prefix = '') {
  const metadata = await lstat(folder);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail(`Expected a regular directory: ${prefix || 'bundle root'}`);
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const name = prefix + entry.name;
    const target = resolve(folder, entry.name);
    const info = await lstat(target);
    if (info.isSymbolicLink()) fail(`Symlinks are not allowed: ${name}`);
    // File-manager metadata is ignored only when regular and not manifest-listed.
    if (info.isFile() && osMetadata.has(entry.name)) { metadataFiles.add(name); continue; }
    safePath(name);
    if (folded.has(name.toLowerCase())) fail(`Duplicate or case-colliding path: ${name}`);
    folded.add(name.toLowerCase());
    if (info.isDirectory()) await inventory(target, `${name}/`);
    else if (info.isFile()) files.add(name);
    else fail(`Not a regular payload file: ${name}`);
  }
}
async function verify() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== 22 || minor < 12) fail('Use Node.js 22.12 or later on the Node 22 line.');
  await inventory(root);
  if (!files.has('SHA256SUMS')) fail('Missing SHA256SUMS.');
  const manifest = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(resolve(root, 'SHA256SUMS')));
  const expected = new Map();
  for (const line of manifest.split('\n')) {
    if (!line) continue;
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!match) fail('Malformed SHA256SUMS entry.');
    const [, hash, name] = match; safePath(name);
    if (name === 'SHA256SUMS' || expected.has(name)) fail(`Duplicate or invalid checksum entry: ${name}`);
    expected.set(name, hash);
  }
  for (const name of metadataFiles) if (expected.has(name)) {
    if (folded.has(name.toLowerCase())) fail(`Duplicate or case-colliding path: ${name}`);
    folded.add(name.toLowerCase()); files.add(name);
  }
  for (const name of ['dist/index.html', 'scripts/serve.mjs', 'verify.mjs', 'START-HERE.md', 'LICENSE', 'release.json']) {
    if (!expected.has(name)) fail(`Required payload is not listed: ${name}`);
  }
  for (const [name, hash] of expected) {
    if (!files.has(name)) fail(`Missing payload: ${name}`);
    const actual = createHash('sha256').update(await readFile(resolve(root, name))).digest('hex');
    if (actual !== hash) fail(`Checksum mismatch: ${name}`);
  }
  for (const name of files) if (name !== 'SHA256SUMS' && !expected.has(name)) fail(`Unlisted file: ${name}`);
  const release = JSON.parse(await readFile(resolve(root, 'release.json'), 'utf8'));
  if (release.schema !== 'inzone-offline-release/v1' || release.name !== 'inzone-profile-studio' || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(release.version) || !/^[0-9a-f]{40,64}$/.test(release.source_commit) || typeof release.dirty !== 'boolean') fail('Invalid release identity.');
  console.log(`Verified ${expected.size} files: INZONE Profile Studio ${release.version}, source ${release.source_commit}.`);
  if (release.dirty) console.log('This is a dirty preview, not a clean production release.');
  console.log('SHA-256 checks integrity, not publisher identity. These hashes are not a digital signature.');
}
try { await verify(); }
catch (error) { console.error(`Verification failed: ${error.message}`); process.exitCode = 1; }
