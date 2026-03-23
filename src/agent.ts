import { HttpTransport } from './http.js';
import type { Meta } from './types.js';

// ---------------------------------------------------------------------------
// semantic_vad eagerness presets
// ---------------------------------------------------------------------------

export const EAGERNESS_PRESETS: Record<string, Record<string, number>> = {
  low: {
    completed_turn_delay_ms: 500,
    incomplete_turn_delay_ms: 2500,
    uncertain_turn_delay_ms: 1000,
    min_interruption_duration_ms: 600,
    false_interruption_timeout_ms: 1200,
  },
  medium: {
    completed_turn_delay_ms: 250,
    incomplete_turn_delay_ms: 1800,
    uncertain_turn_delay_ms: 900,
    min_interruption_duration_ms: 500,
    false_interruption_timeout_ms: 1000,
  },
  high: {
    completed_turn_delay_ms: 150,
    incomplete_turn_delay_ms: 1400,
    uncertain_turn_delay_ms: 700,
    min_interruption_duration_ms: 300,
    false_interruption_timeout_ms: 750,
  },
  auto: {},
};

/**
 * Expand semantic_vad shorthand to full config dict.
 *
 * Accepts:
 *   - string: "high" / "medium" / "low" / "auto" -> eagerness preset
 *   - object with "eagerness" key: preset + explicit overrides
 *   - object without "eagerness": raw values, passed through unchanged
 *   - undefined/null: returns undefined
 */
export function expandSemanticVad(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    const preset = EAGERNESS_PRESETS[value];
    if (preset === undefined) {
      throw new Error(
        `Unknown semantic_vad preset: "${value}". ` +
        `Use one of: ${Object.keys(EAGERNESS_PRESETS).join(', ')}`,
      );
    }
    return { ...preset };
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = { ...(value as Record<string, unknown>) };
    const eagerness = obj.eagerness;
    if (eagerness !== undefined && eagerness !== null) {
      delete obj.eagerness;
      const preset = EAGERNESS_PRESETS[eagerness as string];
      if (preset === undefined) {
        throw new Error(
          `Unknown eagerness: "${eagerness}". ` +
          `Use one of: ${Object.keys(EAGERNESS_PRESETS).join(', ')}`,
        );
      }
      const base: Record<string, unknown> = { ...preset };
      Object.assign(base, obj);
      return base;
    }
    return obj;
  }
  throw new TypeError(
    `semantic_vad must be string, object, or undefined -- got ${typeof value}`,
  );
}

export interface CreateAgentParams {
  agentName: string;
  websocketUrl: string;
  stt?: Record<string, unknown>;
  sttFallback?: Record<string, unknown>[];
  llm?: Record<string, unknown>;
  llmFallback?: Record<string, unknown>[];
  tts?: Record<string, unknown>;
  ttsFallback?: Record<string, unknown>[];
  s2s?: Record<string, unknown>;
  welcomeGreeting?: string;
  speaksFirst?: string;
  audioFormat?: string;
  interruptionEnabled?: boolean;
  stream?: Record<string, unknown>;
  callbacks?: Record<string, unknown>;
  vad?: Record<string, unknown>;
  semanticVad?: string | Record<string, unknown>;
  turnDetector?: Record<string, unknown>;
  backgroundAudio?: Record<string, unknown>;
  idleTimeout?: Record<string, unknown>;
  agentTools?: Record<string, unknown>[];
  mcpServers?: Record<string, unknown>[];
  participantMode?: string;
  detectionMethod?: string;
  [key: string]: unknown;
}

export interface UpdateAgentParams {
  agentName?: string;
  websocketUrl?: string;
  stt?: Record<string, unknown>;
  sttFallback?: Record<string, unknown>[];
  llm?: Record<string, unknown>;
  llmFallback?: Record<string, unknown>[];
  tts?: Record<string, unknown>;
  ttsFallback?: Record<string, unknown>[];
  s2s?: Record<string, unknown>;
  welcomeGreeting?: string;
  speaksFirst?: string;
  audioFormat?: string;
  interruptionEnabled?: boolean;
  stream?: Record<string, unknown>;
  callbacks?: Record<string, unknown>;
  vad?: Record<string, unknown>;
  semanticVad?: string | Record<string, unknown>;
  turnDetector?: Record<string, unknown>;
  backgroundAudio?: Record<string, unknown>;
  idleTimeout?: Record<string, unknown>;
  agentTools?: Record<string, unknown>[];
  mcpServers?: Record<string, unknown>[];
  participantMode?: string;
  detectionMethod?: string;
  [key: string]: unknown;
}

export interface ListAgentParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
  agentMode?: string;
  participantMode?: string;
}

export interface Agent {
  apiId?: string;
  message?: string;
  agentUuid: string;
  agentName: string;
  websocketUrl?: string;
  createdAt?: string;
  byok?: boolean;
  stt?: Record<string, unknown>;
  llm?: Record<string, unknown>;
  tts?: Record<string, unknown>;
  s2s?: Record<string, unknown>;
  welcomeGreeting?: string;
  speaksFirst?: string;
  participantMode?: string;
  detectionMethod?: string;
  plivoNumber?: string;
  [key: string]: unknown;
}

export interface AgentListResponse {
  apiId: string;
  objects: Agent[];
  meta: Meta;
}

export class AgentResource {
  private http: HttpTransport;
  private prefix: string;

  constructor(http: HttpTransport, prefix: string) {
    this.http = http;
    this.prefix = prefix;
  }

  async create(params: CreateAgentParams): Promise<Agent> {
    const data = { ...params } as Record<string, unknown>;
    if (data.semanticVad !== undefined) {
      data.semanticVad = expandSemanticVad(data.semanticVad);
    }
    return this.http.request<Agent>('POST', `${this.prefix}/Agent`, {
      data,
    });
  }

  async get(agentUuid: string): Promise<Agent> {
    return this.http.request<Agent>('GET', `${this.prefix}/Agent/${agentUuid}`);
  }

  async list(params?: ListAgentParams): Promise<AgentListResponse> {
    return this.http.request<AgentListResponse>('GET', `${this.prefix}/Agent`, {
      params: params as Record<string, unknown>,
    });
  }

  async update(
    agentUuid: string,
    params: UpdateAgentParams,
  ): Promise<Agent> {
    const data = { ...params } as Record<string, unknown>;
    if (data.semanticVad !== undefined) {
      data.semanticVad = expandSemanticVad(data.semanticVad);
    }
    return this.http.request<Agent>(
      'PATCH',
      `${this.prefix}/Agent/${agentUuid}`,
      { data },
    );
  }

  async delete(agentUuid: string): Promise<void> {
    await this.http.request('DELETE', `${this.prefix}/Agent/${agentUuid}`);
  }
}
