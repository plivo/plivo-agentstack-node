import { describe, it, expect } from 'bun:test';
import { parseEvent } from '../src/events.js';
import type {
  AgentSessionStartedEvent,
  ToolCallEvent,
  TurnCompletedEvent,
  PromptEvent,
  DtmfEvent,
  InterruptionEvent,
  AgentSessionEndedEvent,
  ErrorEventData,
  VoicemailDetectedEvent,
  TurnMetricsEvent,
  StreamStartEvent,
  StreamMediaEvent,
  UserIdleEvent,
  CallTransferredEvent,
  ParticipantAddedEvent,
} from '../src/events.js';

describe('parseEvent', () => {
  it('should parse session.started', () => {
    const event = parseEvent(
      '{"type":"session.started","agent_session_id":"sess-1","call_id":"call-1","caller":"+14155551234"}',
    ) as AgentSessionStartedEvent;
    expect(event.type).toBe('session.started');
    expect(event.agentSessionId).toBe('sess-1');
    expect(event.callId).toBe('call-1');
    expect(event.caller).toBe('+14155551234');
  });

  it('should parse tool.called', () => {
    const event = parseEvent(
      '{"type":"tool.called","id":"tc-1","name":"get_weather","arguments":{"city":"SF"}}',
    ) as ToolCallEvent;
    expect(event.type).toBe('tool.called');
    expect(event.id).toBe('tc-1');
    expect(event.name).toBe('get_weather');
    expect(event.arguments.city).toBe('SF');
  });

  it('should parse turn.completed', () => {
    const event = parseEvent(
      '{"type":"turn.completed","user_text":"Hello","agent_text":"Hi there","turn_id":"t-1"}',
    ) as TurnCompletedEvent;
    expect(event.type).toBe('turn.completed');
    expect(event.userText).toBe('Hello');
    expect(event.agentText).toBe('Hi there');
  });

  it('should parse user.transcription', () => {
    const event = parseEvent(
      '{"type":"user.transcription","text":"What is the weather?","is_final":true}',
    ) as PromptEvent;
    expect(event.type).toBe('user.transcription');
    expect(event.text).toBe('What is the weather?');
    expect(event.isFinal).toBe(true);
  });

  it('should parse user.dtmf', () => {
    const event = parseEvent('{"type":"user.dtmf","digit":"5"}') as DtmfEvent;
    expect(event.type).toBe('user.dtmf');
    expect(event.digit).toBe('5');
  });

  it('should parse agent.speech_interrupted', () => {
    const event = parseEvent(
      '{"type":"agent.speech_interrupted","interrupted_text":"I was saying","turn_id":"t-1"}',
    ) as InterruptionEvent;
    expect(event.type).toBe('agent.speech_interrupted');
    expect(event.interruptedText).toBe('I was saying');
  });

  it('should parse session.ended', () => {
    const event = parseEvent(
      '{"type":"session.ended","duration_seconds":120,"turn_count":5}',
    ) as AgentSessionEndedEvent;
    expect(event.type).toBe('session.ended');
    expect(event.durationSeconds).toBe(120);
    expect(event.turnCount).toBe(5);
  });

  it('should parse session.error', () => {
    const event = parseEvent(
      '{"type":"session.error","code":"E001","message":"Pipeline failed"}',
    ) as ErrorEventData;
    expect(event.type).toBe('session.error');
    expect(event.code).toBe('E001');
    expect(event.message).toBe('Pipeline failed');
  });

  it('should parse voicemail.detected', () => {
    const event = parseEvent(
      '{"type":"voicemail.detected","result":"machine","method":"audio"}',
    ) as VoicemailDetectedEvent;
    expect(event.type).toBe('voicemail.detected');
    expect(event.result).toBe('machine');
    expect(event.method).toBe('audio');
  });

  it('should parse turn.metrics', () => {
    const event = parseEvent(
      '{"type":"turn.metrics","turn_number":1,"interrupted":false,"user_perceived_ms":500,"llm_prompt_tokens":100}',
    ) as TurnMetricsEvent;
    expect(event.type).toBe('turn.metrics');
    expect(event.turnNumber).toBe(1);
    expect(event.userPerceivedMs).toBe(500);
    expect(event.llmPromptTokens).toBe(100);
  });

  it('should parse user.idle', () => {
    const event = parseEvent(
      '{"type":"user.idle","retry_count":2,"reason":"no_response"}',
    ) as UserIdleEvent;
    expect(event.type).toBe('user.idle');
    expect(event.retryCount).toBe(2);
    expect(event.reason).toBe('no_response');
  });

  it('should parse call.transferred', () => {
    const event = parseEvent(
      '{"type":"call.transferred","destination":["+14155551234","+14155555678"]}',
    ) as CallTransferredEvent;
    expect(event.type).toBe('call.transferred');
    expect(event.destination).toHaveLength(2);
  });

  it('should parse participant.added', () => {
    const event = parseEvent(
      '{"type":"participant.added","member_id":"m-1","role":"customer","target":"+14155551234"}',
    ) as ParticipantAddedEvent;
    expect(event.type).toBe('participant.added');
    expect(event.memberId).toBe('m-1');
    expect(event.role).toBe('customer');
  });

  it('should parse play.completed', () => {
    const event = parseEvent('{"type":"play.completed"}');
    expect(event.type).toBe('play.completed');
  });

  // --- Audio stream events ---

  it('should parse stream start with nested data', () => {
    const event = parseEvent(
      '{"event":"start","streamId":"stream-1","start":{"callId":"call-1","streamId":"stream-1","mediaFormat":{"type":"audio/x-mulaw","rate":8000}}}',
    ) as StreamStartEvent;
    expect(event.event).toBe('start');
    expect(event.streamId).toBe('stream-1');
    expect(event.callId).toBe('call-1');
    expect(event.contentType).toBe('audio/x-mulaw');
    expect(event.sampleRate).toBe(8000);
  });

  it('should parse stream media with nested data', () => {
    const event = parseEvent(
      '{"event":"media","media":{"payload":"base64data","contentType":"audio/x-mulaw","sampleRate":8000,"timestamp":"0.0"}}',
    ) as StreamMediaEvent;
    expect(event.event).toBe('media');
    expect(event.payload).toBe('base64data');
    expect(event.contentType).toBe('audio/x-mulaw');
  });

  it('should parse unknown events', () => {
    const event = parseEvent('{"type":"future.event","some_field":"value"}');
    expect(event.type).toBe('future.event');
  });

  it('should accept Buffer input', () => {
    const event = parseEvent(
      Buffer.from('{"type":"user.transcription","text":"hello","is_final":true}'),
    ) as PromptEvent;
    expect(event.type).toBe('user.transcription');
    expect(event.text).toBe('hello');
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseEvent('not json')).toThrow();
  });

  it('extra fields in JSON do not cause parse errors', () => {
    const event = parseEvent(
      '{"type":"user.transcription","text":"hello","is_final":true,"extra_field":"extra_value","nested":{"a":1}}',
    ) as PromptEvent;
    expect(event.type).toBe('user.transcription');
    expect(event.text).toBe('hello');
    expect(event.isFinal).toBe(true);
    // Extra fields are still present (forward compatibility)
    expect((event as unknown as Record<string, unknown>).extraField).toBe('extra_value');
  });

  it('full AgentSessionStarted fields', () => {
    const event = parseEvent(
      JSON.stringify({
        type: 'session.started',
        agent_session_id: 'sess-full',
        call_id: 'call-full',
        caller: '+14155551234',
        callee: '+19876543210',
        agent_id: 'agent-42',
        audio_format: 'pcm',
        sample_rate: 16000,
        channels: 1,
        frame_size_ms: 20,
        plc_enabled: true,
      }),
    ) as AgentSessionStartedEvent;
    expect(event.type).toBe('session.started');
    expect(event.agentSessionId).toBe('sess-full');
    expect(event.callId).toBe('call-full');
    expect(event.caller).toBe('+14155551234');
    expect(event.callee).toBe('+19876543210');
    expect(event.agentId).toBe('agent-42');
    expect(event.audioFormat).toBe('pcm');
    expect(event.sampleRate).toBe(16000);
    expect(event.channels).toBe(1);
    expect(event.frameSizeMs).toBe(20);
    expect(event.plcEnabled).toBe(true);
  });

  it('TurnMetrics with detailed fields', () => {
    const event = parseEvent(
      JSON.stringify({
        type: 'turn.metrics',
        turn_number: 3,
        interrupted: true,
        user_perceived_ms: 800,
        stt_delay_ms: 50,
        llm_ttft_ms: 200,
        llm_model: 'gpt-4',
        tts_ttfb_ms: 120,
        stt_provider: 'deepgram',
        llm_provider: 'openai',
        tts_provider: 'elevenlabs',
        llm_prompt_tokens: 500,
        llm_completion_tokens: 80,
        llm_total_tokens: 580,
        llm_cache_read_tokens: 100,
        tts_characters: 200,
        tts_audio_duration_ms: 3000,
        llm_duration_ms: 450,
        tts_duration_ms: 600,
        agent_first: false,
        pipeline: 'stt-llm-tts',
      }),
    ) as TurnMetricsEvent;
    expect(event.type).toBe('turn.metrics');
    expect(event.turnNumber).toBe(3);
    expect(event.interrupted).toBe(true);
    expect(event.userPerceivedMs).toBe(800);
    expect(event.sttDelayMs).toBe(50);
    expect(event.llmTtftMs).toBe(200);
    expect(event.llmModel).toBe('gpt-4');
    expect(event.ttsTtfbMs).toBe(120);
    expect(event.sttProvider).toBe('deepgram');
    expect(event.llmProvider).toBe('openai');
    expect(event.ttsProvider).toBe('elevenlabs');
    expect(event.llmPromptTokens).toBe(500);
    expect(event.llmCompletionTokens).toBe(80);
    expect(event.llmTotalTokens).toBe(580);
    expect(event.llmCacheReadTokens).toBe(100);
    expect(event.ttsCharacters).toBe(200);
    expect(event.ttsAudioDurationMs).toBe(3000);
    expect(event.llmDurationMs).toBe(450);
    expect(event.ttsDurationMs).toBe(600);
    expect(event.agentFirst).toBe(false);
    expect(event.pipeline).toBe('stt-llm-tts');
  });
});
