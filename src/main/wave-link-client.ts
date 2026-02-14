import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import type { WaveLinkInput, InputMuteChangedEvent } from '../shared/types';

const WAVE_LINK_URL = 'ws://127.0.0.1:1824';
const RECONNECT_DELAY = 5000;
const RPC_TIMEOUT = 10000;

interface PendingCall {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class WaveLinkClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private rpcId = 0;
  private pendingCalls = new Map<number, PendingCall>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private micIdentifier: string | null = null;
  private micHardwareIds = new Set<string>();
  private destroyed = false;

  connect(): void {
    if (this.destroyed) return;
    this.cleanup();

    console.log('[WaveLink] Connecting to', WAVE_LINK_URL);
    const ws = new WebSocket(WAVE_LINK_URL);

    ws.on('open', () => {
      console.log('[WaveLink] Connected');
      this.onConnected();
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        // Log all non-RPC-response messages (server-push events)
        if (msg.method) {
          console.log('[WaveLink] Event:', msg.method, JSON.stringify(msg.params, null, 2));
        }
        this.handleMessage(msg);
      } catch (e) {
        console.error('[WaveLink] Failed to parse message:', e);
      }
    });

    ws.on('close', () => {
      console.log('[WaveLink] Disconnected');
      this.onDisconnected();
    });

    ws.on('error', (err: Error) => {
      console.error('[WaveLink] WebSocket error:', err.message);
    });

    this.ws = ws;
  }

  destroy(): void {
    this.destroyed = true;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    for (const [id, pending] of this.pendingCalls) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection closed'));
      this.pendingCalls.delete(id);
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    console.log(`[WaveLink] Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY);
  }

  private async onConnected(): Promise<void> {
    try {
      const inputs = await this.rpcCall<WaveLinkInput[]>('getInputConfigs');
      console.log('[WaveLink] getInputConfigs response:', JSON.stringify(inputs, null, 2));
      const mic = inputs.find((i) => i.isWaveMicInput && i.isAvailable);

      if (!mic) {
        console.warn('[WaveLink] No available hardware mic found');
        this.micIdentifier = null;
        this.emit('connected', null);
        return;
      }

      this.micIdentifier = mic.identifier;
      this.micHardwareIds.clear();
      if (mic.inputs) {
        for (const sub of mic.inputs) {
          this.micHardwareIds.add(sub.identifier);
        }
      }
      const isMuted = mic.localMixer[0];
      console.log(`[WaveLink] Found mic: "${mic.name}" (muted: ${isMuted}, hw ids: ${[...this.micHardwareIds]})`);
      this.emit('connected', mic.name);
      this.emit('mute-changed', isMuted);
    } catch (e) {
      console.error('[WaveLink] Failed to get input configs:', e);
    }
  }

  private onDisconnected(): void {
    this.micIdentifier = null;
    this.emit('disconnected');
    this.scheduleReconnect();
  }

  private handleMessage(msg: { id?: number; method?: string; result?: unknown; error?: unknown; params?: unknown }): void {
    // RPC response
    if (msg.id !== undefined && this.pendingCalls.has(msg.id)) {
      const pending = this.pendingCalls.get(msg.id)!;
      this.pendingCalls.delete(msg.id);
      clearTimeout(pending.timer);
      if (msg.error) {
        pending.reject(new Error(JSON.stringify(msg.error)));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    // Server-push events (JSON-RPC notifications — no id)
    if (msg.method === 'microphoneConfigChanged' && msg.params) {
      const event = msg.params as { identifier: string; property: string; value: boolean };
      if (event.property === 'Microphone Mute' && this.micHardwareIds.has(event.identifier)) {
        console.log(`[WaveLink] Hardware mute changed: ${event.value}`);
        this.emit('mute-changed', event.value);
      }
    } else if (msg.method === 'inputMuteChanged' && msg.params) {
      const event = msg.params as InputMuteChangedEvent;
      if (event.identifier === this.micIdentifier && event.mixerID === 'com.elgato.mix.local') {
        console.log(`[WaveLink] Mixer mute changed: ${event.value}`);
        this.emit('mute-changed', event.value);
      }
    } else if (msg.method === 'inputsChanged') {
      console.log('[WaveLink] Inputs changed, re-fetching...');
      this.onConnected();
    }
  }

  private rpcCall<T>(method: string, params?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }

      const id = ++this.rpcId;
      const timer = setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(`RPC call "${method}" timed out`));
      }, RPC_TIMEOUT);

      this.pendingCalls.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer,
      });

      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      this.ws.send(payload);
    });
  }
}
