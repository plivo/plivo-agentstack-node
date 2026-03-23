import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { PlivoAgentClient } from '../src/index.js';
import { Template, InteractiveMessage, Location } from '../src/messaging.js';

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

// --- MessagingResource Tests ---

describe('MessagingResource', () => {
  test('create sends POST to /Message/ with snake_case keys', async () => {
    const client = makeClient();
    const routeKey = `POST ${prefix}/Message/`;

    mockRoute('POST', `${prefix}/Message/`, {
      status: 201,
      body: {
        api_id: 'msg-api-id',
        message: 'message(s) queued',
        message_uuid: ['uuid-msg-1'],
      },
    });

    const result = await client.messages.create({
      dst: '+14155551234',
      src: '+14155559999',
      text: 'Hello',
      mediaUrls: ['https://example.com/img.jpg'],
      powerpackUuid: 'pp-uuid',
      messageExpiry: 3600,
      dltEntityId: 'ent-123',
      dltTemplateId: 'tpl-456',
      dltTemplateCategory: 'transactional',
    });

    expect(result.message).toBe('message(s) queued');
    expect(result.messageUuid).toEqual(['uuid-msg-1']);

    // Verify the outgoing body uses snake_case keys
    const route = routes.get(routeKey)!;
    expect(route.capturedBody).toBeDefined();
    expect(route.capturedBody!.dst).toBe('+14155551234');
    expect(route.capturedBody!.src).toBe('+14155559999');
    expect(route.capturedBody!.media_urls).toEqual(['https://example.com/img.jpg']);
    expect(route.capturedBody!.powerpack_uuid).toBe('pp-uuid');
    expect(route.capturedBody!.message_expiry).toBe(3600);
    expect(route.capturedBody!.dlt_entity_id).toBe('ent-123');
    expect(route.capturedBody!.dlt_template_id).toBe('tpl-456');
    expect(route.capturedBody!.dlt_template_category).toBe('transactional');
  });

  test('get sends GET to /Message/{uuid}/', async () => {
    const client = makeClient();
    const uuid = 'msg-uuid-123';

    mockRoute('GET', `${prefix}/Message/${uuid}/`, {
      status: 200,
      body: {
        api_id: 'get-api-id',
        message_uuid: uuid,
        from_number: '+14155559999',
        to_number: '+14155551234',
        message_direction: 'outbound',
        message_state: 'delivered',
        message_type: 'sms',
        total_amount: '0.0035',
        units: 1,
      },
    });

    const result = await client.messages.get(uuid);
    expect(result.messageUuid).toBe(uuid);
    expect(result.fromNumber).toBe('+14155559999');
    expect(result.toNumber).toBe('+14155551234');
    expect(result.messageDirection).toBe('outbound');
    expect(result.messageState).toBe('delivered');
    expect(result.messageType).toBe('sms');
    expect(result.totalAmount).toBe('0.0035');
    expect(result.units).toBe(1);
  });

  test('list sends GET to /Message/ with query params', async () => {
    const client = makeClient();
    const routeKey = `GET ${prefix}/Message/`;

    mockRoute('GET', `${prefix}/Message/`, {
      status: 200,
      body: {
        api_id: 'list-api-id',
        objects: [
          { message_uuid: 'uuid-1', message_state: 'delivered' },
          { message_uuid: 'uuid-2', message_state: 'sent' },
        ],
        meta: { limit: 20, offset: 0, total_count: 2, previous: null, next: null },
      },
    });

    const result = await client.messages.list({
      limit: 20,
      offset: 0,
      messageDirection: 'outbound',
      messageState: 'delivered',
    });

    expect(result.objects).toHaveLength(2);
    expect(result.objects[0].messageUuid).toBe('uuid-1');
    expect(result.meta.totalCount).toBe(2);

    // Verify query params are snake_case
    const route = routes.get(routeKey)!;
    expect(route.capturedQuery!.message_direction).toBe('outbound');
    expect(route.capturedQuery!.message_state).toBe('delivered');
    expect(route.capturedQuery!.limit).toBe('20');
    expect(route.capturedQuery!.offset).toBe('0');
  });

  test('listMedia sends GET to /Message/{uuid}/Media/', async () => {
    const client = makeClient();
    const uuid = 'msg-uuid-media';

    mockRoute('GET', `${prefix}/Message/${uuid}/Media/`, {
      status: 200,
      body: {
        api_id: 'media-api-id',
        objects: [
          { media_id: 'media-1', content_type: 'image/jpeg' },
          { media_id: 'media-2', content_type: 'image/png' },
        ],
      },
    });

    const result = await client.messages.listMedia(uuid);
    expect(result.apiId).toBe('media-api-id');
    expect(result.objects).toHaveLength(2);
  });
});

