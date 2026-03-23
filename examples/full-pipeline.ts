/**
 * Full Pipeline Example -- Customer Support Agent with Model Switching
 *
 * Config: stt + llm + tts (Plivo runs the full AI pipeline)
 *
 * Your code only handles:
 *   - Tool calls (e.g. order lookup, transfers, escalation)
 *   - Flow control (update, inject, speak, play, hangup)
 *
 * Features demonstrated:
 *   - VoiceApp server pattern (Plivo connects to you)
 *   - Agent tools: server-side sub-agents for data collection (CollectEmail)
 *   - Mid-call model switching (fast -> powerful on escalation)
 *   - Transfer with parallel/sequential hunt
 *   - Pre-recorded audio playback (agent_session.play)
 *   - Per-turn latency metrics (turn.metrics)
 *   - DTMF receive (caller keypresses) and send (IVR navigation)
 *
 * Providers:
 *   STT:  Deepgram Nova-3
 *   LLM:  OpenAI GPT-4o
 *   TTS:  ElevenLabs Flash v2.5 (voice: Sarah)
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN env vars
 *   3. npx tsx examples/full-pipeline.ts
 */

import { createServer } from 'node:http';
import {
  PlivoAgentClient,
  VoiceApp,
  CollectEmail,
  EndCall,
} from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  AgentToolCompletedEvent,
  AgentToolFailedEvent,
  ToolCallEvent,
  TurnCompletedEvent,
  TurnMetricsEvent,
  DtmfEvent,
  DtmfSentEvent,
  InterruptionEvent,
  VoicemailDetectedEvent,
  VoicemailBeepEvent,
  PlayCompletedEvent,
  AgentHandoffEvent,
  UserIdleEvent,
  UserStateChangedEvent,
  AgentStateChangedEvent,
  AgentSpeechCreatedEvent,
  AgentSpeechStartedEvent,
  AgentSpeechCompletedEvent,
  ToolExecutedEvent,
  UserBackchannelEvent,
  SessionUsageEvent,
  LlmAvailabilityChangedEvent,
  ErrorEventData,
} from '../src/index.js';

const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID ?? '';
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN ?? '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';
const CALLBACK_HOST = process.env.CALLBACK_HOST ?? 'http://localhost:9001';

const client = new PlivoAgentClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

// --- Fake order database for the tool call demo ---

const ORDERS: Record<string, Record<string, unknown>> = {
  'ORD-100': { status: 'shipped', eta: 'Feb 15', tracking: '1Z999AA10123456784' },
  'ORD-200': { status: 'processing', eta: 'Feb 20', tracking: null },
  'ORD-300': { status: 'delivered', eta: null, tracking: '1Z999AA10123456799' },
};

function lookupOrder(orderId: string): Record<string, unknown> {
  return ORDERS[orderId] ?? { error: `Order ${orderId} not found` };
}

// --- Tool definitions ---

const LOOKUP_ORDER_TOOL = {
  name: 'lookup_order',
  description: 'Look up an order by its ID (e.g. ORD-100)',
  parameters: {
    type: 'object',
    properties: {
      order_id: { type: 'string', description: 'The order ID' },
    },
    required: ['order_id'],
  },
};

const TRANSFER_TOOL = {
  name: 'transfer_to_human',
  description: 'Transfer the call to a human agent',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Reason for transfer' },
    },
    required: ['reason'],
  },
};

const ESCALATE_TOOL = {
  name: 'escalate',
  description: 'Escalate to a more capable model for complex issues',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Why escalation is needed' },
    },
    required: ['reason'],
  },
};

const PLAY_HOLD_MUSIC_TOOL = {
  name: 'play_hold_music',
  description: 'Play hold music while the customer waits (cannot be interrupted)',
  parameters: {
    type: 'object',
    properties: {},
  },
};

const TOOLS = [LOOKUP_ORDER_TOOL, TRANSFER_TOOL, ESCALATE_TOOL, PLAY_HOLD_MUSIC_TOOL];

// --- Agent tools (server-side sub-agents) ---
const collectEmail = new CollectEmail();
const endCall = new EndCall('Thanks for calling Acme Corp. Goodbye!');

const SYSTEM_PROMPT =
  'You are a helpful customer support agent for Acme Corp. ' +
  'Be friendly, concise, and professional. When a customer ' +
  'asks about an order, use the lookup_order tool.\n\n' +
  `${collectEmail.promptHint}\n` +
  `${endCall.instructions}`;

// --- Agent setup ---

