import { createServer } from 'node:http';
import { VoiceApp } from '../src/index.js';
import type { ToolCallEvent, AgentSessionStartedEvent, AgentSessionEndedEvent, ErrorEventData } from '../src/index.js';

const app = new VoiceApp();

// Handle session start
app.onSetup((session, event: AgentSessionStartedEvent) => {
  console.log(`Session started: ${event.agentSessionId} (call: ${event.callId})`);
});

// Handle tool calls from the LLM
app.onToolCall((session, event: ToolCallEvent) => {
  console.log(`Tool call: ${event.name}(${JSON.stringify(event.arguments)})`);

  switch (event.name) {
    case 'get_weather': {
      const city = event.arguments.city as string;
      session.sendToolResult(event.id, {
        temperature: 72,
        condition: 'sunny',
        city,
      });
      break;
    }
    default:
      session.sendToolError(event.id, `unknown tool: ${event.name}`);
  }
});

// Handle session end
app.onSessionEnded((session, event: AgentSessionEndedEvent) => {
  console.log(
    `Session ended: ${session.agentSessionId} (duration: ${event.durationSeconds}s, turns: ${event.turnCount})`,
  );
});

// Handle errors
app.onError((session, event: ErrorEventData) => {
  console.log(`Error: [${event.code}] ${event.message}`);
});

// Start the WebSocket server
const server = createServer();
server.on('upgrade', (req, socket, head) => {
  app.handleUpgrade(req, socket, head);
});

server.listen(9000, () => {
  console.log('VoiceApp listening on ws://0.0.0.0:9000');
});
