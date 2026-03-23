import { describe, test, expect } from 'bun:test';
import {
  EndCall,
  SendDtmfTool,
  WarmTransfer,
  CollectEmail,
  CollectAddress,
  CollectDigits,
  CollectPhone,
  CollectName,
  CollectDOB,
  CollectCreditCard,
} from '../src/tools.js';

// ---------------------------------------------------------------------------
// EndCall
// ---------------------------------------------------------------------------

describe('EndCall', () => {
  test('constructor uses default goodbye message', () => {
    const ec = new EndCall();
    expect(ec.tool.name).toBe('end_call');
    expect(ec.instructions).toBeTruthy();
  });

  test('constructor accepts custom goodbye message', () => {
    const ec = new EndCall('See ya!');
    // The goodbye message is private, but we can verify the tool schema is still correct
    expect(ec.tool.name).toBe('end_call');
  });

  test('match returns true for end_call event', () => {
    const ec = new EndCall();
    const event = { type: 'tool.called' as const, id: 'tc-1', name: 'end_call', arguments: {} };
    expect(ec.match(event)).toBe(true);
  });

  test('match returns false for other events', () => {
    const ec = new EndCall();
    const event = { type: 'tool.called' as const, id: 'tc-1', name: 'something_else', arguments: {} };
    expect(ec.match(event)).toBe(false);
  });

  test('tool schema has correct name and parameters', () => {
    const ec = new EndCall();
    expect(ec.tool.name).toBe('end_call');
    const params = ec.tool.parameters as Record<string, unknown>;
    expect(params.type).toBe('object');
    const props = (params.properties as Record<string, unknown>);
    expect(props).toHaveProperty('reason');
  });
});

// ---------------------------------------------------------------------------
// SendDtmfTool
// ---------------------------------------------------------------------------

describe('SendDtmfTool', () => {
  test('constructor sets correct tool name', () => {
    const dt = new SendDtmfTool();
    expect(dt.tool.name).toBe('send_dtmf');
    expect(dt.instructions).toBeTruthy();
  });

  test('match returns true for send_dtmf event', () => {
    const dt = new SendDtmfTool();
    const event = { type: 'tool.called' as const, id: 'tc-1', name: 'send_dtmf', arguments: {} };
    expect(dt.match(event)).toBe(true);
  });

  test('match returns false for other events', () => {
    const dt = new SendDtmfTool();
    const event = { type: 'tool.called' as const, id: 'tc-1', name: 'end_call', arguments: {} };
    expect(dt.match(event)).toBe(false);
  });

  test('tool schema requires digits parameter', () => {
    const dt = new SendDtmfTool();
    const params = dt.tool.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toContain('digits');
  });
});

// ---------------------------------------------------------------------------
// WarmTransfer
// ---------------------------------------------------------------------------

