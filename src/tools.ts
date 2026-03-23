/**
 * Prebuilt tools -- ready-to-use tool definitions and handlers.
 *
 * Two categories:
 *
 * 1. Simple tools (customer-side, single-shot):
 *    - EndCall: LLM-driven graceful call ending
 *    - SendDtmfTool: LLM sends DTMF tones (IVR navigation)
 *    - WarmTransfer: Transfer to human with hold message
 *
 * 2. Agent tools (server-side sub-agents, multi-turn collection):
 *    - CollectEmail: Voice-optimized email collection
 *    - CollectAddress: Mailing address collection
 *    - CollectPhone: E.164 phone number collection
 *    - CollectName: First/middle/last name collection
 *    - CollectDOB: Date of birth collection
 *    - CollectDigits: PIN/account number collection
 *    - CollectCreditCard: Secure credit card detail collection
 *
 * Usage (simple tools):
 *
 *    import { EndCall, WarmTransfer } from '@plivo/agent';
 *
 *    const endCall = new EndCall();
 *    const transfer = new WarmTransfer({ destination: '+18005551234' });
 *
 *    const agent = await client.agents.create({
 *      agentName: 'My Agent',
 *      websocketUrl: 'wss://example.com/ws',
 *      llm: { tools: [endCall.tool, transfer.tool] },
 *    });
 *
 *    app.on('tool.called', (session, event) => {
 *      if (endCall.match(event)) endCall.handle(session, event);
 *      else if (transfer.match(event)) transfer.handle(session, event);
 *    });
 *
 * Usage (agent tools):
 *
 *    import { CollectEmail } from '@plivo/agent';
 *
 *    const collectEmail = new CollectEmail();
 *
 *    const agent = await client.agents.create({
 *      agentName: 'My Agent',
 *      websocketUrl: 'wss://example.com/ws',
 *      agentTools: [collectEmail.definition],
 *      llm: { systemPrompt: `... ${collectEmail.promptHint}` },
 *    });
 *
 *    app.on('agent_tool.completed', (session, event) => {
 *      if (event.agentToolType === 'collect_email') {
 *        console.log(event.result.emailAddress);
 *      }
 *    });
 */

import type { Session } from './session.js';
import type { ToolCallEvent } from './events.js';

// ---------------------------------------------------------------------------
// Simple tools (customer-side, single-shot)
// ---------------------------------------------------------------------------

/**
 * Prebuilt: lets the LLM end the call gracefully.
 *
 * The LLM decides when the conversation is done and invokes this tool.
 * The agent speaks a goodbye message, returns the tool result, then hangs up.
 */
export class EndCall {
  readonly tool: Record<string, unknown>;
  readonly instructions: string;
  private goodbyeMessage: string;

  constructor(goodbyeMessage: string = 'Thank you for calling. Goodbye!') {
    this.goodbyeMessage = goodbyeMessage;
    this.tool = {
      name: 'end_call',
      description:
        'End the call. Use when the conversation is complete, ' +
        'the user says goodbye, or there is nothing more to discuss.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Brief reason for ending the call',
          },
        },
        required: [],
      },
    };
    this.instructions =
      'When the conversation is complete or the user wants to end the call, ' +
      'use the end_call tool. Do not hang up without calling this tool first.';
  }

  match(event: ToolCallEvent): boolean {
    return event.name === 'end_call';
  }

  handle(session: Session, event: ToolCallEvent): string {
    const reason =
      (event.arguments as Record<string, unknown>)?.reason as string ||
      'conversation complete';
    session.speak(this.goodbyeMessage);
    session.sendToolResult(event.id, { status: 'ending', reason });
    session.hangup();
    return reason;
  }
}

/**
 * Prebuilt: lets the LLM send DTMF digits on the call.
 *
 * Useful when the agent needs to navigate IVR menus, enter PINs, or
 * interact with automated phone systems.
 *
 * Named SendDtmfTool to avoid collision with Session.sendDtmf.
 */
export class SendDtmfTool {
  readonly tool: Record<string, unknown>;
  readonly instructions: string;

