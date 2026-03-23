/**
 * Search for available phone numbers and buy one.
 *
 * Usage:
 *   1. npm install
 *   2. Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN env vars
 *   3. npx tsx examples/buy-number.ts
 */

import { PlivoAgentClient } from '../src/index.js';

async function main() {
  const client = new PlivoAgentClient();

  // Search for available US local numbers
  const results = await client.phoneNumbers.search({
    countryIso: 'US',
    type: 'local',
    limit: 5,
  });

  const numbers = results.objects;
  if (!numbers || numbers.length === 0) {
    console.log('No numbers available.');
    return;
  }

  console.log('Available numbers:');
  for (const num of numbers) {
    console.log(`  ${num.number}  (${num.region ?? 'N/A'})`);
  }

  // Buy the first available number
  const first = numbers[0].number;
  console.log(`\nBuying ${first}...`);

  const purchase = await client.phoneNumbers.buy(first);
  console.log('Purchased:', purchase);

  // Look up carrier info for a number
  // const lookup = await client.phoneNumbers.lookup.get('+14155551234');
  // console.log('Lookup:', lookup);
}

main().catch(console.error);
