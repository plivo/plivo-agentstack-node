/**
 * Metrics & Observability Example -- Comprehensive Latency Monitoring
 *
 * Config: stt + llm + tts (full pipeline)
 *
 * Demonstrates all diagnostic events and metrics fields available for monitoring
 * pipeline performance. Covers every field from all 7 pipeline metrics classes.
 *
 * Events shown:
 *   - turn.metrics         -- per-turn latency chain + full provider stats
 *   - turn.completed       -- transcript snapshot per turn
 *   - user.turn_completed  -- turn detection trigger + method
 *   - user.speech_started / user.speech_stopped -- VAD with inference stats
 *   - user.idle            -- user silence detection
 *   - user.backchannel     -- adaptive interruption classification
 *   - session.usage        -- cumulative per-model usage breakdown
 *   - agent.speech_interrupted -- barge-in events
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN env vars
 *   3. npx tsx examples/metrics.ts
 */

import { createServer } from 'node:http';
import { PlivoAgentClient, VoiceApp } from '../src/index.js';
import type {
  AgentSessionStartedEvent,
  AgentSessionEndedEvent,
  TurnCompletedEvent,
  TurnMetricsEvent,
  TurnDetectedEvent,
  VadSpeechStartedEvent,
  VadSpeechStoppedEvent,
  UserIdleEvent,
  UserBackchannelEvent,
  SessionUsageEvent,
  DtmfEvent,
  DtmfSentEvent,
  InterruptionEvent,
  UserStateChangedEvent,
  AgentStateChangedEvent,
  AgentSpeechCreatedEvent,
  AgentSpeechStartedEvent,
  AgentSpeechCompletedEvent,
  ToolExecutedEvent,
  LlmAvailabilityChangedEvent,
  ErrorEventData,
} from '../src/index.js';

const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID ?? '';
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN ?? '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';

const client = new PlivoAgentClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

async function initAgent() {
  const agent = await client.agents.create({
    agentName: 'Metrics Observer',
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
      system_prompt: 'You are a helpful assistant. Keep responses brief.',
      tools: [],
    },
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      model: 'eleven_flash_v2_5',
      api_key: ELEVENLABS_API_KEY,
    },
    welcomeGreeting: "Hi! Say something and I'll show you the latency breakdown.",
    websocketUrl: 'ws://localhost:9000/ws',
  });

  console.log(`Agent created: ${agent.agentUuid}`);
  return agent;
}

// --- Event handlers ---

const app = new VoiceApp();

app.onSetup((session, event: AgentSessionStartedEvent) => {
  console.log(`Session started: ${event.agentSessionId}`);
  console.log('Enabling all diagnostic events...');
  session.update({
    events: { metrics_events: true, vad_events: true, turn_events: true },
  });
});

