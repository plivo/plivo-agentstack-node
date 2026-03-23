# Plivo Agent Node.js SDK

[![npm version](https://img.shields.io/npm/v/@plivo/agent.svg)](https://www.npmjs.com/package/@plivo/agent)
[![Node 18+](https://img.shields.io/node/v/@plivo/agent.svg)](https://www.npmjs.com/package/@plivo/agent)
[![Tests](https://github.com/plivo/plivo-agentstack-node/actions/workflows/tests.yml/badge.svg)](https://github.com/plivo/plivo-agentstack-node/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

TypeScript SDK for Plivo Programmable Agents — build AI agents that work over voice calls programmatically.

## Agent pipeline modes

The SDK supports every Voice AI Agent configuration. Behavior is determined by which configs you provide when creating an agent — there is no explicit `mode` field:

| Config provided | Pipeline | You handle |
|---|---|---|
| `stt` + `llm` + `tts` | **Full AI** — Plivo runs the entire voice agent pipeline | Tool calls and flow control |
| `stt` + `tts` | **BYOLLM** — Plivo handles speech, you bring your own LLM | LLM inference, stream tokens back via `sendText()` |
| `s2s` | **Speech-to-speech** — single provider handles STT+LLM+TTS natively | Event handling (OpenAI Realtime, Gemini Live) |
| _(none)_ | **Audio stream** — Plivo is a telephony bridge | You bring and orchestrate your own STT, LLM, TTS, VAD etc. |

### Call flow

```
Inbound/Outbound Call
        |
   Plivo Platform
        |
   WebSocket ──────► Your VoiceApp server
        |                   |
   Audio stream        app.on("tool_call", handler)
   VAD / Turn          app.on("prompt", handler)      ← BYOLLM
   STT → LLM → TTS    app.on("turn.completed", handler)
        |                   |
   Caller hears        session.sendToolResult()
   agent speech        session.speak() / session.transferToNumber()
                       session.sendText()              ← stream LLM tokens
                       session.sendMedia()             ← raw audio mode
```

### Agent capabilities

- **Tool calling** — LLM invokes tools, you handle them and return results
- **Mid-call model switching** — swap LLM model/prompt/tools via `session.update()` for agent handoff
- **Multi-party conferences** — add participants with `calls.dial()`, warm transfer patterns
- **Voicemail detection** — async AMD with beep detection for outbound calls
- **Background audio** — ambient sounds (office, typing, call-center) mixed with agent speech
- **DTMF handling** — detect keypress events for IVR flows
- **Interruption (barge-in)** — caller can interrupt the agent mid-speech
- **User idle detection** — configurable reminders and auto-hangup on silence
- **Per-turn metrics** — latency breakdown (STT, LLM TTFT, TTS) for monitoring
- **Audio streaming** — raw audio relay with `sendMedia()`, checkpoints, and `clearAudio()`
- **BYOK (Bring Your Own Keys)** — pass API keys for Deepgram, OpenAI, ElevenLabs, Cartesia, etc.

## SDK features

- **TypeScript-native** — full type safety, IntelliSense, and autocompletion
- **Dual ESM/CJS** — works with `import` and `require()` via `tsup`
- **Standalone WS server** — integrate with any Node.js HTTP server or Express
- **Sync + async handlers** — handlers can return `void` or `Promise<void>`
- **Automatic retries** — exponential backoff on 429 (respects `Retry-After`) and 5xx
- **camelCase API** — `snake_case` JSON transformed at the HTTP boundary
- **Typed events** — 25 TypeScript interfaces for all WebSocket events
- **Per-session state** — `session.data` object persists across events within a call
- **Clean errors** — `PlivoError` class hierarchy with `statusCode` and typed subclasses
- **Webhook verification** — `validateSignatureV3()` for securing callbacks
- **Minimal deps** — `axios` for HTTP, `ws` for WebSocket

## Installation

```bash
npm install @plivo/agent
# or
bun add @plivo/agent
```

Requires Node.js 18+.

## Quick start

Sign up at [cx.plivo.com/signup](https://cx.plivo.com/signup) to get your `PLIVO_AUTH_ID` and `PLIVO_AUTH_TOKEN`, then see the [`examples/`](examples/) directory:

- [**Basic agent**](examples/basic-agent.ts) — tool calls, session lifecycle, error handling
- [**Outbound call**](examples/outbound-call.ts) — REST client for agent CRUD and call initiation

### Voice app (WebSocket server)

```typescript
import { createServer } from 'node:http';
import { VoiceApp } from '@plivo/agent';

const app = new VoiceApp();

app.onSetup((session, event) => {
  console.log(`Session started: ${event.agentSessionId}`);
});

app.onToolCall((session, event) => {
  session.sendToolResult(event.id, { temperature: 72, city: 'SF' });
});

app.onSessionEnded((session, event) => {
  console.log(`Session ended: ${event.durationSeconds}s, ${event.turnCount} turns`);
});

const server = createServer();
server.on('upgrade', (req, socket, head) => app.handleUpgrade(req, socket, head));
server.listen(9000, () => console.log('Listening on ws://0.0.0.0:9000'));
```

### REST client

```typescript
import { PlivoAgentClient } from '@plivo/agent';

const client = new PlivoAgentClient('YOUR_AUTH_ID', 'YOUR_AUTH_TOKEN');

// Create an agent
const agent = await client.agents.create({
  agentName: 'Sales Agent',
  websocketUrl: 'wss://your-server.com/ws',
});
console.log(`Agent: ${agent.agentUuid}`);

// Initiate an outbound call
const call = await client.calls.initiate({
  agentId: agent.agentUuid,
  from: '+14155551234',
  to: ['+19876543210'],
});
console.log(`Call: ${call.callUuid} (${call.status})`);
```

## Development

```bash
git clone https://github.com/plivo/plivo-agentstack-node.git
cd plivo-agentstack-node
bun install
bun run build         # tsup — dual ESM/CJS
bun test              # bun:test — ~78 tests
bunx tsc --noEmit     # typecheck
```

## License

[MIT](LICENSE)
