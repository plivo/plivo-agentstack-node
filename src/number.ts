import { HttpTransport } from './http.js';

export interface AssignNumberResponse {
  apiId?: string;
  message?: string;
  agentUuid: string;
  number: string;
}

export interface NumberListResponse {
  apiId?: string;
  agentUuid: string;
  numbers: string[];
}

export class NumberResource {
  private http: HttpTransport;
  private prefix: string;

  constructor(http: HttpTransport, prefix: string) {
    this.http = http;
    this.prefix = prefix;
  }

  async assign(
    agentUuid: string,
    number: string,
  ): Promise<AssignNumberResponse> {
    return this.http.request<AssignNumberResponse>(
      'POST',
      `${this.prefix}/Agent/${agentUuid}/Number`,
      { data: { number } },
    );
  }

  async list(agentUuid: string): Promise<NumberListResponse> {
    return this.http.request<NumberListResponse>(
      'GET',
      `${this.prefix}/Agent/${agentUuid}/Number`,
    );
  }

  async unassign(agentUuid: string, number: string): Promise<void> {
    await this.http.request(
      'DELETE',
      `${this.prefix}/Agent/${agentUuid}/Number/${number}`,
    );
  }
}
