import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import type { WaveLinkInput, InputMuteChangedEvent } from '../shared/types';

const WAVE_LINK_URL = 'ws://127.0.0.1:1824';
const RECONNECT_DELAY_MS = 5000;
const RPC_TIMEOUT_MS = 10000;

interface PendingCall {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface RPCResponse {
  id?: number;
  method?: string;
  result?: unknown;
  error?: unknown;
  params?: unknown;
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

    console.log(`[WaveLink] Connecting to ${WAVE_LINK_URL}`);
    this.ws = new WebSocket(WAVE_LINK_URL);

    this.ws.on('open', () => {
      console.log('[WaveLink] Connected');
      this.onConnected();
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        this.handleMessage(JSON.parse(data.toString()));
      } catch (error) {
        console.error('[WaveLink] Parse error:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('[WaveLink] Disconnected');
      this.handleDisconnect();
    });

    this.ws.on('error', (error: Error) => {
      console.error('[WaveLink] Error:', error.message);
    });
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

    this.pendingCalls.forEach(pending => {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection closed'));
    });
    this.pendingCalls.clear();

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.micIdentifier = null;
    this.micHardwareIds.clear();
  }

  private handleDisconnect(): void {
    this.micIdentifier = null;
    this.micHardwareIds.clear();
    this.emit('disconnected');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    console.log(`[WaveLink] Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
  }

  private async onConnected(): Promise<void> {
    try {
      const inputs = await this.rpcCall<WaveLinkInput[]>('getInputConfigs');
      const mic = inputs.find(i => i.isWaveMicInput && i.isAvailable);

      if (!mic) {
        console.warn('[WaveLink] No hardware mic found');
        this.emit('connected', null);
        return;
      }

      this.micIdentifier = mic.identifier;
      this.micHardwareIds.clear();
      mic.inputs?.forEach(sub => this.micHardwareIds.add(sub.identifier));

      const isMuted = mic.localMixer[0];
      console.log(`[WaveLink] Mic: "${mic.name}" (${isMuted ? 'muted' : 'unmuted'})`);

      this.emit('connected', mic.name);
      this.emit('mute-changed', isMuted);
    } catch (error) {
      console.error('[WaveLink] Failed to get inputs:', error);
      this.emit('connected', null);
    }
  }

  private handleMessage(msg: RPCResponse): void {
    if (msg.id !== undefined) {
      this.handleRPCResponse(msg);
      return;
    }

    if (msg.method && msg.params) {
      this.handleServerEvent(msg.method, msg.params);
    }
  }

  private handleRPCResponse(msg: RPCResponse): void {
    if (msg.id === undefined) return;
    
    const pending = this.pendingCalls.get(msg.id);
    if (!pending) return;

    this.pendingCalls.delete(msg.id);
    clearTimeout(pending.timer);

    if (msg.error) {
      pending.reject(new Error(JSON.stringify(msg.error)));
    } else {
      pending.resolve(msg.result);
    }
  }

  private handleServerEvent(method: string, params: unknown): void {
    switch (method) {
      case 'microphoneConfigChanged': {
        const event = params as { identifier: string; property: string; value: boolean };
        if (event.property === 'Microphone Mute' && this.micHardwareIds.has(event.identifier)) {
          console.log(`[WaveLink] Hardware mute: ${event.value}`);
          this.emit('mute-changed', event.value);
        }
        break;
      }
      case 'inputMuteChanged': {
        const event = params as InputMuteChangedEvent;
        if (event.identifier === this.micIdentifier && event.mixerID === 'com.elgato.mix.local') {
          console.log(`[WaveLink] Mixer mute: ${event.value}`);
          this.emit('mute-changed', event.value);
        }
        break;
      }
      case 'inputsChanged':
        console.log('[WaveLink] Inputs changed');
        this.onConnected();
        break;
    }
  }

  private rpcCall<T>(method: string, params?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const id = ++this.rpcId;
      const timer = setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(`RPC "${method}" timed out`));
      }, RPC_TIMEOUT_MS);

      this.pendingCalls.set(id, { resolve: resolve as (result: unknown) => void, reject, timer });

      this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }
}
