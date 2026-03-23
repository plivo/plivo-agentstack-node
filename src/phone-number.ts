import { HttpTransport } from './http.js';
import type { Meta } from './types.js';

// --- List owned numbers ---

export interface ListPhoneNumberParams {
  limit?: number;
  offset?: number;
  type?: string;
  numberStartswith?: string;
  subaccount?: string;
  alias?: string;
  services?: string;
  [key: string]: unknown;
}

export interface PhoneNumber {
  apiId?: string;
  number?: string;
  alias?: string;
  application?: string;
  carrier?: string;
  city?: string;
  country?: string;
  numberType?: string;
  monthlyRentalRate?: string;
  region?: string;
  resourceUri?: string;
  smsEnabled?: boolean;
  smsRate?: string;
  subAccount?: unknown;
  voiceEnabled?: boolean;
  voiceRate?: string;
  addedOn?: string;
  renewalDate?: string;
}

export interface PhoneNumberListResponse {
  apiId: string;
  objects: PhoneNumber[];
  meta: Meta;
}

// --- Buy ---

export interface BuyPhoneNumberParams {
  appId?: string;
  [key: string]: unknown;
}

export interface BuyPhoneNumberResponse {
  apiId: string;
  message: string;
  status: string;
  numbers?: { number: string; status: string }[];
}

// --- Update ---

export interface UpdatePhoneNumberParams {
  appId?: string;
  subaccount?: string;
  alias?: string;
  [key: string]: unknown;
}

export interface UpdatePhoneNumberResponse {
  apiId: string;
  message: string;
}

// --- Search ---

export interface SearchPhoneNumberParams {
  countryIso: string;
  limit?: number;
  offset?: number;
  type?: string;
  pattern?: string;
  region?: string;
  services?: string;
  lata?: number;
  rateCenter?: string;
  city?: string;
  [key: string]: unknown;
}

export interface SearchResult {
  number: string;
  prefix?: string;
  city?: string;
  country?: string;
  lata?: number;
  monthlyRentalRate?: string;
  rateCenter?: string;
  region?: string;
  resourceUri?: string;
  restriction?: string;
  restrictionText?: string;
  setupRate?: string;
  smsEnabled?: boolean;
  smsRate?: string;
  type?: string;
  voiceEnabled?: boolean;
  voiceRate?: string;
}

export interface SearchPhoneNumberResponse {
  apiId: string;
  objects: SearchResult[];
  meta: Meta;
}

// --- Lookup ---

export interface LookupResponse {
  apiId?: string;
  phoneNumber?: string;
  country?: unknown;
  carrier?: unknown;
  format?: unknown;
  resourceUri?: string;
}

// --- PhoneNumberResource ---

export class PhoneNumberResource {
  private http: HttpTransport;
  private prefix: string;
  readonly lookup: LookupResource;

  constructor(http: HttpTransport, prefix: string) {
    this.http = http;
    this.prefix = prefix;
    this.lookup = new LookupResource(http);
  }

  async list(params?: ListPhoneNumberParams): Promise<PhoneNumberListResponse> {
    return this.http.request<PhoneNumberListResponse>(
      'GET',
      `${this.prefix}/Number/`,
      { params: params as Record<string, unknown> },
    );
  }

  async get(number: string): Promise<PhoneNumber> {
    return this.http.request<PhoneNumber>(
      'GET',
      `${this.prefix}/Number/${number}/`,
    );
  }

  async buy(number: string, params?: BuyPhoneNumberParams): Promise<BuyPhoneNumberResponse> {
    return this.http.request<BuyPhoneNumberResponse>(
      'POST',
      `${this.prefix}/PhoneNumber/${number}/`,
      params ? { data: params } : undefined,
    );
  }

  async update(number: string, params: UpdatePhoneNumberParams): Promise<UpdatePhoneNumberResponse> {
    return this.http.request<UpdatePhoneNumberResponse>(
      'POST',
      `${this.prefix}/Number/${number}/`,
      { data: params },
    );
  }

  async delete(number: string): Promise<null> {
    return this.http.request<null>(
      'DELETE',
      `${this.prefix}/Number/${number}/`,
    );
  }

  async search(params: SearchPhoneNumberParams): Promise<SearchPhoneNumberResponse> {
    return this.http.request<SearchPhoneNumberResponse>(
      'GET',
      `${this.prefix}/PhoneNumber/`,
      { params: params as Record<string, unknown> },
    );
  }
}

// --- LookupResource ---

class LookupResource {
  private http: HttpTransport;

  constructor(http: HttpTransport) {
    this.http = http;
  }

  async get(number: string, type = 'carrier'): Promise<LookupResponse> {
    return this.http.request<LookupResponse>(
      'GET',
      `/v1/Number/${number}`,
      { params: { type } },
    );
  }
}
