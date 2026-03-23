/**
 * SMS & MMS Examples -- Text and Media Messages
 *
 * Demonstrates sending SMS (text only) and MMS (with media attachments)
 * using the Plivo Agent SDK.
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN env vars
 *   3. npx tsx examples/send-sms.ts [sms | mms | mms-multi]
 */

import { PlivoAgentClient } from '../src/index.js';

const SRC = '+14155551234'; // your Plivo number
const DST = '+14155559876'; // recipient

// --- SMS: plain text ---

async function sendSms() {
  const client = new PlivoAgentClient();
  const response = await client.messages.create({
    src: SRC,
    dst: DST,
    text: 'Hello from the Plivo Agent SDK!',
  });
  console.log('SMS sent:', response.messageUuid);
}

// --- MMS: single image ---

async function sendMms() {
  const client = new PlivoAgentClient();
  const response = await client.messages.create({
    src: SRC,
    dst: DST,
    text: 'Check out this image!',
    type: 'mms',
    mediaUrls: ['https://media.plivo.com/demo/image-sample.jpg'],
  });
  console.log('MMS sent:', response.messageUuid);
}

// --- MMS: multiple media (image + PDF) ---

async function sendMmsMulti() {
  const client = new PlivoAgentClient();
  const response = await client.messages.create({
    src: SRC,
    dst: DST,
    text: 'Here are your documents.',
    type: 'mms',
    mediaUrls: [
      'https://media.plivo.com/demo/image-sample.jpg',
      'https://media.plivo.com/demo/invoice.pdf',
    ],
  });
  console.log('MMS (multi) sent:', response.messageUuid);
}

// --- Run ---

const examples: Record<string, () => Promise<void>> = {
  sms: sendSms,
  mms: sendMms,
  'mms-multi': sendMmsMulti,
};

const choice = process.argv[2] ?? 'sms';
const fn = examples[choice];

if (!fn) {
  console.log(`Usage: npx tsx examples/send-sms.ts [${Object.keys(examples).join(' | ')}]`);
  process.exit(1);
}

fn().catch(console.error);
