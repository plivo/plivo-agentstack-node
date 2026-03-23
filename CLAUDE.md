# CLAUDE.md — plivo-agentstack-node

## Project overview

TypeScript SDK for the Plivo Voice AI Agent platform. Dual ESM/CJS output via tsup. Covers REST client (Agent CRUD, Call management, Number assignment, Session history) and WebSocket server (VoiceApp with typed event routing).

## Repository layout

```
plivo-agentstack-node/
  package.json
  tsconfig.json
  tsup.config.ts
  src/
    index.ts              # Public exports
    client.ts             # PlivoAgentClient — entry point
    http.ts               # HttpTransport — Axios, auth, retry, camelCase transform
    errors.ts             # PlivoError hierarchy
    types.ts              # Shared types (Meta, pagination)
    agent.ts              # AgentResource — CRUD
    call.ts               # CallResource — initiate/connect/dial
    number.ts             # NumberResource — assign/list/unassign
    session-resource.ts   # SessionResource — list/get
    voice-app.ts          # VoiceApp — WS server, event routing
    session.ts            # Session — per-connection handle
    events.ts             # 25 event interfaces + parseEvent()
    webhook.ts            # validateSignatureV3()
  tests/
    client.test.ts        # REST client tests (bun:test + mock HTTP server)
    voice-app.test.ts     # VoiceApp WS tests
    events.test.ts        # Event parsing tests
    session.test.ts       # Session message tests
    errors.test.ts        # Error hierarchy tests
    webhook.test.ts       # Webhook signature tests
  examples/
    basic-agent.ts        # Minimal agent example
    outbound-call.ts      # Outbound call example
```

## Build & test

```bash
bun install
bun run build        # tsup — dual ESM/CJS
bun test             # bun:test — 78 tests
bunx tsc --noEmit    # typecheck
```

## Code conventions

- TypeScript-native with strict mode
- camelCase for JS API, snake_case transformed at HTTP boundary
- Axios for HTTP with Basic auth
- ws library for WebSocket server
- bun:test for testing with local mock HTTP server (no nock)
- Errors extend PlivoError with specific status code subclasses
- VoiceApp handlers can be sync or async
- Session methods enqueue messages via microtask drain

## Dependencies

- `axios` — HTTP client
- `ws` — WebSocket server
- `typescript`, `tsup` — dev