app.on('turn.metrics', (session, event) => {
  const e = event as TurnMetricsEvent;
  const perceived = e.userPerceivedMs ?? 0;
  const stt = e.sttDelayMs ?? 0;
  const turn = e.turnDecisionMs ?? 0;
  const llm = e.llmTtftMs ?? 0;
  const tts = e.ttsTtfbMs ?? 0;

  const sep = '='.repeat(60);
  console.log(`\n${sep}`);
  console.log(`  TURN ${e.turnNumber} METRICS ${e.interrupted ? '(interrupted)' : ''}`);
  if (e.agentFirst) console.log('  [agent-first turn]');
  if (e.pipeline) console.log(`  Pipeline: ${e.pipeline}`);
  console.log(sep);

  // SDK-measured latency
  console.log(`  User perceived latency:  ${perceived}ms`);
  if (e.sdkLlmTtftMs != null) console.log(`  SDK LLM TTFT:            ${e.sdkLlmTtftMs}ms`);
  if (e.sdkTtsTtfbMs != null) console.log(`  SDK TTS TTFB:            ${e.sdkTtsTtfbMs}ms`);
  if (e.sdkTranscriptionDelayMs != null)
    console.log(`  SDK transcription delay: ${e.sdkTranscriptionDelayMs}ms`);
  if (e.sdkEndOfTurnDelayMs != null)
    console.log(`  SDK end-of-turn delay:   ${e.sdkEndOfTurnDelayMs}ms`);

  // Server latency chain
  console.log('\n  Server latency chain:');
  console.log(`  +- STT delay:            ${stt}ms`);
  console.log(`  +- Turn decision:        ${turn}ms`);
  console.log(`  +- LLM TTFT:             ${llm}ms`);
  console.log(`  +- TTS pipeline:         ${tts}ms`);

  if (perceived > 0) {
    console.log('\n  Budget breakdown:');
    console.log(`    STT:  ${((stt / perceived) * 100).toFixed(1)}%`);
    console.log(`    Turn: ${((turn / perceived) * 100).toFixed(1)}%`);
    console.log(`    LLM:  ${((llm / perceived) * 100).toFixed(1)}%`);
    console.log(`    TTS:  ${((tts / perceived) * 100).toFixed(1)}%`);
  }

  // Turn detection
  console.log(`\n  Turn method:     ${e.turnMethod ?? 'n/a'}`);
  if (e.turnProbability != null) console.log(`  Turn confidence: ${e.turnProbability.toFixed(2)}`);
  if (e.turnUnlikelyThreshold != null)
    console.log(`  Unlikely thresh: ${e.turnUnlikelyThreshold.toFixed(2)}`);
  if (e.eouSpeechId) console.log(`  Turn speech ID:  ${e.eouSpeechId}`);

  // Dynamic endpointing
  if (e.endpointingMinDelayMs != null) {
    console.log('\n  Endpointing EMA:');
    console.log(`    Min delay:     ${e.endpointingMinDelayMs}ms`);
    console.log(`    Max delay:     ${e.endpointingMaxDelayMs}ms`);
  }

  // VAD
  if (e.vadInferenceCount != null) {
    console.log('\n  VAD stats:');
    console.log(`    Idle time:     ${e.vadIdleTimeS}s`);
    console.log(`    Inferences:    ${e.vadInferenceCount}`);
    console.log(`    Total duration:${e.vadInferenceDurationTotalMs}ms`);
    if (e.vadLabel) console.log(`    Label:         ${e.vadLabel}`);
  }

  // LLM
  if (e.llmModel) {
    console.log(`\n  LLM (${e.llmProvider}/${e.llmModel}):`);
    console.log(
      `    Tokens:        ${e.llmPromptTokens ?? 0}p / ${e.llmCompletionTokens ?? 0}c (${e.llmTotalTokens ?? 0} total)`,
    );
    if (e.llmTokensPerSecond)
      console.log(`    Throughput:    ${e.llmTokensPerSecond.toFixed(1)} tok/s`);
    if (e.llmCacheReadTokens) console.log(`    Cache read:    ${e.llmCacheReadTokens}`);
    if (e.llmCacheHitRatio) console.log(`    Cache ratio:   ${e.llmCacheHitRatio.toFixed(2)}`);
    if (e.llmDurationMs) console.log(`    Duration:      ${e.llmDurationMs}ms`);
    if (e.llmCancelled) console.log('    [CANCELLED]');
    if (e.llmLabel) console.log(`    Label:         ${e.llmLabel}`);
    if (e.llmRequestId) console.log(`    Request ID:    ${e.llmRequestId}`);
  }

  // STT
  if (e.sttProvider) {
    console.log(`\n  STT (${e.sttProvider}/${e.sttModel ?? '?'}):`);
    if (e.sttDurationMs) console.log(`    Duration:      ${e.sttDurationMs}ms`);
    if (e.sttAudioDurationMs) console.log(`    Audio:         ${e.sttAudioDurationMs}ms`);
    if (e.sttConfidence != null) console.log(`    Confidence:    ${e.sttConfidence.toFixed(2)}`);
    if (e.sttStreamed != null) console.log(`    Streamed:      ${e.sttStreamed}`);
  }

  // TTS
  if (e.ttsProvider) {
    console.log(`\n  TTS (${e.ttsProvider}/${e.ttsModel ?? '?'}):`);
    if (e.ttsTtfbMs) console.log(`    TTFB:          ${e.ttsTtfbMs}ms`);
    if (e.ttsDurationMs) console.log(`    Duration:      ${e.ttsDurationMs}ms`);
    if (e.ttsCharacters) console.log(`    Characters:    ${e.ttsCharacters}`);
    if (e.ttsAudioDurationMs) console.log(`    Audio:         ${e.ttsAudioDurationMs}ms`);
    if (e.ttsCancelled) console.log('    [CANCELLED]');
  }

  // Interruption
  if (e.numInterruptions || e.interruptionTotalDurationMs) {
    console.log('\n  Interruption stats:');
    if (e.interruptionTotalDurationMs)
      console.log(`    Total:         ${e.interruptionTotalDurationMs}ms`);
    if (e.interruptionPredictionMs)
      console.log(`    Prediction:    ${e.interruptionPredictionMs}ms`);
    if (e.interruptionDetectionDelayMs)
      console.log(`    Detection:     ${e.interruptionDetectionDelayMs}ms`);
    if (e.numInterruptions) console.log(`    Count:         ${e.numInterruptions}`);
    if (e.numBackchannels) console.log(`    Backchannels:  ${e.numBackchannels}`);
  }

  // Realtime (S2S)
  if (e.realtimeModel) {
    console.log(`\n  Realtime (${e.realtimeProvider}/${e.realtimeModel}):`);
    console.log(`    TTFT:          ${e.realtimeTtftMs}ms`);
    if (e.realtimeDurationMs) console.log(`    Duration:      ${e.realtimeDurationMs}ms`);
    if (e.realtimeSessionDurationMs)
      console.log(`    Session:       ${e.realtimeSessionDurationMs}ms`);
    if (e.realtimeCancelled) console.log('    [CANCELLED]');
    console.log(
      `    Tokens:        ${e.realtimeInputTokens ?? 0}in / ${e.realtimeOutputTokens ?? 0}out (${e.realtimeTotalTokens ?? 0} total)`,
    );
    if (e.realtimeTokensPerSecond)
      console.log(`    Throughput:    ${e.realtimeTokensPerSecond.toFixed(1)} tok/s`);
    if (e.realtimeCacheHitRatio)
      console.log(`    Cache ratio:   ${e.realtimeCacheHitRatio.toFixed(2)}`);
  }

  // Wall-clock timestamps
  if (e.userStartedSpeakingAt) {
    console.log('\n  Timestamps:');
    console.log(`    User started:  ${e.userStartedSpeakingAt}`);
    console.log(`    User stopped:  ${e.userStoppedSpeakingAt}`);
    console.log(`    Agent started: ${e.agentStartedSpeakingAt}`);
    console.log(`    Agent stopped: ${e.agentStoppedSpeakingAt}`);
  }

  if (e.speakingRate) console.log(`\n  Speaking rate:   ${e.speakingRate.toFixed(1)} words/s`);
  if (e.errorSource) console.log(`  Error source:    ${e.errorSource}`);
  console.log(`${sep}\n`);
});

