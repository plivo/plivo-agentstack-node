/**
 * Minimal BYOLLM echo test -- no external LLM needed.
 *
 * Receives transcription prompts from Plivo, echoes them back as text tokens.
 * This lets you trace the full STT -> customer WS -> TTS flow with fake API keys.
 *
 * Usage:
 *   1. npm install
 *   2. npx tsx examples/byollm-echo.ts
 */

import { createServer } from 'node:http';
import { VoiceApp } from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  PromptEvent,
  InterruptionEvent,
  ErrorEventData,
} from '../src/index.js';

const app = new VoiceApp();

app.onSetup((session, event: AgentSessionStartedEvent) => {
  console.log(`[STARTED] session=${event.agentSessionId} call=${event.callId}`);
});

app.on('user.transcription', (session, event) => {
  const e = event as PromptEvent;
  console.log(`[PROMPT] text='${e.text}' is_final=${e.isFinal}`);

  if (e.isFinal && e.text.trim()) {
    const reply = `You said: ${e.text}`;
    session.sendText(reply, true);
    console.log(`[REPLY] ${reply}`);
  }
});

app.on('agent.speech_interrupted', (session, event) => {
  const e = event as InterruptionEvent;
  console.log(`[INTERRUPTION] text='${e.interruptedText ?? ''}'`);
});

app.onError((session, event: ErrorEventData) => {
  console.log(`[ERROR] code=${event.code} message=${event.message}`);
});

app.onSessionEnded((session, event: AgentSessionEndedEvent) => {
  console.log(`[ENDED] duration=${event.durationSeconds}s`);
});

// --- Start server ---

console.log('Starting BYOLLM echo server on ws://0.0.0.0:9000');
const server = createServer();
server.on('upgrade', (req, socket, head) => {
  app.handleUpgrade(req, socket, head);
});
server.listen(9000, () => {
  console.log('VoiceApp listening on ws://0.0.0.0:9000');
});
