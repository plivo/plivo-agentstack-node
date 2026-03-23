import { HttpTransport } from './http.js';
import type { Meta } from './types.js';

// --- CreateMessage ---

export interface CreateMessageParams {
  dst: string;
  src?: string;
  text?: string;
  type?: string;
  url?: string;
  method?: string;
  mediaUrls?: string[];
  mediaIds?: string[];
  powerpackUuid?: string;
  template?: Record<string, unknown>;
  interactive?: Record<string, unknown>;
  location?: Record<string, unknown>;
  log?: boolean;
  trackable?: boolean;
  messageExpiry?: number;
  dltEntityId?: string;
  dltTemplateId?: string;
  dltTemplateCategory?: string;
  [key: string]: unknown;
}

export interface CreateMessageResponse {
  apiId: string;
  message: string;
  messageUuid: string[];
}

export interface MessageRecord {
  apiId?: string;
  errorCode?: string;
  fromNumber?: string;
  toNumber?: string;
  messageDirection?: string;
  messageState?: string;
  messageType?: string;
  messageUuid?: string;
  messageTime?: string;
  resourceUri?: string;
  totalAmount?: string;
  totalRate?: string;
  units?: number;
  powerpackId?: string;
  requesterIp?: unknown;
}

export interface ListMessageParams {
  limit?: number;
  offset?: number;
  messageDirection?: string;
  messageState?: string;
  messageType?: string;
  messageTimeGt?: string;
  messageTimeGte?: string;
  messageTimeLt?: string;
  messageTimeLte?: string;
  subaccount?: string;
  errorCode?: number;
  powerpackId?: string;
  fromNumber?: string;
  toNumber?: string;
  conversationId?: string;
  conversationOrigin?: string;
  [key: string]: unknown;
}

export interface MessageListResponse {
  apiId: string;
  objects: MessageRecord[];
  meta: Meta;
}

export interface MediaListResponse {
  apiId: string;
  objects: unknown[];
}

// --- MessagingResource ---

export class MessagingResource {
  private http: HttpTransport;
  private prefix: string;

  constructor(http: HttpTransport, prefix: string) {
    this.http = http;
    this.prefix = prefix;
  }

  async create(params: CreateMessageParams): Promise<CreateMessageResponse> {
    return this.http.request<CreateMessageResponse>(
      'POST',
      `${this.prefix}/Message/`,
      { data: params },
    );
  }

  async get(messageUuid: string): Promise<MessageRecord> {
    return this.http.request<MessageRecord>(
      'GET',
      `${this.prefix}/Message/${messageUuid}/`,
    );
  }

  async list(params?: ListMessageParams): Promise<MessageListResponse> {
    // Remap time filter fields to use double-underscore names expected by the API.
    // The transport's camelToSnake transform would produce single underscores,
    // but the Plivo API uses Django-style double-underscore lookups.
    let rawParams: Record<string, unknown> | undefined;
    if (params) {
      const { messageTimeGt, messageTimeGte, messageTimeLt, messageTimeLte, ...rest } = params;
      rawParams = { ...rest } as Record<string, unknown>;
      if (messageTimeGt !== undefined) rawParams['message_time__gt'] = messageTimeGt;
      if (messageTimeGte !== undefined) rawParams['message_time__gte'] = messageTimeGte;
      if (messageTimeLt !== undefined) rawParams['message_time__lt'] = messageTimeLt;
      if (messageTimeLte !== undefined) rawParams['message_time__lte'] = messageTimeLte;
    }
    return this.http.request<MessageListResponse>(
      'GET',
      `${this.prefix}/Message/`,
      { params: rawParams },
    );
  }

  async listMedia(messageUuid: string): Promise<MediaListResponse> {
    return this.http.request<MediaListResponse>(
      'GET',
      `${this.prefix}/Message/${messageUuid}/Media/`,
    );
  }
}

// --- Template builder ---

export class Template {
  private _name: string;
  private _language: string;
  private _headerParams: Record<string, unknown>[] = [];
  private _bodyParams: Record<string, unknown>[] = [];
  private _buttonParams: Record<string, unknown>[] = [];

  constructor(name: string, language = 'en') {
    this._name = name;
    this._language = language;
  }

  addHeaderParam(value: string): this {
    this._headerParams.push({ type: 'text', text: value });
    return this;
  }

  addHeaderMedia(url: string): this {
    this._headerParams.push({ type: 'media', media: url });
    return this;
  }

  addBodyParam(value: string): this {
    this._bodyParams.push({ type: 'text', text: value });
    return this;
  }

  addBodyCurrency(fallback: string, code: string, amount1000: number): this {
    this._bodyParams.push({
      type: 'currency',
      currency: {
        fallback_value: fallback,
        code,
        amount_1000: amount1000,
      },
    });
    return this;
  }

  addBodyDatetime(fallback: string): this {
    this._bodyParams.push({
      type: 'date_time',
      date_time: { fallback_value: fallback },
    });
    return this;
  }

  addButtonParam(subType: string, index: number, value: string): this {
    this._buttonParams.push({
      type: 'button',
      sub_type: subType,
      index: String(index),
      parameters: [{ type: 'text', text: value }],
    });
    return this;
  }

  build(): Record<string, unknown> {
    const components: Record<string, unknown>[] = [];

    if (this._headerParams.length > 0) {
      components.push({ type: 'header', parameters: this._headerParams });
    }
    if (this._bodyParams.length > 0) {
      components.push({ type: 'body', parameters: this._bodyParams });
    }
    components.push(...this._buttonParams);

    const payload: Record<string, unknown> = {
      name: this._name,
      language: this._language,
    };
    if (components.length > 0) {
      payload.components = components;
    }
    return payload;
  }
}

// --- Interactive message builders ---

export interface ButtonDef {
  id: string;
  title: string;
}

export interface SectionDef {
  title: string;
  rows: { id: string; title: string; description?: string }[];
}

export class InteractiveMessage {
  static button(
    bodyText: string,
    buttons: ButtonDef[],
    options?: { header?: Record<string, unknown>; footerText?: string },
  ): Record<string, unknown> {
    const actionButtons = buttons.map((b) => ({
      type: 'reply',
      reply: { id: b.id, title: b.title },
    }));

    const payload: Record<string, unknown> = {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: actionButtons },
    };

    if (options?.header) payload.header = options.header;
    if (options?.footerText) payload.footer = { text: options.footerText };

    return payload;
  }

  static list(
    bodyText: string,
    buttonText: string,
    sections: SectionDef[],
    options?: { headerText?: string; footerText?: string },
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      type: 'list',
      body: { text: bodyText },
      action: { button: buttonText, sections },
    };

    if (options?.headerText) {
      payload.header = { type: 'text', text: options.headerText };
    }
    if (options?.footerText) payload.footer = { text: options.footerText };

    return payload;
  }

  static ctaUrl(
    bodyText: string,
    buttonTitle: string,
    url: string,
    options?: { header?: Record<string, unknown>; footerText?: string },
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      type: 'cta_url',
      body: { text: bodyText },
      action: {
        buttons: [{ type: 'cta_url', title: buttonTitle, url }],
      },
    };

    if (options?.header) payload.header = options.header;
    if (options?.footerText) payload.footer = { text: options.footerText };

    return payload;
  }
}

// --- Location builder ---

export class Location {
  static build(
    latitude: number,
    longitude: number,
    options?: { name?: string; address?: string },
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = { latitude, longitude };
    if (options?.name !== undefined) payload.name = options.name;
    if (options?.address !== undefined) payload.address = options.address;
    return payload;
  }
}
