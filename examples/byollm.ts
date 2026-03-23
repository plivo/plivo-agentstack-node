/**
 * BYOLLM Example -- Bring Your Own LLM
 *
 * Config: stt + tts (Plivo runs STT + TTS, you run the LLM)
 *
 * This is for when you need full control over the LLM -- fine-tuned models,
 * custom RAG, multi-agent orchestration, or complex conversation logic.
 *
 * Plivo handles: audio transport, VAD, turn detection, STT, TTS, barge-in.
 * You handle: everything text-based (LLM inference, tool calling, context).
 *
 * Note on tools:
 *   - Agent tools (CollectEmail, etc.) do NOT work in BYOLLM.
 *   - Simple customer-side tools (EndCall, etc.) work -- they are patterns in
 *     your WebSocket handler, not server-side tools.
 *
 * Features demonstrated:
 *   - VoiceApp server pattern (Plivo connects to you)
 *   - Async handler for streaming LLM tokens
 *   - Per-session conversation history via session.data
 *   - Context injection for external data
 *   - Full tool calling loop (your LLM owns tool execution)
 *
 * Providers:
 *   STT:  Deepgram Nova-3  (Plivo-managed)
 *   TTS:  ElevenLabs Sarah  (Plivo-managed)
 *   LLM:  Your own (e.g. OpenAI GPT-4o -- not imported here)
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, OPENAI_API_KEY env vars
 *   3. npx tsx examples/byollm.ts
 */

import { createServer } from 'node:http';
import { PlivoAgentClient, VoiceApp } from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  PromptEvent,
  TurnCompletedEvent,
  InterruptionEvent,
  DtmfEvent,
  UserIdleEvent,
  ErrorEventData,
} from '../src/index.js';

const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID ?? '';
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN ?? '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY ?? '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';

const client = new PlivoAgentClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

// --- Agent setup ---

async function initAgent() {
  const agent = await client.agents.create({
    agentName: "Mario's Pizza Bot",
    stt: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
      api_key: DEEPGRAM_API_KEY,
    },
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      model: 'eleven_turbo_v2',
      api_key: ELEVENLABS_API_KEY,
    },
    semanticVad: {
      speech_activation_threshold: 0.5,
      completed_turn_delay_ms: 250,
    },
    welcomeGreeting: "Welcome to Mario's Pizza! What can I get for you today?",
    websocketUrl: 'ws://localhost:9000/ws',
    interruptionEnabled: true,
    idleTimeout: {
      no_response_timeout_ms: 15000,
      reminder_message: 'Are you still there? Would you like to place an order?',
      extended_wait_time_ms: 30000,
      max_retries: 3,
      hangup_message: "I haven't heard from you. Goodbye!",
    },
  });

  console.log(`Agent created: ${agent.agentUuid}`);
}

// --- Event handlers ---

const app = new VoiceApp();

app.onSetup((session, event: AgentSessionStartedEvent) => {
  session.data.messages = [
    {
      role: 'system',
      content:
        "You are a friendly pizza ordering assistant for Mario's Pizza. " +
        'Help the customer place an order. Be concise -- this is a phone call, ' +
        'not a chat. Keep responses under 2 sentences when possible.',
    },
  ];
  session.data.orderItems = [];
  session.data.customerContext = null;

  console.log(`Session started: ${event.agentSessionId}`);
});

app.on('user.transcription', async (session, event) => {
  const e = event as PromptEvent;
  if (!e.isFinal || !e.text.trim()) return;

  console.log(`  User said: '${e.text}'`);
  const messages = session.data.messages as Record<string, unknown>[];
  messages.push({ role: 'user', content: e.text });

  // --- Replace this block with your actual LLM call ---
  // Example using OpenAI (install openai package separately):
  //
  //   import OpenAI from 'openai';
  //   const openai = new OpenAI();
  //
  //   const stream = await openai.chat.completions.create({
  //     model: 'gpt-4o',
  //     messages: messages as OpenAI.ChatCompletionMessageParam[],
  //     stream: true,
  //     temperature: 0.7,
  //     max_tokens: 200,
  //   });
  //
  //   const fullResponse: string[] = [];
  //   for await (const chunk of stream) {
  //     const token = chunk.choices[0]?.delta?.content;
  //     if (token) {
  //       fullResponse.push(token);
  //       session.sendText(token);
  //     }
  //   }
  //   session.sendText('', true);
  //
  //   const assistantText = fullResponse.join('');
  //   messages.push({ role: 'assistant', content: assistantText });
  //   console.log(`  LLM response: '${assistantText}'`);

  // Placeholder echo response (replace with actual LLM):
  const reply = `I heard you say: ${e.text}`;
  session.sendText(reply, true);
  messages.push({ role: 'assistant', content: reply });
  console.log(`  Response: '${reply}'`);
});

app.onTurnCompleted((session, event: TurnCompletedEvent) => {
  const messages = session.data.messages as Record<string, unknown>[];
  const turnCount = messages.filter((m) => m.role === 'user').length;
  if (turnCount >= 3 && !session.data.customerContext) {
    session.data.customerContext = 'returning_customer';
    const sysMsg = messages[0] as Record<string, string>;
    sysMsg.content +=
      '\n\nNote: This customer has been chatting for a while. ' +
      'Be extra helpful and try to close the order.';
    console.log(`  Context updated: returning customer after ${turnCount} turns`);
  }
});

app.on('agent.speech_interrupted', (_session, _event) => {
  console.log('  User interrupted -- TTS was cut');
});

app.on('user.dtmf', (session, event) => {
  const e = event as DtmfEvent;
  console.log(`  DTMF: ${e.digit}`);
  if (e.digit === '0') {
    session.transfer('+18005551234');
  }
});

app.on('user.idle', (session, event) => {
  const e = event as UserIdleEvent;
  console.log(`  User idle: retry=${e.retryCount}, reason=${e.reason}`);
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
