// Client
export { PlivoAgentClient, type ClientOptions } from './client.js';

// Resources
export { AgentResource, EAGERNESS_PRESETS, expandSemanticVad, type CreateAgentParams, type UpdateAgentParams, type ListAgentParams, type Agent, type AgentListResponse } from './agent.js';
export { CallResource, type InitiateCallParams, type InitiateCallResponse, type ConnectCallResponse, type DialTarget, type DialParams, type DialResponse } from './call.js';
export { NumberResource, type AssignNumberResponse, type NumberListResponse } from './number.js';
export { SessionResource, type ListSessionParams, type SessionRecord, type SessionListResponse } from './session-resource.js';
export { MessagingResource, Template, InteractiveMessage, Location, type CreateMessageParams, type CreateMessageResponse, type MessageRecord, type ListMessageParams, type MessageListResponse, type MediaListResponse, type ButtonDef, type SectionDef } from './messaging.js';
export { PhoneNumberResource, type ListPhoneNumberParams, type PhoneNumber, type PhoneNumberListResponse, type BuyPhoneNumberParams, type BuyPhoneNumberResponse, type UpdatePhoneNumberParams, type UpdatePhoneNumberResponse, type SearchPhoneNumberParams, type SearchResult, type SearchPhoneNumberResponse, type LookupResponse } from './phone-number.js';

// WebSocket
export { VoiceApp } from './voice-app.js';
export { Session } from './session.js';

// Events
export {
  parseEvent,
  type Event,
  type BaseEvent,
  type AgentSessionStartedEvent,
  type ToolCallEvent,
  type TurnCompletedEvent,
  type PromptEvent,
  type DtmfEvent,
  type DtmfSentEvent,
  type AgentHandoffEvent,
  type InterruptionEvent,
  type AgentSessionEndedEvent,
  type ErrorEventData,
  type VadSpeechStartedEvent,
  type VadSpeechStoppedEvent,
  type TurnDetectedEvent,
  type VoicemailDetectedEvent,
  type VoicemailBeepEvent,
  type ParticipantAddedEvent,
  type ParticipantRemovedEvent,
  type CallTransferredEvent,
  type PlayCompletedEvent,
  type UserIdleEvent,
  type TurnMetricsEvent,
  type ToolExecutedEvent,
  type UserStateChangedEvent,
  type AgentStateChangedEvent,
  type AgentSpeechStartedEvent,
  type AgentSpeechCompletedEvent,
  type AgentSpeechCreatedEvent,
  type AgentFalseInterruptionEvent,
  type LlmAvailabilityChangedEvent,
  type AgentToolStartedEvent,
  type AgentToolCompletedEvent,
  type AgentToolFailedEvent,
  type UserBackchannelEvent,
  type SessionUsageEvent,
  type StreamStartEvent,
  type StreamMediaEvent,
  type StreamDtmfEvent,
  type PlayedStreamEvent,
  type ClearedAudioEvent,
  type StreamStopEvent,
  type UnknownEvent,
} from './events.js';

// Errors
export {
  PlivoError,
  AuthenticationError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServerError,
  WebSocketError,
} from './errors.js';

// Webhook
export { validateSignatureV3 } from './webhook.js';

// Types
export type { Meta, ListParams } from './types.js';

// Prebuilt tools
export {
  EndCall,
  SendDtmfTool,
  WarmTransfer,
  type WarmTransferOptions,
  CollectEmail,
  CollectAddress,
  CollectDigits,
  CollectPhone,
  CollectName,
  CollectDOB,
  CollectCreditCard,
} from './tools.js';

// HTTP (for advanced usage)
export { HttpTransport, type TransportOptions } from './http.js';
