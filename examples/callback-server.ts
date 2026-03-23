/**
 * Callback Server -- Receives async HTTP callbacks from Plivo.
 *
 * Handles hangup, recording, and ring post-call events.
 * Shared by all modes (managed, text, audio).
 *
 * Uses Node.js built-in http.createServer (no frameworks needed).
 *
 * Usage:
 *   npx tsx examples/callback-server.ts
 */

import { createServer } from 'node:http';

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  const raw = await readBody(req);
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid JSON' }));
    return;
  }

  const url = req.url ?? '';

  if (url === '/callbacks/hangup') {
    console.log(
      `[callback] Hangup: call_uuid=${body.call_uuid} ` +
        `duration=${body.duration}s cause=${body.hangup_cause}`,
    );
  } else if (url === '/callbacks/recording') {
    console.log(`[callback] Recording ready: ${body.recording_url}`);
  } else if (url === '/callbacks/ring') {
    console.log(
      `[callback] Ring: call_uuid=${body.call_uuid} ` +
        `direction=${body.direction} from=${body.from} to=${body.to}`,
    );
  } else {
    console.log(`[callback] Unknown path ${url}: ${JSON.stringify(body)}`);
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});

server.listen(9001, () => {
  console.log('Callback server listening on http://0.0.0.0:9001');
});
