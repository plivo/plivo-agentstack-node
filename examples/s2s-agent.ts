/**
 * Speech-to-Speech Example -- OpenAI Realtime / Gemini Live
 *
 * Config: s2s only (no stt, llm, or tts)
 *
 * Speech-to-speech is a separate pipeline where a single provider handles
 * STT + LLM + TTS natively. Audio goes directly to the S2S provider
 * and synthesized audio comes back -- Plivo does not run separate workers.
 *
 * S2S is mutually exclusive with stt/llm/tts configs.
 *
 * Tool calling: S2S providers support function calling natively.
 * tool.called events arrive on the WebSocket and you send tool_result back.
 *
 * Providers:
 *   S2S: OpenAI Realtime (gpt-4o-realtime) or Gemini Live
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, OPENAI_API_KEY env vars
 *   3. npx tsx examples/s2s-agent.ts
 */

import { createServer } from 'node:http';
import { PlivoAgentClient, VoiceApp, EndCall } from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  ToolCallEvent,
  DtmfEvent,
  ErrorEventData,
} from '../src/index.js';

const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID ?? '';
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

const client = new PlivoAgentClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

// --- Tool definitions ---

const CHECK_WEATHER_TOOL = {
  name: 'check_weather',
  description: 'Get the current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' },
    },
    required: ['city'],
  },
};

const endCall = new EndCall('Thanks for calling. Goodbye!');

const TOOLS = [CHECK_WEATHER_TOOL, endCall.tool];

const SYSTEM_PROMPT =
  'You are a helpful voice assistant. Be concise -- this is a phone call. ' +
  'When the user asks about weather, use the check_weather tool. ' +
  endCall.instructions;

// --- Agent setup ---

async function initAgent() {
  const agent = await client.agents.create({
    agentName: 'S2S Voice Agent',
    s2s: {
      provider: 'openai_realtime',     // openai_realtime, gemini_live, azure_openai
      model: 'gpt-4o-realtime',
      voice: 'alloy',                  // alloy, echo, fable, onyx, nova, shimmer
      api_key: OPENAI_API_KEY,
      system_prompt: SYSTEM_PROMPT,
      tools: TOOLS,
    },
    // No stt, llm, or tts -- S2S is a separate pipeline
    websocketUrl: 'ws://localhost:9000/ws',
  });

  console.log(`Agent created: ${agent.agentUuid}`);
  return agent;
}

// --- Event handlers ---

const app = new VoiceApp();

app.onSetup((session, event: AgentSessionStartedEvent) => {
  console.log(`Session started: ${event.agentSessionId}`);
});

app.onToolCall((session, event: ToolCallEvent) => {
  console.log(`  Tool call: ${event.name}(${JSON.stringify(event.arguments)})`);

  if (event.name === 'check_weather') {
    const city = (event.arguments.city as string) ?? 'unknown';
    // In a real app, call a weather API here
    session.sendToolResult(event.id, {
      city,
      temperature: '72F',
      condition: 'sunny',
    });
  } else if (endCall.match(event)) {
    endCall.handle(session, event);
  } else {
    session.sendToolError(event.id, `Unknown tool: ${event.name}`);
  }
});

app.on('user.dtmf', (session, event) => {
  const e = event as DtmfEvent;
  console.log(`  DTMF: ${e.digit}`);
  if (e.digit === '#') {
    session.hangup();
  }
});

app.onError((session, event: ErrorEventData) => {
  console.log(`  Error [${event.code}]: ${event.message}`);
});

app.onSessionEnded((session, event: AgentSessionEndedEvent) => {
  console.log(`Session ended: ${event.durationSeconds}s`);
});

// --- Start server ---

initAgent().then(() => {
  const server = createServer();
  server.on('upgrade', (req, socket, head) => {
    app.handleUpgrade(req, socket, head);
  });
  server.listen(9000, () => {
    console.log('VoiceApp listening on ws://0.0.0.0:9000');
  });
}).catch(console.error);