describe('WarmTransfer', () => {
  test('constructor uses defaults', () => {
    const wt = new WarmTransfer();
    expect(wt.tool.name).toBe('transfer_to_human');
    expect(wt.instructions).toBeTruthy();
  });

  test('constructor accepts custom options', () => {
    const wt = new WarmTransfer({
      destination: '+18005551234',
      holdMessage: 'Please hold.',
      dialMode: 'sequential',
      timeout: 60,
      toolName: 'connect_agent',
    });
    expect(wt.tool.name).toBe('connect_agent');
  });

  test('match returns true for default tool name', () => {
    const wt = new WarmTransfer();
    const event = { type: 'tool.called' as const, id: 'tc-1', name: 'transfer_to_human', arguments: {} };
    expect(wt.match(event)).toBe(true);
  });

  test('match uses custom toolName', () => {
    const wt = new WarmTransfer({ toolName: 'connect_agent' });
    const eventMatch = { type: 'tool.called' as const, id: 'tc-1', name: 'connect_agent', arguments: {} };
    const eventNoMatch = { type: 'tool.called' as const, id: 'tc-2', name: 'transfer_to_human', arguments: {} };
    expect(wt.match(eventMatch)).toBe(true);
    expect(wt.match(eventNoMatch)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CollectEmail
// ---------------------------------------------------------------------------

describe('CollectEmail', () => {
  test('defaults are correct', () => {
    const ce = new CollectEmail();
    const def = ce.definition;
    expect(def.type).toBe('collect_email');
    const config = def.config as Record<string, unknown>;
    expect(config.tool_name).toBe('collect_email');
    expect(config.require_confirmation).toBe(true);
    expect(config.timeout_s).toBe(60.0);
  });

  test('custom options override defaults', () => {
    const ce = new CollectEmail({
      toolName: 'get_email',
      toolDescription: 'Get email',
      requireConfirmation: false,
      onEnterMessage: 'Email please.',
      instructions: 'custom instructions',
      timeoutS: 90,
    });
    const config = ce.definition.config as Record<string, unknown>;
    expect(config.tool_name).toBe('get_email');
    expect(config.tool_description).toBe('Get email');
    expect(config.require_confirmation).toBe(false);
    expect(config.on_enter_message).toBe('Email please.');
    expect(config.instructions).toBe('custom instructions');
    expect(config.timeout_s).toBe(90);
  });

  test('definition returns correct type and config', () => {
    const ce = new CollectEmail();
    const def = ce.definition;
    expect(def.type).toBe('collect_email');
    expect(def.config).toBeDefined();
  });

  test('promptHint is non-empty', () => {
    const ce = new CollectEmail();
    expect(ce.promptHint).toBeTruthy();
    expect(ce.promptHint.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CollectAddress
// ---------------------------------------------------------------------------

describe('CollectAddress', () => {
  test('defaults are correct', () => {
    const ca = new CollectAddress();
    const def = ca.definition;
    expect(def.type).toBe('collect_address');
    const config = def.config as Record<string, unknown>;
    expect(config.tool_name).toBe('collect_address');
    expect(config.require_confirmation).toBe(true);
    expect(config.timeout_s).toBe(60.0);
  });

  test('custom options override defaults', () => {
    const ca = new CollectAddress({
      toolName: 'get_address',
      toolDescription: 'Get address',
      requireConfirmation: false,
      onEnterMessage: 'Address please.',
      instructions: 'custom instructions',
      timeoutS: 120,
    });
    const config = ca.definition.config as Record<string, unknown>;
    expect(config.tool_name).toBe('get_address');
    expect(config.require_confirmation).toBe(false);
    expect(config.timeout_s).toBe(120);
  });

  test('definition returns correct type and config', () => {
    const ca = new CollectAddress();
    const def = ca.definition;
    expect(def.type).toBe('collect_address');
    expect(def.config).toBeDefined();
  });

  test('promptHint is non-empty', () => {
    const ca = new CollectAddress();
    expect(ca.promptHint).toBeTruthy();
    expect(ca.promptHint.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CollectDigits
// ---------------------------------------------------------------------------

describe('CollectDigits', () => {
  test('with numDigits and label', () => {
    const cd = new CollectDigits({ numDigits: 4, label: 'PIN' });
    const config = cd.definition.config as Record<string, unknown>;
    expect(config.num_digits).toBe(4);
    expect(config.label).toBe('PIN');
    expect(config.tool_name).toBe('collect_digits');
  });

  test('default label is digits', () => {
    const cd = new CollectDigits({ numDigits: 6 });
    const config = cd.definition.config as Record<string, unknown>;
    expect(config.label).toBe('digits');
  });

  test('definition returns correct type', () => {
    const cd = new CollectDigits({ numDigits: 4, label: 'PIN' });
    expect(cd.definition.type).toBe('collect_digits');
  });

  test('promptHint is non-empty', () => {
    const cd = new CollectDigits({ numDigits: 4, label: 'PIN' });
    expect(cd.promptHint).toBeTruthy();
    expect(cd.promptHint.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CollectPhone
// ---------------------------------------------------------------------------

describe('CollectPhone', () => {
  test('defaults are correct', () => {
    const cp = new CollectPhone();
    const config = cp.definition.config as Record<string, unknown>;
    expect(config.tool_name).toBe('collect_phone');
    expect(config.require_confirmation).toBe(true);
    expect(config.timeout_s).toBe(60.0);
  });

  test('custom options override defaults', () => {
    const cp = new CollectPhone({
      toolName: 'get_phone',
      toolDescription: 'Get phone',
      requireConfirmation: false,
      onEnterMessage: 'Phone please.',
      extraInstructions: 'extra',
      instructions: 'custom',
      timeoutS: 90,
    });
    const config = cp.definition.config as Record<string, unknown>;
    expect(config.tool_name).toBe('get_phone');
    expect(config.require_confirmation).toBe(false);
    expect(config.extra_instructions).toBe('extra');
    expect(config.timeout_s).toBe(90);
  });

  test('definition returns correct type', () => {
    const cp = new CollectPhone();
    expect(cp.definition.type).toBe('collect_phone');
  });

  test('promptHint is non-empty', () => {
    const cp = new CollectPhone();
    expect(cp.promptHint).toBeTruthy();
    expect(cp.promptHint.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CollectName
// ---------------------------------------------------------------------------

describe('CollectName', () => {
  test('with name config fields', () => {
    const cn = new CollectName({
      firstName: true,
      lastName: true,
      middleName: false,
      verifySpelling: false,
    });
    const config = cn.definition.config as Record<string, unknown>;
    expect(config.first_name).toBe(true);
    expect(config.last_name).toBe(true);
    expect(config.middle_name).toBe(false);
    expect(config.verify_spelling).toBe(false);
    expect(config.tool_name).toBe('collect_name');
  });

  test('definition returns correct type', () => {
    const cn = new CollectName();
    expect(cn.definition.type).toBe('collect_name');
  });

  test('promptHint is non-empty', () => {
    const cn = new CollectName();
    expect(cn.promptHint).toBeTruthy();
    expect(cn.promptHint.length).toBeGreaterThan(0);
  });

  test('custom options override defaults', () => {
    const cn = new CollectName({
      firstName: true,
      lastName: true,
      middleName: true,
      verifySpelling: true,
      toolName: 'get_name',
      nameFormat: 'first_last',
      requireConfirmation: false,
      timeoutS: 120,
    });
    const config = cn.definition.config as Record<string, unknown>;
    expect(config.tool_name).toBe('get_name');
    expect(config.name_format).toBe('first_last');
    expect(config.require_confirmation).toBe(false);
    expect(config.timeout_s).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// CollectDOB
// ---------------------------------------------------------------------------

describe('CollectDOB', () => {
  test('with includeTime false', () => {
    const cd = new CollectDOB({ includeTime: false });
    const config = cd.definition.config as Record<string, unknown>;
    expect(config.include_time).toBe(false);
    expect(config.tool_name).toBe('collect_dob');
    expect(config.require_confirmation).toBe(true);
    expect(config.timeout_s).toBe(60.0);
  });

  test('with includeTime true', () => {
    const cd = new CollectDOB({ includeTime: true });
    const config = cd.definition.config as Record<string, unknown>;
    expect(config.include_time).toBe(true);
  });

  test('definition returns correct type', () => {
    const cd = new CollectDOB();
    expect(cd.definition.type).toBe('collect_dob');
  });

  test('promptHint is non-empty', () => {
    const cd = new CollectDOB();
    expect(cd.promptHint).toBeTruthy();
    expect(cd.promptHint.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CollectCreditCard
// ---------------------------------------------------------------------------

describe('CollectCreditCard', () => {
  test('defaults have timeoutS 120', () => {
    const cc = new CollectCreditCard();
    const config = cc.definition.config as Record<string, unknown>;
    expect(config.tool_name).toBe('collect_credit_card');
    expect(config.require_confirmation).toBe(true);
    expect(config.timeout_s).toBe(120.0);
  });

  test('definition returns correct type', () => {
    const cc = new CollectCreditCard();
    expect(cc.definition.type).toBe('collect_credit_card');
  });

  test('promptHint is non-empty', () => {
    const cc = new CollectCreditCard();
    expect(cc.promptHint).toBeTruthy();
    expect(cc.promptHint.length).toBeGreaterThan(0);
  });

  test('custom options override defaults', () => {
    const cc = new CollectCreditCard({
      toolName: 'pay',
      toolDescription: 'Pay now',
      requireConfirmation: false,
      onEnterMessage: 'Card please.',
      timeoutS: 180,
    });
    const config = cc.definition.config as Record<string, unknown>;
    expect(config.tool_name).toBe('pay');
    expect(config.tool_description).toBe('Pay now');
    expect(config.require_confirmation).toBe(false);
    expect(config.on_enter_message).toBe('Card please.');
    expect(config.timeout_s).toBe(180);
  });
});