app.onTurnCompleted((session, event: TurnCompletedEvent) => {
  const prefix = event.agentFirst ? '[agent-first] ' : '';
  console.log(`  ${prefix}Turn ${event.turnNumber}:`);
  console.log(`    User:  ${event.userText}`);
  console.log(`    Agent: ${event.agentText}`);
  const latencies: string[] = [];
  if (event.transcriptionDelayS != null) latencies.push(`stt=${event.transcriptionDelayS.toFixed(3)}s`);
  if (event.turnDecisionS != null) latencies.push(`turn=${event.turnDecisionS.toFixed(3)}s`);
  if (event.llmTtftS != null) latencies.push(`llm=${event.llmTtftS.toFixed(3)}s`);
  if (event.ttsTtfbS != null) latencies.push(`tts=${event.ttsTtfbS.toFixed(3)}s`);
  if (event.realtimeTtftS != null) latencies.push(`realtime=${event.realtimeTtftS.toFixed(3)}s`);
  if (latencies.length > 0) console.log(`    Latency: ${latencies.join(' ')}`);
});

app.on('user.turn_completed', (session, event) => {
  const e = event as TurnDetectedEvent;
  console.log(`  Turn detected: trigger=${e.trigger} duration=${e.durationMs}ms`);
});

app.on('user.speech_started', (session, event) => {
  const e = event as VadSpeechStartedEvent;
  const parts = [`at ${e.timestampMs}ms`];
  if (e.vadIdleTimeS != null) parts.push(`idle=${e.vadIdleTimeS.toFixed(1)}s`);
  if (e.vadInferenceCount != null) parts.push(`inferences=${e.vadInferenceCount}`);
  if (e.vadInferenceDurationTotalMs != null)
    parts.push(`duration=${e.vadInferenceDurationTotalMs}ms`);
  console.log(`  VAD started: ${parts.join(' ')}`);
});

