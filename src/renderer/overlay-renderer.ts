declare global {
  interface Window {
    muteBorder: {
      onMuteStateChanged: (callback: (isMuted: boolean) => void) => void;
    };
  }
}

const overlay = document.getElementById('border-overlay')!;

window.muteBorder.onMuteStateChanged((isMuted) => {
  if (isMuted) {
    overlay.classList.add('muted');
  } else {
    overlay.classList.remove('muted');
  }
});

export {};
