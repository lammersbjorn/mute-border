export type MixerState = [boolean, number, boolean, ...boolean[]];

export type MixerID = 'com.elgato.mix.local' | 'com.elgato.mix.stream';

export interface WaveLinkSubInput {
  identifier: string;
  inputType: number;
}

export interface WaveLinkInput {
  identifier: string;
  name: string;
  inputType: number;
  isAvailable: boolean;
  isWaveMicInput?: boolean;
  inputs?: WaveLinkSubInput[];
  localMixer: MixerState;
  streamMixer: MixerState;
}

export interface InputMuteChangedEvent {
  identifier: string;
  mixerID: MixerID;
  value: boolean;
}

export interface InputsChangedEvent {
  inputs: WaveLinkInput[];
}

export type SourceKey = 'waveLink' | 'obs';

export interface OBSConfig {
  enabled: boolean;
  host: string;
  port: number;
  password: string;
  inputName: string | null;
}

export interface WaveLinkConfig {
  enabled: boolean;
}

export interface Config {
  obs: OBSConfig;
  waveLink: WaveLinkConfig;
}

export interface OBSInput {
  inputName: string;
  inputUuid: string;
  inputKind: string;
  unversionedInputKind: string;
}

export interface OBSInputMuteStateChangedEvent {
  inputName: string;
  inputMuted: boolean;
}

export type SourceState = 
  | { type: 'connected'; name: string | null; muted: boolean }
  | { type: 'disconnected' }
  | { type: 'disabled' };

export interface MuteSource {
  waveLink: SourceState;
  obs: SourceState;
}

export type MuteSourceClient = {
  on(event: 'connected' | 'disconnected' | 'mute-changed', handler: (data: unknown) => void): void;
  connect(): void;
  destroy(): void;
};