  constructor() {
    this.tool = {
      name: 'send_dtmf',
      description:
        'Send DTMF digits on the call. Use to navigate IVR menus, ' +
        'enter PINs, or interact with automated phone systems. ' +
        'Digits can include 0-9, *, and #.',
      parameters: {
        type: 'object',
        properties: {
          digits: {
            type: 'string',
            description: "DTMF digits to send (e.g. '1', '123#', '*9')",
          },
        },
        required: ['digits'],
      },
    };
    this.instructions =
      'You can send DTMF tones using the send_dtmf tool. ' +
      'When navigating an IVR or phone menu, listen to the options ' +
      'and send the appropriate digit(s).';
  }

  match(event: ToolCallEvent): boolean {
    return event.name === 'send_dtmf';
  }

  handle(session: Session, event: ToolCallEvent): string {
    const digits =
      (event.arguments as Record<string, unknown>)?.digits as string || '';
    if (!digits) {
      session.sendToolError(event.id, 'No digits provided');
      return '';
    }
    session.sendDtmf(digits);
    session.sendToolResult(event.id, { status: 'sent', digits });
    return digits;
  }
}

export interface WarmTransferOptions {
  destination?: string | string[];
  holdMessage?: string;
  dialMode?: string;
  timeout?: number;
  toolName?: string;
}

/**
 * Prebuilt: lets the LLM initiate a warm transfer to a human agent.
 *
 * The LLM calls the transfer tool with a reason. The handler speaks a
 * hold message to the caller, then transfers the call.
 */
export class WarmTransfer {
  readonly tool: Record<string, unknown>;
  readonly instructions: string;
  private _toolName: string;
  private destination: string | string[];
  private holdMessage: string;
  private dialMode: string;
  private timeout: number;

  constructor(options?: WarmTransferOptions) {
    this._toolName = options?.toolName ?? 'transfer_to_human';
    this.destination = options?.destination ?? '';
    this.holdMessage =
      options?.holdMessage ??
      'Let me connect you with a specialist. One moment please.';
    this.dialMode = options?.dialMode ?? 'parallel';
    this.timeout = options?.timeout ?? 30;

    this.tool = {
      name: this._toolName,
      description:
        'Transfer the call to a human agent. Use when the user ' +
        'requests a human, or when you cannot resolve their issue.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Brief reason for the transfer',
          },
        },
        required: ['reason'],
      },
    };
    this.instructions =
      'If the user asks to speak with a human, a manager, or a real person, ' +
      'or if you cannot resolve their issue, use the transfer_to_human tool. ' +
      'Briefly explain why you are transferring before doing so.';
  }

  match(event: ToolCallEvent): boolean {
    return event.name === this._toolName;
  }

  handle(session: Session, event: ToolCallEvent): string {
    const reason =
      (event.arguments as Record<string, unknown>)?.reason as string ||
      'user requested transfer';
    if (this.holdMessage) {
      session.speak(this.holdMessage);
    }
    const dest = this.destination;
    if (!dest || (Array.isArray(dest) && dest.length === 0)) {
      session.sendToolError(event.id, 'No transfer destination configured');
      return '';
    }
    session.transfer(dest, this.dialMode, this.timeout);
    session.sendToolResult(event.id, { status: 'transferring', reason });
    return reason;
  }
}

// ---------------------------------------------------------------------------
// Agent tools (server-side sub-agents, multi-turn collection)
// ---------------------------------------------------------------------------

/**
 * Agent tool: collect and verify an email address via voice.
 *
 * Uses a server-side sub-agent for multi-turn collection with validation.
 */
export class CollectEmail {
  private _config: Record<string, unknown>;

  static readonly DEFAULT_ON_ENTER = 'Ask the user to provide their email address.';

  constructor(options?: {
    toolName?: string;
    toolDescription?: string;
    requireConfirmation?: boolean;
    onEnterMessage?: string;
    instructions?: string;
    timeoutS?: number;
  }) {
    this._config = {
      tool_name: options?.toolName ?? 'collect_email',
      tool_description:
        options?.toolDescription ?? 'Collect an email address from the user.',
      require_confirmation: options?.requireConfirmation ?? true,
      on_enter_message: options?.onEnterMessage ?? CollectEmail.DEFAULT_ON_ENTER,
      timeout_s: options?.timeoutS ?? 60.0,
    };
    if (options?.instructions) {
      this._config.instructions = options.instructions;
    }
  }

