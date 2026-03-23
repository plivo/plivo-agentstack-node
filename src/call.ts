import { HttpTransport } from './http.js';

export interface InitiateCallParams {
  agentId: string;
  from: string;
  to: string[];
  dialMode?: string;
  callerName?: string;
  timeLimit?: number;
  ringTimeout?: number;
  machineDetection?: string;
  sendDigits?: string;
  voicemailDetect?: boolean;
  [key: string]: unknown;
}

export interface InitiateCallResponse {
  apiId?: string;
  message?: string;
  callUuid: string;
  agentId: string;
  status: string;
  from: string;
  to: string[];
  participantMode?: string;
  mpcName?: string;
}

export interface ConnectCallResponse {
  apiId?: string;
  message?: string;
  agentSessionId: string;
  status: string;
}

export interface DialTarget {
  number: string;
  sendDigits?: string;
}

export interface DialParams {
  agentId?: string;
  targets: DialTarget[];
  dialMode?: string;
  callerId?: string;
  timeout?: number;
  timeLimit?: number;
  hangupOnStar?: boolean;
  dialMusic?: string;
  confirmSound?: string;
  confirmKey?: string;
  sipHeaders?: string;
  [key: string]: unknown;
}

export interface DialResponse {
  apiId?: string;
  message?: string;
  status: string;
  callUuid: string;
}

export class CallResource {
  private http: HttpTransport;
  private prefix: string;

  constructor(http: HttpTransport, prefix: string) {
    this.http = http;
    this.prefix = prefix;
  }

  async initiate(params: InitiateCallParams): Promise<InitiateCallResponse> {
    return this.http.request<InitiateCallResponse>(
      'POST',
      `${this.prefix}/AgentCall`,
      { data: params },
    );
  }

  async connect(
    callUuid: string,
    agentUuid: string,
  ): Promise<ConnectCallResponse> {
    return this.http.request<ConnectCallResponse>(
      'POST',
      `${this.prefix}/AgentCall/${callUuid}/connect`,
      { data: { agentId: agentUuid } },
    );
  }

  async dial(callUuid: string, params: DialParams): Promise<DialResponse> {
    return this.http.request<DialResponse>(
      'POST',
      `${this.prefix}/AgentCall/${callUuid}/dial`,
      { data: params },
    );
  }
}
