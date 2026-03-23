import { PlivoAgentClient } from '../src/index.js';

async function main() {
  // Create a REST client
  const client = new PlivoAgentClient('YOUR_AUTH_ID', 'YOUR_AUTH_TOKEN');

  // Create an agent
  const agent = await client.agents.create({
    agentName: 'Outbound Sales Agent',
    websocketUrl: 'wss://your-server.com/ws',
  });
  console.log(`Created agent: ${agent.agentUuid}`);

  // Initiate an outbound call
  const call = await client.calls.initiate({
    agentId: agent.agentUuid,
    from: '+14155551234',
    to: ['+19876543210'],
  });
  console.log(`Call initiated: ${call.callUuid} (status: ${call.status})`);

  // Assign a phone number to the agent
  const num = await client.numbers.assign(agent.agentUuid, '+14155551234');
  console.log(`Number assigned: ${num.number}`);

  // List sessions
  const sessions = await client.sessions.list({
    agentId: agent.agentUuid,
    limit: 10,
  });
  console.log(`Sessions: ${sessions.meta.totalCount} total`);
}

main().catch(console.error);