  get definition(): Record<string, unknown> {
    return { type: 'collect_email', config: { ...this._config } };
  }

  get promptHint(): string {
    return `When you need the user's email, use the ${this._config.tool_name} tool.`;
  }
}

/**
 * Agent tool: collect and verify a mailing address via voice.
 *
 * Handles international addresses from any country.
 */
export class CollectAddress {
  private _config: Record<string, unknown>;

  static readonly DEFAULT_ON_ENTER = 'Ask the user to provide their mailing address.';

  constructor(options?: {
    toolName?: string;
    toolDescription?: string;
    requireConfirmation?: boolean;
    onEnterMessage?: string;
    instructions?: string;
    timeoutS?: number;
  }) {
    this._config = {
      tool_name: options?.toolName ?? 'collect_address',
      tool_description:
        options?.toolDescription ?? 'Collect a mailing address from the user.',
      require_confirmation: options?.requireConfirmation ?? true,
      on_enter_message:
        options?.onEnterMessage ?? CollectAddress.DEFAULT_ON_ENTER,
      timeout_s: options?.timeoutS ?? 60.0,
    };
    if (options?.instructions) {
      this._config.instructions = options.instructions;
    }
  }

  get definition(): Record<string, unknown> {
    return { type: 'collect_address', config: { ...this._config } };
  }

  get promptHint(): string {
    return `When you need the user's address, use the ${this._config.tool_name} tool.`;
  }
}

/**
 * Agent tool: collect a sequence of digits via DTMF or voice.
 *
 * Supports both keypad tones and spoken digits.
 */
export class CollectDigits {
  private _config: Record<string, unknown>;

  static readonly DEFAULT_ON_ENTER = 'Ask the user to provide the digits.';

  constructor(options?: {
    numDigits?: number;
    label?: string;
    toolName?: string;
    toolDescription?: string;
    requireConfirmation?: boolean;
    onEnterMessage?: string;
    instructions?: string;
    timeoutS?: number;
  }) {
    const label = options?.label ?? 'digits';
    this._config = {
      tool_name: options?.toolName ?? 'collect_digits',
      tool_description:
        options?.toolDescription ?? `Collect ${label} from the user.`,
      num_digits: options?.numDigits ?? 0,
      label,
      require_confirmation: options?.requireConfirmation ?? true,
      on_enter_message:
        options?.onEnterMessage ?? `Ask the user to provide their ${label}.`,
      timeout_s: options?.timeoutS ?? 60.0,
    };
    if (options?.instructions) {
      this._config.instructions = options.instructions;
    }
  }

  get definition(): Record<string, unknown> {
    return { type: 'collect_digits', config: { ...this._config } };
  }

  get promptHint(): string {
    const label = this._config.label || 'digits';
    return `When you need the user's ${label}, use the ${this._config.tool_name} tool.`;
  }
}

/**
 * Agent tool: collect and verify a phone number via voice.
 *
 * Validates format via regex, strips formatting, reads back in groups.
 */
export class CollectPhone {
  private _config: Record<string, unknown>;

  static readonly DEFAULT_ON_ENTER = 'Ask the user to provide their phone number.';

  constructor(options?: {
    toolName?: string;
    toolDescription?: string;
    requireConfirmation?: boolean;
    onEnterMessage?: string;
    extraInstructions?: string;
    instructions?: string;
    timeoutS?: number;
  }) {
    this._config = {
      tool_name: options?.toolName ?? 'collect_phone',
      tool_description:
        options?.toolDescription ?? 'Collect a phone number from the user.',
      require_confirmation: options?.requireConfirmation ?? true,
      on_enter_message:
        options?.onEnterMessage ?? CollectPhone.DEFAULT_ON_ENTER,
      timeout_s: options?.timeoutS ?? 60.0,
    };
    if (options?.extraInstructions) {
      this._config.extra_instructions = options.extraInstructions;
    }
    if (options?.instructions) {
      this._config.instructions = options.instructions;
    }
  }

  get definition(): Record<string, unknown> {
    return { type: 'collect_phone', config: { ...this._config } };
  }

