/**
 * Config Examples -- All Pipeline Configurations
 *
 * There is no `mode` field. Behavior is determined entirely by which configs
 * (stt, llm, tts) you include when creating the agent:
 *
 *   +------------------------+------------------------+-----------------+
 *   | Config provided        | Pipeline behavior      | You handle      |
 *   +------------------------+------------------------+-----------------+
 *   | stt + llm + tts        | Full AI pipeline       | Tool calls      |
 *   | stt + tts              | Plivo STT + TTS        | Your own LLM    |
 *   | stt only               | Plivo STT              | LLM + TTS       |
 *   | tts only               | Plivo TTS              | STT + LLM       |
 *   | nothing                | Raw audio relay        | Everything      |
 *   +------------------------+------------------------+-----------------+
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN env vars
 *   3. npx tsx examples/pipeline-modes.ts [full-ai | customer-llm | stt-only | tts-only | raw-audio]
 */

import { createServer } from 'node:http';
import { PlivoAgentClient, VoiceApp } from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  ToolCallEvent,
  TurnCompletedEvent,
  PromptEvent,
  DtmfEvent,
  PlayCompletedEvent,
  VadSpeechStartedEvent,
  VadSpeechStoppedEvent,
  StreamStartEvent,
  StreamMediaEvent,
  StreamDtmfEvent,
} from '../src/index.js';

const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID ?? '';
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN ?? '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';

const client = new PlivoAgentClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

// =========================================================================
// Example 1: Full AI Pipeline (stt + llm + tts)
// =========================================================================

async function createFullAiAgent() {
  return client.agents.create({
    agentName: 'Full AI Support Agent',
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
      system_prompt: 'You are a helpful support agent.',
      tools: [
        {
          name: 'lookup_order',
          description: 'Look up an order by ID',
          parameters: {
            type: 'object',
            properties: { order_id: { type: 'string' } },
            required: ['order_id'],
          },
        },
      ],
    },
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      api_key: ELEVENLABS_API_KEY,
    },
    welcomeGreeting: 'Hi! How can I help you?',
    websocketUrl: 'ws://localhost:9000/ws',
  });
}

const appFullAi = new VoiceApp();

appFullAi.onToolCall((session, event: ToolCallEvent) => {
  session.sendToolResult(event.id, { status: 'shipped', eta: 'Feb 20' });
});

appFullAi.on('play.completed', (session, _event) => {
  session.speak('Thanks for waiting.');
});

appFullAi.onTurnCompleted((session, event: TurnCompletedEvent) => {
  console.log(`  User:  ${event.userText}`);
  console.log(`  Agent: ${event.agentText}`);
});

// =========================================================================
// Example 2: Customer LLM (stt + tts, no llm)
// =========================================================================

async function createCustomerLlmAgent() {
  return client.agents.create({
    agentName: 'Customer LLM Agent',
    stt: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
      api_key: DEEPGRAM_API_KEY,
    },
    // llm: omitted -- you run your own
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      api_key: ELEVENLABS_API_KEY,
    },
    welcomeGreeting: 'Hi! How can I help you?',
    websocketUrl: 'ws://localhost:9000/ws',
  });
}

const appCustomerLlm = new VoiceApp();

appCustomerLlm.on('user.transcription', async (session, event) => {
  const e = event as PromptEvent;
  if (!e.isFinal) return;

  console.log(`  User said: ${e.text}`);

  // --- Replace with your own LLM call ---
  // import OpenAI from 'openai';
  // const openai = new OpenAI();
  // const stream = await openai.chat.completions.create({
  //   model: 'gpt-4o',
  //   messages: [
  //     { role: 'system', content: 'You are a helpful assistant.' },
  //     { role: 'user', content: e.text },
  //   ],
  //   stream: true,
  // });
  // for await (const chunk of stream) {
  //   const token = chunk.choices[0]?.delta?.content ?? '';
  //   if (token) session.sendText(token);
  // }
  // session.sendText('', true);

  // Placeholder echo:
  session.sendText(`Echo: ${e.text}`, true);
});

// =========================================================================
// Example 3: STT Only (stt, no llm, no tts)
// =========================================================================

async function createSttOnlyAgent() {
  return client.agents.create({
    agentName: 'STT Relay Agent',
    stt: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
      api_key: DEEPGRAM_API_KEY,
    },
    events: { vad_events: true },
    websocketUrl: 'ws://localhost:9000/ws',
  });
}

