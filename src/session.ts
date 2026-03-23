import type WebSocket from 'ws';

/**
 * Per-connection session handle passed to every event handler.
 * All methods enqueue messages for async sending.
 */
export class Session {
  callUuid: string = '';
  agentSessionId: string = '';
  streamId: string = '';
  data: Record<string, unknown> = {};

  private ws: WebSocket;
  private queue: string[] = [];
  private draining = false;

  /** @internal */
  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  private enqueue(msg: Record<string, unknown>): void {
    this.queue.push(JSON.stringify(msg));
    this.drain();
  }

  private drain(): void {
    if (this.draining) return;
    this.draining = true;
    queueMicrotask(() => {
      while (this.queue.length > 0) {
        const msg = this.queue.shift()!;
        try {
          this.ws.send(msg);
        } catch {
          // Connection may be closed
        }
      }
      this.draining = false;
    });
  }

  // --- Managed mode (pipeline) ---

  /** Send a tool.result response. */
  sendToolResult(toolCallId: string, result: unknown): void {
    this.enqueue({ type: 'tool.result', id: toolCallId, result });
  }

  /** Send a tool.error response. */
  sendToolError(toolCallId: string, error: string): void {
    this.enqueue({ type: 'tool.error', id: toolCallId, error });
  }

  // --- Text mode (BYOLLM) ---

  /** Stream an LLM token to the platform for TTS. */
  sendText(token: string, last: boolean = false): void {
    this.enqueue({ type: 'text', token, last });
  }

  /** Extend the idle timeout. */
  extendWait(): void {
    this.enqueue({ type: 'agent_session.extend_wait' });
  }

  /** Send an arbitrary JSON message. */
  sendRaw(msg: Record<string, unknown>): void {
    this.enqueue(msg);
  }

  // --- Audio mode (Plivo audio streaming protocol) ---

  /** Send audio data to the caller. */
  sendMedia(
    payloadB64: string,
    contentType: string = 'audio/x-mulaw',
    sampleRate: number = 8000,
  ): void {
    this.enqueue({
      event: 'playAudio',
      media: { contentType, sampleRate, payload: payloadB64 },
    });
  }

  /** Mark a playback position in the audio queue. */
  sendCheckpoint(name: string): void {
    this.enqueue({
      event: 'checkpoint',
      streamId: this.streamId,
      name,
    });
  }

  /** Clear all queued audio on the Plivo side. */
  clearAudio(): void {
    this.enqueue({
      event: 'clearAudio',
      streamId: this.streamId,
    });
  }

  // --- Session control (all modes) ---

  /** Update session config mid-call. */
  update(config: Record<string, unknown>): void {
    this.enqueue({ type: 'agent_session.update', ...config });
  }

  /** Inject context into the LLM conversation. */
  inject(content: string): void {
    this.enqueue({ type: 'agent_session.inject', content });
  }

  /** Hand off to a different agent persona mid-call. */
  handoff(
    systemPrompt: string,
    tools?: Record<string, unknown>[],
    llm?: Record<string, unknown>,
    summary?: string,
  ): void {
    const config: Record<string, unknown> = { system_prompt: systemPrompt };
    if (tools !== undefined) {
      config.tools = tools;
    }
    if (llm !== undefined) {
      config.llm = llm;
    }
    this.update(config);
    if (summary) {
      this.inject(summary);
    }
  }

  /** Speak text to the caller via TTS. */
  speak(text: string): void {
    this.enqueue({ type: 'agent_session.speak', text });
  }

  /** Play base64-encoded audio data. */
  play(audioDataB64: string, allowInterruption: boolean = true): void {
    const msg: Record<string, unknown> = {
      type: 'agent_session.play',
      audio_data: audioDataB64,
    };
    if (!allowInterruption) {
      msg.allow_interruption = false;
    }
    this.enqueue(msg);
  }

  /** Transfer the call to one or more destinations. */
  transfer(
    destination: string | string[],
    dialMode: string = 'parallel',
    timeout: number = 30,
    callerId?: string,
  ): void {
    const dest = Array.isArray(destination) ? destination : [destination];
    const msg: Record<string, unknown> = {
      type: 'agent_session.transfer',
      destination: dest,
      dial_mode: dialMode,
      timeout,
    };
    if (callerId) {
      msg.caller_id = callerId;
    }
    this.enqueue(msg);
  }

  /** Send DTMF digits to the call (e.g., for IVR navigation). */
  sendDtmf(digits: string): void {
    this.enqueue({ type: 'agent_session.send_dtmf', digits });
  }

  /** End the call. */
  hangup(): void {
    this.enqueue({ type: 'agent_session.hangup' });
  }

  // --- Background audio ---

  /** Play or switch background audio. */
  playBackground(
    sound: string,
    volume: number = 0.5,
    loop: boolean = true,
  ): void {
    this.enqueue({ type: 'audio.mix', sound, volume, loop });
  }

  /** Stop background audio mixing. */
  stopBackground(): void {
    this.enqueue({ type: 'audio.mix_enable', enabled: false });
  }
}