  get promptHint(): string {
    return `When you need the user's phone number, use the ${this._config.tool_name} tool.`;
  }
}

/**
 * Agent tool: collect and verify a person's name via voice.
 *
 * Configurable name parts: first, middle, last. Supports verifySpelling.
 */
export class CollectName {
  private _config: Record<string, unknown>;

  constructor(options?: {
    firstName?: boolean;
    lastName?: boolean;
    middleName?: boolean;
    nameFormat?: string;
    verifySpelling?: boolean;
    toolName?: string;
    toolDescription?: string;
    requireConfirmation?: boolean;
    onEnterMessage?: string;
    extraInstructions?: string;
    instructions?: string;
    timeoutS?: number;
  }) {
    this._config = {
      tool_name: options?.toolName ?? 'collect_name',
      tool_description:
        options?.toolDescription ?? "Collect the user's name.",
      first_name: options?.firstName ?? true,
      last_name: options?.lastName ?? false,
      middle_name: options?.middleName ?? false,
      verify_spelling: options?.verifySpelling ?? false,
      require_confirmation: options?.requireConfirmation ?? true,
      timeout_s: options?.timeoutS ?? 60.0,
    };
    if (options?.nameFormat) {
      this._config.name_format = options.nameFormat;
    }
    if (options?.onEnterMessage) {
      this._config.on_enter_message = options.onEnterMessage;
    }
    if (options?.extraInstructions) {
      this._config.extra_instructions = options.extraInstructions;
    }
    if (options?.instructions) {
      this._config.instructions = options.instructions;
    }
  }

  get definition(): Record<string, unknown> {
    return { type: 'collect_name', config: { ...this._config } };
  }

  get promptHint(): string {
    return `When you need the user's name, use the ${this._config.tool_name} tool.`;
  }
}

/**
 * Agent tool: collect and verify a date of birth via voice.
 *
 * Validates the date is real and not in the future. Optionally collects time.
 */
export class CollectDOB {
  private _config: Record<string, unknown>;

  constructor(options?: {
    includeTime?: boolean;
    toolName?: string;
    toolDescription?: string;
    requireConfirmation?: boolean;
    onEnterMessage?: string;
    extraInstructions?: string;
    instructions?: string;
    timeoutS?: number;
  }) {
    this._config = {
      tool_name: options?.toolName ?? 'collect_dob',
      tool_description:
        options?.toolDescription ?? "Collect the user's date of birth.",
      include_time: options?.includeTime ?? false,
      require_confirmation: options?.requireConfirmation ?? true,
      timeout_s: options?.timeoutS ?? 60.0,
    };
    if (options?.onEnterMessage) {
      this._config.on_enter_message = options.onEnterMessage;
    }
    if (options?.extraInstructions) {
      this._config.extra_instructions = options.extraInstructions;
    }
    if (options?.instructions) {
      this._config.instructions = options.instructions;
    }
  }

  get definition(): Record<string, unknown> {
    return { type: 'collect_dob', config: { ...this._config } };
  }

  get promptHint(): string {
    return `When you need the user's date of birth, use the ${this._config.tool_name} tool.`;
  }
}

/**
 * Agent tool: collect credit card details via voice (security-first).
 *
 * Uses sequential sub-tasks: cardholder name, card number, security code,
 * expiration date. Supports restart and decline at any point.
 */
export class CollectCreditCard {
  private _config: Record<string, unknown>;

  constructor(options?: {
    toolName?: string;
    toolDescription?: string;
    requireConfirmation?: boolean;
    onEnterMessage?: string;
    timeoutS?: number;
  }) {
    this._config = {
      tool_name: options?.toolName ?? 'collect_credit_card',
      tool_description:
        options?.toolDescription ?? 'Collect credit card details from the user.',
      require_confirmation: options?.requireConfirmation ?? true,
      timeout_s: options?.timeoutS ?? 120.0,
    };
    if (options?.onEnterMessage) {
      this._config.on_enter_message = options.onEnterMessage;
    }
  }

  get definition(): Record<string, unknown> {
    return { type: 'collect_credit_card', config: { ...this._config } };
  }

  get promptHint(): string {
    return `When you need the user's credit card, use the ${this._config.tool_name} tool.`;
  }
}
