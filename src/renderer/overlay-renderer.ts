declare global {
  interface Window {
    muteBorder: {
      onMuteStateChanged: (callback: (isMuted: boolean) => void) => void;
      platform: string;
    };
  }
}

const overlay = document.getElementById('border-overlay');
const badge = document.getElementById('muted-badge');

if (overlay && badge) {
  if (window.muteBorder.platform === 'darwin') {
    overlay.classList.add('rounded-corners');
  }

  window.muteBorder.onMuteStateChanged((isMuted) => {
    if (isMuted) {
      overlay.classList.add('muted');
      badge.classList.add('visible');
    } else {
      overlay.classList.remove('muted');
      badge.classList.remove('visible');
    }
  });
} else {
  console.error('[Renderer] Elements not found');
}

export {};
