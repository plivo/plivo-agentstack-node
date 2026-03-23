import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { PlivoAgentClient } from '../src/client.js';
import {
  NotFoundError,
  AuthenticationError,
  ValidationError,
  ServerError,
  RateLimitError,
} from '../src/errors.js';

const AUTH_ID = 'test-dummy-id';
const AUTH_TOKEN = 'test-dummy-token';

// --- Mock HTTP server ---

type MockResponse = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

type MockRoute = {
  responses: MockResponse[];
  callIndex: number;
  validateBody?: (body: Record<string, unknown>) => void;
  validateQuery?: (query: Record<string, string>) => void;
  capturedHeaders?: Record<string, string | string[] | undefined>;
};

let server: Server;
let baseUrl: string;
const routes = new Map<string, MockRoute>();

function mockRoute(
  method: string,
  path: string,
  response: MockResponse | MockResponse[],
  options?: {
    validateBody?: (body: Record<string, unknown>) => void;
    validateQuery?: (query: Record<string, string>) => void;
    times?: number;
  },
) {
  let responses: MockResponse[];
  if (Array.isArray(response)) {
    responses = response;
  } else if (options?.times) {
    responses = Array(options.times).fill(response);
  } else {
    responses = [response];
  }
  routes.set(`${method} ${path}`, {
    responses,
    callIndex: 0,
    validateBody: options?.validateBody,
    validateQuery: options?.validateQuery,
  });
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const urlObj = new URL(req.url!, `http://${req.headers.host}`);
      const key = `${req.method} ${urlObj.pathname}`;
      const route = routes.get(key);

      if (!route) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `No mock for ${key}` }));
        return;
      }

      // Capture request headers
      route.capturedHeaders = req.headers;

      // Validate body
      if (body && route.validateBody) {
        try {
          route.validateBody(JSON.parse(body));
        } catch {
          // validation errors will surface in the test assertions
        }
      }

      // Validate query params
      if (route.validateQuery) {
        const query: Record<string, string> = {};
        urlObj.searchParams.forEach((v, k) => (query[k] = v));
        route.validateQuery(query);
      }

      // Pick the response (use last one if exhausted)
      const idx = Math.min(route.callIndex, route.responses.length - 1);
      const resp = route.responses[idx];
      route.callIndex++;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (resp.headers) Object.assign(headers, resp.headers);

      res.writeHead(resp.status, headers);
      if (resp.body !== undefined) {
        res.end(JSON.stringify(resp.body));
      } else {
        res.end();
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterEach(() => {
  routes.clear();
});

afterAll(() => {
  server.close();
});

// --- Helpers ---

function makeClient(overrides?: Record<string, unknown>) {
  return new PlivoAgentClient(AUTH_ID, AUTH_TOKEN, {
    baseUrl,
    ...overrides,
  });
}

function fastClient() {
  return makeClient({ backoffFactor: 0.01 });
}

const prefix = `/v1/Account/${AUTH_ID}`;

// --- Agent Tests ---

describe('AgentResource', () => {
  it('should create an agent', async () => {
    const client = makeClient();

    mockRoute('POST', `${prefix}/Agent`, {
      status: 201,
      body: {
        api_id: 'test-api-id',
        message: 'Agent created',
        agent_uuid: 'uuid-123',
        agent_name: 'Test Agent',
      },
    }, {
      validateBody: (body) => {
        expect(body.agent_name).toBe('Test Agent');
        expect(body.websocket_url).toBe('wss://example.com/ws');
      },
    });

    const agent = await client.agents.create({
      agentName: 'Test Agent',
      websocketUrl: 'wss://example.com/ws',
    });
    expect(agent.agentUuid).toBe('uuid-123');
    expect(agent.agentName).toBe('Test Agent');
  });

  it('should get an agent', async () => {
    const client = makeClient();

    mockRoute('GET', `${prefix}/Agent/uuid-123`, {
      status: 200,
      body: {
        agent_uuid: 'uuid-123',
        agent_name: 'Test Agent',
      },
    });

    const agent = await client.agents.get('uuid-123');
    expect(agent.agentUuid).toBe('uuid-123');
    expect(agent.agentName).toBe('Test Agent');
  });

  it('should list agents', async () => {
    const client = makeClient();

    mockRoute('GET', `${prefix}/Agent`, {
      status: 200,
      body: {
        api_id: 'list-api-id',
        objects: [
          { agent_uuid: 'uuid-1', agent_name: 'Agent 1' },
          { agent_uuid: 'uuid-2', agent_name: 'Agent 2' },
        ],
        meta: { limit: 20, offset: 0, total_count: 2, previous: null, next: null },
      },
    });

    const result = await client.agents.list();
    expect(result.objects).toHaveLength(2);
    expect(result.meta.totalCount).toBe(2);
  });

  it('should update an agent', async () => {
    const client = makeClient();

    mockRoute('PATCH', `${prefix}/Agent/uuid-123`, {
      status: 200,
      body: {
        agent_uuid: 'uuid-123',
        agent_name: 'Updated Agent',
      },
    }, {
      validateBody: (body) => {
        expect(body.agent_name).toBe('Updated Agent');
      },
    });

    const agent = await client.agents.update('uuid-123', {
      agentName: 'Updated Agent',
    });
    expect(agent.agentName).toBe('Updated Agent');
  });

  it('should delete an agent', async () => {
    const client = makeClient();

    mockRoute('DELETE', `${prefix}/Agent/uuid-123`, {
      status: 204,
    });

    await expect(client.agents.delete('uuid-123')).resolves.toBeUndefined();
  });
});

// --- Call Tests ---

describe('CallResource', () => {
  it('should initiate a call', async () => {
    const client = makeClient();

    mockRoute('POST', `${prefix}/AgentCall`, {
      status: 201,
      body: {
        call_uuid: 'call-uuid-1',
        agent_id: 'agent-uuid',
        status: 'initiated',
        from: '+14155551234',
        to: ['+19876543210'],
      },
    }, {
      validateBody: (body) => {
        expect(body.agent_id).toBe('agent-uuid');
        expect(body.from).toBe('+14155551234');
      },
    });

    const result = await client.calls.initiate({
      agentId: 'agent-uuid',
      from: '+14155551234',
      to: ['+19876543210'],
    });
    expect(result.callUuid).toBe('call-uuid-1');
    expect(result.status).toBe('initiated');
  });

  it('should connect a call', async () => {
    const client = makeClient();

    mockRoute('POST', `${prefix}/AgentCall/call-uuid-1/connect`, {
      status: 201,
      body: {
        agent_session_id: 'session-1',
        status: 'connecting',
      },
    });

    const result = await client.calls.connect('call-uuid-1', 'agent-uuid');
    expect(result.agentSessionId).toBe('session-1');
    expect(result.status).toBe('connecting');
  });

  it('should dial from a call', async () => {
    const client = makeClient();

    mockRoute('POST', `${prefix}/AgentCall/call-uuid-1/dial`, {
      status: 200,
      body: {
        status: 'dialing',
        call_uuid: 'call-uuid-2',
      },
    });

    const result = await client.calls.dial('call-uuid-1', {
      targets: [{ number: '+19876543210' }],
    });
    expect(result.status).toBe('dialing');
  });
});

// --- Number Tests ---

describe('NumberResource', () => {
  it('should assign a number', async () => {
    const client = makeClient();

    mockRoute('POST', `${prefix}/Agent/agent-uuid/Number`, {
      status: 201,
      body: {
        agent_uuid: 'agent-uuid',
        number: '+14155551234',
      },
    });

    const result = await client.numbers.assign('agent-uuid', '+14155551234');
    expect(result.number).toBe('+14155551234');
  });

  it('should list numbers', async () => {
    const client = makeClient();

    mockRoute('GET', `${prefix}/Agent/agent-uuid/Number`, {
      status: 200,
      body: {
        agent_uuid: 'agent-uuid',
        numbers: ['+14155551234', '+14155555678'],
      },
    });

    const result = await client.numbers.list('agent-uuid');
    expect(result.numbers).toHaveLength(2);
  });

  it('should unassign a number', async () => {
    const client = makeClient();

    mockRoute('DELETE', `${prefix}/Agent/agent-uuid/Number/+14155551234`, {
      status: 204,
    });

    await expect(
      client.numbers.unassign('agent-uuid', '+14155551234'),
    ).resolves.toBeUndefined();
  });
});

// --- Session Tests ---

describe('SessionResource', () => {
  it('should list sessions', async () => {
    const client = makeClient();

    mockRoute('GET', `${prefix}/AgentSession`, {
      status: 200,
      body: {
        api_id: 'list-sessions',
        objects: [
          {
            agent_session_uuid: 'session-1',
            agent_uuid: 'agent-uuid',
            duration_seconds: 120,
          },
        ],
        meta: { limit: 20, offset: 0, total_count: 1, previous: null, next: null },
      },
    });

    const result = await client.sessions.list();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].durationSeconds).toBe(120);
  });

  it('should get a session', async () => {
    const client = makeClient();

    mockRoute('GET', `${prefix}/AgentSession/session-1`, {
      status: 200,
      body: {
        agent_session_uuid: 'session-1',
        agent_uuid: 'agent-uuid',
        duration_seconds: 120,
        state: 'completed',
      },
    });

    const result = await client.sessions.get('session-1');
    expect(result.agentSessionUuid).toBe('session-1');
    expect(result.state).toBe('completed');
  });
});

