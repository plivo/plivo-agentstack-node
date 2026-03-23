/**
 * Framework integration for Voice AI Agent.
 *
 * Mounts the VoiceApp WebSocket handler inside a standard Node.js HTTP server,
 * allowing you to combine voice agent endpoints with REST routes.
 * This pattern works with Express, Fastify, Koa, etc. — any framework that
 * exposes the raw http.Server for the 'upgrade' event.
 *
 * Run:
 *   npx tsx examples/framework-integration.ts
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import {
  VoiceApp,
  type AgentSessionStartedEvent,
  type ToolCallEvent,
  type AgentSessionEndedEvent,
} from '../src/index.js';

// -- VoiceApp --

const app = new VoiceApp();

app.onSetup((session, event) => {
  const e = event as AgentSessionStartedEvent;
  console.log(`Session started: ${e.agentSessionId}`);
});

app.onToolCall((session, event) => {
  const e = event as ToolCallEvent;
  console.log(`Tool call: ${e.name}(${JSON.stringify(e.arguments)})`);

  if (e.name === 'check_weather') {
    const city = (e.arguments as Record<string, unknown>).city ?? 'unknown';
    session.sendToolResult(e.id, { city, temp_f: 72, condition: 'sunny' });
  } else if (e.name === 'transfer_to_human') {
    session.transfer(['+18005551234']);
    session.sendToolResult(e.id, { status: 'transferring' });
  } else {
    session.sendToolError(e.id, `Unknown tool: ${e.name}`);
  }
});

app.onSessionEnded((session, event) => {
  const e = event as AgentSessionEndedEvent;
  console.log(`Session ended: duration=${e.durationSeconds}s turns=${e.turnCount}`);
});

// -- HTTP server with REST + WebSocket routes --

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Reject non-WebSocket requests to /ws
  if (req.url === '/ws') {
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('Upgrade required');
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Handle WebSocket upgrades on /ws path only
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    app.handleUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

const PORT = 9000;
server.listen(PORT, () => {
  console.log(`Server listening on :${PORT} (WS: /ws, REST: /health)`);
});
