/**
 * WhatsApp Examples -- All Message Types
 *
 * Demonstrates every WhatsApp message type supported by the SDK:
 * text, media, template, interactive buttons, list, CTA URL, and location.
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN env vars
 *   3. npx tsx examples/whatsapp.ts [text | media | template | buttons | list | cta | location]
 */

import {
  PlivoAgentClient,
  Template,
  InteractiveMessage,
  Location,
} from '../src/index.js';

const SRC = '+14155551234'; // your WhatsApp Business number
const DST = '+14155559876'; // recipient

// --- Text message ---

async function sendText() {
  const client = new PlivoAgentClient();
  const response = await client.messages.create({
    src: SRC,
    dst: DST,
    type: 'whatsapp',
    text: 'Hello from the Plivo Agent SDK!',
  });
  console.log('Text sent:', response.messageUuid);
}

// --- Media message (image with caption) ---

async function sendMedia() {
  const client = new PlivoAgentClient();
  const response = await client.messages.create({
    src: SRC,
    dst: DST,
    type: 'whatsapp',
    text: 'Here is your receipt.',
    mediaUrls: ['https://media.plivo.com/demo/image-sample.jpg'],
  });
  console.log('Media sent:', response.messageUuid);
}

// --- Template message (with body params, currency, datetime, button) ---

async function sendTemplate() {
  const tpl = new Template('order_confirmation', 'en')
    .addHeaderMedia('https://media.plivo.com/demo/banner.jpg')
    .addBodyParam('Alice')
    .addBodyParam('ORD-42')
    .addBodyCurrency('$12.99', 'USD', 12990)
    .addBodyDatetime('2026-03-07T10:30:00Z')
    .addButtonParam('url', 0, 'https://example.com/track/ORD-42')
    .build();

  const client = new PlivoAgentClient();
  const response = await client.messages.create({
    src: SRC,
    dst: DST,
    type: 'whatsapp',
    template: tpl,
  });
  console.log('Template sent:', response.messageUuid);
}

// --- Interactive: quick reply buttons ---

async function sendButtons() {
  const interactive = InteractiveMessage.button(
    'How would you rate your experience?',
    [
      { id: 'great', title: 'Great' },
      { id: 'okay', title: 'Okay' },
      { id: 'poor', title: 'Poor' },
    ],
    {
      header: { type: 'text', text: 'Feedback' },
      footerText: 'Powered by Plivo',
    },
  );

  const client = new PlivoAgentClient();
  const response = await client.messages.create({
    src: SRC,
    dst: DST,
    type: 'whatsapp',
    interactive,
  });
  console.log('Buttons sent:', response.messageUuid);
}

// --- Interactive: list message ---

async function sendList() {
  const interactive = InteractiveMessage.list(
    'Browse our menu and pick your favorite.',
    'View Menu',
    [
      {
        title: 'Pizza',
        rows: [
          { id: 'margherita', title: 'Margherita', description: '$10' },
          { id: 'pepperoni', title: 'Pepperoni', description: '$12' },
        ],
      },
      {
        title: 'Sides',
        rows: [
          { id: 'fries', title: 'Fries', description: '$4' },
          { id: 'salad', title: 'Garden Salad', description: '$6' },
        ],
      },
    ],
    {
      headerText: "Mario's Pizza",
      footerText: 'Prices include tax',
    },
  );

  const client = new PlivoAgentClient();
  const response = await client.messages.create({
    src: SRC,
    dst: DST,
    type: 'whatsapp',
    interactive,
  });
  console.log('List sent:', response.messageUuid);
}

// --- Interactive: CTA URL ---

async function sendCta() {
  const interactive = InteractiveMessage.ctaUrl(
    'Track your order in real time.',
    'Track Order',
    'https://example.com/track/ORD-42',
    { footerText: 'Powered by Plivo' },
  );

  const client = new PlivoAgentClient();
  const response = await client.messages.create({
    src: SRC,
    dst: DST,
    type: 'whatsapp',
    interactive,
  });
  console.log('CTA sent:', response.messageUuid);
}

// --- Location message ---

async function sendLocation() {
  const location = Location.build(37.7749, -122.4194, {
    name: 'Plivo HQ',
    address: '201 Spear St, San Francisco, CA 94105',
  });

  const client = new PlivoAgentClient();
  const response = await client.messages.create({
    src: SRC,
    dst: DST,
    type: 'whatsapp',
    location,
  });
  console.log('Location sent:', response.messageUuid);
}

// --- Run ---

const examples: Record<string, () => Promise<void>> = {
  text: sendText,
  media: sendMedia,
  template: sendTemplate,
  buttons: sendButtons,
  list: sendList,
  cta: sendCta,
  location: sendLocation,
};

const choice = process.argv[2] ?? 'text';
const fn = examples[choice];

if (!fn) {
  console.log(`Usage: npx tsx examples/whatsapp.ts [${Object.keys(examples).join(' | ')}]`);
  process.exit(1);
}

fn().catch(console.error);
