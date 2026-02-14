// Tuple: [isMuted, volume, fxBypassed]
export type MixerState = [boolean, number, boolean];

export type MixerID = 'com.elgato.mix.local' | 'com.elgato.mix.stream';

export interface WaveLinkInput {
  identifier: string;
  name: string;
  inputType: number; // 1 = hardware mic, 2 = virtual input
  isAvailable: boolean;
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

export type ConnectionState = 'connected' | 'disconnected' | 'connecting';
