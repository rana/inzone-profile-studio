/** Local product server: serves the built public app only, on loopback. */
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major !== 22 || minor < 12) {
  console.error('Use Node.js 22.12 or later on the Node 22 line. Check with node --version.');
  process.exit(1);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
try { await stat(resolve(root, 'index.html')); }
catch { console.error('No built studio found. Extract a complete offline package, or run npm run build in the source checkout.'); process.exit(1); }
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a port from 1024 to 65535.');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method || '')) { res.writeHead(405); res.end('Read-only app server.'); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    if (pathname.includes('\0') || pathname.split('/').some(part => part === '..' || part.startsWith('.'))) throw new Error('Invalid path');
    const target = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    const actual = await realpath(target);
    if (!actual.startsWith(root + sep)) throw new Error('Outside app directory');
    if (!(await stat(actual)).isFile()) throw new Error('Not a public file');
    const bytes = await readFile(actual);
    res.setHeader('Content-Type', mime[extname(actual)] || 'application/octet-stream');
    res.setHeader('Content-Length', bytes.length);
    res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found.'); }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Close the previous studio server, then start this copy again.`
    : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`INZONE Profile Studio: http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