async function initAgent() {
  const agent = await client.agents.create({
    agentName: 'Acme Support Agent',
    stt: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
      api_key: DEEPGRAM_API_KEY,
    },
    llm: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      api_key: OPENAI_API_KEY,
      system_prompt: SYSTEM_PROMPT,
      tools: [...TOOLS, endCall.tool],
    },
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      model: 'eleven_flash_v2_5',
      api_key: ELEVENLABS_API_KEY,
      output_format: 'pcm_16000',
      stability: 0.5,
      similarity_boost: 0.75,
    },
    agentTools: [collectEmail.definition],
    semanticVad: 'high',
    welcomeGreeting: 'Hi there! Thanks for calling Acme Corp. How can I help you today?',
    websocketUrl: 'ws://localhost:9000/ws',
    speaksFirst: 'agent',
    idleTimeout: {
      no_response_timeout_ms: 15000,
      extended_wait_time_ms: 30000,
      max_retries: 3,
      hangup_message: "I haven't heard from you, so I'll end the call. Goodbye.",
    },
    interruptionEnabled: true,
    callbacks: {
      hangup: { url: `${CALLBACK_HOST}/callbacks/hangup`, method: 'POST' },
      recording: { url: `${CALLBACK_HOST}/callbacks/recording`, method: 'POST' },
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

app.on('agent_tool.completed', (session, event) => {
  const e = event as AgentToolCompletedEvent;
  const result = e.result;
  console.log(`  Agent tool completed: ${e.agentToolType} (${e.agentToolId})`);

  if (result.timed_out) {
    console.log('    Timed out -- agent will handle gracefully');
  } else if (result.declined) {
    console.log(`    User declined: ${result.decline_reason ?? ''}`);
  } else if (e.agentToolType === 'collect_email') {
    console.log(`    Email collected: ${result.email_address}`);
  }
});

app.on('agent_tool.failed', (session, event) => {
  const e = event as AgentToolFailedEvent;
  console.log(`  Agent tool failed: ${e.agentToolType} -- ${e.error}`);
});

app.onToolCall((session, event: ToolCallEvent) => {
  console.log(`  Tool call: ${event.name}(${JSON.stringify(event.arguments)})`);

  if (event.name === 'lookup_order') {
    const result = lookupOrder(event.arguments.order_id as string ?? '');
    session.sendToolResult(event.id, result);
  } else if (event.name === 'transfer_to_human') {
    session.speak('Let me transfer you to a specialist. One moment please.');
    session.transfer('+18005551234');
  } else if (event.name === 'play_hold_music') {
    // In production, read a WAV file and base64-encode it:
    //   import { readFileSync } from 'fs';
    //   const b64 = readFileSync('hold_music.wav').toString('base64');
    //   session.play(b64, false);
    session.speak('Playing hold music now.');
    session.sendToolResult(event.id, { status: 'playing_hold_music' });
    console.log('  Playing hold music (non-interruptible)');
  } else if (event.name === 'escalate') {
    const reason = (event.arguments.reason as string) ?? '';
    session.speak('Let me connect you with a specialist. One moment please.');
    session.handoff(
      'You are a senior support specialist at Acme Corp. ' +
        'You have access to refund and exchange tools. ' +
        'Be empathetic and resolve the issue.',
      [LOOKUP_ORDER_TOOL, TRANSFER_TOOL],
      { model: 'gpt-4o' },
      `Customer escalated: ${reason}. Review conversation history above.`,
    );
    session.sendToolResult(event.id, { status: 'escalated' });
    console.log(`  Agent handoff: escalated to specialist -- ${reason}`);
  } else if (endCall.match(event)) {
    endCall.handle(session, event);
    console.log('  Call ending');
  } else {
    session.sendToolError(event.id, `Unknown tool: ${event.name}`);
  }
});

app.on('voicemail.detected', (session, event) => {
  const e = event as VoicemailDetectedEvent;
  if (e.result === 'machine') {
    console.log(`  Machine detected -- waiting for beep: ${session.callUuid}`);
  } else {
    console.log(`  Human answered: ${session.callUuid}`);
  }
});

app.on('voicemail.beep', (session, event) => {
  const e = event as VoicemailBeepEvent;
  console.log(`  Beep detected: freq=${e.frequencyHz}Hz`);
  session.speak('Hi, this is Acme Corp returning your call. Please call us back.');
  session.hangup();
});

app.on('play.completed', (session, _event) => {
  console.log('  Play completed -- resuming conversation');
  session.speak('Thank you for waiting. I\'m back.');
});

app.on('agent.handoff', (session, event) => {
  const e = event as AgentHandoffEvent;
  console.log(`  Agent handoff: new agent = ${e.newAgent}`);
});

app.on('user.idle', (session, event) => {
  const e = event as UserIdleEvent;
  console.log(`  User idle: retry=${e.retryCount}, reason=${e.reason}`);
});

app.on('turn.metrics', (session, event) => {
  const e = event as TurnMetricsEvent;
  const parts = [
    `perceived=${e.userPerceivedMs}ms`,
    `stt=${e.sttDelayMs}ms`,
    `turn=${e.turnDecisionMs}ms`,
    `llm_ttft=${e.llmTtftMs}ms`,
    `tts_ttfb=${e.ttsTtfbMs}ms`,
    `method=${e.turnMethod}`,
  ];
  if (e.llmTokensPerSecond) parts.push(`tok/s=${e.llmTokensPerSecond}`);
  if (e.llmCacheHitRatio) parts.push(`cache=${e.llmCacheHitRatio}`);
  if (e.endpointingMinDelayMs != null) {
    parts.push(`ep_min=${e.endpointingMinDelayMs}ms`);
    parts.push(`ep_max=${e.endpointingMaxDelayMs}ms`);
  }
  if (e.llmCancelled) parts.push('llm_cancelled');
  if (e.ttsCancelled) parts.push('tts_cancelled');
  if (e.numInterruptions) parts.push(`interruptions=${e.numInterruptions}`);
  if (e.numBackchannels) parts.push(`backchannels=${e.numBackchannels}`);
  console.log(`  Metrics [turn ${e.turnNumber}]: ${parts.join(' ')}`);
});

app.onTurnCompleted((session, event: TurnCompletedEvent) => {
  const prefix = event.agentFirst ? '[agent-first] ' : '';
  console.log(`  ${prefix}User:  ${event.userText}`);
  console.log(`  ${prefix}Agent: ${event.agentText}`);
});

app.on('user.dtmf', (session, event) => {
  const e = event as DtmfEvent;
  console.log(`  DTMF: ${e.digit}`);
  if (e.digit === '0') {
    session.speak('Transferring you to an agent.');
    session.transfer('+18005551234');
  } else if (e.digit === '#') {
    session.speak('Goodbye.');
    session.hangup();
  }
});

app.on('dtmf.sent', (session, event) => {
  const e = event as DtmfSentEvent;
  console.log(`  DTMF sent: ${e.digits}`);
});

app.on('agent.speech_interrupted', (session, event) => {
  const e = event as InterruptionEvent;
  console.log(`  User interrupted: '${e.interruptedText ?? ''}'`);
});

// --- State & lifecycle events ---

app.on('user.state_changed', (session, event) => {
  const e = event as UserStateChangedEvent;
  console.log(`  User: ${e.oldState} -> ${e.newState}`);
});

app.on('agent.state_changed', (session, event) => {
  const e = event as AgentStateChangedEvent;
  console.log(`  Agent: ${e.oldState} -> ${e.newState}`);
});

app.on('agent.speech_created', (session, event) => {
  const e = event as AgentSpeechCreatedEvent;
  console.log(`  Speech created: source=${e.source} user_initiated=${e.userInitiated}`);
});

app.on('agent.speech_started', (_session, _event) => {
  console.log('  Agent speaking');
});

app.on('agent.speech_completed', (session, event) => {
  const e = event as AgentSpeechCompletedEvent;
  console.log(`  Agent finished speaking (${e.playbackPositionS?.toFixed(1)}s)`);
});

app.on('agent.false_interruption', (_session, _event) => {
  console.log('  False interruption -- agent resumed');
});

app.on('tool.executed', (session, event) => {
  const e = event as ToolExecutedEvent;
  if (e.calls) {
    for (const call of e.calls) {
      const c = call as Record<string, unknown>;
      const output = String(c.output ?? '');
      const isError = c.is_error as boolean;
      const status = isError ? 'ERROR' : 'ok';
      console.log(
        `  Tool executed: ${c.name}(${c.arguments ?? ''}) [${status}] ${output.slice(0, 100)}`,
      );
    }
  }
});

app.on('user.backchannel', (session, event) => {
  const e = event as UserBackchannelEvent;
  const label = e.isInterruption ? 'INTERRUPTION' : 'backchannel';
  console.log(
    `  Backchannel: ${label} (prob=${e.probability}, delay=${e.detectionDelayMs}ms)`,
  );
});

app.on('session.usage', (session, event) => {
  const e = event as SessionUsageEvent;
  if (!e.models) return;
  const parts: string[] = [];
  for (const m of e.models as Record<string, unknown>[]) {
    const t = m.type as string;
    const provider = m.provider ?? '?';
    const model = m.model ?? '?';
    if (t === 'llm_usage') {
      parts.push(
        `LLM(${provider}/${model}): ${m.input_tokens ?? 0}in/${m.output_tokens ?? 0}out cached=${m.input_cached_tokens ?? 0}`,
      );
    } else if (t === 'tts_usage') {
      parts.push(
        `TTS(${provider}/${model}): ${m.characters_count ?? 0} chars, ${Number(m.audio_duration ?? 0).toFixed(1)}s audio`,
      );
    } else if (t === 'stt_usage') {
      parts.push(`STT(${provider}/${model}): ${Number(m.audio_duration ?? 0).toFixed(1)}s audio`);
    } else if (t === 'interruption_usage') {
      parts.push(`Interruption(${provider}): ${m.total_requests ?? 0} reqs`);
    }
  }
  if (parts.length > 0) console.log(`  Usage: ${parts.join(' | ')}`);
});

app.on('llm.availability_changed', (session, event) => {
  const e = event as LlmAvailabilityChangedEvent;
  const status = e.available ? 'available' : 'UNAVAILABLE';
  console.log(`  LLM availability: ${e.llm} -> ${status}`);
});

app.onError((session, event: ErrorEventData) => {
  console.log(`  Error [${event.code}]: ${event.message}`);
});

app.onSessionEnded((session, event: AgentSessionEndedEvent) => {
  console.log(`Session ended: ${event.durationSeconds}s, ${event.turnCount} turns`);
});

app.onHandlerError((session, event, err) => {
  console.log(`  Handler error: ${err}`);
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
