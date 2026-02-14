import { BrowserWindow, screen, Display } from 'electron';
import path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

export class OverlayManager {
  private overlays = new Map<number, BrowserWindow>();

  init(): void {
    for (const display of screen.getAllDisplays()) {
      this.createOverlay(display);
    }

    screen.on('display-added', (_event, display) => {
      this.createOverlay(display);
    });

    screen.on('display-removed', (_event, display) => {
      this.destroyOverlay(display.id);
    });

    screen.on('display-metrics-changed', (_event, display) => {
      const win = this.overlays.get(display.id);
      if (win && !win.isDestroyed()) {
        const { x, y, width, height } = display.bounds;
        win.setBounds({ x, y, width, height });
      }
    });
  }

  sendMuteState(isMuted: boolean): void {
    for (const [, win] of this.overlays) {
      if (!win.isDestroyed()) {
        win.webContents.send('mute-state-changed', isMuted);
      }
    }
  }

  destroy(): void {
    for (const [id] of this.overlays) {
      this.destroyOverlay(id);
    }
  }

  private createOverlay(display: Display): void {
    const { x, y, width, height } = display.bounds;

    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      roundedCorners: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.setAlwaysOnTop(true, 'screen-saver');
    win.setIgnoreMouseEvents(true);
    win.setVisibleOnAllWorkspaces(true);

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }

    win.showInactive();

    this.overlays.set(display.id, win);
  }

  private destroyOverlay(displayId: number): void {
    const win = this.overlays.get(displayId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    this.overlays.delete(displayId);
  }
}
