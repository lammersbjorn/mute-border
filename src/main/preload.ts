import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('muteBorder', {
  onMuteStateChanged: (callback: (isMuted: boolean) => void) => {
    ipcRenderer.on('mute-state-changed', (_event, isMuted: boolean) => {
      callback(isMuted);
    });
  },
  platform: process.platform,
});
