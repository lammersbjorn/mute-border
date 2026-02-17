import { EventEmitter } from 'node:events';
import type { SourceKey, SourceState, MuteSource } from '../shared/types';

export class MuteAggregator extends EventEmitter {
  private sources: MuteSource = {
    waveLink: { type: 'disabled' },
    obs: { type: 'disabled' },
  };
  private lastEmittedState: boolean | null = null;

  setSourceState(source: SourceKey, state: SourceState): void {
    this.sources[source] = state;
    this.emitMuteStateIfNeeded();
  }

  getSources(): MuteSource {
    return structuredClone(this.sources);
  }

  isMuted(): boolean {
    return this.computeMuteState();
  }

  private emitMuteStateIfNeeded(): void {
    const isMuted = this.computeMuteState();
    if (isMuted !== this.lastEmittedState) {
      this.lastEmittedState = isMuted;
      this.emit('mute-changed', isMuted);
    }
  }

  private computeMuteState(): boolean {
    const sources = Object.values(this.sources);
    const connectedSources = sources.filter(s => s.type === 'connected');

    if (connectedSources.length === 0) {
      return false;
    }

    return connectedSources.some(s => s.muted);
  }
}
