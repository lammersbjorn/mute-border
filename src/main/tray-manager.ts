import { Tray, Menu, app, nativeImage } from 'electron';
import path from 'node:path';
import type { MuteSource, SourceState } from '../shared/types';

function assetPath(name: string): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', name)
    : path.join(app.getAppPath(), 'assets', name);
}

function createTrayIcon(iconName: string): nativeImage {
  const isMac = process.platform === 'darwin';

  if (isMac) {
    const templateName = iconName.replace('.png', 'Template.png');
    const templatePath = assetPath(templateName);
    const templateIcon = nativeImage.createFromPath(templatePath);
    if (!templateIcon.isEmpty()) {
      return templateIcon;
    }
    console.warn(
      `[TrayManager] macOS template tray icon not found or empty, falling back to standard icon: ${templatePath}`,
    );
  }

  return nativeImage.createFromPath(assetPath(iconName)).resize({ width: 16, height: 16 });
}

function formatSourceStatus(label: string, state: SourceState): string {
  switch (state.type) {
    case 'disabled':
      return `${label}: Disabled`;
    case 'disconnected':
      return `${label}: Disconnected`;
    case 'connected': {
      const status = state.muted ? 'Muted' : 'Unmuted';
      return `${label}: ${state.name ?? 'Unknown'} (${status})`;
    }
  }
}

export class TrayManager {
  private tray: Tray | null = null;
  private sources: MuteSource = {
    waveLink: { type: 'disabled' },
    obs: { type: 'disabled' },
  };

  init(): void {
    const icon = createTrayIcon('tray-icon-disconnected.png');
    this.tray = new Tray(icon);
    this.tray.setToolTip('Mute Border');
    this.updateMenu();
  }

  updateSourceState(sources: MuteSource): void {
    this.sources = sources;
    this.updateIcon();
    this.updateMenu();
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private getSourceCounts(): { connected: number; muted: number } {
    const values = Object.values(this.sources);
    const connected = values.filter(s => s.type === 'connected');
    return {
      connected: connected.length,
      muted: connected.filter(s => s.muted).length,
    };
  }

  private updateIcon(): void {
    if (!this.tray) return;

    const { connected, muted } = this.getSourceCounts();

    const iconName = connected === 0
      ? 'tray-icon-disconnected.png'
      : muted > 0
        ? 'tray-icon-muted.png'
        : 'tray-icon-unmuted.png';

    this.tray.setImage(createTrayIcon(iconName));

    const tooltip = connected === 0
      ? 'Mute Border — Disconnected'
      : muted > 0
        ? `Mute Border — Muted (${muted}/${connected})`
        : 'Mute Border — Unmuted';

    this.tray.setToolTip(tooltip);
  }

  private updateMenu(): void {
    if (!this.tray) return;

    const menu = Menu.buildFromTemplate([
      { label: formatSourceStatus('Wave Link', this.sources.waveLink), enabled: false },
      { label: formatSourceStatus('OBS', this.sources.obs), enabled: false },
      { type: 'separator' },
      {
        label: 'Launch at Login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);

    this.tray.setContextMenu(menu);
  }
}
