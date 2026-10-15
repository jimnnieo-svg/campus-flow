// Local-only browser smoke test. The production index.html is served unchanged
// except for its SDK import base, which points to the isolated mock modules.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mockRoot = join(root, 'tests', 'mock-firebase');
const modules = new Set(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js', 'state.js']);
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/' || request.url === '/?legacy=1') {
      let html = (await readFile(join(root, 'index.html'), 'utf8'))
        .replace("const SDK_ROOT = 'https://www.gstatic.com/firebasejs/12.4.0/';", "const SDK_ROOT = '/mock/';");
      if (request.url === '/?legacy=1') {
        const createdAt = Date.now() - 60000;
        const dueDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const backup = { app: 'CampusFlow', version: 2, tasks: [{
          id: 'mock-legacy-1', subject: '이전 과목', title: '이전 브라우저 과제',
          dueDate, priority: 'normal', note: '가져오기 검증', completed: false,
          createdAt, updatedAt: createdAt, completedAt: null
        }] };
        html = html.replace('<script>', `<script>localStorage.setItem('campus-flow.tasks.v1', ${JSON.stringify(JSON.stringify(backup))});</script><script>`);
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(html);
    } else if (request.url?.startsWith('/mock/') && modules.has(request.url.slice(6))) {
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(await readFile(join(mockRoot, request.url.slice(6))));
    } else {
      response.writeHead(404); response.end();
    }
  } catch (error) {
    response.writeHead(500); response.end(String(error));
  }
});
server.listen(8001, '127.0.0.1', () => console.log('Mock browser test: http://127.0.0.1:8001/'));
