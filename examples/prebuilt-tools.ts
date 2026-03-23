/**
 * Prebuilt Tools Example -- Agent Tools + Simple Tools
 *
 * Config: stt + llm + tts (full pipeline)
 *
 * Demonstrates all prebuilt tools that ship with the SDK:
 *
 * Agent tools (server-side sub-agents for multi-turn collection):
 *   - CollectEmail     -- Voice-optimized email collection
 *   - CollectAddress   -- Voice-optimized mailing address collection
 *   - CollectPhone     -- E.164 phone number collection
 *   - CollectName      -- First/last name collection
 *   - CollectDOB       -- Date of birth collection
 *   - CollectDigits    -- DTMF or spoken digit collection (PINs, account numbers)
 *   - CollectCreditCard -- Secure credit card detail collection
 *
 * Simple tools (single-shot, customer-side):
 *   - EndCall         -- LLM-driven graceful call ending
 *   - SendDtmfTool    -- LLM sends DTMF tones (IVR navigation)
 *   - WarmTransfer    -- Transfer to human with hold message
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, DEEPGRAM_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY
 *   3. npx tsx examples/prebuilt-tools.ts
 */

import { createServer } from 'node:http';
import {
  PlivoAgentClient,
  VoiceApp,
  CollectEmail,
  CollectAddress,
  CollectPhone,
  CollectName,
  CollectDOB,
  CollectDigits,
  CollectCreditCard,
  EndCall,
  SendDtmfTool,
  WarmTransfer,
} from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  AgentToolStartedEvent,
  AgentToolCompletedEvent,
  AgentToolFailedEvent,
  ToolCallEvent,
  TurnCompletedEvent,
} from '../src/index.js';

const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID ?? '';
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN ?? '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';

const client = new PlivoAgentClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

// --- Initialize tools ---

// Agent tools: server handles multi-turn collection automatically.
const collectEmail = new CollectEmail();
const collectAddress = new CollectAddress();
const collectPhone = new CollectPhone();
const collectName = new CollectName({ firstName: true, lastName: true });
const collectDob = new CollectDOB();
const collectPin = new CollectDigits({ numDigits: 4, label: 'PIN' });
const collectCard = new CollectCreditCard();

// Simple tools: customer handles tool calls directly.
const endCall = new EndCall('Thanks for calling Acme Corp. Have a great day!');
const sendDtmf = new SendDtmfTool();
const transfer = new WarmTransfer({
  destination: '+18005551234',
  holdMessage: 'Connecting you now. One moment.',
});

// --- Build system prompt with agent tool hints ---

const SYSTEM_PROMPT =
  'You are a customer service agent for Acme Corp. ' +
  'You help customers with orders, account updates, and general inquiries.\n\n' +
  `${collectEmail.promptHint}\n` +
  `${collectAddress.promptHint}\n` +
  `${collectPhone.promptHint}\n` +
  `${collectName.promptHint}\n` +
  `${collectDob.promptHint}\n` +
  `${collectPin.promptHint}\n` +
  `${collectCard.promptHint}\n\n` +
  `${transfer.instructions}\n\n` +
  `${endCall.instructions}`;

async function initAgent() {
  const agent = await client.agents.create({
    agentName: 'Prebuilt Tools Demo',
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
      tools: [endCall.tool, sendDtmf.tool, transfer.tool],
    },
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      model: 'eleven_flash_v2_5',
      api_key: ELEVENLABS_API_KEY,
    },
    agentTools: [
      collectEmail.definition,
      collectAddress.definition,
      collectPhone.definition,
      collectName.definition,
      collectDob.definition,
      collectPin.definition,
      collectCard.definition,
    ],
    welcomeGreeting: 'Hi! Welcome to Acme Corp. How can I help you today?',
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

app.on('agent_tool.started', (session, event) => {
  const e = event as AgentToolStartedEvent;
  console.log(`  Agent tool started: ${e.agentToolType} (${e.agentToolId})`);
});

app.on('agent_tool.completed', (session, event) => {
  const e = event as AgentToolCompletedEvent;
  const toolType = e.agentToolType;
  const result = e.result;
  console.log(`  Agent tool completed: ${toolType} (${e.agentToolId})`);

  if (result.timed_out) {
    console.log('    Timed out');
    return;
  }
  if (result.declined) {
    console.log(`    Declined: ${result.decline_reason ?? ''}`);
    return;
  }

  if (toolType === 'collect_email') {
    console.log(`    Email: ${result.email_address}`);
  } else if (toolType === 'collect_address') {
    console.log(`    Address: ${result.street_address}, ${result.locality}`);
  } else if (toolType === 'collect_phone') {
    console.log(`    Phone: ${result.phone_number}`);
  } else if (toolType === 'collect_name') {
    console.log(`    Name: ${result.first_name} ${result.last_name}`);
  } else if (toolType === 'collect_dob') {
    console.log(`    DOB: ${result.date_of_birth}`);
  } else if (toolType === 'collect_digits') {
    console.log(`    Digits: ${result.digits}`);
  } else if (toolType === 'collect_credit_card') {
    const cardNum = String(result.card_number ?? '');
    console.log(
      `    Card: ${result.issuer} ****${cardNum.slice(-4)}, exp ${result.expiration_date}`,
    );
  }
});

app.on('agent_tool.failed', (session, event) => {
  const e = event as AgentToolFailedEvent;
  console.log(`  Agent tool failed: ${e.agentToolType} -- ${e.error}`);
});

app.onToolCall((session, event: ToolCallEvent) => {
  if (endCall.match(event)) {
    const reason = endCall.handle(session, event);
    console.log(`  Call ending: ${reason}`);
  } else if (sendDtmf.match(event)) {
    const digits = sendDtmf.handle(session, event);
    console.log(`  DTMF sent: ${digits}`);
  } else if (transfer.match(event)) {
    const reason = transfer.handle(session, event);
    console.log(`  Transferring: ${reason}`);
  } else {
    session.sendToolError(event.id, `Unknown tool: ${event.name}`);
    console.log(`  Unknown tool: ${event.name}`);
  }
});

app.onTurnCompleted((session, event: TurnCompletedEvent) => {
  console.log(`  User:  ${event.userText}`);
  console.log(`  Agent: ${event.agentText}`);
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
