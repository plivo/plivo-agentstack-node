import { describe, it, expect, afterEach } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { WebSocket } from 'ws';
import { VoiceApp } from '../src/voice-app.js';

function setupServer(app: VoiceApp): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer();
    server.on('upgrade', (req, socket, head) => {
      app.handleUpgrade(req, socket, head);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, url: `ws://127.0.0.1:${addr.port}` });
    });
  });
}

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

const servers: Server[] = [];

afterEach(() => {
  for (const s of servers) {
    s.close();
  }
  servers.length = 0;
});

describe('VoiceApp', () => {
  it('should handle session setup', async () => {
    const app = new VoiceApp();
    let receivedSessionId = '';
    let receivedCallId = '';

    app.onSetup((session, event) => {
      receivedSessionId = event.agentSessionId;
      receivedCallId = event.callId;
    });

    const { server, url } = await setupServer(app);
    servers.push(server);
    const ws = await connectWs(url);

    ws.send(
      JSON.stringify({
        type: 'session.started',
        agent_session_id: 'sess-123',
        call_id: 'call-456',
      }),
    );

    await waitFor(100);

    expect(receivedSessionId).toBe('sess-123');
    expect(receivedCallId).toBe('call-456');

    ws.send(JSON.stringify({ type: 'session.ended', duration_seconds: 0 }));
    await waitFor(50);
    ws.close();
  });

  it('should handle tool calls and send results', async () => {
    const app = new VoiceApp();
    let receivedToolName = '';

    app.onToolCall((session, event) => {
      receivedToolName = event.name;
      session.sendToolResult(event.id, { temp: 72 });
    });

    const { server, url } = await setupServer(app);
    servers.push(server);
    const ws = await connectWs(url);

    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    ws.send(
      JSON.stringify({
        type: 'tool.called',
        id: 'tc-1',
        name: 'get_weather',
        arguments: { city: 'SF' },
      }),
    );

    const response = await responsePromise;
    expect(receivedToolName).toBe('get_weather');
    expect(response.type).toBe('tool.result');
    expect(response.id).toBe('tc-1');

    ws.send(JSON.stringify({ type: 'session.ended', duration_seconds: 0 }));
    await waitFor(50);
    ws.close();
  });

  it('should call connect and disconnect handlers', async () => {
    const app = new VoiceApp();
    let connectCalled = false;
    let disconnectCalled = false;

    app.onConnect(() => {
      connectCalled = true;
    });

    app.onDisconnect(() => {
      disconnectCalled = true;
    });

    const { server, url } = await setupServer(app);
    servers.push(server);
    const ws = await connectWs(url);

    await waitFor(100);
    expect(connectCalled).toBe(true);

    ws.send(JSON.stringify({ type: 'session.ended', duration_seconds: 0 }));
    await waitFor(100);

    expect(disconnectCalled).toBe(true);
    ws.close();
  });

  it('should call catch-all handler for every event', async () => {
    const app = new VoiceApp();
    const eventTypes: string[] = [];

    app.onEvent((session, event) => {
      eventTypes.push(event.type);
    });

    const { server, url } = await setupServer(app);
    servers.push(server);
    const ws = await connectWs(url);

    ws.send(JSON.stringify({ type: 'user.transcription', text: 'hello', is_final: true }));
    await waitFor(50);
    ws.send(JSON.stringify({ type: 'session.ended', duration_seconds: 0 }));
    await waitFor(100);

    expect(eventTypes).toContain('user.transcription');
    expect(eventTypes).toContain('session.ended');
    ws.close();
  });

  it('should recover from handler errors', async () => {
    const app = new VoiceApp();
    let errorCaught = false;

    app.on('user.transcription', () => {
      throw new Error('test error');
    });

    app.onHandlerError((session, event, err) => {
      errorCaught = true;
    });

    const { server, url } = await setupServer(app);
    servers.push(server);
    const ws = await connectWs(url);

    ws.send(JSON.stringify({ type: 'user.transcription', text: 'hello' }));
    await waitFor(100);

    expect(errorCaught).toBe(true);

    // Connection should still be alive
    ws.send(JSON.stringify({ type: 'session.ended', duration_seconds: 0 }));
    await waitFor(50);
    ws.close();
  });

  it('should set session metadata from events', async () => {
    const app = new VoiceApp();
    let sessionId = '';
    let callUuid = '';

    app.onSetup((session) => {
      sessionId = session.agentSessionId;
      callUuid = session.callUuid;
    });

    const { server, url } = await setupServer(app);
    servers.push(server);
    const ws = await connectWs(url);

    ws.send(
      JSON.stringify({
        type: 'session.started',
        agent_session_id: 'sess-abc',
        call_id: 'call-def',
      }),
    );

    await waitFor(100);
    expect(sessionId).toBe('sess-abc');
    expect(callUuid).toBe('call-def');

    ws.send(JSON.stringify({ type: 'session.ended', duration_seconds: 0 }));
    await waitFor(50);
    ws.close();
  });
});