app.on('user.speech_stopped', (session, event) => {
  const e = event as VadSpeechStoppedEvent;
  const parts = [`at ${e.timestampMs}ms`, `spoke=${e.durationMs}ms`];
  if (e.vadInferenceCount != null) parts.push(`inferences=${e.vadInferenceCount}`);
  if (e.vadInferenceDurationTotalMs != null)
    parts.push(`duration=${e.vadInferenceDurationTotalMs}ms`);
  console.log(`  VAD stopped: ${parts.join(' ')}`);
});

app.on('user.idle', (session, event) => {
  const e = event as UserIdleEvent;
  console.log(`  User idle: retry=${e.retryCount}, reason=${e.reason}`);
});

app.on('user.backchannel', (session, event) => {
  const e = event as UserBackchannelEvent;
  const label = e.isInterruption ? 'INTERRUPTION' : 'backchannel';
  const parts = [label];
  if (e.probability != null) parts.push(`prob=${e.probability.toFixed(2)}`);
  if (e.detectionDelayMs != null) parts.push(`delay=${e.detectionDelayMs.toFixed(0)}ms`);
  if (e.totalDurationMs != null) parts.push(`duration=${e.totalDurationMs.toFixed(0)}ms`);
  if (e.numRequests != null) parts.push(`requests=${e.numRequests}`);
  console.log(`  Backchannel: ${parts.join(' ')}`);
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
        `TTS(${provider}/${model}): ${m.characters_count ?? 0} chars, ${Number(m.audio_duration ?? 0).toFixed(1)}s`,
      );
    } else if (t === 'stt_usage') {
      parts.push(`STT(${provider}/${model}): ${Number(m.audio_duration ?? 0).toFixed(1)}s`);
    } else if (t === 'interruption_usage') {
      parts.push(`Interruption(${provider}): ${m.total_requests ?? 0} reqs`);
    }
  }
  if (parts.length > 0) console.log(`  Usage: ${parts.join(' | ')}`);
});

app.on('user.dtmf', (session, event) => {
  const e = event as DtmfEvent;
  console.log(`  DTMF received: digit=${e.digit}`);
});

app.on('dtmf.sent', (session, event) => {
  const e = event as DtmfSentEvent;
  console.log(`  DTMF sent: digits=${e.digits}`);
});

app.on('agent.speech_interrupted', (session, event) => {
  const e = event as InterruptionEvent;
  console.log(`  Interruption: '${e.interruptedText ?? ''}'`);
});

app.on('user.state_changed', (session, event) => {
  const e = event as UserStateChangedEvent;
  console.log(`  User state: ${e.oldState} -> ${e.newState}`);
});

app.on('agent.state_changed', (session, event) => {
  const e = event as AgentStateChangedEvent;
  console.log(`  Agent state: ${e.oldState} -> ${e.newState}`);
});

app.on('agent.speech_created', (session, event) => {
  const e = event as AgentSpeechCreatedEvent;
  console.log(`  Speech created: source=${e.source}`);
});

app.on('agent.speech_started', (_session, _event) => {
  console.log('  Agent speaking started');
});

app.on('agent.speech_completed', (session, event) => {
  const e = event as AgentSpeechCompletedEvent;
  console.log(`  Agent speaking completed (${e.playbackPositionS}s)`);
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

app.on('llm.availability_changed', (session, event) => {
  const e = event as LlmAvailabilityChangedEvent;
  const status = e.available ? 'available' : 'UNAVAILABLE';
  console.log(`  LLM availability: ${e.llm} -> ${status}`);
});

app.onError((session, event: ErrorEventData) => {
  console.log(`  Error [${event.code}]: ${event.message}`);
});

app.onSessionEnded((session, event: AgentSessionEndedEvent) => {
  console.log(`\nSession ended: ${event.durationSeconds}s, ${event.turnCount} turns`);
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