const appSttOnly = new VoiceApp();

appSttOnly.on('user.transcription', (session, event) => {
  const e = event as PromptEvent;
  if (e.isFinal) {
    console.log(`  Transcript: ${e.text}`);
  }
});

appSttOnly.on('user.speech_started', (session, event) => {
  const e = event as VadSpeechStartedEvent;
  console.log(`  Speech started at ${e.timestampMs}ms`);
});

appSttOnly.on('user.speech_stopped', (session, event) => {
  const e = event as VadSpeechStoppedEvent;
  console.log(`  Speech stopped after ${e.durationMs}ms`);
});

// =========================================================================
// Example 4: TTS Only (tts, no stt, no llm)
// =========================================================================

async function createTtsOnlyAgent() {
  return client.agents.create({
    agentName: 'Notification Agent',
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      api_key: ELEVENLABS_API_KEY,
    },
    welcomeGreeting: 'Hello, you have a new notification.',
    websocketUrl: 'ws://localhost:9000/ws',
  });
}

const appTtsOnly = new VoiceApp();

appTtsOnly.onSetup((session, event: AgentSessionStartedEvent) => {
  console.log(`  Session started: ${event.agentSessionId}`);
});

appTtsOnly.on('user.dtmf', (session, event) => {
  const e = event as DtmfEvent;
  console.log(`  DTMF: ${e.digit}`);
  if (e.digit === '1') {
    session.speak('Your balance is forty two dollars and seventeen cents.');
  } else if (e.digit === '2') {
    session.speak('Transferring you to an agent.');
    session.transfer('+18005551234');
  } else if (e.digit === '#') {
    session.speak('Goodbye.');
    session.hangup();
  }
});

appTtsOnly.onSessionEnded((session, event: AgentSessionEndedEvent) => {
  console.log(`  Session ended: ${event.durationSeconds}s`);
});

// =========================================================================
// Example 5: Raw Audio Relay (no stt, no llm, no tts)
// =========================================================================

async function createRawAudioAgent() {
  return client.agents.create({
    agentName: 'Raw Audio Relay',
    websocketUrl: 'ws://localhost:9000/ws',
  });
}

const appRawAudio = new VoiceApp();

appRawAudio.on('start', (session, event) => {
  const e = event as StreamStartEvent;
  session.data.frames = [] as Buffer[];
  console.log(`  Raw audio: format=${e.contentType} rate=${e.sampleRate}`);
});

appRawAudio.on('media', (session, event) => {
  const e = event as StreamMediaEvent;
  const audioBytes = Buffer.from(e.payload, 'base64');
  (session.data.frames as Buffer[]).push(audioBytes);

  // Feed to your own STT, speech-to-speech model, etc.
  // Send audio back:
  //   session.sendMedia(responseAudioB64, 'audio/x-mulaw', 8000);
  // Mark playback position:
  //   session.sendCheckpoint('my-marker');
  // Clear queued audio:
  //   session.clearAudio();
});

appRawAudio.on('dtmf', (session, event) => {
  const e = event as StreamDtmfEvent;
  console.log(`  DTMF: ${e.digit}`);
  if (e.digit === '#') {
    session.hangup();
  }
});

// =========================================================================
// Run whichever example you want
// =========================================================================

const examples: Record<string, [() => Promise<{ agentUuid: string }>, VoiceApp]> = {
  'full-ai': [createFullAiAgent, appFullAi],
  'customer-llm': [createCustomerLlmAgent, appCustomerLlm],
  'stt-only': [createSttOnlyAgent, appSttOnly],
  'tts-only': [createTtsOnlyAgent, appTtsOnly],
  'raw-audio': [createRawAudioAgent, appRawAudio],
};

const choice = process.argv[2] ?? 'full-ai';
const entry = examples[choice];

if (!entry) {
  console.log(`Usage: npx tsx examples/pipeline-modes.ts [${Object.keys(examples).join(' | ')}]`);
  process.exit(1);
}

const [createFn, voiceApp] = entry;

createFn()
  .then((agent) => {
    console.log(`Agent created: ${agent.agentUuid}  (example: ${choice})`);
    const server = createServer();
    server.on('upgrade', (req, socket, head) => {
      voiceApp.handleUpgrade(req, socket, head);
    });
    server.listen(9000, () => {
      console.log('VoiceApp listening on ws://0.0.0.0:9000');
    });
  })
  .catch(console.error);