// --- Template Tests ---

describe('Template', () => {
  test('build with header param, body params, and buttons', () => {
    const tpl = new Template('order_update', 'en')
      .addHeaderParam('Order #1234')
      .addBodyParam('John')
      .addBodyParam('shipped')
      .addButtonParam('url', 0, 'https://track.example.com/1234');

    const result = tpl.build();

    expect(result.name).toBe('order_update');
    expect(result.language).toBe('en');
    expect(result.components).toBeDefined();

    const components = result.components as Record<string, unknown>[];
    expect(components).toHaveLength(3); // header, body, button

    // Header component
    const header = components[0];
    expect(header.type).toBe('header');
    expect(header.parameters).toEqual([{ type: 'text', text: 'Order #1234' }]);

    // Body component
    const body = components[1];
    expect(body.type).toBe('body');
    expect(body.parameters).toEqual([
      { type: 'text', text: 'John' },
      { type: 'text', text: 'shipped' },
    ]);

    // Button component
    const button = components[2];
    expect(button.type).toBe('button');
    expect(button.sub_type).toBe('url');
    expect(button.index).toBe('0');
    expect(button.parameters).toEqual([
      { type: 'text', text: 'https://track.example.com/1234' },
    ]);
  });

  test('build with no components omits components key', () => {
    const tpl = new Template('simple_greeting', 'en');
    const result = tpl.build();

    expect(result.name).toBe('simple_greeting');
    expect(result.language).toBe('en');
    expect(result).not.toHaveProperty('components');
  });

  test('build with currency and datetime body params', () => {
    const tpl = new Template('payment_reminder', 'en')
      .addBodyCurrency('$100.00', 'USD', 100000)
      .addBodyDatetime('2026-03-23');

    const result = tpl.build();
    const components = result.components as Record<string, unknown>[];
    const body = components[0];

    expect(body.type).toBe('body');
    const params = body.parameters as Record<string, unknown>[];
    expect(params[0]).toEqual({
      type: 'currency',
      currency: { fallback_value: '$100.00', code: 'USD', amount_1000: 100000 },
    });
    expect(params[1]).toEqual({
      type: 'date_time',
      date_time: { fallback_value: '2026-03-23' },
    });
  });

  test('build with header media', () => {
    const tpl = new Template('promo', 'en')
      .addHeaderMedia('https://example.com/image.jpg');

    const result = tpl.build();
    const components = result.components as Record<string, unknown>[];
    const header = components[0];

    expect(header.type).toBe('header');
    expect(header.parameters).toEqual([
      { type: 'media', media: 'https://example.com/image.jpg' },
    ]);
  });

  test('fluent chaining - all methods return this', () => {
    const tpl = new Template('test', 'en');

    const r1 = tpl.addHeaderParam('h');
    expect(r1).toBe(tpl);

    const r2 = tpl.addHeaderMedia('url');
    expect(r2).toBe(tpl);

    const r3 = tpl.addBodyParam('b');
    expect(r3).toBe(tpl);

    const r4 = tpl.addBodyCurrency('$1', 'USD', 1000);
    expect(r4).toBe(tpl);

    const r5 = tpl.addBodyDatetime('2026-01-01');
    expect(r5).toBe(tpl);

    const r6 = tpl.addButtonParam('url', 0, 'val');
    expect(r6).toBe(tpl);
  });

  test('default language is en', () => {
    const tpl = new Template('test');
    const result = tpl.build();
    expect(result.language).toBe('en');
  });
});

// --- InteractiveMessage Tests ---

