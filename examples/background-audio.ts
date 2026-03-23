/**
 * Background Audio Example -- Ambient Sound During Calls
 *
 * Demonstrates how to use built-in background sounds to make AI agent calls
 * feel more natural. Background audio plays continuously (mixed with agent
 * speech) and can be switched or stopped at runtime.
 *
 * Built-in sounds:
 *   - "office"            Office ambience
 *   - "city-street"       City/street ambient noise
 *   - "crowded-room"      Crowded room / busy venue
 *   - "call-center"       Call center ambience
 *   - "typing"            Keyboard typing (longer loop)
 *   - "typing-short"      Keyboard typing (shorter)
 *
 * Two ways to enable:
 *   1. At agent creation: set backgroundAudio in create params
 *   2. At runtime: session.playBackground() / session.stopBackground()
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN env vars
 *   3. npx tsx examples/background-audio.ts
 */

import { createServer } from 'node:http';
import { PlivoAgentClient, VoiceApp } from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  ToolCallEvent,
  TurnCompletedEvent,
  DtmfEvent,
} from '../src/index.js';

const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID ?? '';
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN ?? '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';

const client = new PlivoAgentClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

const TOOLS = [
  {
    name: 'check_status',
    description: 'Check order status',
    parameters: {
      type: 'object',
      properties: { order_id: { type: 'string' } },
      required: ['order_id'],
    },
  },
];

async function initAgent() {
  const agent = await client.agents.create({
    agentName: 'Office Support Agent',
    stt: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
      api_key: DEEPGRAM_API_KEY,
    },
    llm: {
      provider: 'openai',
      model: 'gpt-4o',
      api_key: OPENAI_API_KEY,
      system_prompt:
        'You are a helpful office support agent. ' +
        'Be friendly, professional, and concise.',
      tools: TOOLS,
    },
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      model: 'eleven_flash_v2_5',
      api_key: ELEVENLABS_API_KEY,
      output_format: 'pcm_16000',
    },
    welcomeGreeting: 'Hi! Thanks for calling support. How can I help?',
    websocketUrl: 'ws://localhost:9000/ws',

    // Background audio (starts automatically on every call)
    backgroundAudio: {
      sound: 'office',
      volume: 0.3,
      loop: true,
    },
  });

  console.log(`Agent created: ${agent.agentUuid}`);
  return agent;
}

// --- Event handlers ---

const app = new VoiceApp();

app.onSetup((session, event: AgentSessionStartedEvent) => {
  console.log(`Session started: ${event.agentSessionId}`);
  // Background audio is already playing (configured at agent creation).
  // You can switch sounds at runtime:
  //   session.playBackground('crowded-room', 0.4);
});

app.onToolCall((session, event: ToolCallEvent) => {
  console.log(`  Tool call: ${event.name}`);

  if (event.name === 'check_status') {
    // Switch to typing sound while "looking up" the order
    session.playBackground('typing', 0.5);

    const result = { status: 'shipped', eta: 'March 5' };
    session.sendToolResult(event.id, result);

    // Switch back to office ambience after responding
    session.playBackground('office', 0.3);
  } else {
    session.sendToolError(event.id, `Unknown tool: ${event.name}`);
  }
});

app.on('user.dtmf', (session, event) => {
  const e = event as DtmfEvent;
  console.log(`  DTMF: ${e.digit}`);
  if (e.digit === '1') {
    session.playBackground('office', 0.3);
  } else if (e.digit === '2') {
    session.playBackground('call-center', 0.4);
  } else if (e.digit === '0') {
    session.stopBackground();
  }
});

app.onTurnCompleted((session, event: TurnCompletedEvent) => {
  console.log(`  User:  ${event.userText}`);
  console.log(`  Agent: ${event.agentText}`);
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
