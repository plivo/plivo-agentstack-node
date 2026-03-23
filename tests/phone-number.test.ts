import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { PlivoAgentClient } from '../src/index.js';

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
  capturedBody?: Record<string, unknown>;
  capturedQuery?: Record<string, string>;
};

let server: Server;
let baseUrl: string;
const routes = new Map<string, MockRoute>();

function mockRoute(
  method: string,
  path: string,
  response: MockResponse | MockResponse[],
) {
  const responses = Array.isArray(response) ? response : [response];
  routes.set(`${method} ${path}`, {
    responses,
    callIndex: 0,
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

      // Capture request body
      if (body) {
        try {
          route.capturedBody = JSON.parse(body);
        } catch {
          // ignore parse errors
        }
      }

      // Capture query params
      const query: Record<string, string> = {};
      urlObj.searchParams.forEach((v, k) => (query[k] = v));
      route.capturedQuery = query;

      const idx = Math.min(route.callIndex, route.responses.length - 1);
      const resp = route.responses[idx];
      route.callIndex++;

      res.writeHead(resp.status, { 'Content-Type': 'application/json' });
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

function makeClient() {
  return new PlivoAgentClient(AUTH_ID, AUTH_TOKEN, { baseUrl });
}

const prefix = `/v1/Account/${AUTH_ID}`;

// --- PhoneNumberResource Tests ---

describe('PhoneNumberResource', () => {
  test('list sends GET to /Number/ with params', async () => {
    const client = makeClient();
    const routeKey = `GET ${prefix}/Number/`;

    mockRoute('GET', `${prefix}/Number/`, {
      status: 200,
      body: {
        api_id: 'list-numbers-id',
        objects: [
          {
            number: '+14155551234',
            alias: 'main-line',
            number_type: 'local',
            sms_enabled: true,
            voice_enabled: true,
            monthly_rental_rate: '0.80',
          },
          {
            number: '+14155555678',
            alias: 'backup',
            number_type: 'local',
            sms_enabled: false,
            voice_enabled: true,
          },
        ],
        meta: { limit: 20, offset: 0, total_count: 2, previous: null, next: null },
      },
    });

    const result = await client.phoneNumbers.list({
      limit: 20,
      offset: 0,
      type: 'local',
      numberStartswith: '415',
    });

    expect(result.objects).toHaveLength(2);
    expect(result.objects[0].number).toBe('+14155551234');
    expect(result.objects[0].alias).toBe('main-line');
    expect(result.objects[0].numberType).toBe('local');
    expect(result.objects[0].smsEnabled).toBe(true);
    expect(result.meta.totalCount).toBe(2);

    // Verify query params are snake_case
    const route = routes.get(routeKey)!;
    expect(route.capturedQuery!.limit).toBe('20');
    expect(route.capturedQuery!.offset).toBe('0');
    expect(route.capturedQuery!.type).toBe('local');
    expect(route.capturedQuery!.number_startswith).toBe('415');
  });

  test('get sends GET to /Number/{number}/', async () => {
    const client = makeClient();
    const number = '+14155551234';

    mockRoute('GET', `${prefix}/Number/${number}/`, {
      status: 200,
      body: {
        api_id: 'get-number-id',
        number: '+14155551234',
        alias: 'main-line',
        number_type: 'local',
        country: 'US',
        city: 'San Francisco',
        region: 'California',
        sms_enabled: true,
        voice_enabled: true,
        monthly_rental_rate: '0.80',
        voice_rate: '0.0085',
        sms_rate: '0.0075',
        added_on: '2025-01-15',
        renewal_date: '2026-01-15',
      },
    });

    const result = await client.phoneNumbers.get(number);
    expect(result.number).toBe('+14155551234');
    expect(result.alias).toBe('main-line');
    expect(result.numberType).toBe('local');
    expect(result.country).toBe('US');
    expect(result.city).toBe('San Francisco');
    expect(result.smsEnabled).toBe(true);
    expect(result.voiceEnabled).toBe(true);
    expect(result.monthlyRentalRate).toBe('0.80');
    expect(result.addedOn).toBe('2025-01-15');
    expect(result.renewalDate).toBe('2026-01-15');
  });

  test('buy sends POST to /PhoneNumber/{number}/', async () => {
    const client = makeClient();
    const number = '+14155559999';
    const routeKey = `POST ${prefix}/PhoneNumber/${number}/`;

    mockRoute('POST', `${prefix}/PhoneNumber/${number}/`, {
      status: 201,
      body: {
        api_id: 'buy-api-id',
        message: 'created',
        status: 'fulfilled',
        numbers: [{ number: '+14155559999', status: 'Success' }],
      },
    });

    const result = await client.phoneNumbers.buy(number, { appId: 'app-123' });
    expect(result.apiId).toBe('buy-api-id');
    expect(result.message).toBe('created');
    expect(result.status).toBe('fulfilled');
    expect(result.numbers).toHaveLength(1);
    expect(result.numbers![0].number).toBe('+14155559999');

    // Verify request body uses snake_case
    const route = routes.get(routeKey)!;
    expect(route.capturedBody!.app_id).toBe('app-123');
  });

  test('buy without params sends POST with no body', async () => {
    const client = makeClient();
    const number = '+14155558888';

    mockRoute('POST', `${prefix}/PhoneNumber/${number}/`, {
      status: 201,
      body: {
        api_id: 'buy-api-id',
        message: 'created',
        status: 'fulfilled',
      },
    });

    const result = await client.phoneNumbers.buy(number);
    expect(result.status).toBe('fulfilled');
  });

  test('update sends POST to /Number/{number}/ with body', async () => {
    const client = makeClient();
    const number = '+14155551234';
    const routeKey = `POST ${prefix}/Number/${number}/`;

    mockRoute('POST', `${prefix}/Number/${number}/`, {
      status: 200,
      body: {
        api_id: 'update-api-id',
        message: 'changed',
      },
    });

    const result = await client.phoneNumbers.update(number, {
      appId: 'app-456',
      alias: 'updated-alias',
      subaccount: 'sub-123',
    });

    expect(result.apiId).toBe('update-api-id');
    expect(result.message).toBe('changed');

    // Verify request body uses snake_case
    const route = routes.get(routeKey)!;
    expect(route.capturedBody!.app_id).toBe('app-456');
    expect(route.capturedBody!.alias).toBe('updated-alias');
    expect(route.capturedBody!.subaccount).toBe('sub-123');
  });

  test('delete sends DELETE to /Number/{number}/', async () => {
    const client = makeClient();
    const number = '+14155551234';

    mockRoute('DELETE', `${prefix}/Number/${number}/`, {
      status: 204,
    });

    const result = await client.phoneNumbers.delete(number);
    expect(result == null).toBe(true);
  });

  test('search sends GET to /PhoneNumber/ with params including country_iso', async () => {
    const client = makeClient();
    const routeKey = `GET ${prefix}/PhoneNumber/`;

    mockRoute('GET', `${prefix}/PhoneNumber/`, {
      status: 200,
      body: {
        api_id: 'search-api-id',
        objects: [
          {
            number: '+14155551111',
            type: 'local',
            city: 'San Francisco',
            country: 'US',
            region: 'California',
            monthly_rental_rate: '0.80',
            sms_enabled: true,
            voice_enabled: true,
          },
          {
            number: '+14155552222',
            type: 'local',
            city: 'San Jose',
            country: 'US',
          },
        ],
        meta: { limit: 10, offset: 0, total_count: 2, previous: null, next: null },
      },
    });

    const result = await client.phoneNumbers.search({
      countryIso: 'US',
      type: 'local',
      region: 'California',
      limit: 10,
    });

    expect(result.objects).toHaveLength(2);
    expect(result.objects[0].number).toBe('+14155551111');
    expect(result.objects[0].smsEnabled).toBe(true);
    expect(result.meta.totalCount).toBe(2);

    // Verify query params are snake_case, including country_iso
    const route = routes.get(routeKey)!;
    expect(route.capturedQuery!.country_iso).toBe('US');
    expect(route.capturedQuery!.type).toBe('local');
    expect(route.capturedQuery!.region).toBe('California');
    expect(route.capturedQuery!.limit).toBe('10');
  });
});

// --- LookupResource Tests ---

describe('LookupResource', () => {
  test('get sends GET to /v1/Number/{number} (no Account prefix)', async () => {
    const client = makeClient();
    const number = '+14155551234';
    const routeKey = `GET /v1/Number/${number}`;

    mockRoute('GET', `/v1/Number/${number}`, {
      status: 200,
      body: {
        api_id: 'lookup-api-id',
        phone_number: '+14155551234',
        country: { iso2: 'US', name: 'United States' },
        carrier: { name: 'Verizon', type: 'mobile' },
        format: { e164: '+14155551234', national: '(415) 555-1234' },
        resource_uri: '/v1/Number/+14155551234',
      },
    });

    const result = await client.phoneNumbers.lookup.get(number);
    expect(result.phoneNumber).toBe('+14155551234');
    expect(result.resourceUri).toBe('/v1/Number/+14155551234');

    // Verify the path has no Account prefix and includes type param
    const route = routes.get(routeKey)!;
    expect(route.capturedQuery!.type).toBe('carrier');
  });

  test('get with custom type parameter', async () => {
    const client = makeClient();
    const number = '+14155551234';
    const routeKey = `GET /v1/Number/${number}`;

    mockRoute('GET', `/v1/Number/${number}`, {
      status: 200,
      body: {
        api_id: 'lookup-api-id',
        phone_number: '+14155551234',
      },
    });

    await client.phoneNumbers.lookup.get(number, 'caller_name');

    const route = routes.get(routeKey)!;
    expect(route.capturedQuery!.type).toBe('caller_name');
  });
});
