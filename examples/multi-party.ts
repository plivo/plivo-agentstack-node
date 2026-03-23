/**
 * Multi-Party Example -- Conference Calls with AI Agent
 *
 * Config: stt + llm + tts, participantMode="multi"
 *
 * Uses Plivo Multi-Party Conferences (MPC) to support 3+ participants.
 * The AI agent joins as a conference participant alongside human callers.
 *
 * Features demonstrated:
 *   - Multi-party agent creation (requires Plivo credentials)
 *   - Adding participants mid-call via dial()
 *   - Warm transfer pattern (add human agent, AI drops)
 *   - Participant lifecycle events
 *   - DTMF send via LLM tool call
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN env vars
 *   3. npx tsx examples/multi-party.ts
 */

import { createServer } from 'node:http';
import { PlivoAgentClient, VoiceApp } from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  ToolCallEvent,
  TurnCompletedEvent,
  DtmfEvent,
  DtmfSentEvent,
  InterruptionEvent,
  ParticipantAddedEvent,
  ParticipantRemovedEvent,
  ErrorEventData,
} from '../src/index.js';

const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID ?? '';
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN ?? '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';

const client = new PlivoAgentClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

// --- Tool definitions ---

const SEND_DTMF_TOOL = {
  name: 'send_dtmf',
  description: 'Send DTMF digits on the call (e.g. to navigate an IVR menu)',
  parameters: {
    type: 'object',
    properties: {
      digits: { type: 'string', description: 'DTMF digits to send (0-9, *, #)' },
    },
    required: ['digits'],
  },
};

const TRANSFER_TO_HUMAN_TOOL = {
  name: 'transfer_to_human',
  description: 'Add a human agent to the conference for a warm transfer',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Reason for transfer' },
    },
    required: ['reason'],
  },
};

const ADD_PARTICIPANT_TOOL = {
  name: 'add_participant',
  description: 'Add another person to the conference call',
  parameters: {
    type: 'object',
    properties: {
      number: { type: 'string', description: 'Phone number to dial' },
    },
    required: ['number'],
  },
};

const SYSTEM_PROMPT =
  'You are a conference call moderator for Acme Corp. ' +
  'You can add participants to the call and transfer to human agents. ' +
  'Be concise -- this is a phone call.';

// --- Agent setup ---

async function initAgent() {
  const agent = await client.agents.create({
    agentName: 'Acme Conference Agent',
    participantMode: 'multi',
    plivoAuthId: PLIVO_AUTH_ID,
    plivoAuthToken: PLIVO_AUTH_TOKEN,
    plivoNumber: '+14155551234',
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
      system_prompt: SYSTEM_PROMPT,
      tools: [TRANSFER_TO_HUMAN_TOOL, ADD_PARTICIPANT_TOOL, SEND_DTMF_TOOL],
    },
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      model: 'eleven_flash_v2_5',
      api_key: ELEVENLABS_API_KEY,
    },
    welcomeGreeting: 'Welcome to the Acme conference line. How can I help?',
    websocketUrl: 'ws://localhost:9000/ws',
    interruptionEnabled: true,
  });

  console.log(`Agent created: ${agent.agentUuid}`);
  return agent;
}

// --- Event handlers ---

const app = new VoiceApp();

app.onSetup((session, event: AgentSessionStartedEvent) => {
  console.log(`Session started: ${event.agentSessionId}`);
});

app.onToolCall(async (session, event: ToolCallEvent) => {
  console.log(`  Tool call: ${event.name}(${JSON.stringify(event.arguments)})`);

  if (event.name === 'add_participant') {
    const number = (event.arguments.number as string) ?? '';
    await client.calls.dial(session.callUuid, {
      targets: [{ number }],
    });
    session.sendToolResult(event.id, { status: 'dialing', number });
    console.log(`  Dialing ${number} into conference`);
  } else if (event.name === 'transfer_to_human') {
    session.speak('Let me connect you with a human agent. One moment.');
    await client.calls.dial(session.callUuid, {
      targets: [{ number: '+18005551234' }],
    });
    session.sendToolResult(event.id, { status: 'transferring' });
    console.log('  Warm transfer: dialing human agent into conference');
  } else if (event.name === 'send_dtmf') {
    const digits = (event.arguments.digits as string) ?? '';
    session.sendDtmf(digits);
    session.sendToolResult(event.id, { status: 'sent', digits });
    console.log(`  Sending DTMF: ${digits}`);
  } else {
    session.sendToolError(event.id, `Unknown tool: ${event.name}`);
  }
});

app.on('participant.added', (session, event) => {
  const e = event as ParticipantAddedEvent;
  console.log(
    `  Participant joined: member=${e.memberId} role=${e.role} target=${e.target}`,
  );

  if (e.role === 'agent') {
    session.speak("I've connected you with a specialist. I'll leave you to it. Goodbye!");
    session.hangup();
  }
});

app.on('participant.removed', (session, event) => {
  const e = event as ParticipantRemovedEvent;
  console.log(`  Participant left: member=${e.memberId} role=${e.role}`);
});

app.onTurnCompleted((session, event: TurnCompletedEvent) => {
  console.log(`  User:  ${event.userText}`);
  console.log(`  Agent: ${event.agentText}`);
});

app.on('user.dtmf', (session, event) => {
  const e = event as DtmfEvent;
  console.log(`  DTMF: ${e.digit}`);
});

app.on('dtmf.sent', (session, event) => {
  const e = event as DtmfSentEvent;
  console.log(`  DTMF sent: ${e.digits}`);
});

app.on('agent.speech_interrupted', (session, event) => {
  const e = event as InterruptionEvent;
  console.log(`  User interrupted: '${e.interruptedText ?? ''}'`);
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
