/**
 * Audio Stream Example -- Full DIY Pipeline (Plivo Audio Streaming Protocol)
 *
 * Config: no stt/llm/tts (raw audio relay, you handle everything)
 *
 * Plivo is just the telephony bridge. You get raw audio frames and handle
 * everything yourself: STT, LLM, TTS, VAD, turn detection.
 *
 * Features demonstrated:
 *   - VoiceApp server pattern (Plivo connects to you)
 *   - Full Plivo Audio Streaming protocol compatibility
 *   - Sync handlers with per-session state (session.data)
 *   - Audio echo bot (buffers audio, plays it back)
 *   - Checkpoint events for playback tracking
 *   - clearAudio for interruption
 *
 * Protocol (Plivo Audio Streaming):
 *   Inbound: start, media, dtmf, playedStream, clearedAudio, stop
 *   Outbound: playAudio, checkpoint, clearAudio
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN env vars
 *   3. npx tsx examples/audio-stream.ts
 */

import { createServer } from 'node:http';
import { PlivoAgentClient, VoiceApp } from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  StreamStartEvent,
  StreamMediaEvent,
  StreamDtmfEvent,
  PlayedStreamEvent,
  ClearedAudioEvent,
  StreamStopEvent,
  ErrorEventData,
} from '../src/index.js';

const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID ?? '';
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN ?? '';
const CALLBACK_HOST = process.env.CALLBACK_HOST ?? 'http://localhost:9001';
const PLIVO_NUMBER = process.env.PLIVO_NUMBER ?? '';

const client = new PlivoAgentClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

async function initAgent() {
  const agent = await client.agents.create({
    agentName: 'Audio Echo Bot',
    audioFormat: 'mulaw_8k',
    websocketUrl: 'ws://localhost:9000/ws',
    stream: {
      extra_headers: { userId: '12345', tenant: 'acme' },
    },
    callbacks: {
      hangup: { url: `${CALLBACK_HOST}/callbacks/hangup`, method: 'POST' },
      recording: { url: `${CALLBACK_HOST}/callbacks/recording`, method: 'POST' },
      ring: { url: `${CALLBACK_HOST}/callbacks/ring`, method: 'POST' },
    },
  });

  const agentUuid = agent.agentUuid;
  console.log(`Agent created: ${agentUuid}`);

  if (PLIVO_NUMBER) {
    await client.numbers.assign(agentUuid, PLIVO_NUMBER);
    console.log(`Number ${PLIVO_NUMBER} assigned to agent`);
  }
}

// --- Event handlers ---

const app = new VoiceApp();

app.onSetup((session, event: AgentSessionStartedEvent) => {
  console.log(`Session started: ${event.agentSessionId}`);
});

app.on('start', (session, event) => {
  const e = event as StreamStartEvent;
  session.data.echoBuffer = [] as string[];
  session.data.echoPlaying = false;
  session.data.encoding = e.contentType || 'audio/x-mulaw';
  session.data.sampleRate = e.sampleRate || 8000;

  console.log(
    `Stream started: streamId=${session.streamId} ` +
      `callId=${e.callId} ` +
      `format=${session.data.encoding} ` +
      `rate=${session.data.sampleRate}`,
  );
});

app.on('media', (session, event) => {
  const e = event as StreamMediaEvent;
  const buffer = session.data.echoBuffer as string[];
  buffer.push(e.payload);

  // After collecting enough chunks (~2 seconds), play them back
  if (buffer.length >= 100 && !session.data.echoPlaying) {
    session.data.echoPlaying = true;
    console.log(`  Playing echo: ${buffer.length} chunks`);

    for (const chunkB64 of buffer) {
      session.sendMedia(
        chunkB64,
        (session.data.encoding as string) ?? 'audio/x-mulaw',
        (session.data.sampleRate as number) ?? 8000,
      );
    }

    session.sendCheckpoint('echo-complete');
    buffer.length = 0;
    session.data.echoPlaying = false;
  }
});

app.on('dtmf', (session, event) => {
  const e = event as StreamDtmfEvent;
  console.log(`  DTMF: ${e.digit}`);

  if (e.digit === '*') {
    console.log('  Clearing audio queue...');
    session.clearAudio();
  } else if (e.digit === '#') {
    session.hangup();
  }
});

app.on('playedStream', (session, event) => {
  const e = event as PlayedStreamEvent;
  console.log(`  Checkpoint reached: ${e.name}`);
});

app.on('clearedAudio', (_session, _event) => {
  console.log('  Audio cleared');
});

app.onError((session, event: ErrorEventData) => {
  console.log(`  Error [${event.code}]: ${event.message}`);
});

app.on('stop', (_session, _event) => {
  console.log('Stream stopped');
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