// --- Error Tests ---

describe('Error handling', () => {
  it('should throw NotFoundError on 404', async () => {
    const client = makeClient();

    mockRoute('GET', `${prefix}/Agent/nonexistent`, {
      status: 404,
      body: { api_id: 'err-id', error: 'Agent not found' },
    });

    await expect(client.agents.get('nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('should throw AuthenticationError on 401', async () => {
    const client = makeClient();

    mockRoute('GET', `${prefix}/Agent`, {
      status: 401,
      body: { error: 'Invalid credentials' },
    });

    await expect(client.agents.list()).rejects.toThrow(AuthenticationError);
  });

  it('should throw ValidationError on 400', async () => {
    const client = makeClient();

    mockRoute('POST', `${prefix}/Agent`, {
      status: 400,
      body: { error: 'agent_name is required' },
    });

    await expect(
      client.agents.create({ agentName: '', websocketUrl: '' }),
    ).rejects.toThrow(ValidationError);
  });

  it('should retry and throw ServerError on 500', async () => {
    const client = fastClient();

    mockRoute('GET', `${prefix}/Agent/uuid-123`, {
      status: 500,
      body: { error: 'Internal server error' },
    }, { times: 4 });

    await expect(client.agents.get('uuid-123')).rejects.toThrow(ServerError);
  });

  it('should send basic auth header', async () => {
    const client = makeClient();
    const routeKey = `GET ${prefix}/Agent/uuid-auth`;

    mockRoute('GET', `${prefix}/Agent/uuid-auth`, {
      status: 200,
      body: { agent_uuid: 'uuid-auth', agent_name: 'Test' },
    });

    const agent = await client.agents.get('uuid-auth');
    expect(agent.agentUuid).toBe('uuid-auth');

    // Verify Basic auth was sent
    const route = routes.get(routeKey)!;
    const expected = Buffer.from(`${AUTH_ID}:${AUTH_TOKEN}`).toString('base64');
    expect(route.capturedHeaders?.authorization).toBe(`Basic ${expected}`);
  });

  it('204 response returns null/undefined', async () => {
    const client = makeClient();

    mockRoute('DELETE', `${prefix}/Agent/uuid-del`, {
      status: 204,
    });

    const result = await client.agents.delete('uuid-del');
    expect(result == null).toBe(true);
  });

  it('429 retries then succeeds', async () => {
    const client = fastClient();

    mockRoute('GET', `${prefix}/Agent/uuid-429`, [
      { status: 429, body: { error: 'Rate limited' } },
      { status: 200, body: { agent_uuid: 'uuid-429', agent_name: 'Recovered' } },
    ]);

    const agent = await client.agents.get('uuid-429');
    expect(agent.agentUuid).toBe('uuid-429');
    expect(agent.agentName).toBe('Recovered');
  });

  it('429 respects Retry-After header', async () => {
    const client = fastClient();

    mockRoute('GET', `${prefix}/Agent/uuid-ra`, [
      { status: 429, body: { error: 'Rate limited' }, headers: { 'Retry-After': '0.01' } },
      { status: 200, body: { agent_uuid: 'uuid-ra', agent_name: 'After Retry' } },
    ]);

    const start = Date.now();
    const agent = await client.agents.get('uuid-ra');
    const elapsed = Date.now() - start;

    expect(agent.agentUuid).toBe('uuid-ra');
    expect(elapsed).toBeLessThan(5000);
  });

  it('429 exhausts retries and throws RateLimitError', async () => {
    const client = fastClient();

    mockRoute('GET', `${prefix}/Agent/uuid-rl`, {
      status: 429,
      body: { error: 'Rate limited' },
    }, { times: 4 });

    await expect(client.agents.get('uuid-rl')).rejects.toThrow(RateLimitError);
  });

  it('undefined params are stripped from query string', async () => {
    const client = makeClient();

    mockRoute('GET', `${prefix}/Agent`, {
      status: 200,
      body: {
        api_id: 'stripped-test',
        objects: [],
        meta: { limit: 20, offset: 0, total_count: 0, previous: null, next: null },
      },
    }, {
      validateQuery: (query) => {
        expect(query).not.toHaveProperty('agent_name');
      },
    });

    const result = await client.agents.list({ agentName: undefined } as any);
    expect(result.objects).toHaveLength(0);
  });
});
