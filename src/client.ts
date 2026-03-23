import { HttpTransport, type TransportOptions } from './http.js';
import { AgentResource } from './agent.js';
import { CallResource } from './call.js';
import { NumberResource } from './number.js';
import { SessionResource } from './session-resource.js';
import { MessagingResource } from './messaging.js';
import { PhoneNumberResource } from './phone-number.js';

export interface ClientOptions extends TransportOptions {}

/**
 * Plivo Agent client — entry point for the REST API.
 *
 * Sub-resources:
 *   .agents       — Agent CRUD (create/get/list/update/delete)
 *   .calls        — Call management (initiate/connect/dial)
 *   .numbers      — Agent number assignment (assign/list/unassign)
 *   .sessions     — Session history (list/get)
 *   .messages     — Messaging (SMS/MMS/WhatsApp)
 *   .phoneNumbers — Phone number management (search/buy/update/delete/lookup)
 */
export class PlivoAgentClient {
  readonly agents: AgentResource;
  readonly calls: CallResource;
  readonly numbers: NumberResource;
  readonly sessions: SessionResource;
  readonly messages: MessagingResource;
  readonly phoneNumbers: PhoneNumberResource;

  private http: HttpTransport;

  constructor(authId?: string, authToken?: string, options?: ClientOptions) {
    const _authId = authId || process.env.PLIVO_AUTH_ID || '';
    const _authToken = authToken || process.env.PLIVO_AUTH_TOKEN || '';

    if (!_authId || !_authToken) {
      throw new Error(
        'authId and authToken are required. Pass them directly or set PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN env vars.',
      );
    }

    this.http = new HttpTransport(_authId, _authToken, options);
    const prefix = `/v1/Account/${_authId}`;

    this.agents = new AgentResource(this.http, prefix);
    this.calls = new CallResource(this.http, prefix);
    this.numbers = new NumberResource(this.http, prefix);
    this.sessions = new SessionResource(this.http, prefix);
    this.messages = new MessagingResource(this.http, prefix);
    this.phoneNumbers = new PhoneNumberResource(this.http, prefix);
  }
}
