/** Typed event models for Agent Stack WebSocket events. */

export interface BaseEvent {
  type: string;
}

export interface AgentSessionStartedEvent extends BaseEvent {
  type: 'session.started';
  agentSessionId: string;
  callId: string;
  caller?: string;
  callee?: string;
  agentId?: string;
  audioFormat?: string;
  sampleRate?: number;
  channels?: number;
  frameSizeMs?: number;
  plcEnabled?: boolean;
}

export interface ToolCallEvent extends BaseEvent {
  type: 'tool.called';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface TurnCompletedEvent extends BaseEvent {
  type: 'turn.completed';
  turnNumber?: number;
  userText: string;
  agentText: string;
  turnId: string;
  agentFirst?: boolean;
  agentToolId?: string;
  turnDecisionS?: number;
  transcriptionDelayS?: number;
  llmTtftS?: number;
  ttsTtfbS?: number;
  realtimeTtftS?: number;
  userStartedSpeakingAt?: string;
  userStoppedSpeakingAt?: string;
  agentStartedSpeakingAt?: string;
}

export interface PromptEvent extends BaseEvent {
  type: 'user.transcription';
  text: string;
  isFinal: boolean;
  language?: string;
  speakerId?: string;
}

export interface DtmfEvent extends BaseEvent {
  type: 'user.dtmf';
  digit: string;
}

export interface DtmfSentEvent extends BaseEvent {
  type: 'dtmf.sent';
  digits: string;
}

export interface AgentHandoffEvent extends BaseEvent {
  type: 'agent.handoff';
  newAgent?: string;
}

export interface InterruptionEvent extends BaseEvent {
  type: 'agent.speech_interrupted';
  interruptedText?: string;
  turnId?: string;
  playbackPositionS?: number;
  timestamp?: string;
}

export interface AgentSessionEndedEvent extends BaseEvent {
  type: 'session.ended';
  durationSeconds: number;
  turnCount?: number;
  reason?: string;
  startedAt?: string;
  endedAt?: string;
  error?: string;
  transcript?: unknown;
  sttDuration?: number;
  llmDuration?: number;
  ttsDuration?: number;
}

export interface ErrorEventData extends BaseEvent {
  type: 'session.error';
  code: string;
  message: string;
}

export interface VadSpeechStartedEvent extends BaseEvent {
  type: 'user.speech_started';
  timestampMs: number;
  timestamp?: string;
  vadIdleTimeS?: number;
  vadInferenceCount?: number;
  vadInferenceDurationTotalMs?: number;
}

export interface VadSpeechStoppedEvent extends BaseEvent {
  type: 'user.speech_stopped';
  timestampMs: number;
  durationMs: number;
  timestamp?: string;
  vadIdleTimeS?: number;
  vadInferenceCount?: number;
  vadInferenceDurationTotalMs?: number;
}

export interface TurnDetectedEvent extends BaseEvent {
  type: 'user.turn_completed';
  turnId: string;
  trigger: string;
  durationMs: number;
  timestamp?: string;
  turnMethod?: string;
  turnProbability?: number;
}

export interface VoicemailDetectedEvent extends BaseEvent {
  type: 'voicemail.detected';
  result: string;
  method: string;
  transcript?: string;
}

export interface VoicemailBeepEvent extends BaseEvent {
  type: 'voicemail.beep';
  frequencyHz: number;
  durationMs: number;
}

export interface ParticipantAddedEvent extends BaseEvent {
  type: 'participant.added';
  memberId: string;
  role: string;
  target: string;
}

export interface ParticipantRemovedEvent extends BaseEvent {
  type: 'participant.removed';
  memberId: string;
  role: string;
}

export interface CallTransferredEvent extends BaseEvent {
  type: 'call.transferred';
  destination: string[];
}

export interface PlayCompletedEvent extends BaseEvent {
  type: 'play.completed';
}

export interface UserIdleEvent extends BaseEvent {
  type: 'user.idle';
  retryCount: number;
  reason: string;
}

export interface TurnMetricsEvent extends BaseEvent {
  type: 'turn.metrics';
  turnNumber: number;
  interrupted: boolean;
  agentFirst?: boolean;
  agentToolId?: string;
  userText?: string;
  agentText?: string;
  pipeline?: string;

  // SDK-measured latency
  userPerceivedMs?: number;
  sdkLlmTtftMs?: number;
  sdkTtsTtfbMs?: number;
  sdkTranscriptionDelayMs?: number;
  sdkEndOfTurnDelayMs?: number;
  sdkTurnCompletedCallbackMs?: number;
  sdkStartedSpeakingAt?: number;
  sdkStoppedSpeakingAt?: number;

  // Turn detection
  sttDelayMs?: number;
  turnDecisionMs?: number;
  turnCompletedCallbackMs?: number;
  eouSpeechId?: string;
  turnMethod?: string;
  turnProbability?: number;
  turnUnlikelyThreshold?: number;

