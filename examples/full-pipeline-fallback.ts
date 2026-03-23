/**
 * Full Pipeline with Provider Fallback -- Resilient Voice Agent
 *
 * Config: stt + llm + tts with fallback providers for each component
 *
 * Demonstrates automatic failover between providers:
 *   - STT: Deepgram -> OpenAI Whisper (if Deepgram fails)
 *   - LLM: OpenAI GPT-4o -> Anthropic Claude -> Groq (if OpenAI fails)
 *   - TTS: ElevenLabs -> OpenAI TTS (if ElevenLabs fails)
 *
 * The FallbackAdapter retries automatically -- no customer code needed.
 *
 * Usage:
 *   1. npm install
 *   2. Set provider API keys as env vars
 *   3. npx tsx examples/full-pipeline-fallback.ts
 */

import { createServer } from 'node:http';
import { PlivoAgentClient, VoiceApp } from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  ToolCallEvent,
  TurnCompletedEvent,
  TurnMetricsEvent,
  InterruptionEvent,
  ErrorEventData,
} from '../src/index.js';

const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID ?? '';
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN ?? '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';

const client = new PlivoAgentClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

// --- Tool definitions ---

const CHECK_BALANCE_TOOL = {
  name: 'check_balance',
  description: "Check the customer's account balance",
  parameters: {
    type: 'object',
    properties: {
      account_id: { type: 'string', description: 'The account ID' },
    },
    required: ['account_id'],
  },
};

const SYSTEM_PROMPT =
  'You are a helpful banking assistant. Be concise and professional. ' +
  'When the customer asks about their balance, use the check_balance tool.';

// --- Agent setup with fallback providers ---

async function initAgent() {
  const agent = await client.agents.create({
    agentName: 'Resilient Banking Agent',

    // Primary STT
    stt: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
      api_key: DEEPGRAM_API_KEY,
    },

    // STT Fallback
    sttFallback: [
      {
        provider: 'openai',
        model: 'gpt-4o-transcribe',
        api_key: OPENAI_API_KEY,
      },
    ],

    // Primary LLM
    llm: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      api_key: OPENAI_API_KEY,
      system_prompt: SYSTEM_PROMPT,
      tools: [CHECK_BALANCE_TOOL],
    },

    // LLM Fallback
    llmFallback: [
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        api_key: ANTHROPIC_API_KEY,
      },
      {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        api_key: GROQ_API_KEY,
      },
    ],

    // Primary TTS
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      model: 'eleven_flash_v2_5',
      api_key: ELEVENLABS_API_KEY,
    },

    // TTS Fallback
    ttsFallback: [
      {
        provider: 'openai',
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        api_key: OPENAI_API_KEY,
      },
    ],

    welcomeGreeting: 'Hello! Welcome to Acme Bank. How can I help you today?',
    websocketUrl: 'ws://localhost:9000/ws',
    speaksFirst: 'agent',
    interruptionEnabled: true,
    semanticVad: {
      completed_turn_delay_ms: 250,
      incomplete_turn_delay_ms: 1200,
      min_interruption_duration_ms: 200,
    },
  });

  console.log(`Agent created: ${agent.agentUuid}`);
  return agent;
}

// --- Event handlers ---

const app = new VoiceApp();

app.onSetup((session, event: AgentSessionStartedEvent) => {
  console.log(`Session started: ${event.agentSessionId}`);
  session.update({ events: { metrics_events: true } });
});

app.onToolCall((session, event: ToolCallEvent) => {
  console.log(`  Tool call: ${event.name}(${JSON.stringify(event.arguments)})`);

  if (event.name === 'check_balance') {
    session.sendToolResult(event.id, {
      balance: '$12,345.67',
      account_type: 'checking',
      last_transaction: 'Feb 14 -- $45.00 at Coffee Shop',
    });
  } else {
    session.sendToolError(event.id, `Unknown tool: ${event.name}`);
  }
});

app.on('turn.metrics', (session, event) => {
  const e = event as TurnMetricsEvent;
  console.log(
    `  Metrics [turn ${e.turnNumber}]: ` +
      `perceived=${e.userPerceivedMs}ms ` +
      `stt=${e.sttProvider} ` +
      `llm=${e.llmProvider} ` +
      `tts=${e.ttsProvider}`,
  );
});

app.onTurnCompleted((session, event: TurnCompletedEvent) => {
  console.log(`  User:  ${event.userText}`);
  console.log(`  Agent: ${event.agentText}`);
});

app.on('agent.speech_interrupted', (session, event) => {
  const e = event as InterruptionEvent;
  console.log(`  Interrupted: '${e.interruptedText ?? ''}'`);
});

app.onError((session, event: ErrorEventData) => {
  console.log(`  Error [${event.code}]: ${event.message}`);
});

app.onSessionEnded((session, event: AgentSessionEndedEvent) => {
  console.log(`Session ended: ${event.durationSeconds}s, ${event.turnCount} turns`);
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
