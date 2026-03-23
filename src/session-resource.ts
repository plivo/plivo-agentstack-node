import { HttpTransport } from './http.js';
import type { Meta } from './types.js';

export interface ListSessionParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
  agentId?: string;
  agentMode?: string;
  callUuid?: string;
  phoneNumber?: string;
  endedAtGte?: string;
  endedAtLte?: string;
  createdAtGte?: string;
  createdAtLte?: string;
  durationGte?: number;
  durationLte?: number;
}

export interface SessionRecord {
  agentSessionUuid: string;
  agentUuid: string;
  agentName?: string;
  plivoAuthId?: string;
  primaryCallUuid?: string;
  agentMode?: string;
  participantMode?: string;
  state?: string;
  createdAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  turnCount?: number;
  hasStt?: boolean;
  hasLlm?: boolean;
  hasTts?: boolean;
  hasS2s?: boolean;
  totalCost?: string;
  fromNumber?: string;
  toNumber?: string;
  callLegs?: unknown;
  recordUrl?: string;
}

export interface SessionListResponse {
  apiId: string;
  objects: SessionRecord[];
  meta: Meta;
}

export class SessionResource {
  private http: HttpTransport;
  private prefix: string;

  constructor(http: HttpTransport, prefix: string) {
    this.http = http;
    this.prefix = prefix;
  }

  async list(params?: ListSessionParams): Promise<SessionListResponse> {
    // Remap date/duration filter fields to double-underscore names expected by the API.
    // The transport's camelToSnake would produce single underscores (ended_at_gte),
    // but the API uses Django-style double-underscore lookups (ended_at__gte).
    let rawParams: Record<string, unknown> | undefined;
    if (params) {
      const {
        endedAtGte, endedAtLte,
        createdAtGte, createdAtLte,
        durationGte, durationLte,
        ...rest
      } = params;
      rawParams = { ...rest } as Record<string, unknown>;
      if (endedAtGte !== undefined) rawParams['ended_at__gte'] = endedAtGte;
      if (endedAtLte !== undefined) rawParams['ended_at__lte'] = endedAtLte;
      if (createdAtGte !== undefined) rawParams['created_at__gte'] = createdAtGte;
      if (createdAtLte !== undefined) rawParams['created_at__lte'] = createdAtLte;
      if (durationGte !== undefined) rawParams['duration__gte'] = durationGte;
      if (durationLte !== undefined) rawParams['duration__lte'] = durationLte;
    }
    return this.http.request<SessionListResponse>(
      'GET',
      `${this.prefix}/AgentSession`,
      { params: rawParams },
    );
  }

  async get(sessionId: string): Promise<SessionRecord> {
    return this.http.request<SessionRecord>(
      'GET',
      `${this.prefix}/AgentSession/${sessionId}`,
    );
  }
}
