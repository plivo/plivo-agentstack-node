/**
 * MCP Server Integration -- Voice Agent with External Tool Servers
 *
 * Config: stt + llm + tts + mcp_servers
 *
 * Demonstrates connecting MCP (Model Context Protocol) servers to a voice
 * agent. MCP servers provide tools that the LLM can call -- hosted externally.
 *
 * Two MCP server types:
 *   - HTTP: Connect to an MCP server over HTTP (SSE or streamable HTTP)
 *   - Stdio: Spawn an MCP server as a subprocess
 *
 * MCP tools are discovered automatically at session start. Tool calls
 * are handled server-side -- results go directly to the LLM without
 * hitting the customer WebSocket.
 *
 * Run:
 *   npx tsx examples/pipeline-mcp.ts
 */

import { createServer } from 'node:http';
import {
  PlivoAgentClient,
  VoiceApp,
  type AgentSessionStartedEvent,
  type ToolCallEvent,
  type TurnCompletedEvent,
  type TurnMetricsEvent,
  type InterruptionEvent,
  type AgentSessionEndedEvent,
} from '../src/index.js';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';
const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? 'http://localhost:3001/mcp';

const client = new PlivoAgentClient();

// --- Regular tools (alongside MCP tools) ---

const lookupAccountTool = {
  name: 'lookup_account',
  description: 'Look up a customer account by phone number',
  parameters: {
    type: 'object',
    properties: {
      phone: { type: 'string', description: 'Customer phone number' },
    },
    required: ['phone'],
  },
};

// --- Agent setup with MCP servers ---

async function initAgent() {
  const agent = await client.agents.create({
    agentName: 'MCP-Enabled Agent',
    stt: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
      api_key: DEEPGRAM_API_KEY,
    },
    llm: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      api_key: OPENAI_API_KEY,
      system_prompt:
        'You are a helpful support agent. You have access to tools from ' +
        'both the platform and external MCP servers. Use them as needed ' +
        'to help customers.',
      tools: [lookupAccountTool],
    },
    tts: {
      provider: 'elevenlabs',
      voice: 'EXAVITQu4vr4xnSDxMaL',
      model: 'eleven_flash_v2_5',
      api_key: ELEVENLABS_API_KEY,
    },

    // --- MCP Servers ---
    // Tools from these servers are added to the LLM automatically.
    // MCP tool calls are handled server-side (not routed to customer WS).
    mcpServers: [
      // HTTP MCP server -- connect to a running server
      {
        type: 'http',
        url: MCP_SERVER_URL,
        // Optional: filter which tools to expose
        // allowed_tools: ['search_docs', 'create_ticket'],
        // Optional: auth headers
        // headers: { Authorization: 'Bearer sk-...' },
      },

      // Stdio MCP server -- spawned as a subprocess
      // Uncomment to use a local SQLite MCP server:
      // {
      //   type: 'stdio',
      //   command: 'npx',
      //   args: ['-y', '@modelcontextprotocol/server-sqlite', '/tmp/test.db'],
      // },
    ],

    welcomeGreeting:
      "Hello! I'm your support agent with extended tool access. How can I help?",
    websocketUrl: 'ws://localhost:9000/ws',
    speaksFirst: 'agent',
    semanticVad: {
      completed_turn_delay_ms: 250,
      incomplete_turn_delay_ms: 1200,
    },
  });
  console.log(`Agent created: ${agent.agentUuid}`);
}

// --- Event handlers ---

const app = new VoiceApp();

app.onSetup((session, event) => {
  const e = event as AgentSessionStartedEvent;
  console.log(`Session started: ${e.agentSessionId}`);
  session.update({ events: { metrics_events: true } });
});

// Handle regular tool calls (non-MCP).
// MCP tool calls are handled server-side and never reach this handler.
app.onToolCall((session, event) => {
  const e = event as ToolCallEvent;
  console.log(`  Tool call: ${e.name}(${JSON.stringify(e.arguments)})`);

  if (e.name === 'lookup_account') {
    session.sendToolResult(e.id, {
      name: 'Jane Smith',
      account_id: 'ACC-12345',
      status: 'active',
    });
  } else {
    session.sendToolError(e.id, `Unknown tool: ${e.name}`);
  }
});

app.on('turn.metrics', (_session, event) => {
  const m = event as TurnMetricsEvent;
  console.log(
    `  Metrics [turn ${m.turnNumber}]: perceived=${m.userPerceivedMs}ms llm_ttft=${m.llmTtftMs}ms`,
  );
});

app.onTurnCompleted((_session, event) => {
  const e = event as TurnCompletedEvent;
  console.log(`  User:  ${e.userText}`);
  console.log(`  Agent: ${e.agentText}`);
});

app.on('agent.speech_interrupted', (_session, event) => {
  const e = event as InterruptionEvent;
  console.log(`  Interrupted: '${e.interruptedText ?? ''}'`);
});

app.onSessionEnded((_session, event) => {
  const e = event as AgentSessionEndedEvent;
  console.log(`Session ended: ${e.durationSeconds}s, ${e.turnCount} turns`);
});

// --- Start ---

const PORT = 9000;
const server = createServer(app.handleRequest.bind(app));
server.on('upgrade', (req, socket, head) => {
  app.handleUpgrade(req, socket, head);
});

initAgent()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`MCP agent listening on :${PORT}`);
    });
  })
  .catch(console.error);