describe('InteractiveMessage', () => {
  test('button creates correct payload structure', () => {
    const result = InteractiveMessage.button(
      'Choose an option',
      [
        { id: 'btn-1', title: 'Option A' },
        { id: 'btn-2', title: 'Option B' },
      ],
      {
        header: { type: 'text', text: 'Welcome' },
        footerText: 'Powered by Plivo',
      },
    );

    expect(result.type).toBe('button');
    expect(result.body).toEqual({ text: 'Choose an option' });
    expect(result.header).toEqual({ type: 'text', text: 'Welcome' });
    expect(result.footer).toEqual({ text: 'Powered by Plivo' });

    const action = result.action as { buttons: unknown[] };
    expect(action.buttons).toEqual([
      { type: 'reply', reply: { id: 'btn-1', title: 'Option A' } },
      { type: 'reply', reply: { id: 'btn-2', title: 'Option B' } },
    ]);
  });

  test('button without optional header/footer', () => {
    const result = InteractiveMessage.button(
      'Pick one',
      [{ id: 'btn-1', title: 'Yes' }],
    );

    expect(result.type).toBe('button');
    expect(result.body).toEqual({ text: 'Pick one' });
    expect(result).not.toHaveProperty('header');
    expect(result).not.toHaveProperty('footer');
  });

  test('list creates correct payload structure', () => {
    const sections = [
      {
        title: 'Category A',
        rows: [
          { id: 'row-1', title: 'Item 1', description: 'First item' },
          { id: 'row-2', title: 'Item 2' },
        ],
      },
      {
        title: 'Category B',
        rows: [{ id: 'row-3', title: 'Item 3' }],
      },
    ];

    const result = InteractiveMessage.list(
      'Browse our catalog',
      'View options',
      sections,
      { headerText: 'Catalog', footerText: 'Tap to select' },
    );

    expect(result.type).toBe('list');
    expect(result.body).toEqual({ text: 'Browse our catalog' });
    expect(result.header).toEqual({ type: 'text', text: 'Catalog' });
    expect(result.footer).toEqual({ text: 'Tap to select' });

    const action = result.action as { button: string; sections: unknown[] };
    expect(action.button).toBe('View options');
    expect(action.sections).toEqual(sections);
  });

  test('list without optional header/footer', () => {
    const result = InteractiveMessage.list(
      'Items',
      'Choose',
      [{ title: 'Section', rows: [{ id: 'r1', title: 'Row 1' }] }],
    );

    expect(result.type).toBe('list');
    expect(result).not.toHaveProperty('header');
    expect(result).not.toHaveProperty('footer');
  });

  test('ctaUrl creates correct payload structure', () => {
    const result = InteractiveMessage.ctaUrl(
      'Visit our website',
      'Open Link',
      'https://example.com',
      {
        header: { type: 'text', text: 'Check it out' },
        footerText: 'Click above',
      },
    );

    expect(result.type).toBe('cta_url');
    expect(result.body).toEqual({ text: 'Visit our website' });
    expect(result.header).toEqual({ type: 'text', text: 'Check it out' });
    expect(result.footer).toEqual({ text: 'Click above' });

    const action = result.action as { buttons: unknown[] };
    expect(action.buttons).toEqual([
      { type: 'cta_url', title: 'Open Link', url: 'https://example.com' },
    ]);
  });

  test('ctaUrl without optional header/footer', () => {
    const result = InteractiveMessage.ctaUrl(
      'Click here',
      'Go',
      'https://example.com',
    );

    expect(result.type).toBe('cta_url');
    expect(result).not.toHaveProperty('header');
    expect(result).not.toHaveProperty('footer');
  });
});

// --- Location Tests ---

describe('Location', () => {
  test('build with latitude and longitude only', () => {
    const result = Location.build(37.7749, -122.4194);

    expect(result.latitude).toBe(37.7749);
    expect(result.longitude).toBe(-122.4194);
    expect(result).not.toHaveProperty('name');
    expect(result).not.toHaveProperty('address');
  });

  test('build with optional name and address', () => {
    const result = Location.build(37.7749, -122.4194, {
      name: 'Plivo HQ',
      address: '201 Spear St, San Francisco, CA',
    });

    expect(result.latitude).toBe(37.7749);
    expect(result.longitude).toBe(-122.4194);
    expect(result.name).toBe('Plivo HQ');
    expect(result.address).toBe('201 Spear St, San Francisco, CA');
  });

  test('build with only name (no address)', () => {
    const result = Location.build(40.7128, -74.006, {
      name: 'NYC Office',
    });

    expect(result.latitude).toBe(40.7128);
    expect(result.longitude).toBe(-74.006);
    expect(result.name).toBe('NYC Office');
    expect(result).not.toHaveProperty('address');
  });

  test('build with only address (no name)', () => {
    const result = Location.build(40.7128, -74.006, {
      address: '123 Broadway, New York, NY',
    });

    expect(result.latitude).toBe(40.7128);
    expect(result.longitude).toBe(-74.006);
    expect(result).not.toHaveProperty('name');
    expect(result.address).toBe('123 Broadway, New York, NY');
  });
});