  // Dynamic endpointing
  endpointingMinDelayMs?: number;
  endpointingMaxDelayMs?: number;

  // VAD
  vadIdleTimeS?: number;
  vadInferenceCount?: number;
  vadInferenceDurationTotalMs?: number;
  vadLabel?: string;

  // LLM
  llmTtftMs?: number;
  llmDurationMs?: number;
  llmCancelled?: boolean;
  llmPromptTokens?: number;
  llmCompletionTokens?: number;
  llmTotalTokens?: number;
  llmTokensPerSecond?: number;
  llmCacheReadTokens?: number;
  llmCacheHitRatio?: number;
  llmModel?: string;
  llmProvider?: string;
  llmLabel?: string;
  llmRequestId?: string;
  llmTimestamp?: number;
  llmSpeechId?: string;

  // TTS
  ttsTtfbMs?: number;
  ttsDurationMs?: number;
  ttsAudioDurationMs?: number;
  ttsCancelled?: boolean;
  ttsCharacters?: number;
  ttsStreamed?: boolean;
  ttsInputTokens?: number;
  ttsOutputTokens?: number;
  ttsModel?: string;
  ttsProvider?: string;
  ttsLabel?: string;
  ttsRequestId?: string;
  ttsTimestamp?: number;
  ttsSpeechId?: string;
  ttsSegmentId?: string;

  // STT
  sttDurationMs?: number;
  sttAudioDurationMs?: number;
  sttStreamed?: boolean;
  sttInputTokens?: number;
  sttOutputTokens?: number;
  sttModel?: string;
  sttProvider?: string;
  sttConfidence?: number;
  sttLabel?: string;
  sttRequestId?: string;
  sttTimestamp?: number;

  // Adaptive interruption
  interruptionTotalDurationMs?: number;
  interruptionPredictionMs?: number;
  interruptionDetectionDelayMs?: number;
  numInterruptions?: number;
  numBackchannels?: number;
  interruptionNumRequests?: number;

  // S2S / Realtime
  realtimeTtftMs?: number;
  realtimeDurationMs?: number;
  realtimeSessionDurationMs?: number;
  realtimeCancelled?: boolean;
  realtimeInputTokens?: number;
  realtimeOutputTokens?: number;
  realtimeTotalTokens?: number;
  realtimeTokensPerSecond?: number;
  realtimeLabel?: string;
  realtimeRequestId?: string;
  realtimeModel?: string;
  realtimeProvider?: string;
  realtimeInputAudioTokens?: number;
  realtimeInputTextTokens?: number;
  realtimeInputImageTokens?: number;
  realtimeOutputAudioTokens?: number;
  realtimeOutputTextTokens?: number;
  realtimeOutputImageTokens?: number;
  realtimeCachedTokens?: number;
  realtimeCachedAudioTokens?: number;
  realtimeCachedTextTokens?: number;
  realtimeCachedImageTokens?: number;
  realtimeCacheHitRatio?: number;

  // Wall-clock timestamps
  userStartedSpeakingAt?: string;
  userStoppedSpeakingAt?: string;
  agentStartedSpeakingAt?: string;
  agentStoppedSpeakingAt?: string;

