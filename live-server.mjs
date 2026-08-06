import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const port = 5174;
const clients = new Set();
const types = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
};
const liveReload = `<script>new EventSource('/_live-reload').onmessage=()=>location.reload()</script>`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/_live-reload') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    response.write('\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }

  const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = normalize(join(root, relative));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404); response.end('Not found'); return;
  }
  const type = types[extname(file).toLowerCase()] ?? 'application/octet-stream';
  if (type.startsWith('text/html')) {
    let html = await import('node:fs/promises').then(fs => fs.readFile(file, 'utf8'));
    html = html.replace('</body>', `${liveReload}</body>`);
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' }); response.end(html); return;
  }
  response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(response);
});

watch(root, { recursive: true }, (_event, filename) => {
  if (filename && !filename.startsWith('.git')) for (const client of clients) client.write('data: reload\n\n');
});
server.listen(port, '127.0.0.1', () => console.log(`Live server: http://127.0.0.1:${port}`));
