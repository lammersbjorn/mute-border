import { Tray, Menu, app, nativeImage } from 'electron';
import path from 'node:path';
import type { ConnectionState } from '../shared/types';

function assetPath(name: string): string {
  // In production, assets are in the resources dir next to the asar
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', name);
  }
  return path.join(app.getAppPath(), 'assets', name);
}

export class TrayManager {
  private tray: Tray | null = null;
  private state: ConnectionState = 'disconnected';
  private micName: string | null = null;
  private isMuted = false;

  init(): void {
    const icon = nativeImage.createFromPath(assetPath('tray-icon-disconnected.png'));
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip('Mute Border — Disconnected');
    this.updateMenu();
  }

  setConnected(micName: string | null): void {
    this.state = 'connected';
    this.micName = micName;
    this.updateIcon();
    this.updateMenu();
  }

  setDisconnected(): void {
    this.state = 'disconnected';
    this.micName = null;
    this.isMuted = false;
    this.updateIcon();
    this.updateMenu();
  }

  setMuted(isMuted: boolean): void {
    this.isMuted = isMuted;
    this.updateIcon();
    this.updateMenu();
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  private updateIcon(): void {
    if (!this.tray) return;

    let iconName: string;
    if (this.state === 'disconnected') {
      iconName = 'tray-icon-disconnected.png';
    } else if (this.isMuted) {
      iconName = 'tray-icon-muted.png';
    } else {
      iconName = 'tray-icon-unmuted.png';
    }

    const icon = nativeImage.createFromPath(assetPath(iconName));
    this.tray.setImage(icon.resize({ width: 16, height: 16 }));

    const tooltip = this.state === 'disconnected'
      ? 'Mute Border — Disconnected'
      : `Mute Border — ${this.micName ?? 'Unknown mic'} (${this.isMuted ? 'Muted' : 'Unmuted'})`;
    this.tray.setToolTip(tooltip);
  }

  private updateMenu(): void {
    if (!this.tray) return;

    let statusLabel: string;
    if (this.state === 'disconnected') {
      statusLabel = 'Wave Link: Disconnected';
    } else {
      statusLabel = `${this.micName ?? 'Unknown mic'}: ${this.isMuted ? 'Muted' : 'Unmuted'}`;
    }

    const menu = Menu.buildFromTemplate([
      { label: statusLabel, enabled: false },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);

    this.tray.setContextMenu(menu);
  }
}
