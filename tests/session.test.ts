import { describe, it, expect, afterEach } from 'bun:test';
import { WebSocketServer, WebSocket } from 'ws';
import { Session } from '../src/session.js';

/** Create a WS pair: a server-side socket (for Session) and a client-side socket (for reading). */
function createWsPair(): Promise<{
  serverSocket: WebSocket;
  clientSocket: WebSocket;
  wss: WebSocketServer;
  port: number;
}> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as { port: number }).port;

    let serverSocket: WebSocket | null = null;
    let clientOpen = false;

    function tryResolve() {
      if (serverSocket && clientOpen) {
        resolve({ serverSocket, clientSocket: client, wss, port });
      }
    }

    wss.on('connection', (ws) => {
      serverSocket = ws;
      tryResolve();
    });

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    client.on('open', () => {
      clientOpen = true;
      tryResolve();
    });
  });
}

/** Read the next JSON message from a WebSocket. */
function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

const cleanup: Array<{ wss: WebSocketServer; clientSocket: WebSocket }> = [];

afterEach(async () => {
  for (const { wss, clientSocket } of cleanup) {
    if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
      try {
        clientSocket.close();
      } catch {
        // Ignore close errors
      }
    }
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  }
  cleanup.length = 0;
});

async function makeSession(): Promise<{
  session: Session;
  clientSocket: WebSocket;
  wss: WebSocketServer;
}> {
  const { serverSocket, clientSocket, wss } = await createWsPair();
  cleanup.push({ wss, clientSocket });
  const session = new Session(serverSocket as unknown as import('ws').WebSocket);
  return { session, clientSocket, wss };
}

describe('Session message enqueue', () => {
  it('sendToolResult enqueues correct JSON', async () => {
    const { session, clientSocket } = await makeSession();
    const msgPromise = nextMessage(clientSocket);

    session.sendToolResult('tc-1', { temp: 72 });

    const msg = await msgPromise;
    expect(msg.type).toBe('tool.result');
    expect(msg.id).toBe('tc-1');
    expect(msg.result).toEqual({ temp: 72 });
  });

  it('sendToolError enqueues correct JSON', async () => {
    const { session, clientSocket } = await makeSession();
    const msgPromise = nextMessage(clientSocket);

    session.sendToolError('tc-2', 'something went wrong');

    const msg = await msgPromise;
    expect(msg.type).toBe('tool.error');
    expect(msg.id).toBe('tc-2');
    expect(msg.error).toBe('something went wrong');
  });

  it('sendText enqueues correct JSON', async () => {
    const { session, clientSocket } = await makeSession();
    const msgPromise = nextMessage(clientSocket);

    session.sendText('Hello', true);

    const msg = await msgPromise;
    expect(msg.type).toBe('text');
    expect(msg.token).toBe('Hello');
    expect(msg.last).toBe(true);
  });

  it('hangup enqueues correct JSON', async () => {
    const { session, clientSocket } = await makeSession();
    const msgPromise = nextMessage(clientSocket);

    session.hangup();

    const msg = await msgPromise;
    expect(msg.type).toBe('agent_session.hangup');
  });

  it('transfer with string wraps to array', async () => {
    const { session, clientSocket } = await makeSession();
    const msgPromise = nextMessage(clientSocket);

    session.transfer('+14155551234');

    const msg = await msgPromise;
    expect(msg.type).toBe('agent_session.transfer');
    expect(msg.destination).toEqual(['+14155551234']);
    expect(msg.dial_mode).toBe('parallel');
    expect(msg.timeout).toBe(30);
  });

  it('transfer with array passes through, sequential mode', async () => {
    const { session, clientSocket } = await makeSession();
    const msgPromise = nextMessage(clientSocket);

    session.transfer(['+14155551234', '+14155555678'], 'sequential', 60);

    const msg = await msgPromise;
    expect(msg.type).toBe('agent_session.transfer');
    expect(msg.destination).toEqual(['+14155551234', '+14155555678']);
    expect(msg.dial_mode).toBe('sequential');
    expect(msg.timeout).toBe(60);
  });

  it('sendDtmf enqueues correct JSON', async () => {
    const { session, clientSocket } = await makeSession();
    const msgPromise = nextMessage(clientSocket);

    session.sendDtmf('123#');

    const msg = await msgPromise;
    expect(msg.type).toBe('agent_session.send_dtmf');
    expect(msg.digits).toBe('123#');
  });

  it('playBackground enqueues audio.mix message', async () => {
    const { session, clientSocket } = await makeSession();
    const msgPromise = nextMessage(clientSocket);

    session.playBackground('office-noise', 0.3, false);

    const msg = await msgPromise;
    expect(msg.type).toBe('audio.mix');
    expect(msg.sound).toBe('office-noise');
    expect(msg.volume).toBe(0.3);
    expect(msg.loop).toBe(false);
  });

  it('session data object is accessible', async () => {
    const { session } = await makeSession();

    expect(session.data).toEqual({});
    session.data.customKey = 'customValue';
    expect(session.data.customKey).toBe('customValue');
  });
});
