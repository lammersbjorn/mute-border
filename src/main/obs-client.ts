import { EventEmitter } from 'node:events';
import { OBSWebSocket } from 'obs-websocket-js';
import type { OBSInput, OBSInputMuteStateChangedEvent, OBSConfig } from '../shared/types';

const RECONNECT_DELAY_MS = 5000;

const AUDIO_INPUT_KINDS = new Set([
  'wasapi_input_capture',
  'coreaudio_input_capture',
  'pulse_input_capture',
  'alsa_input_capture',
  'jack_input_capture',
  'oss_input_capture',
]);

export class OBSClient extends EventEmitter {
  private obs: OBSWebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private connected = false;
  private readonly config: OBSConfig;
  private currentInput: string | null = null;

  constructor(config: OBSConfig) {
    super();
    this.config = config;
  }

  connect(): void {
    if (this.destroyed) return;
    this.cleanup();

    const url = `ws://${this.config.host}:${this.config.port}`;
    console.log(`[OBS] Connecting to ${url}`);

    this.connected = true;
    this.obs = new OBSWebSocket();

    this.obs.on('ConnectionOpened', () => {
      console.log('[OBS] WebSocket connected');
    });

    this.obs.on('ConnectionClosed', () => {
      console.log('[OBS] Disconnected');
      this.handleDisconnect();
    });

    this.obs.on('ConnectionError', (error: Error) => {
      console.error('[OBS] Connection error:', error.message);
    });

    this.obs.on('InputMuteStateChanged', (data: OBSInputMuteStateChangedEvent) => {
      if (data.inputName === this.currentInput) {
        console.log(`[OBS] Mute state: ${data.inputMuted}`);
        this.emit('mute-changed', data.inputMuted);
      }
    });

    this.obs.connect(url, this.config.password)
      .then(() => this.onConnected())
      .catch((error: Error) => {
        console.error('[OBS] Connection failed:', error.message);
        this.handleDisconnect();
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
    if (this.obs) {
      this.obs.disconnect();
      this.obs.removeAllListeners();
      this.obs = null;
    }
    this.currentInput = null;
  }

  private handleDisconnect(): void {
    if (!this.connected) return;
    this.connected = false;
    this.cleanup();
    this.emit('disconnected');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    console.log(`[OBS] Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
  }

  private async onConnected(): Promise<void> {
    if (!this.obs) return;

    try {
      const { inputs } = await this.obs.call('GetInputList') as { inputs: OBSInput[] };
      const audioInputs = inputs.filter(i => AUDIO_INPUT_KINDS.has(i.unversionedInputKind));

      if (audioInputs.length === 0) {
        console.warn('[OBS] No audio inputs found');
        this.emit('connected', null);
        return;
      }

      const targetInput = this.selectInput(audioInputs);
      this.currentInput = targetInput.inputName;
      console.log(`[OBS] Watching: "${this.currentInput}"`);

      const { inputMuted } = await this.obs.call('GetInputMute', { inputName: this.currentInput });
      console.log(`[OBS] Current state: ${inputMuted ? 'muted' : 'unmuted'}`);

      this.emit('connected', this.currentInput);
      this.emit('mute-changed', inputMuted);
    } catch (error) {
      console.error('[OBS] Failed to query inputs:', error);
      this.emit('connected', null);
    }
  }

  private selectInput(inputs: OBSInput[]): OBSInput {
    if (this.config.inputName) {
      const found = inputs.find(i => i.inputName === this.config.inputName);
      if (found) {
        return found;
      }
      console.warn(`[OBS] Configured input "${this.config.inputName}" not found, auto-detecting`);
    }

    const micLike = inputs.find(i => 
      i.inputName.toLowerCase().includes('mic') ||
      i.inputName.toLowerCase().includes('aux')
    );
    
    return micLike ?? inputs[0];
  }
}