  // Other
  speakingRate?: number;
  errorSource?: string;
  llmAvailability?: Record<string, unknown>;
}

// --- New event types ---

export interface ToolExecutedEvent extends BaseEvent {
  type: 'tool.executed';
  calls?: unknown[];
  timestamp?: string;
}

export interface UserStateChangedEvent extends BaseEvent {
  type: 'user.state_changed';
  oldState?: string;
  newState?: string;
  timestamp?: string;
}

export interface AgentStateChangedEvent extends BaseEvent {
  type: 'agent.state_changed';
  oldState?: string;
  newState?: string;
  timestamp?: string;
}

export interface AgentSpeechStartedEvent extends BaseEvent {
  type: 'agent.speech_started';
  timestamp?: string;
}

export interface AgentSpeechCompletedEvent extends BaseEvent {
  type: 'agent.speech_completed';
  playbackPositionS?: number;
  timestamp?: string;
  transcript?: string;
}

export interface AgentSpeechCreatedEvent extends BaseEvent {
  type: 'agent.speech_created';
  source?: string;
  userInitiated?: boolean;
  timestamp?: string;
}

export interface AgentFalseInterruptionEvent extends BaseEvent {
  type: 'agent.false_interruption';
  resumed?: boolean;
  timestamp?: string;
}

export interface LlmAvailabilityChangedEvent extends BaseEvent {
  type: 'llm.availability_changed';
  llm?: string;
  available?: boolean;
  timestamp?: string;
}

export interface AgentToolStartedEvent extends BaseEvent {
  type: 'agent_tool.started';
  agentToolType: string;
  agentToolId: string;
}

export interface AgentToolCompletedEvent extends BaseEvent {
  type: 'agent_tool.completed';
  agentToolType: string;
  agentToolId: string;
  result: Record<string, unknown>;
}

export interface AgentToolFailedEvent extends BaseEvent {
  type: 'agent_tool.failed';
  agentToolType: string;
  agentToolId: string;
  error: string;
}

export interface UserBackchannelEvent extends BaseEvent {
  type: 'user.backchannel';
  isInterruption: boolean;
  probability?: number;
  detectionDelayMs?: number;
  totalDurationMs?: number;
  predictionDurationMs?: number;
  overlapStartedAt?: string;
  numRequests?: number;
  timestamp?: string;
  speechInputB64?: string;
  probabilities?: unknown[];
}

export interface SessionUsageEvent extends BaseEvent {
  type: 'session.usage';
  models?: unknown[];
}

// --- Audio stream events (Plivo Audio Streaming protocol) ---

export interface StreamStartEvent {
  event: 'start';
  streamId: string;
  callId: string;
  contentType: string;
  sampleRate: number;
}

export interface StreamMediaEvent {
  event: 'media';
  payload: string;
  contentType: string;
  sampleRate: number;
  timestamp: string;
}

export interface StreamDtmfEvent {
  event: 'dtmf';
  digit: string;
}

export interface PlayedStreamEvent {
  event: 'playedStream';
  name: string;
}

export interface ClearedAudioEvent {
  event: 'clearedAudio';
}

export interface StreamStopEvent {
  event: 'stop';
}

export interface UnknownEvent {
  type: string;
  [key: string]: unknown;
}

/** Union of all possible events. */
export type Event =
  | AgentSessionStartedEvent
  | ToolCallEvent
  | TurnCompletedEvent
  | PromptEvent
  | DtmfEvent
  | DtmfSentEvent
  | AgentHandoffEvent
  | InterruptionEvent
  | AgentSessionEndedEvent
  | ErrorEventData
  | VadSpeechStartedEvent
  | VadSpeechStoppedEvent
  | TurnDetectedEvent
  | VoicemailDetectedEvent
  | VoicemailBeepEvent
  | ParticipantAddedEvent
  | ParticipantRemovedEvent
  | CallTransferredEvent
  | PlayCompletedEvent
  | UserIdleEvent
  | TurnMetricsEvent
  | ToolExecutedEvent
  | UserStateChangedEvent
  | AgentStateChangedEvent
  | AgentSpeechStartedEvent
  | AgentSpeechCompletedEvent
  | AgentSpeechCreatedEvent
  | AgentFalseInterruptionEvent
  | LlmAvailabilityChangedEvent
  | AgentToolStartedEvent
  | AgentToolCompletedEvent
  | AgentToolFailedEvent
  | UserBackchannelEvent
  | SessionUsageEvent
  | StreamStartEvent
  | StreamMediaEvent
  | StreamDtmfEvent
  | PlayedStreamEvent
  | ClearedAudioEvent
  | StreamStopEvent
  | UnknownEvent;

// snake_case to camelCase for event fields
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function transformEventKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[camelKey] = transformEventKeys(value as Record<string, unknown>);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

/**
 * Parse raw JSON data into a typed Event.
 * Unknown event types return as UnknownEvent for forward compatibility.
 */
export function parseEvent(data: string | Buffer): Event {
  const raw: Record<string, unknown> =
    typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());

  const eventType = (raw.type as string) || (raw.event as string);

  // Handle nested Plivo audio stream events
  if (eventType === 'start' && raw.start) {
    const startData = raw.start as Record<string, unknown>;
    const mediaFormat = (startData.mediaFormat as Record<string, unknown>) || {};
    return {
      event: 'start',
      streamId: (raw.streamId as string) || (startData.streamId as string) || '',
      callId: (startData.callId as string) || '',
      contentType: (mediaFormat.type as string) || '',
      sampleRate: (mediaFormat.rate as number) || 8000,
    } as StreamStartEvent;
  }

  if (eventType === 'media' && raw.media) {
    const mediaData = raw.media as Record<string, unknown>;
    return {
      event: 'media',
      payload: (mediaData.payload as string) || '',
      contentType: (mediaData.contentType as string) || '',
      sampleRate: (mediaData.sampleRate as number) || 8000,
      timestamp: (mediaData.timestamp as string) || '',
    } as StreamMediaEvent;
  }

  if (eventType === 'dtmf' && raw.dtmf) {
    const dtmfData = raw.dtmf as Record<string, unknown>;
    return {
      event: 'dtmf',
      digit: (dtmfData.digit as string) || '',
    } as StreamDtmfEvent;
  }

  // Audio stream events with "event" field
  if (raw.event && !raw.type) {
    switch (eventType) {
      case 'playedStream':
        return { event: 'playedStream', name: (raw.name as string) || '' } as PlayedStreamEvent;
      case 'clearedAudio':
        return { event: 'clearedAudio' } as ClearedAudioEvent;
      case 'stop':
        return { event: 'stop' } as StreamStopEvent;
    }
  }

  // Pipeline events — transform keys to camelCase
  const transformed = transformEventKeys(raw);
  return transformed as Event;
}
