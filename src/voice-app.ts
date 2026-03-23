import { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { Session } from './session.js';
import { parseEvent, type Event } from './events.js';

type EventHandler = (session: Session, event: Event) => void | Promise<void>;
type LifecycleHandler = (session: Session) => void | Promise<void>;
type ErrorHandler = (session: Session, event: Event | null, error: unknown) => void;

/**
 * WebSocket server that receives connections from Plivo and routes
 * typed events to registered handlers.
 */
export class VoiceApp {
  private handlers = new Map<string, EventHandler>();
  private catchAll: EventHandler | null = null;
  private onConnectHandler: LifecycleHandler | null = null;
  private onDisconnectHandler: LifecycleHandler | null = null;
  private onHandlerErrorHandler: ErrorHandler | null = null;
  private wss: WebSocketServer;

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
  }

  /** Register a handler for a specific event type. */
  on(eventType: string, handler: EventHandler): void {
    this.handlers.set(eventType, handler);
  }

  /** Register a catch-all handler for every event. */
  onEvent(handler: EventHandler): void {
    this.catchAll = handler;
  }

  /** Register a handler called when a WebSocket connects. */
  onConnect(handler: LifecycleHandler): void {
    this.onConnectHandler = handler;
  }

  /** Register a handler called when a WebSocket disconnects. */
  onDisconnect(handler: LifecycleHandler): void {
    this.onDisconnectHandler = handler;
  }

  /** Register a callback for handler exceptions. */
  onHandlerError(handler: ErrorHandler): void {
    this.onHandlerErrorHandler = handler;
  }

  // Typed convenience methods

  /** Register a handler for session.started events. */
  onSetup(handler: (session: Session, event: Extract<Event, { type: 'session.started' }>) => void | Promise<void>): void {
    this.on('session.started', handler as EventHandler);
  }

  /** Register a handler for tool.called events. */
  onToolCall(handler: (session: Session, event: Extract<Event, { type: 'tool.called' }>) => void | Promise<void>): void {
    this.on('tool.called', handler as EventHandler);
  }

  /** Register a handler for turn.completed events. */
  onTurnCompleted(handler: (session: Session, event: Extract<Event, { type: 'turn.completed' }>) => void | Promise<void>): void {
    this.on('turn.completed', handler as EventHandler);
  }

  /** Register a handler for session.ended events. */
  onSessionEnded(handler: (session: Session, event: Extract<Event, { type: 'session.ended' }>) => void | Promise<void>): void {
    this.on('session.ended', handler as EventHandler);
  }

  /** Register a handler for session.error events. */
  onError(handler: (session: Session, event: Extract<Event, { type: 'session.error' }>) => void | Promise<void>): void {
    this.on('session.error', handler as EventHandler);
  }

  /**
   * Handle an HTTP upgrade request (for use with Express or raw http.Server).
   *
   * Usage:
   *   server.on('upgrade', (req, socket, head) => app.handleUpgrade(req, socket, head));
   */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.handleConnection(ws);
    });
  }

  /**
   * Handle a raw HTTP request by upgrading to WebSocket.
   * Can be used as a standalone HTTP handler.
   */
  handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // If not an upgrade request, reject
    if (req.headers.upgrade?.toLowerCase() !== 'websocket') {
      res.writeHead(426, { 'Content-Type': 'text/plain' });
      res.end('WebSocket upgrade required');
      return;
    }
    // The actual upgrade is handled by the 'upgrade' event on the server
    res.writeHead(400);
    res.end();
  }

  private async handleConnection(ws: WebSocket): Promise<void> {
    const session = new Session(ws);

    // on_connect
    if (this.onConnectHandler) {
      await this.safeCall(() => this.onConnectHandler!(session), session, null);
    }

    ws.on('message', async (data: Buffer | string) => {
      try {
        const raw = typeof data === 'string' ? data : data.toString();
        const rawObj = JSON.parse(raw) as Record<string, unknown>;
        const event = parseEvent(raw);

        const eventType = (rawObj.type as string) || (rawObj.event as string);

        // Set session metadata
        if (eventType === 'session.started') {
          session.agentSessionId = (rawObj.agent_session_id as string) || '';
          session.callUuid = (rawObj.call_id as string) || '';
        }

        if (eventType === 'start') {
          const startData = (rawObj.start as Record<string, unknown>) || {};
          session.streamId =
            (rawObj.streamId as string) ||
            (startData.streamId as string) ||
            '';
          if (!session.callUuid) {
            session.callUuid = (startData.callId as string) || '';
          }
        }

        // Catch-all
        if (this.catchAll) {
          await this.safeCall(() => this.catchAll!(session, event), session, event);
        }

        // Type-specific handler
        const handler = this.handlers.get(eventType);
        if (handler) {
          await this.safeCall(() => handler(session, event), session, event);
        }

        // Break on session end
        if (eventType === 'session.ended' || eventType === 'stop') {
          ws.close();
        }
      } catch (err) {
        // Parse error — log and continue
        console.error('plivo-agent: message parse error:', err);
      }
    });

    ws.on('close', async () => {
      if (this.onDisconnectHandler) {
        await this.safeCall(
          () => this.onDisconnectHandler!(session),
          session,
          null,
        );
      }
    });

    ws.on('error', (err) => {
      console.error('plivo-agent: websocket error:', err);
    });
  }

  private async safeCall(
    fn: () => void | Promise<void>,
    session: Session,
    event: Event | null,
  ): Promise<void> {
    try {
      await fn();
    } catch (err) {
      console.error(
        `plivo-agent: handler error for session ${session.agentSessionId}:`,
        err,
      );
      if (this.onHandlerErrorHandler) {
        try {
          this.onHandlerErrorHandler(session, event, err);
        } catch {
          // Swallow errors in error handler
        }
      }
    }
  }
}
